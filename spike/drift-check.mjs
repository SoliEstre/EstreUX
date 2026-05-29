#!/usr/bin/env node
/**
 * estreux drift-check — .eux ↔ 생성물 일관성 감시
 *
 * Phase A (기본): 각 생성물의 provenance 헤더 sha256 ↔ 현재 .eux sha256 비교.
 *   불일치·누락 → drift (exit 1). pre-commit hook 용.
 *
 * Phase B (--contract): .eux @ports 계약 이름 → 결과물 존재 여부 체크.
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

// ── 계약 이름 추출 (.eux raw 에서) ───────────────────────────────
function extractContractNames(raw) {
  const lines = raw.split('\n');
  const names = new Set();

  // @ports 섹션 수집
  let section = null;
  const sectionLines = { ports: [], behavior: [] };
  for (const line of lines) {
    if (/^@ports\b/.test(line))               { section = 'ports'; continue; }
    if (/^@(?:behavior|machine)\b/.test(line)) { section = 'behavior'; continue; }
    if (/^@/.test(line))                       { section = null; continue; }
    if (section) sectionLines[section].push(line);
  }

  // @ports: cmd NAME( / out NAME(
  for (const line of sectionLines.ports) {
    const c = line.match(/^\s*cmd\s+(\w+)\s*\(/);   if (c) names.add(c[1]);
    const o = line.match(/^\s*out\s+(\w+)\s*\(/);   if (o) names.add(o[1]);
  }
  // @behavior/@machine: mount 언급 시 추가
  if (sectionLines.behavior.some(l => /\bmount\b/.test(l))) names.add('mount');

  return [...names];
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

  // Phase B: --contract 계약 체크
  if (contractMode) {
    const names = extractContractNames(raw);
    if (names.length === 0) {
      console.log(`    contract  (계약 이름 없음 — skip)`);
    } else {
      for (const name of names) {
        if (new RegExp(`\\b${name}\\b`).test(head)) {
          console.log(`    contract  ✓ ${name}`);
        } else {
          console.log(`    contract  ✗ ${name} — 결과물에 없음`);
          drift++;
        }
      }
    }
  }
}

if (drift) { console.error(`\n${drift} drift — \`npm run expand\` 로 재생성하세요.`); process.exit(1); }
console.log('\n전부 일치 — drift 없음.');
