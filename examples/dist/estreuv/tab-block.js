// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : tab-block.eux  (sha256:383d3811ce39)
// │ profile: ui-component
// │ target : estreuv   provider : agent
// │ trio   : temp=0.2 model=agent/claude template=estreux/v0.0.1
// │ invariants: brewed
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { EstreUVElement } from 'estreuv';
import { html, css } from 'lit';

/**
 * <tab-block> — estreuv(micro-Rimwork, Lit) 변종.
 * EstreUI 스톡 EstreTabBlockHandle(estreUi-handles.js:4847-5050)의 UV 재구현 — V3 파일럿 3호 (B2 중형).
 * 원본 계약 보존: 1-base tab id · 탭(shadow)/콘텐츠(light) 두 표면 data-tab-selected("1"/"") 동기 ·
 * begin-tab 미지정 시 가운데 탭 초기 선택 · 클릭+스와이프 전환(경계 no-op) · 슬라이드 피드백(data-slide).
 * 원본이 요구하던 titled_tab_block/ul/li 마크업은 shadow 셀프 렌더로 흡수 —
 * 사용법: <tab-block tabs="라벨1,라벨2"><div data-tab-id="1">…</div><div data-tab-id="2">…</div></tab-block>
 *
 * @invariants (brewed — spec @invariants 각인)
 * - state/member-of: selected ∈ [1..N], 각 표면의 data-tab-selected ∈ {"1",""} — "1" 은 표면당 정확히 1개
 * - temporal/bounded: 스와이프/prev/next 의 selected 이동은 [1..N] 안에 bounded — 경계에서 변경 없음
 * - causality: selectTab(유효 id) 이 두 표면 반영 ∧ tabchange 발화에 precedes
 * - causality: 범위 밖 id 는 아무 표면도 변경하지 않음을 implies (원본 selectTab 가드)
 */
export class TabBlock extends EstreUVElement {
  static properties = {
    tabs: { type: String },
    selected: { type: Number, reflect: false },
    beginTab: { type: String, attribute: 'begin-tab' },
  };
  static styles = css`
    :host { display: block; }
    .tabset {
      display: flex; gap: var(--tb-tab-gap, 0);
      border-bottom: var(--tb-tabset-border, 1px solid rgba(128,128,128,.35));
    }
    .tabset li {
      list-style: none; padding: 8px 14px; cursor: pointer; user-select: none;
      opacity: .6; border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .tabset li[data-tab-selected="1"] {
      opacity: 1; border-bottom-color: var(--tb-active-color, currentColor);
    }
    .contents { touch-action: pan-y; }
  `;

  constructor() {
    super();
    this.tabs = '';
    this.selected = 0;
    this.beginTab = '';
    this.#swipe = { active: false, startX: 0, startY: 0, dx: 0 };
  }

  #swipe;

  get #labels() {
    return this.tabs.split(',').map(s => s.trim()).filter(Boolean);
  }

  get #contents() {
    return [...this.querySelectorAll('[data-tab-id]')];
  }

  firstUpdated() {
    this.#mount();
  }

  // mount 진입점 (spec @behavior mount) — 초기 선택: 원본 initTabSelection 보존.
  // begin-tab 유효 시 그 id, 아니면 가운데 탭 규칙(양끝 번갈아 제거 — 홀수 N=정중앙·짝수 N=중앙 왼쪽)
  #mount() {
    const n = this.#labels.length;
    let target = parseInt(this.beginTab);
    if (!(target > 0 && target <= n)) {
      const list = Array.from({ length: n }, (_, i) => i + 1);
      let s = 0;
      while (list.length > 1) {
        if (s % 2 === 0) list.splice(-1);
        else list.shift();
        s++;
      }
      target = list[0] ?? 0;
    }
    if (target > 0) this.selectTab(target, true);
  }

  /** 외부 지정 command-in — 원본 selectTab 등가. 1-base, 범위 밖·비정수는 무시 */
  selectTab(id, isInit = false) {
    const intId = parseInt(id);
    const n = this.#labels.length;
    if (id == null || id === '' || isNaN(intId) || intId <= 0 || intId > n) return;
    this.selected = intId;
    this.#applySurfaces(intId);
    this.dispatchEvent(new CustomEvent('tabchange', { detail: { id: intId, isInit }, bubbles: true, composed: true }));
  }

  getPrevTabId() { const t = this.selected - 1; return t >= 1 ? t : this.selected; }   // 경계 클램프 = 변경 없음
  getNextTabId() { const t = this.selected + 1; return t <= this.#labels.length ? t : this.selected; }
  selectPrevTab() { const t = this.getPrevTabId(); if (t !== this.selected) this.selectTab(t); }
  selectNextTab() { const t = this.getNextTabId(); if (t !== this.selected) this.selectTab(t); }

  // 두 표면 data-tab-selected 동기 — 원본 applyTab/ContentSelected 등가.
  // light DOM 콘텐츠에 반영해 기존 EstreUI CSS 셀렉터가 그대로 동작한다.
  #applySurfaces(id) {
    const tabs = this.renderRoot?.querySelectorAll('.tabset li[data-tab-id]') ?? [];
    for (const el of tabs) el.setAttribute('data-tab-selected', parseInt(el.dataset.tabId) === id ? '1' : '');
    for (const el of this.#contents) el.setAttribute('data-tab-selected', parseInt(el.dataset.tabId) === id ? '1' : '');
  }

  // X축 스와이프 — 원본 EstreSwipeHandler 경로의 UV 단독 재현 (Pointer Events, 임계 40px)
  #onPointerDown(e) {
    this.#swipe = { active: true, startX: e.clientX, startY: e.clientY, dx: 0 };
  }
  #onPointerMove(e) {
    if (!this.#swipe.active) return;
    this.#swipe.dx = e.clientX - this.#swipe.startX;
    // 슬라이드 피드백 — 이동 방향의 인접 타깃 콘텐츠에 data-slide="1" (원본 setOnMove 계약)
    const targetId = this.#swipe.dx < 0 ? this.getNextTabId() : this.getPrevTabId();
    for (const el of this.#contents) {
      if (targetId !== this.selected && parseInt(el.dataset.tabId) === targetId) el.setAttribute('data-slide', '1');
      else el.removeAttribute('data-slide');
    }
  }
  #onPointerUp() {
    if (!this.#swipe.active) return;
    const dx = this.#swipe.dx;
    this.#swipe.active = false;
    for (const el of this.#contents) el.removeAttribute('data-slide');
    if (Math.abs(dx) >= 40) {
      if (dx < 0) this.selectNextTab();   // 왼쪽 스와이프 = 다음 — 경계에서 no-op
      else this.selectPrevTab();
    }
  }

  updated(changed) {
    super.updated?.(changed);
    if (changed.has('tabs') && this.selected > 0) this.#applySurfaces(this.selected);
  }

  render() {
    return html`
      <ul class="tabset">
        ${this.#labels.map((label, i) => html`
          <li data-tab-id=${i + 1} data-tab-selected=${this.selected === i + 1 ? '1' : ''}
              @click=${() => this.selectTab(i + 1)}>${label}</li>
        `)}
      </ul>
      <div class="contents"
           @pointerdown=${this.#onPointerDown}
           @pointermove=${this.#onPointerMove}
           @pointerup=${this.#onPointerUp}
           @pointercancel=${this.#onPointerUp}>
        <slot></slot>
      </div>
    `;
  }
}

customElements.define('tab-block', TabBlock);
