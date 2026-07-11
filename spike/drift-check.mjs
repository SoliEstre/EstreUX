#!/usr/bin/env node
/**
 * estreux drift-check — .eux ↔ 생성물 일관성 감시
 *
 * Phase A (기본): 각 생성물의 provenance 헤더 sha256 ↔ 현재 .eux sha256 비교.
 *   불일치·누락 → drift (exit 1). pre-commit hook 용.
 *
 * Phase B (--contract): .eux 구조 계약 → 결과물 존재 여부 체크 (카테고리별).
 *   ports   : @ports cmd/out 함수명 — 호스트 인터페이스(강, 반드시).
 *   mount   : 진입점.
 *   machine : @machine states/dispatch — 상태머신(중).
 *   vocab   : v1.1 §2.5 adapter contract 7종의 대괄호 vocabulary(대문자 프로토콜 심볼) — 어휘 잔존(중).
 *   @state 필드 정합은 일반 식별자 false-match 위험으로 P3(AST) 영역 — 얇은 게이트 제외.
 *   provider=agent: sha staleness 는 warn 만 (exit 0 유지), 계약 체크는 수행.
 *   provider=template 등: sha staleness 도 drift (exit 1).
 *
 * usage: drift-check.mjs [--contract] <file.eux>
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const contractMode = args.includes('--contract');
const invariantMode = args.includes('--invariant');   // Phase C: 행동 계약(@invariants) 정적 게이트 (P3c)
const cssMode = args.includes('--css');                // Phase D: css-asset(@source CSS sha + @owns 셀렉터) 게이트 (R3)
const euxPath = args.find(a => !a.startsWith('-'));
if (!euxPath) { console.error('usage: drift-check.mjs [--contract] [--invariant] [--css] <file.eux>'); process.exit(2); }

const raw = readFileSync(euxPath, 'utf8');
const sha = createHash('sha256').update(raw).digest('hex').slice(0, 12);
const baseDir = dirname(resolve(euxPath));

const comp = (raw.match(/^@component\s+(.+)$/m) || [])[1]?.trim();
const targets = ((raw.match(/^@targets\s+(.+)$/m) || [])[1] || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// ── provider 추출 (결과물 head 에서) ──────────────────────────────
function extractProvider(head) {
  return (head.match(/provider\s*:\s*(\w+)/) || [])[1] || null;
}

// ── 구조 계약 추출 (.eux raw → 카테고리별) ──────────────────────────
//   ports   : @ports cmd/out 함수명 (호스트 인터페이스 · 강)
//   mount   : @behavior/@machine 의 mount 진입점 언급
//   machine : @machine states 리터럴 + dispatch 진입점 (상태머신 · 중; ports 중복 제외)
//   @state 필드는 일반 식별자 false-match 위험으로 제외 (P3 AST 영역).
function extractContractNames(raw) {
  const lines = raw.split(/\r?\n/);   // CRLF-safe (p4-check R1 발견과 동형 예방)
  const ADAPTER = new Set(['runtime', 'roles', 'wire', 'routing', 'delivery', 'redaction', 'operation_discipline']);
  const buckets = { ports: [], behavior: [], machine: [], contract: [] };
  let section = null;
  for (const line of lines) {
    if (/^@ports\b/.test(line))    { section = 'ports'; continue; }
    if (/^@machine\b/.test(line))  { section = 'machine'; continue; }
    if (/^@behavior\b/.test(line)) { section = 'behavior'; continue; }
    const dm = line.match(/^@(\w+)\b/);
    if (dm && ADAPTER.has(dm[1]))  { section = 'contract'; continue; }   // v1.1 §2.5 adapter contract 7종
    if (/^@/.test(line))           { section = null; continue; }
    if (section) buckets[section].push(line);
  }

  // @ports: in(props) · cmd(command-in) · out(events-out) 이름 — 괄호/콜론 형태 무관 (G4: ports.in + `cmd x : ()` 콜론형 포함)
  //   ports.in 강검증은 props 주입형(ui-component/protocol-adapter)만 — backend/supervisor 의 in 은 입력 채널 개념(소켓·HTTP)이라 코드 식별자로 안 남음.
  const profileRaw = (raw.match(/^@profile\s+(.+)$/m) || [])[1]?.trim();
  const profile = profileRaw || 'ui-component';
  // G8: @ports 블록 내 명시 `semantics:` 우선 · 없으면 profile-implicit (ui/adapter=code-identifier 강검증 · backend/supervisor=input-channel 면제)
  // G8b: @profile 미지정 + ports.in 보유 → semantics 미결정이라 강검증 보류(false drift 회피) + warn(명시 유도).
  const portsSem = buckets.ports.map(l => (l.match(/^\s*semantics\s*:\s*(code-identifier|input-channel)/) || [])[1]).find(Boolean) || null;
  const strictIn = portsSem ? portsSem === 'code-identifier'
    : !profileRaw ? false
    : (profile === 'ui-component' || profile === 'protocol-adapter');
  const ports = new Set();
  let hadPortsIn = false;
  for (const line of buckets.ports) {
    if (/^\s*semantics\s*:/.test(line)) continue;   // semantics 메타 라인(포트 선언 아님)
    const m = line.match(/^\s*(in|cmd|out)\s+(\w+)/);
    if (m) { if (m[1] === 'in') hadPortsIn = true; if (!(m[1] === 'in' && !strictIn)) ports.add(m[2]); }
  }
  // mount 진입점
  const mount = buckets.behavior.some(l => /\bmount\b/.test(l)) || buckets.machine.some(l => /\bmount\b/.test(l));
  // @machine (G2): (a) 인라인 `states: A · B · C` (b) 멀티라인 YAML `states:`→들여쓰기 `STATE:` (c) arrow `event → TARGET` (d) dispatch NAME
  const machine = new Set();
  let inStates = false;
  for (const line of buckets.machine) {
    const stInline = line.match(/^\s*states\s*:\s*(\S.*)$/);
    if (stInline) { stInline[1].split(/[·,]/).forEach(s => { const m = s.match(/[A-Za-z_]\w*/); if (m) machine.add(m[0]); }); inStates = false; continue; }
    if (/^\s*states\s*:\s*$/.test(line)) { inStates = true; continue; }                    // 멀티라인 YAML states 블록 진입
    if (inStates) { const sm = line.match(/^\s+([A-Z][A-Z0-9_]*)\s*:\s*$/); if (sm) machine.add(sm[1]); }   // 들여쓰기 STATENAME:
    const ar = line.match(/→\s*([A-Z][A-Za-z0-9_]*)/);   if (ar) machine.add(ar[1]);        // arrow transition target
    const dp = line.match(/^\s*dispatch[:\s]\s*(\w+)/);   if (dp && !/:\s*$/.test(line)) machine.add(dp[1]);   // "dispatch feed"·"dispatch: tick" — 콜론끝 헤더("dispatch by event:") 제외
  }
  for (const n of [...machine]) if (ports.has(n)) machine.delete(n);   // ports 와 중복 제외
  // 7 directive (adapter contract): 대괄호 리스트의 대문자-시작 프로토콜 심볼만 추출.
  //   [DONE, BLOCKED, AckProcessed] · [DeadlockProbe, …] · applies_to:[Delegate, …]
  //   소문자 envelope 필드(type/id/runId)·산문 대문자(Constellation/MCP)는 제외 → false-match 안전.
  const vocab = new Set();
  for (const line of buckets.contract) {
    const arr = line.match(/\[([^\]]+)\]/);
    if (!arr) continue;
    arr[1].split(',').map(s => s.trim()).forEach(s => {
      if (/^[A-Z][A-Za-z0-9_]{2,}$/.test(s) && !ports.has(s) && !machine.has(s)) vocab.add(s);
    });
  }

  return { ports: [...ports], mount, machine: [...machine], vocab: [...vocab], profileDeferred: !profileRaw && hadPortsIn };
}

// ── 메인 루프 ─────────────────────────────────────────────────────
let drift = 0;
console.log(`drift-check — ${comp}.eux (sha256:${sha})${contractMode ? ' [--contract]' : ''}`);

for (const id of targets) {
  const out = resolve(baseDir, 'dist', id, `${comp}.js`);
  if (!existsSync(out)) {
    if (cssMode) { console.log(`  ~ ${id.padEnd(8)} 로더 미생성 — css-asset 은 R4 로더 brew 후 (--css gate 1/2 는 @source/@owns 로 진행)`); continue; }
    console.log(`  ✗ ${id.padEnd(8)} MISSING — 재생성 필요`);
    drift++;
    continue;
  }
  const head = readFileSync(out, 'utf8');
  const shaM = head.match(/sha256:([0-9a-f]+)/);
  const provider = extractProvider(head);
  const isAgent = provider === 'agent';

  // Phase A: sha staleness
  if (!shaM) {
    console.log(`  ✗ ${id.padEnd(8)} provenance 헤더 없음`);
    drift++;
  } else if (shaM[1] !== sha) {
    if (isAgent) {
      console.warn(`  ⚠ ${id.padEnd(8)} agent provider — byte staleness 감지, 계약 체크 권고 (sha mismatch exit 생략)`);
    } else {
      console.log(`  ✗ ${id.padEnd(8)} DRIFT — 생성물 sha256:${shaM[1]} ≠ 소스 sha256:${sha}`);
      drift++;
    }
  } else {
    console.log(`  ✓ ${id.padEnd(8)} in sync`);
  }

  // Phase B: --contract 구조 계약 체크 (ports 강 · mount · machine 중)
  if (contractMode) {
    const c = extractContractNames(raw);
    if (c.profileDeferred) console.warn(`    ⚠ @profile 미지정 + @ports.in 보유 — ports.in semantics 미결정으로 강검증 보류. @profile 명시 권장(G8b).`);
    const checks = [
      ...c.ports.map(n => ['ports', n]),
      ...(c.mount ? [['mount', 'mount']] : []),
      ...c.machine.map(n => ['machine', n]),
      ...c.vocab.map(n => ['vocab', n]),
    ];
    if (checks.length === 0) {
      console.log(`    contract  (계약 이름 없음 — skip)`);
    } else {
      for (const [cat, name] of checks) {
        if (new RegExp(`\\b${name}\\b`).test(head)) {
          console.log(`    contract  ✓ ${cat.padEnd(7)} ${name}`);
        } else {
          console.log(`    contract  ✗ ${cat.padEnd(7)} ${name} — 결과물에 없음`);
          drift++;
        }
      }
    }
  }

  // Phase C: --invariant 행동 계약 정적 게이트 (P3c) — EG 협의 Q2: 절 존재 + sub-section 일관성 + vocabulary 키워드 잔존.
  //   invariant 는 본질이 행동이라 정적 grep 으로 위반은 못 잡음(P4 dynamic). 정적은 "본질 누락" 만 검출.
  if (invariantMode) {
    let inInv = false, invBlock = '';
    for (const l of raw.split(/\r?\n/)) {   // CRLF-safe (p4-check R1 발견과 동형 예방)
      if (/^@invariants\b/.test(l)) { inInv = true; continue; }
      if (/^@/.test(l)) { inInv = false; continue; }
      if (inInv) invBlock += l + '\n';
    }
    if (!invBlock.trim()) {
      console.log(`    invariant  (@invariants 없음 — P3 격상 대상 아님, skip)`);
    } else {
      const subs = ['state', 'temporal', 'transaction', 'causality'].filter(s => new RegExp(`^\\s*${s}\\s*:`, 'm').test(invBlock));   // causality 별도 sub-section (1st cut dogfooding 정합)
      if (subs.length === 0) { console.log(`    invariant  ✗ sub-section 없음 (state/temporal/transaction ≥1 필요)`); drift++; }
      else console.log(`    invariant  ✓ sub-section: ${subs.join('·')}`);
      const VOCAB = ['bounded', 'ordered', 'monotonic', 'member-of', 'within', 'after', 'at-most-once', 'idempotent', 'expires-after', 'atomic', 'rollback-safe', 'dual-write', 'commit-then', 'persist-before', 'precedes', 'iff', 'implies'];
      const declared = VOCAB.filter(k => invBlock.includes(k));
      if (declared.length === 0) { console.log(`    invariant  ✗ 권장 vocabulary 키워드 없음 (prose 만 — 정적 grep 불가)`); drift++; }
      else {
        const surviving = declared.filter(k => head.includes(k));
        console.log(`    invariant  vocab ${surviving.length}/${declared.length} 잔존: ${surviving.slice(0, 8).join('·')}${surviving.length > 8 ? '…' : ''}`);
        if (surviving.length === 0) { console.log(`    invariant  ✗ 선언 vocabulary 전부 산출물 누락 — 본질 손실(BlockerManifest §13.20-shaped)`); drift++; }
      }
    }
  }
}

// Phase D: --css css-asset 정적 게이트 (R3, RCSS v1.3) — @source 실 CSS sha + @owns 셀렉터 잔존.
//   (로더 ↔ manifest(@trigger/@load) 정합 gate 는 R4 로더 brew 후. 동적 실 로딩 측정은 v-next.)
if (cssMode) {
  const cssProfile = (raw.match(/^@profile\s+(.+)$/m) || [])[1]?.trim();
  if (cssProfile !== 'css-asset') {
    console.log(`  --css  (css-asset profile 아님 — skip)`);
  } else {
    const srcM = raw.match(/^@source\s+(\S+)/m);
    if (!srcM) { console.log(`  css  ✗ @source 없음 (css-asset 필수)`); drift++; }
    else {
      const cssPath = resolve(baseDir, srcM[1]);
      if (!existsSync(cssPath)) { console.log(`  css  ✗ @source ${srcM[1]} — 실 CSS 파일 없음 (dogfood 시 필요)`); drift++; }
      else {
        const css = readFileSync(cssPath, 'utf8');
        const cssSha = createHash('sha256').update(css).digest('hex').slice(0, 12);
        console.log(`  css  ✓ @source ${srcM[1]} (sha256:${cssSha})`);
        const ownsM = raw.match(/^@owns\s+(.+)$/m);
        const owns = ownsM ? ownsM[1].split(/\s+/).filter(Boolean) : [];
        for (const sel of owns) {
          if (css.includes(sel)) console.log(`  css  ✓ owns ${sel} — 실 CSS 잔존`);
          else { console.log(`  css  ✗ owns ${sel} — 실 CSS 에 없음`); drift++; }
        }
        // gate3 (R4): 생성 로더 ↔ manifest(@source/@trigger/@load) 정합 — forward-synth 로딩 코드 검증.
        //   로더는 referencing-only(CSS 바이트 미복제)라, @source 파일명·@trigger 셀렉터·@load 전략이 로더에 살아있어야 정합.
        const triggerSel = (raw.match(/^@trigger\s+handle-first-use\s*:\s*(\S+)/m) || [])[1];   // handle-first-use:<sel> 셀렉터 hook (공백 허용 — 문서 예시 `handle-first-use : .sel` 정합). eager/page/feature/idle 은 셀렉터 hook 아님 → gate3 trigger 체크 skip
        const loadStrat = (raw.match(/^@load\s+(.+)$/m) || [])[1]?.trim();
        const srcFile = srcM[1].replace(/^\.\//, '');
        let loaderFound = false;
        for (const id of targets) {
          const loaderPath = resolve(baseDir, 'dist', id, `${comp}.js`);
          if (!existsSync(loaderPath)) continue;
          loaderFound = true;
          const loader = readFileSync(loaderPath, 'utf8');
          const checks = [
            ['ensureStylesheet 로더 함수', /ensureStylesheet\s*\(/.test(loader)],
            [`@source ${srcFile} 참조`, loader.includes(srcFile)],
            ...(triggerSel ? [[`@trigger ${triggerSel} 참조`, loader.includes(triggerSel)]] : []),
            ...(loadStrat ? [[`@load ${loadStrat} 반영`, loader.includes(loadStrat)]] : []),
          ];
          for (const [label, ok] of checks) {
            if (ok) console.log(`  css  ✓ gate3 ${id} — ${label}`);
            else { console.log(`  css  ✗ gate3 ${id} — ${label} 누락`); drift++; }
          }
        }
        if (!loaderFound) console.log(`  css  (로더 미생성 — gate3 는 R4 로더 brew 후. gate1/2 는 정합)`);
      }
    }
  }
}

if (drift) { console.error(`\n${drift} drift — \`npm run expand\` 로 재생성하세요.`); process.exit(1); }
console.log('\n전부 일치 — drift 없음.');
