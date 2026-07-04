#!/usr/bin/env node
/**
 * estreux brew — Phase A thin spike PoC expander (정식 명령 `brew`, `expand` 는 호환 별칭).
 *
 * 하나의 `.eux` 자연어 중간 소스 → `@targets` 에 명시된 다중 타깃(estreuv / estreui / pair)
 * 코드로 γ-driven expansion. 각 산출물에 provenance 헤더(source sha + trio)를 박아
 * drift-check 가 .eux ↔ 산출물 일관성을 감시할 수 있게 한다.
 *
 * expansion 엔진은 **provider-무관** 으로 분리됨(`providers/`): trio `model` prefix 로 선택.
 * - template : 결정적 PoC(LLM stand-in, 기본). 구조·provenance·drift·재현성 검증용.
 * - openai-compatible : Ollama·vLLM·LM Studio·OpenAI 공통(/v1/chat/completions). Phase B.
 * 특정 provider 를 기본으로 두지 않는다(품질=프런티어/BYOK, 비용·오프라인=로컬).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { resolveProvider, parseModel } from './providers/index.mjs';

let _args = process.argv.slice(2);
if (_args[0] === 'brew' || _args[0] === 'expand') _args = _args.slice(1);   // 서브명령 별칭 (brew = 정식, expand = 호환)
const skipExisting = _args.includes('--skip-existing');                     // 부분 실패 재시도용: 현 spec sha 와 provenance 일치하는 산출물은 건너뜀
if (skipExisting) _args = _args.filter((a) => a !== '--skip-existing');
const euxPath = _args[0];
if (!euxPath) { console.error('usage: estreux brew <file.eux> [--skip-existing]   (별칭: expand)'); process.exit(2); }

const raw = readFileSync(euxPath, 'utf8');
const sha = createHash('sha256').update(raw).digest('hex').slice(0, 12);
const baseDir = dirname(resolve(euxPath));

// ---- .eux 파서 (약한 구조 — @directive 섹션) ----
function parseEux(text) {
  // v1/v1.1 자유텍스트 directive — §2(machine/source/deps) + §2.5 adapter contract 7종 + §2.6/§2.7 행동계약(invariants/metamorphic, P3 v1.2).
  const FREETEXT_DIRECTIVES = new Set(['machine', 'source', 'deps', 'runtime', 'roles', 'wire', 'routing', 'delivery', 'redaction', 'operation_discipline', 'invariants', 'metamorphic', 'owns', 'trigger', 'load', 'size', 'css-deps', 'tokens']);   // +css-asset v1.3 디렉티브
  const spec = { component: '', profile: '', intent: '', expansion: {}, targets: [], state: [], behavior: [], render: '', styles: '', machine: '', source: '', deps: '', runtime: '', roles: '', wire: '', routing: '', delivery: '', redaction: '', operation_discipline: '', invariants: '', metamorphic: '', owns: '', trigger: '', load: '', size: '', 'css-deps': '', tokens: '', persist: {}, ports: { in: [], cmd: [], out: [], deps: [] } };
  let section = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^@([\w-]+)\s*(.*)$/);   // 하이픈 허용 (@css-deps 등 css-asset v1.3)
    if (m) {
      const [, key, rest] = m;
      if (key === 'component') spec.component = rest.trim();
      else if (key === 'profile') { spec.profile = rest.trim(); section = null; }   // v1: 컴포넌트 프로파일(ui-component/backend-service/protocol-adapter/state-machine/supervisor)
      else if (key === 'intent') spec.intent = rest.trim();
      else if (key === 'expansion') rest.trim().split(/\s+/).forEach(kv => { const [k, v] = kv.split('='); spec.expansion[k] = v; });
      else if (key === 'targets') spec.targets = rest.replace(/\s*#.*$/, '').split(',').map(s => s.trim()).filter(Boolean);  // 인라인 # 주석 strip (콤마 포함 주석이 가짜 타깃으로 분리되는 것 방지)
      else if (key === 'persist') { rest.trim().split(/\s+/).forEach(kv => { const [k, v] = kv.split('='); spec.persist[k] = v; }); section = null; }
      else { section = key; if (rest.trim() && FREETEXT_DIRECTIVES.has(key)) spec[key] = rest.trim(); }   // FREETEXT 한 줄 값(rest, @trigger/@load/@owns 등 css-asset) + 다음 줄 누적 겸용
      continue;
    }
    if (section === 'state') {
      const sm = line.match(/^\s*(\w+)\s*:\s*(\w+)\s*=\s*([^#]+?)\s*(?:#\s*(.*))?$/);
      if (sm) spec.state.push({ name: sm[1], type: sm[2], default: sm[3].trim(), comment: (sm[4] || '').trim() });
    } else if (section === 'behavior') {
      const bm = line.match(/^\s*(\w+)(\([^)]*\))?\s*:\s*(.+)$/);
      if (bm) spec.behavior.push({ name: bm[1], args: (bm[2] || '()').replace(/[()]/g, ''), desc: bm[3].trim() });
    } else if (section === 'render') {
      if (line.trim()) spec.render += (spec.render ? '\n' : '') + line.trim();
    } else if (section === 'styles') {
      // @styles — 디자인 토큰 + 셀렉터별 스타일 힌트(자유 텍스트). brew 가 결정적 CSS 로 emit.
      if (line.trim()) spec.styles += (spec.styles ? '\n' : '') + line.trim();
    } else if (FREETEXT_DIRECTIVES.has(section)) {
      // 자유텍스트 directive 누적 — @machine(상태머신; 복수 블록은 같은 spec.machine 에 반복 누적, EG 권장 2026-06-04) ·
      //   @source(원본추적) · @deps(.eux 의존) · v1.1 adapter contract 7종(@runtime/@roles/@wire/@routing/@delivery/@redaction/@operation_discipline, §2.5).
      if (line.trim()) spec[section] = (spec[section] ? spec[section] + '\n' : '') + line.trim();
    } else if (section === 'ports') {
      // @ports — 격리 컴포넌트의 호스트 계약. 줄 prefix 로 방향 구분:
      //   in   <name> : <type>  # comment        (props-in, 호스트→컴포넌트 정적/반응형 데이터 주입)
      //   cmd  <name>(<args>) : <desc>            (command-in, 호스트가 호출하는 갱신 메서드 — setData·feed 류)
      //   out  <name>(<args>) : <desc>            (events-out, 컴포넌트→호스트 콜백)
      //   deps <name> : <type>  # comment        (주입 의존)
      const dm = line.match(/^\s*(in|cmd|out|deps)\s+(.+)$/);
      if (dm) {
        const dir = dm[1], body = dm[2];
        if (dir === 'out' || dir === 'cmd') {
          // desc 선택 (시그니처-only `out NAME(args)` 허용) + 인라인 # 주석 strip — EG a2a.eux events-out 형태 정합 (2026-06-04 drift-check 발견)
          const om = body.replace(/\s*#.*$/, '').match(/^(\w+)(\([^)]*\))?\s*(?::\s*(.+))?$/);
          if (om) spec.ports[dir].push({ name: om[1], args: (om[2] || '()').replace(/[()]/g, ''), desc: (om[3] || '').trim() });
        } else {
          const im = body.match(/^(\w+)\s*:\s*([^#]+?)\s*(?:#\s*(.*))?$/);
          if (im) spec.ports[dir].push({ name: im[1], type: im[2].trim(), comment: (im[3] || '').trim() });
        }
      }
    }
  }
  return spec;
}

const spec = parseEux(raw);
const trio = `temp=${spec.expansion.temperature} model=${spec.expansion.model} template=${spec.expansion.template}`;

function header(targetId, providerId) {
  return [
    '// ┌─ estreux:expanded ──────────────────────────────────────────────',
    `// │ source : ${spec.component}.eux  (sha256:${sha})`,
    `// │ profile: ${spec.profile || 'ui-component'}`,
    `// │ target : ${targetId}   provider : ${providerId}`,
    `// │ trio   : ${trio}`,
    '// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).',
    '// └─────────────────────────────────────────────────────────────────',
    '',
  ].join('\n');
}

// ---- provider 해소 + expansion 실행 ----
const provider = resolveProvider(spec.expansion.model);
const { provider: modelProvider, name: modelName } = parseModel(spec.expansion.model);
const ctx = { expansion: spec.expansion, sha, modelProvider, modelName };

const t0 = Date.now();
const written = [];
const skipped = [];
for (const id of spec.targets) {
  const out = resolve(baseDir, 'dist', id, `${spec.component}.js`);
  if (skipExisting) {
    // 라이브 LLM 부분 실패 재시도 시 전-타깃 재호출 비효율 해소 (2026-07-03 관찰):
    // 산출물의 provenance sha 가 현 spec sha 와 일치하면 이 타깃은 이미 최신 — 건너뜀.
    try {
      const head = readFileSync(out, 'utf8').slice(0, 400);
      if (head.includes(`sha256:${sha}`)) { skipped.push({ id, out }); continue; }
    } catch {}
  }
  let body;
  try {
    body = await provider.expand(spec, id, ctx);
  } catch (e) {
    console.error(`✗ expand 실패 [${id}] via ${provider.id}: ${e.message}`);
    process.exit(1);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, header(id, provider.id) + body);
  written.push({ id, out });
}
const ms = Date.now() - t0;
console.log(`estreux brew — ${spec.component}.eux (sha256:${sha}) · provider=${provider.id}`);
console.log(`  trio: ${trio}`);
for (const w of written) console.log(`  ✓ ${w.id.padEnd(8)} → ${w.out.replace(baseDir + '/', '').replace(baseDir + '\\', '')}`);
for (const w of skipped) console.log(`  ↷ ${w.id.padEnd(8)} skip (provenance sha 일치 — 최신)`);
console.log(`  ${written.length} targets in ${ms}ms${skipped.length ? ` (+${skipped.length} skipped)` : ''}`);
