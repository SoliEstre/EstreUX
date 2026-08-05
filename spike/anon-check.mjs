#!/usr/bin/env node
// anon-check.mjs — 공개 repo 익명화 게이트 (2026-08-02)
//
// staged 파일에서 금칙 식별자 패턴을 검사한다. 증류 원본 환경의 식별자(CSS 변수 프리픽스 등)가
// spec/산출물을 타고 공개 repo 에 잔존했던 실사고가 동기다.
//
// 금칙 목록은 커밋되지 않는다 — 공개 repo 에 금칙어 목록을 커밋하면 그 목록이 곧 누출이므로,
// 목록은 repo 루트의 `.anon-blocklist.local`(gitignore) 에 있고 이 검사기는 내용을 모른다.
// 형식: 한 줄에 정규식 하나(대소문자 무시로 컴파일), `#` 시작 줄은 주석.
// 목록 파일이 없는 클론(외부 기여자 등)에서는 warn 후 통과 — 게이트의 주 대상은 원저자 환경이다.
// 단 그 통과는 «검사해서 깨끗함» 이 아니라 «검사를 못 함» 이므로 SKIP 으로 구분해 보고한다.
// 원저자 환경처럼 목록이 반드시 있어야 하는 자리에서는 `--strict` 로 SKIP 을 실패 처리한다 —
// 목록이 지워지거나 경로가 바뀌어 게이트가 무력화된 상태가 «이상 없음» 과 같아 보이는 것을 막는다.
// (근거: 허브 _lessons/006 — 어떤 입력에서도 통과하는 관문도 꺼진 관문)
//
// 출력 규율: 히트한 값 자체를 에코하지 않는다(훅 출력이 로그·CI 에 남는다). 파일·행·패턴 번호만.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const LIST = '.anon-blocklist.local';
const STRICT = process.argv.includes('--strict');

function skip(reason) {
  console.warn(`[anon-check] SKIP — ${reason} (검사를 수행하지 않았습니다)`);
  if (STRICT) {
    console.error('[anon-check] FAIL — --strict: 검사를 수행할 수 없는 상태는 통과로 세지 않습니다.');
    process.exit(1);
  }
  process.exit(0);
}

if (!existsSync(LIST)) {
  skip(`${LIST} 없음 — 원저자 환경이라면 목록을 만들어 두세요(gitignore 대상)`);
}

const patterns = readFileSync(LIST, 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l, i) => { try { return { re: new RegExp(l, 'i'), idx: i + 1 }; } catch { console.warn(`[anon-check] 패턴 #${i + 1} 정규식 오류 — 무시`); return null; } })
  .filter(Boolean);
if (!patterns.length) skip('유효 패턴 0');

let staged = [];
try {
  staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch (e) { console.error('[anon-check] git diff 실패:', e.message); process.exit(1); }

let fail = 0;
for (const f of staged) {
  if (f === LIST) continue;
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }           // 삭제·바이너리 read 실패는 스킵
  if (text.includes('\u0000')) continue;                                 // 바이너리 추정 스킵
  const lines = text.split('\n');
  for (let n = 0; n < lines.length; n++) {
    for (const p of patterns) {
      if (p.re.test(lines[n])) { fail++; console.error(`[anon-check] HIT — ${f}:${n + 1} (패턴 #${p.idx})`); }
    }
  }
}

if (fail) {
  console.error(`\n✗ anon-check — 금칙 식별자 ${fail}건. 값은 에코하지 않았습니다 — ${LIST} 의 해당 패턴 번호로 확인 후 중립화하고 다시 커밋하세요.`);
  process.exit(1);
}
process.exit(0);
