// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : toggle-block.eux  (sha256:e6dd26e11dff)
// │ profile: ui-component
// │ target : estreuv   provider : agent
// │ trio   : temp=0.2 model=agent/claude template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { EstreUVElement } from 'estreuv';
import { html, css } from 'lit';

/**
 * <toggle-block> — estreuv(micro-Rimwork, Lit) 변종.
 * EstreUI 스톡 EstreToggleBlockHandle(estreUi-handles.js:4520-4619)의 UV 재구현 — V3 파일럿 2호.
 * 원본 계약 보존: 호스트에 data-collapsed("1"/"0") 반영(기존 CSS 셀렉터 호환) +
 * 전역 스와이프 가드(data-on-swipe="1" 중 클릭 무시, EstreUI Swipe 공존).
 * 원본이 외부 CSS 에 위임하던 접힘 표현은 slot 기반 셀프 렌더로 흡수.
 */
export class ToggleBlock extends EstreUVElement {
  static properties = {
    collapsed: { type: Boolean, reflect: false },
    label: { type: String },
  };
  static styles = css`
    :host { display: block; }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--tb-gap, 8px); padding: 8px 12px; cursor: pointer; user-select: none;
      background: var(--tb-header-bg, transparent);
    }
    .arrow { transition: transform .2s ease; }
    :host([data-collapsed="1"]) .arrow { transform: rotate(-90deg); }
    .body { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .2s ease; }
    :host([data-collapsed="1"]) .body { grid-template-rows: 0fr; }
    .body > .inner { overflow: hidden; min-height: 0; }
  `;

  constructor() {
    super();
    this.collapsed = false;
    this.label = '';
  }

  // 전역 스와이프 가드 — 원본 isOnSwipe($(window).attr(eds.onSwipe)=="1") 등가.
  // EstreUI Swipe 는 window 바인딩이라 documentElement/body 속성 양쪽을 관용적으로 확인.
  get #onSwipe() {
    return document.documentElement.getAttribute('data-on-swipe') === '1'
      || document.body?.getAttribute('data-on-swipe') === '1';
  }

  #toggle(e) {
    if (this.#onSwipe) return;
    e.preventDefault();
    this.setCollapsed(!this.collapsed);
  }

  /** 외부 지정 command-in — 원본 setCollapsed(t1/t0) 등가 */
  setCollapsed(v) {
    this.collapsed = !!v;
  }

  updated(changed) {
    super.updated?.(changed);
    if (changed.has('collapsed')) {
      // 원본 계약: 호스트 data-collapsed("1"/"0") 반영 — 기존 EstreUI CSS·외부 관찰 코드 호환
      this.setAttribute('data-collapsed', this.collapsed ? '1' : '0');
      // 원본의 부모 data-content-collapsed 연동을 event-up 으로 일반화 (pair 어댑터가 중계)
      this.dispatchEvent(new CustomEvent('toggle', { detail: { collapsed: this.collapsed }, bubbles: true, composed: true }));
    }
  }

  render() {
    return html`
      <div class="header" @click=${this.#toggle}>
        <slot name="header">${this.label}</slot>
        <span class="arrow">▾</span>
      </div>
      <div class="body"><div class="inner"><slot></slot></div></div>
    `;
  }
}

customElements.define('toggle-block', ToggleBlock);
