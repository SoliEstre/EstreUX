#!/usr/bin/env node
/**
 * estreux — EstreUX CLI (Phase A). brew/expand/drift 서브명령을 spike 엔진에 위임한다.
 *   estreux brew   <file.eux>   .eux → 코드 변종 생성 (정식 명령)
 *   estreux expand <file.eux>   brew 의 호환 별칭
 *   estreux drift  <file.eux>   .eux ↔ 산출물(dist/*) 일관성 검사
 *
 * Phase A 의 brew 는 결정적 template PoC(spike/expand.mjs)에 위임한다.
 * LLM 기반 brew(provider=agent/openai/ollama/…)는 같은 .eux 계약 위에서 Phase B 에 교체된다.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [cmd, ...rest] = process.argv.slice(2);

// brew = expand(.eux→코드), drift = 일관성 검사. brew/expand 는 같은 엔진(별칭).
const MAP = { brew: 'spike/expand.mjs', expand: 'spike/expand.mjs', drift: 'spike/drift-check.mjs' };

function usage() {
  console.log(`estreux — EstreUX CLI (Phase A)

  estreux brew   <file.eux>   .eux → 코드 변종 생성 (expand 별칭)
  estreux expand <file.eux>   brew 와 동일
  estreux drift  <file.eux>   .eux ↔ 산출물 일관성 검사

Phase A brew = 결정적 template PoC(spike/expand.mjs) 위임. LLM brew(agent/openai/…)는 Phase B.`);
}

if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') { usage(); process.exit(cmd ? 0 : 1); }
const script = MAP[cmd];
if (!script) { console.error(`알 수 없는 명령: '${cmd}'\n`); usage(); process.exit(2); }
const r = spawnSync(process.execPath, [resolve(root, script), ...rest], { stdio: 'inherit' });
process.exit(r.status ?? 1);
