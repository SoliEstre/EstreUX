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
const euxPath = args.find(a => !a.startsWith('-'));
if (!euxPath) { console.error('usage: drift-check.mjs [--contract] <file.eux>'); process.exit(2); }

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
  const lines = raw.split('\n');
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

  // @ports: cmd NAME( / out NAME(
  const ports = new Set();
  for (const line of buckets.ports) {
    const c = line.match(/^\s*cmd\s+(\w+)\s*\(/);   if (c) ports.add(c[1]);
    const o = line.match(/^\s*out\s+(\w+)\s*\(/);   if (o) ports.add(o[1]);
  }
  // mount 진입점
  const mount = buckets.behavior.some(l => /\bmount\b/.test(l)) || buckets.machine.some(l => /\bmount\b/.test(l));
  // @machine: states: A · B · C  +  dispatch NAME (ports 에 이미 있으면 중복 제외)
  const machine = new Set();
  for (const line of buckets.machine) {
    const st = line.match(/^\s*states\s*:\s*(.+)$/);
    if (st) st[1].split(/[·,]/).forEach(s => { const m = s.match(/[A-Za-z_]\w*/); if (m) machine.add(m[0]); });
    const dp = line.match(/^\s*dispatch[:\s]\s*(\w+)/);   // "dispatch feed" · "dispatch: tick" 양형
    if (dp && !ports.has(dp[1])) machine.add(dp[1]);
  }
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

  return { ports: [...ports], mount, machine: [...machine], vocab: [...vocab] };
}

// ── 메인 루프 ─────────────────────────────────────────────────────
let drift = 0;
console.log(`drift-check — ${comp}.eux (sha256:${sha})${contractMode ? ' [--contract]' : ''}`);

for (const id of targets) {
  const out = resolve(baseDir, 'dist', id, `${comp}.js`);
  if (!existsSync(out)) {
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
}

if (drift) { console.error(`\n${drift} drift — \`npm run expand\` 로 재생성하세요.`); process.exit(1); }
console.log('\n전부 일치 — drift 없음.');
