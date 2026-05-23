// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : wordchain-story.eux  (sha256:a614ce3acdd5)
// │ target : estreuv   provider : agent/claude
// │ trio   : temp=0.4 model=agent/claude template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { EstreUVElement } from 'estreuv';
import { html, css } from 'lit';

// provider=agent 이거나 키 미설정 시 폴백 끝말잇기 체인(런타임 LLM stand-in)
const FALLBACK = [
  { w: '사과', s: '노을이 지는 과수원에서 한 소년이 사과를 땄다.' },
  { w: '과수원', s: '그 과수원은 할머니가 평생을 가꾼 곳이었다.' },
  { w: '원두막', s: '밭 가운데 원두막에서 둘은 더위를 식혔다.' },
  { w: '막내', s: '막내는 늘 가장 큰 사과를 골라 들었다.' },
  { w: '내일', s: '내일이면 첫 수확을 장에 내다 팔 참이었다.' },
  { w: '일기', s: '소년은 그날의 설렘을 일기에 적어 두었다.' },
  { w: '기차', s: '멀리서 기차가 기적을 울리며 들판을 가로질렀다.' },
  { w: '차표', s: '주머니엔 도시로 가는 차표 한 장이 들어 있었다.' },
];
const POS = ['좌상', '우상', '좌하', '우하'];
const ORDER = [0, 1, 3, 2];   // 시계방향 순환
const BASE = { openai: 'https://api.openai.com/v1', ollama: 'http://localhost:11434/v1', vllm: 'http://localhost:8000/v1', lmstudio: 'http://localhost:1234/v1' };
const MODEL = { openai: 'gpt-4o-mini', ollama: 'llama3.2', vllm: '', lmstudio: 'local-model' };
const langName = l => l === 'en' ? '영어' : l === 'ja' ? '일본어' : '한국어';

/**
 * <wordchain-story> — estreuv(micro-Rimwork, Lit) 단독 변종.
 * 우측 2x2 카드 시계방향 끝말잇기 회전, 카드 클릭 시 좌측 스토리에 원전 문장 누적(스무스 스크롤) + ~1.5초 자동 재개.
 * 하단 provider/key/모델/언어/후보수 설정, 시작=일시정지 토글(모델 선택까지 끝나야 활성), 우상단 복사·공유(클릭 시 일시정지).
 * provider(+key) 가 정해지면 #refreshModels 가 /v1/models 로 모델 목록을 받아 선택하게 하고,
 * 런타임 문장 생성은 #genChain 의 provider 분기(agent/미지원 → 폴백, openai-compatible → 선택 모델로 fetch)에서 처리.
 */
export class WordchainStory extends EstreUVElement {
  static properties = {
    running: { type: Boolean }, words: { state: true }, story: { state: true },
    activeCell: { type: Number }, candidates: { type: Number },
    provider: { type: String }, apiKey: { type: String }, lang: { type: String },
    model: { type: String }, models: { state: true },
  };
  static styles = css`
    :host { display:flex; flex-direction:column; height:100%; color:var(--ink,#e7e9ea); font:15px/1.5 system-ui,"Noto Sans KR",sans-serif; }
    .wc { flex:1; min-height:0; display:flex; flex-direction:row-reverse; gap:18px; padding:18px; }
    @media (max-width:760px){ .wc { flex-direction:column; } }
    .wc-grid { display:grid; grid-template-columns:repeat(2,minmax(140px,200px)); gap:14px; align-self:center; }
    .wc-card { aspect-ratio:1.5; background:var(--panel,#171a21); border:1px solid var(--line,#2a2f3a); border-radius:14px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; position:relative; }
    .wc-card.active { border-color:var(--active,#d9a23b); box-shadow:0 0 0 1px var(--active,#d9a23b); }
    .wc-card.picked { border-color:var(--accent,#7a4dff); box-shadow:0 0 0 1px var(--accent,#7a4dff); }
    .wc-pos { position:absolute; top:8px; left:10px; font-size:.6rem; color:var(--muted,#9aa3ad); }
    .wc-word { font-size:1.6rem; font-weight:700; }
    .wc-story { flex:1.4 1 0; min-width:0; min-height:0; background:var(--panel2,#1e222b); border:1px solid var(--line,#2a2f3a); border-radius:12px; padding:12px 16px; display:flex; flex-direction:column; }
    .wc-story h3 { margin:0 0 8px; font-size:.8rem; color:var(--muted,#9aa3ad); }
    .wc-lines { flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:6px; }
    .wc-line { padding:6px 12px; background:var(--panel,#171a21); border:1px solid var(--line,#2a2f3a); border-left:3px solid var(--accent,#7a4dff); border-radius:9px; font-size:.95rem; }
    .wc-foot { border-top:1px solid var(--line,#2a2f3a); padding:12px 18px; display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }
    .wc-foot label { font-size:.66rem; color:var(--muted,#9aa3ad); display:block; }
    .wc-foot select,.wc-foot input { background:var(--panel2,#1e222b); color:inherit; border:1px solid var(--line,#2a2f3a); border-radius:8px; padding:6px 9px; font:inherit; font-size:.84rem; }
    .wc-sp { flex:1; } .wc-head { display:flex; gap:8px; padding:10px 18px 0; justify-content:flex-end; }
    button { background:var(--panel2,#1e222b); color:var(--muted,#9aa3ad); border:1px solid var(--line,#2a2f3a); border-radius:9px; padding:7px 14px; font:inherit; cursor:pointer; }
    #toggle { background:var(--done,#2fae66); color:#fff; border:0; font-weight:700; padding:10px 20px; }
    #toggle:disabled { background:var(--panel2,#1e222b); color:var(--muted,#9aa3ad); cursor:not-allowed; }
    #toggle.running { background:var(--active,#d9a23b); }
  `;
  constructor() {
    super();
    this.running = false; this.words = ['·', '·', '·', '·']; this.story = [];
    this.activeCell = 0; this.candidates = 9; this.provider = ''; this.apiKey = '';
    this.lang = (navigator.language || 'ko').slice(0, 2);
    this.model = ''; this.models = []; this._modelHint = '— provider 선택 —';
    this._chain = []; this._pos = 0; this._cellWord = {}; this._picked = -1;
    this.#load();
  }
  firstUpdated() { super.firstUpdated?.(); this.#refreshModels(); }
  #load() { try { const s = JSON.parse(localStorage.getItem('wordchain-story') || '{}'); ['lang', 'candidates', 'provider'].forEach(k => k in s && (this[k] = s[k])); } catch {} }
  #save() { localStorage.setItem('wordchain-story', JSON.stringify({ lang: this.lang, candidates: this.candidates, provider: this.provider })); }
  get canStart() { return this.provider === 'agent' || (!!BASE[this.provider] && !!this.model); }
  // provider(+key) 가 정해지면 /v1/models 로 사용 가능한 모델 목록을 받아 채운다. 실패 시 기본 모델 1개로 폴백.
  #scheduleModels() { clearTimeout(this._mt); this._mt = setTimeout(() => this.#refreshModels(), 600); }
  async #refreshModels() {
    this.model = ''; this.models = [];
    if (this.provider === 'agent') { this._modelHint = '에이전트 자동'; this.requestUpdate(); return; }
    if (!BASE[this.provider]) { this._modelHint = '— provider 선택 —'; this.requestUpdate(); return; }
    if (this.provider === 'openai' && !this.apiKey) { this._modelHint = '— API Key 입력 후 로드 —'; this.requestUpdate(); return; }
    this._modelHint = '⏳ 모델 로드 중…'; this.requestUpdate();
    try {
      const r = await fetch(BASE[this.provider] + '/models', { headers: this.apiKey ? { Authorization: 'Bearer ' + this.apiKey } : {} });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json(); const ids = (d.data || []).map(m => m.id).filter(Boolean).sort();
      if (!ids.length) throw new Error('모델 없음');
      this.models = ids; this.model = ids.includes(MODEL[this.provider]) ? MODEL[this.provider] : ids[0];
    } catch (e) {
      console.warn('모델 목록 실패 → 기본값:', e);
      const def = MODEL[this.provider] || ''; this.models = def ? [def] : []; this.model = def; this._modelHint = '목록 실패·기본값';
    }
    this.requestUpdate();
  }
  async start() {
    if (!this.canStart) return;
    if (!this._chain.length) this._chain = await this.#genChain();
    this.running = true; clearInterval(this._t); this._t = setInterval(() => this.#rotate(), 1000); this.#rotate();
  }
  pause() { this.running = false; clearInterval(this._t); }
  toggle() { this.running ? this.pause() : this.start(); }
  #rotate() {
    const cell = ORDER[this._pos % 4], item = this._chain[this._pos % this._chain.length];
    const w = [...this.words]; w[cell] = item.w; this.words = w;
    this._cellWord[cell] = item; this.activeCell = cell; this._pos++;
  }
  pick(cell) {
    const item = this._cellWord[cell]; if (!item) return;
    this._picked = cell; this.story = [...this.story, item.s]; this.pause();
    this.updateComplete.then(() => { const b = this.renderRoot?.querySelector('.wc-lines'); if (b) b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' }); });
    // 다음 문장 작성 대기가 없으면 ~1.5초 뒤 자동 재개
    setTimeout(() => { if (this.canStart) { this.running = true; clearInterval(this._t); this._t = setInterval(() => this.#rotate(), 1000); } }, 1500);
  }
  // 런타임 끝말잇기 체인 생성: provider 분기. agent/미지원 → 폴백, openai-compatible → fetch.
  async #genChain() {
    if (this.provider === 'agent' || !BASE[this.provider]) return FALLBACK;
    try { return await this.#llmChain(); } catch (e) { console.warn('LLM 실패 → 폴백 체인:', e); return FALLBACK; }
  }
  // openai-compatible(/v1/chat/completions) — 끝말잇기 단어 candidates 개 + 이야기 문장 생성.
  async #llmChain() {
    const n = Math.max(4, +this.candidates || 9);
    const prompt = `끝말잇기(앞 단어의 마지막 글자 = 다음 단어의 첫 글자) 규칙으로 이어지는 단어 ${n}개와, 각 단어가 자연스럽게 등장하며 하나로 이어지는 짧은 이야기 문장을 ${langName(this.lang)}로 만들어줘. 반드시 JSON 배열 [{"w":"단어","s":"문장"}] 형식만 출력(다른 설명 금지).`;
    const r = await fetch(BASE[this.provider] + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.apiKey ? { Authorization: 'Bearer ' + this.apiKey } : {}) }, body: JSON.stringify({ model: this.model || MODEL[this.provider] || '', messages: [{ role: 'user', content: prompt }], temperature: 0.4 }) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json(); const t = d.choices?.[0]?.message?.content || '';
    const arr = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)).filter(x => x && x.w && x.s);
    if (!arr.length) throw new Error('빈 응답'); return arr;
  }
  #set(k, v) { this[k] = v; if (['lang', 'candidates', 'provider'].includes(k)) this.#save(); }
  render() {
    return html`
      <div class="wc-head">
        <button @click=${() => { this.pause(); navigator.clipboard?.writeText(this.story.join('\n')); }}>⧉ 복사</button>
        <button @click=${() => { this.pause(); }}>↗ 공유</button>
      </div>
      <div class="wc">
        <div class="wc-story">
          <h3>지금까지의 스토리 (위 → 아래)</h3>
          <div class="wc-lines">${this.story.map(s => html`<div class="wc-line">${s}</div>`)}</div>
        </div>
        <div class="wc-grid">
          ${[0, 1, 2, 3].map(i => html`
            <div class="wc-card ${this.activeCell === i ? 'active' : ''} ${this._picked === i ? 'picked' : ''}" @click=${() => this.pick(i)}>
              <span class="wc-pos">${POS[i]}</span><span class="wc-word">${this.words[i]}</span>
            </div>`)}
        </div>
      </div>
      <div class="wc-foot">
        <div><label>AI Provider</label>
          <select @change=${e => { this.#set('provider', e.target.value); this.#refreshModels(); }} .value=${this.provider}>
            <option value="">— 선택 —</option><option value="agent">agent (현재 에이전트)</option>
            <option value="openai">openai</option><option value="ollama">ollama</option><option value="vllm">vllm</option><option value="lmstudio">lmstudio</option>
          </select></div>
        <div><label>API Key</label><input type="password" placeholder="sk-…" @input=${e => { this.apiKey = e.target.value; this.#scheduleModels(); }}></div>
        <div><label>모델</label>
          <select ?disabled=${!this.models.length} @change=${e => this.#set('model', e.target.value)} .value=${this.model}>
            ${this.models.length
              ? this.models.map(id => html`<option value=${id} ?selected=${id === this.model}>${id}</option>`)
              : html`<option value="">${this._modelHint}</option>`}
          </select></div>
        <div><label>언어</label>
          <select @change=${e => this.#set('lang', e.target.value)} .value=${this.lang}>
            <option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option>
          </select></div>
        <div><label>문장 후보 수</label><input type="number" min="1" max="30" .value=${String(this.candidates)} @input=${e => this.#set('candidates', +e.target.value)} style="width:64px"></div>
        <span class="wc-sp"></span>
        <button id="toggle" class=${this.running ? 'running' : ''} ?disabled=${!this.canStart} @click=${() => this.toggle()}>${this.running ? '⏸ 일시정지' : '▶ 시작'}</button>
      </div>`;
  }
}
customElements.define('wordchain-story', WordchainStory);
