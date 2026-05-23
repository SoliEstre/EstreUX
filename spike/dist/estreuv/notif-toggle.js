// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : notif-toggle.eux  (sha256:5f22b106a337)
// │ target : estreuv   provider : template
// │ trio   : temp=0.0 model=template/deterministic-templater@v0 template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run expand` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { EstreUVElement } from 'estreuv';
import { html } from 'lit';

/**
 * <notif-toggle> — estreuv(micro-Rimwork, Lit) 단독 변종.
   * enabled=true 면 🔔, false 면 🔕 버튼. 클릭하면 toggle.
   * count > 0 이면 버튼 우상단에 count 배지 표시.
 */
export class NotifToggle extends EstreUVElement {
  static properties = { enabled: { type: Boolean }, count: { type: Number } };
  constructor() { super(); this.enabled = true; this.count = 0; this.#load(); }
  toggle() { this.enabled = !this.enabled; this.#save(); }
  bump(n) { this.count += n; }
  clear() { this.count = 0; }
  #load() { try { const s = JSON.parse(localStorage.getItem('notif-toggle') || '{}'); if ('enabled' in s) this.enabled = s.enabled; if ('count' in s) this.count = s.count; } catch {} }
  #save() { localStorage.setItem('notif-toggle', JSON.stringify({ enabled: this.enabled, count: this.count })); }
  render() {
    return html`<button class="nt-btn" @click=${() => this.toggle()}>${this.enabled ? '🔔' : '🔕'}</button>${this.count > 0 ? html`<span class="nt-badge">${this.count}</span>` : ''}`;
  }
}
customElements.define('notif-toggle', NotifToggle);
