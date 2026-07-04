// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : num-keypad.eux  (sha256:71a506d8a93e)
// │ profile: ui-component
// │ target : estreuv   provider : agent
// │ trio   : temp=0.2 model=agent/claude template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { EstreUVElement } from 'estreuv';
import { html, css } from 'lit';

/**
 * <num-keypad> — estreuv(micro-Rimwork, Lit) 변종.
 * EstreUI 스톡 EstreNumKeypadHandle(estreUi-handles.js:5340-5491)의 UV 재구현 — V3 대체 파일럿 1호.
 * 외부 input(id 연결)에 숫자 입력을 공급. 원본의 입력 계약(길이 제한·자동 구분자·직접 입력 차단·
 * BS 구분자 인지 삭제·ENTER keypress 13·change 이벤트)을 보존해 기존 input 소비 코드가 그대로 동작한다.
 */
export class NumKeypad extends EstreUVElement {
  static properties = {
    for: { type: String },
    limitLength: { type: Number, attribute: 'limit-length' },
    autoDivider: { type: String, attribute: 'auto-divider' },
    autoDividerPos: { type: String, attribute: 'auto-divider-pos' },
    preventDirect: { type: Boolean, attribute: 'prevent-direct' },
    withEnter: { type: Boolean, attribute: 'with-enter' },
  };
  static styles = css`
    :host { display: inline-block; }
    .pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--nk-gap, 8px); }
    button {
      min-width: 44px; min-height: 44px; padding: 10px 0; border: 0; border-radius: 10px;
      background: var(--nk-btn-bg, #f1f3f5); color: var(--nk-btn-fg, #202124);
      font: 600 1.15rem/1 system-ui, sans-serif; cursor: pointer; touch-action: manipulation;
    }
    button:active { filter: brightness(.92); }
    button:disabled { opacity: .4; cursor: default; }
    button.aux { background: var(--nk-accent, #dde3ea); font-size: .95rem; }
    button.enter { grid-column: 1 / -1; }
  `;

  constructor() {
    super();
    this.for = '';
    this.limitLength = 0;
    this.autoDivider = '';
    this.autoDividerPos = '';
    this.preventDirect = false;
    this.withEnter = false;
    this.#onInput = this.#onInput.bind(this);
    this.#onFocus = this.#onFocus.bind(this);
  }

  #input = null;        // 연결된 외부 input (light DOM)
  #wired = false;       // 리스너 중복 부착 가드

  get #posList() {
    return (this.autoDividerPos || '').split(',').map((p) => parseInt(p, 10)).filter((p) => !isNaN(p));
  }

  // ── 외부 input 결선 ────────────────────────────────────────────
  #resolveInput() {
    const next = this.for ? document.getElementById(this.for) : null;
    if (next === this.#input && this.#wired) return;
    this.#unwire();
    this.#input = next;
    if (!this.#input) {
      if (this.for) console.warn(`[num-keypad] input #${this.for} 을 찾지 못했어요 — 키 비활성.`);
      this.requestUpdate();
      return;
    }
    this.#input.addEventListener('input', this.#onInput);
    this.#input.addEventListener('paste', this.#onInput);
    this.#input.addEventListener('cut', this.#onInput);
    this.#input.addEventListener('change', this.#onInput);
    this.#input.addEventListener('focus', this.#onFocus);
    this.#wired = true;
    this.requestUpdate();
  }

  #unwire() {
    if (!this.#input || !this.#wired) { this.#wired = false; return; }
    this.#input.removeEventListener('input', this.#onInput);
    this.#input.removeEventListener('paste', this.#onInput);
    this.#input.removeEventListener('cut', this.#onInput);
    this.#input.removeEventListener('change', this.#onInput);
    this.#input.removeEventListener('focus', this.#onFocus);
    this.#wired = false;
  }

  updated(changed) {
    super.updated?.(changed);
    if (changed.has('for')) this.#resolveInput();
  }

  connectedCallback() {
    super.connectedCallback();
    this.#resolveInput();
  }

  disconnectedCallback() {
    this.#unwire();               // 이중 안전망 — onRelease 와 별개 채널 (2채널 계약)
    super.disconnectedCallback();
  }

  // EstreUI 채널(8훅) — 페이지 release 시 외부 리스너 해제 (UI↔UV 계약 §1.3)
  onRelease() {
    super.onRelease?.();
    this.#unwire();
  }

  // ── 원본 계약 보존 동작 ────────────────────────────────────────
  #onFocus(e) {
    if (!this.preventDirect) return;
    e.preventDefault();
    e.target.blur();
  }

  // 외부 유래 입력에도 길이 제한·자동 구분자 적용 (원본 setEvent input 리스너와 동일)
  #onInput() {
    const input = this.#input;
    if (!input) return;
    const value = input.value;
    if (this.limitLength > 0 && value.length > this.limitLength) {
      input.value = value.substr(0, this.limitLength);
      return;
    }
    if (this.autoDivider) {
      for (const pos of this.#posList) if (pos === value.length) input.value += this.autoDivider;
    }
  }

  #emitChange() {
    this.#input?.dispatchEvent(new Event('change'));
  }

  #pressNumber(n) {
    const input = this.#input;
    if (!input) return;
    if (this.limitLength > 0 && input.value.length >= this.limitLength) return;
    input.value += n;
    this.#emitChange();
  }

  #pressClear() {
    if (!this.#input) return;
    this.#input.value = '';
    this.#emitChange();
  }

  #pressBackspace() {
    const input = this.#input;
    if (!input) return;
    const val = input.value;
    let back = 1;
    if (this.autoDivider && val.slice(-this.autoDivider.length) === this.autoDivider) back += this.autoDivider.length;
    input.value = val.substring(0, val.length - back);
    this.#emitChange();
  }

  #pressEnter() {
    const input = this.#input;
    if (!input) return;
    // 원본 호환 — jQuery trigger({type:"keypress", which:13}) 에 상응하는 native keypress 13
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  }

  render() {
    const off = !this.#input;
    const num = (n) => html`<button ?disabled=${off} @click=${() => this.#pressNumber(String(n))}>${n}</button>`;
    return html`
      <div class="pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num)}
        <button class="aux" ?disabled=${off} @click=${this.#pressClear}>CLR</button>
        ${num(0)}
        <button class="aux" ?disabled=${off} @click=${this.#pressBackspace}>⌫</button>
        ${this.withEnter ? html`<button class="aux enter" ?disabled=${off} @click=${this.#pressEnter}>ENTER</button>` : ''}
      </div>
    `;
  }
}

customElements.define('num-keypad', NumKeypad);
