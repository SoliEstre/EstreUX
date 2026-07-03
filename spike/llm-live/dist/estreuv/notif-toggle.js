// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : notif-toggle.eux  (sha256:bc2d6448e081)
// │ profile: ui-component
// │ target : estreuv   provider : openai-compatible
// │ trio   : temp=0 model=google/gemini-2.5-flash template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * @typedef {object} NotifToggleState
 * @property {boolean} enabled - 알림 수신 여부
 * @property {number} count - 안 읽은 알림 수
 */

@customElement('notif-toggle')
export class NotifToggle extends LitElement {
  /**
   * @property {boolean} enabled - 알림 수신 여부
   */
  @property({ type: Boolean })
  enabled = true;

  /**
   * @property {number} count - 안 읽은 알림 수
   */
  @property({ type: Number })
  count = 0;

  static styles = css`
    :host {
      display: inline-block;
      position: relative;
      font-family: sans-serif;
    }
    button {
      background: none;
      border: none;
      font-size: 2em; /* Larger emoji */
      cursor: pointer;
      padding: 0.2em;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    button:focus {
      outline: 2px solid var(--notif-toggle-focus-color, #007bff);
      outline-offset: 2px;
      border-radius: 4px;
    }
    .badge {
      position: absolute;
      top: -0.2em;
      right: -0.2em;
      background-color: var(--notif-toggle-badge-bg, #ff4d4f); /* Red */
      color: var(--notif-toggle-badge-color, white);
      border-radius: 50%;
      padding: 0.2em 0.5em;
      font-size: 0.6em;
      font-weight: bold;
      min-width: 1.5em;
      height: 1.5em;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      pointer-events: none; /* Don't block button clicks */
      transform: translate(50%, -50%);
      white-space: nowrap;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadState();
  }

  /**
   * @param {import('lit').PropertyValues<this>} changedProperties
   */
  updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has('enabled') || changedProperties.has('count')) {
      this._saveState();
    }
  }

  /**
   * enabled 를 반전하고 영속
   */
  toggle() {
    this.enabled = !this.enabled;
  }

  /**
   * count 에 n 을 더함
   * @param {number} n
   */
  bump(n) {
    this.count = Math.max(0, this.count + n); // Ensure count doesn't go negative
  }

  /**
   * count 를 0 으로 되돌림
   */
  clear() {
    this.count = 0;
  }

  /**
   * Loads the component state from localStorage.
   * @private
   */
  _loadState() {
    try {
      const persistedState = localStorage.getItem('notif-toggle');
      if (persistedState) {
        const state = JSON.parse(persistedState);
        if (typeof state.enabled === 'boolean') {
          this.enabled = state.enabled;
        }
        if (typeof state.count === 'number' && state.count >= 0) {
          this.count = state.count;
        }
      }
    } catch (e) {
      console.error('Failed to load notif-toggle state from localStorage:', e);
    }
  }

  /**
   * Saves the component state to localStorage.
   * @private
   */
  _saveState() {
    try {
      const stateToPersist = {
        enabled: this.enabled,
        count: this.count,
      };
      localStorage.setItem('notif-toggle', JSON.stringify(stateToPersist));
    } catch (e) {
      console.error('Failed to save notif-toggle state to localStorage:', e);
    }
  }

  render() {
    return html`
      <button @click="${this.toggle}" aria-label="${this.enabled ? '알림 끄기' : '알림 켜기'}">
        ${this.enabled ? '🔔' : '🔕'}
        ${this.count > 0
          ? html`<span class="badge" aria-live="polite" aria-atomic="true">${this.count}</span>`
          : ''}
      </button>
    `;
  }
}
