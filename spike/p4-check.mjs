#!/usr/bin/env node
/**
 * estreux p4-check — @metamorphic 절 → fast-check property 검증 (P4 dynamic).
 *
 * P3 drift-check(정적: @invariants 키워드 잔존 grep) ↔ p4-check(dynamic: @metamorphic property 실행) 대칭.
 * brew(.eux → stub source 생성) ↔ p4-check(.eux + impl → @metamorphic property 실행) 의 생성/검증 boundary.
 *
 * P4a (현재): @metamorphic 절 추출 + fast-check property 골격 생성(추출 모드, fast-check 불요).
 * P4b: impl anchor 모듈 wiring + fast-check 실행(--run, dev-dep `fast-check` 필요).
 *
 * 결정(EG 협의 2026-06-04): framework=fast-check(dev-dep, 런타임 deps-0 유지) · 별도 runner(생성/검증 분리)
 *   · dogfood=history-store mode chain · property 매핑=반자동(runner 골격 + 수동 anchor).
 *
 * usage: p4-check.mjs [--run] <file.eux>
 *   기본    : @metamorphic 추출 + property 골격 출력.
 *   --run   : `<component>.p4.mjs` anchor(GEN + relation) 로드 + fast-check 실행 (P4b).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const runMode = args.includes('--run');
const euxPath = args.find(a => !a.startsWith('-'));
if (!euxPath) { console.error('usage: p4-check.mjs [--run] <file.eux>'); process.exit(2); }

const raw = readFileSync(euxPath, 'utf8');
const comp = (raw.match(/^@component\s+(.+)$/m) || [])[1]?.trim() || basename(euxPath, '.eux');

// @metamorphic 절 추출 (P3b parseEux FREETEXT 와 동형 — `- <kind>: <desc>` 항목)
let inMeta = false, curKind = null;
const props = [];
for (const l of raw.split('\n')) {
  if (/^@metamorphic\b/.test(l)) { inMeta = true; curKind = null; continue; }
  if (/^@/.test(l)) { inMeta = false; continue; }
  if (!inMeta) continue;
  const km = l.match(/^\s*(round_trip|idempotency|determinism)\s*:\s*$/);   // sub-section 키(@invariants 와 동형 — EG 1st cut 형식)
  if (km) { curKind = km[1]; continue; }
  const im = l.match(/^\s*-\s*(.+)$/);
  if (im) {
    const flat = im[1].match(/^(round_trip|idempotency|determinism)\s*:\s*(.+)$/);   // flat 호환: `- kind: desc`
    if (flat) props.push({ kind: flat[1], desc: flat[2].trim() });
    else if (curKind) props.push({ kind: curKind, desc: im[1].trim() });
  }
}

// 패턴별 fast-check property 골격 (반자동 — GEN/relation 은 P4b 수동 anchor)
const SKELETON = {
  round_trip:  'fc.assert(fc.property(GEN, x => byteEqual(forward(backward(x)), x)))',
  idempotency: 'fc.assert(fc.property(GEN, fc.integer({min:1,max:5}), (x,n) => deepEqual(applyN(f,n,x), f(x))))',
  determinism: 'fc.assert(fc.property(GEN, x => deepEqual(f(x), f(x))))',
};

console.log(`p4-check — ${comp}.eux · @metamorphic ${props.length} property${runMode ? ' [--run]' : ''}`);
if (props.length === 0) { console.log('  (@metamorphic 없음 — P4 대상 아님, skip)'); process.exit(0); }

for (const p of props) {
  console.log(`\n  ▸ ${p.kind}: ${p.desc}`);
  console.log(`    골격: ${SKELETON[p.kind] || 'fc.assert(fc.property(GEN, x => /* custom relation */))'}`);
}

if (!runMode) {
  console.log(`\n  ${props.length} property 골격 — impl wiring + 실행은 \`--run\` (P4b). anchor 파일 = ${comp}.p4.mjs.`);
  process.exit(0);
}

// --run (P4b): anchor 모듈(GEN + relation + fast-check 실행) 로드.
const anchorPath = resolve(dirname(euxPath), `${comp}.p4.mjs`);
if (!existsSync(anchorPath)) {
  console.error(`\n  ✗ --run: anchor 모듈 없음 — ${comp}.p4.mjs (GEN + relation + 'fast-check' import) 필요. P4b dogfood 에서 작성.`);
  process.exit(1);
}
try {
  const anchor = await import(pathToFileURL(anchorPath).href);   // Windows: 절대경로는 file:// URL 필요
  if (typeof anchor.run !== 'function') { console.error(`  ✗ ${comp}.p4.mjs 가 run(props) export 안 함.`); process.exit(1); }
  await anchor.run(props);   // anchor 가 fast-check 로 각 property 실행 + 결과 출력
  console.log('\n  P4 dynamic 검증 완료.');
} catch (e) {
  console.error(`  ✗ p4 실행 실패: ${e.message}`);
  process.exit(1);
}
