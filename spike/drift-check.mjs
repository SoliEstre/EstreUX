#!/usr/bin/env node
/**
 * estreux drift-check — .eux ↔ 생성물 일관성 감시 (Phase A PoC).
 *
 * 각 생성물의 provenance 헤더에 박힌 source sha 와 현재 .eux 의 sha 를 비교한다.
 * 불일치(= .eux 가 바뀌었는데 재생성 안 됨) 또는 누락이면 drift → exit 1.
 * pre-commit hook 으로 걸면 "spec ↔ 코드" 표류를 커밋 전에 차단.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const euxPath = process.argv[2];
if (!euxPath) { console.error('usage: drift-check.mjs <file.eux>'); process.exit(2); }

const raw = readFileSync(euxPath, 'utf8');
const sha = createHash('sha256').update(raw).digest('hex').slice(0, 12);
const baseDir = dirname(resolve(euxPath));

const comp = (raw.match(/^@component\s+(.+)$/m) || [])[1]?.trim();
const targets = ((raw.match(/^@targets\s+(.+)$/m) || [])[1] || '').split(',').map(s => s.trim()).filter(Boolean);

let drift = 0;
console.log(`drift-check — ${comp}.eux (sha256:${sha})`);
for (const id of targets) {
  const out = resolve(baseDir, 'dist', id, `${comp}.js`);
  if (!existsSync(out)) { console.log(`  ✗ ${id.padEnd(8)} MISSING — 재생성 필요`); drift++; continue; }
  const head = readFileSync(out, 'utf8');
  const m = head.match(/sha256:([0-9a-f]+)/);
  if (!m) { console.log(`  ✗ ${id.padEnd(8)} provenance 헤더 없음`); drift++; }
  else if (m[1] !== sha) { console.log(`  ✗ ${id.padEnd(8)} DRIFT — 생성물 sha256:${m[1]} ≠ 소스 sha256:${sha}`); drift++; }
  else console.log(`  ✓ ${id.padEnd(8)} in sync`);
}
if (drift) { console.error(`\n${drift} drift — \`npm run expand\` 로 재생성하세요.`); process.exit(1); }
console.log('\n전부 일치 — drift 없음.');
