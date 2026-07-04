// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : num-keypad.eux  (sha256:71a506d8a93e)
// │ profile: ui-component
// │ target : pair   provider : agent
// │ trio   : temp=0.2 model=agent/claude template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import './../estreuv/num-keypad.js';

/**
 * numKeypadPanel — pair 변종: EstreUI(macro) 컨테이너가 estreuv(micro) <num-keypad> 를 호스팅.
 * 원본 스톡 핸들 자리(.num_keypad + data-for 마크업)를 이 한 줄 호스팅으로 대체하는 V3 패턴.
 * EstreUI 페이지 핸들러가 opts.wire 로 8훅 dispatcher 를 결선하면(UI↔UV 계약 §1.2) 페이지
 * release 시 엘리먼트 onRelease 가 외부 input 리스너를 해제한다.
 *
 * @param {HTMLElement} host   마운트 지점 (예: 원본 .num_keypad 있던 자리)
 * @param {object} [opts]      { for, limitLength, autoDivider, autoDividerPos, preventDirect, withEnter }
 */
export function numKeypadPanel(host, opts = {}) {
  const el = document.createElement('num-keypad');
  if (opts.for) el.setAttribute('for', opts.for);
  if (opts.limitLength) el.setAttribute('limit-length', String(opts.limitLength));
  if (opts.autoDivider) el.setAttribute('auto-divider', opts.autoDivider);
  if (opts.autoDividerPos) el.setAttribute('auto-divider-pos', String(opts.autoDividerPos));
  if (opts.preventDirect) el.setAttribute('prevent-direct', '');
  if (opts.withEnter) el.setAttribute('with-enter', '');
  host.replaceChildren(el);
  return {
    get element() { return el; },
    // EstreUI 페이지 핸들러 콜백에서 호출할 8훅 위임 (duck-typing 계약)
    dispatch(hook) { el[hook]?.(); },
  };
}
