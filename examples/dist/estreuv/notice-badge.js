// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : notice-badge.eux  (sha256:28f5ff45d1b0)
// │ profile: ui-component
// │ target : estreuv   provider : agent
// │ trio   : temp=0.2 model=agent/claude template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { EstreUVElement } from 'estreuv';
import { html, css } from 'lit';

/**
 * <notice-badge> — estreuv(micro-Rimwork, Lit) 변종.
 * 타 프레임워크(React) 마이그레이션 경로 실증 1호 (PM 009 B5) —
 * 원본 migration-samples/react-notice-badge.jsx 의 관용구 매핑:
 *   props → reactive properties · useState(dismissed) → reactive state ·
 *   useEffect(cleanup) → 타이머 lifecycle 제어 · return null → 빈 렌더 ·
 *   onDismiss 콜백 prop → `dismiss` CustomEvent(event-up).
 */
export class NoticeBadge extends EstreUVElement {
  static properties = {
    count: { type: Number },
    max: { type: Number },
    autoRestore: { type: Number, attribute: 'auto-restore' },
    dismissed: { state: true },
  };
  static styles = css`
    :host { display: inline-block; }
    .badge {
      display: inline-block; min-width: 20px; padding: 2px 6px; border-radius: 10px;
      background: var(--nb-bg, #e5484d); color: var(--nb-fg, #fff);
      font: 700 12px/1.4 system-ui, sans-serif; text-align: center; cursor: pointer;
    }
  `;

  constructor() {
    super();
    this.count = 0;
    this.max = 99;
    this.autoRestore = 0;
    this.dismissed = false;
  }

  #restoreTimer = null;

  get #visible() { return this.count > 0 && !this.dismissed; }
  get #label() { return this.count > this.max ? `${this.max}+` : String(this.count); }

  // React useEffect([dismissed, autoRestore]) 등가 — 상태 변화에 반응해 타이머 재설정
  updated(changed) {
    super.updated?.(changed);
    if (changed.has('dismissed') || changed.has('autoRestore')) this.#armRestore();
  }

  #armRestore() {
    this.#clearRestore();
    if (!this.dismissed || !this.autoRestore) return;
    this.#restoreTimer = setTimeout(() => { this.dismissed = false; }, this.autoRestore);
  }

  #clearRestore() {
    if (this.#restoreTimer != null) { clearTimeout(this.#restoreTimer); this.#restoreTimer = null; }
  }

  #dismiss() {
    this.dismissed = true;
    // React onDismiss 콜백 prop 등가 — estreuv event-up 컨벤션
    this.dispatchEvent(new CustomEvent('dismiss', { detail: { count: this.count }, bubbles: true, composed: true }));
  }

  disconnectedCallback() {
    this.#clearRestore();            // React useEffect cleanup 등가 — 타이머 누수 금지
    super.disconnectedCallback();
  }

  // EstreUI 채널(8훅) — 비가시 자원 회수 + 재개 (UI↔UV 계약 §1.3)
  onShow() {
    super.onShow?.();
    if (this.dismissed) this.#armRestore();
  }
  onHide() { super.onHide?.(); this.#clearRestore(); }
  onClose() { super.onClose?.(); this.#clearRestore(); }
  onRelease() { super.onRelease?.(); this.#clearRestore(); }

  render() {
    if (!this.#visible) return html``;
    return html`
      <span class="badge" role="status" title=${`미확인 ${this.count}건`} @click=${this.#dismiss}>
        ${this.#label}
      </span>
    `;
  }
}

customElements.define('notice-badge', NoticeBadge);
