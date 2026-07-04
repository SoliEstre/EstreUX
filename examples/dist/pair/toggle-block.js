// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : toggle-block.eux  (sha256:e6dd26e11dff)
// │ profile: ui-component
// │ target : pair   provider : agent
// │ trio   : temp=0.2 model=agent/claude template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import './../estreuv/toggle-block.js';

/**
 * toggleBlockPanel — pair 변종: EstreUI(macro) 컨테이너가 estreuv(micro) <toggle-block> 을 호스팅.
 * 원본 스톡 핸들 마크업(.toggle_block + button.toggle + 외부 CSS) 자리를 대체하는 V3 패턴.
 * 원본의 부모 data-content-collapsed 연동은 toggle 이벤트 중계로 재현 — 기존
 * EstreUI CSS 셀렉터(부모 접힘 표현)가 그대로 동작한다.
 *
 * @param {HTMLElement} host   마운트 지점 (원본 .toggle_block 있던 자리)
 * @param {object} [opts]      { label, collapsed, syncParent=true }
 */
export function toggleBlockPanel(host, opts = {}) {
  const el = document.createElement('toggle-block');
  if (opts.label) el.setAttribute('label', opts.label);
  if (opts.collapsed) el.collapsed = true;
  // 원본 계약 재현: 부모 요소에 data-content-collapsed("1"/"0") 중계 (opt-out 가능)
  if (opts.syncParent !== false) {
    el.addEventListener('toggle', (e) => {
      const parent = host.parentElement;
      if (parent && parent.dataset.contentCollapsed != null) {
        parent.setAttribute('data-content-collapsed', e.detail.collapsed ? '1' : '0');
      }
    });
  }
  host.replaceChildren(el);
  return {
    get element() { return el; },
    setCollapsed: (v) => el.setCollapsed(v),
    // EstreUI 페이지 핸들러 콜백에서 호출할 8훅 위임 (duck-typing 계약)
    dispatch(hook) { el[hook]?.(); },
  };
}
