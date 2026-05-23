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
const euxPath = _args[0];
if (!euxPath) { console.error('usage: estreux brew <file.eux>   (별칭: expand)'); process.exit(2); }

const raw = readFileSync(euxPath, 'utf8');
const sha = createHash('sha256').update(raw).digest('hex').slice(0, 12);
const baseDir = dirname(resolve(euxPath));

// ---- .eux 파서 (약한 구조 — @directive 섹션) ----
function parseEux(text) {
  const spec = { component: '', intent: '', expansion: {}, targets: [], state: [], behavior: [], render: '', persist: {} };
  let section = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^@(\w+)\s*(.*)$/);
    if (m) {
      const [, key, rest] = m;
      if (key === 'component') spec.component = rest.trim();
      else if (key === 'intent') spec.intent = rest.trim();
      else if (key === 'expansion') rest.trim().split(/\s+/).forEach(kv => { const [k, v] = kv.split('='); spec.expansion[k] = v; });
      else if (key === 'targets') spec.targets = rest.split(',').map(s => s.trim()).filter(Boolean);
      else if (key === 'persist') { rest.trim().split(/\s+/).forEach(kv => { const [k, v] = kv.split('='); spec.persist[k] = v; }); section = null; }
      else section = key; // state / behavior / render
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
for (const id of spec.targets) {
  let body;
  try {
    body = await provider.expand(spec, id, ctx);
  } catch (e) {
    console.error(`✗ expand 실패 [${id}] via ${provider.id}: ${e.message}`);
    process.exit(1);
  }
  const out = resolve(baseDir, 'dist', id, `${spec.component}.js`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, header(id, provider.id) + body);
  written.push({ id, out });
}
const ms = Date.now() - t0;
console.log(`estreux brew — ${spec.component}.eux (sha256:${sha}) · provider=${provider.id}`);
console.log(`  trio: ${trio}`);
for (const w of written) console.log(`  ✓ ${w.id.padEnd(8)} → ${w.out.replace(baseDir + '/', '').replace(baseDir + '\\', '')}`);
console.log(`  ${written.length} targets in ${ms}ms`);
