// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : wordchain-story.eux  (sha256:23df81a6cce9)
// │ target : pair   provider : agent/claude
// │ trio   : temp=0.4 model=agent/claude template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import './../estreuv/wordchain-story.js';

/**
 * wordchainStoryPanel — pair 변종: EstreUI(macro) 컨테이너가 estreuv(micro) <wordchain-story>
 * 엘리먼트를 호스팅. 페이지/섹션 레이아웃은 macro 가, 끝말잇기 위젯 동작은 micro 엘리먼트가 담당.
 */
export function wordchainStoryPanel(host) {
  host.innerHTML = `<div class="wc-panel" style="height:100%;display:flex"><wordchain-story style="flex:1;min-height:0"></wordchain-story></div>`;
  const el = host.querySelector('wordchain-story');
  return {
    start: () => el.start(),
    pause: () => el.pause(),
    toggle: () => el.toggle(),
    get state() { return el; },
  };
}
