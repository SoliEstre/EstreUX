// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : notif-toggle.eux  (sha256:5f22b106a337)
// │ target : pair   provider : template
// │ trio   : temp=0.0 model=template/deterministic-templater@v0 template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import './../estreuv/notif-toggle.js';

/**
 * notif-toggle-panel — pair 변종: EstreUI 컨테이너가 estreuv <notif-toggle> 엘리먼트를 호스팅.
 * macro(EstreUI page/section) ↔ micro(estreuv widget) 페어링 시연.
 */
export function notifTogglePanel(host) {
  host.innerHTML = `<div class="nt-panel"><notif-toggle></notif-toggle></div>`;
  const el = host.querySelector('notif-toggle');
  return {
    bump: (n) => el.bump(n),
    clear: () => el.clear(),
    get enabled() { return el.enabled; },
    get count() { return el.count; },
  };
}
