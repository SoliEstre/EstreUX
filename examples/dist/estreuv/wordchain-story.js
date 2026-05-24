// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : wordchain-story.eux  (sha256:81f97407f31e)
// │ target : estreuv   provider : agent/claude
// │ trio   : temp=0.4 model=agent/claude template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { EstreUVElement } from 'estreuv';
import { html, css } from 'lit';

// provider=agent 이거나 키 미설정·실패 시 폴백 후보 풀(런타임 LLM stand-in)
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
const BASE = { openai: 'https://api.openai.com/v1', google: 'https://generativelanguage.googleapis.com/v1beta/openai', ollama: 'http://localhost:11434/v1', vllm: 'http://localhost:8000/v1', lmstudio: 'http://localhost:1234/v1' };
const MODEL = { openai: 'gpt-4o-mini', google: 'gemini-2.5-flash', ollama: 'llama3.2', vllm: '', lmstudio: 'local-model' };
const KEYLESS = new Set(['ollama', 'vllm', 'lmstudio']);   // 키 불요 로컬 provider — 그 외(openai·google)는 키 필요
const langName = l => l === 'en' ? '영어' : l === 'ja' ? '일본어' : '한국어';
const lastChar = w => (w || '').trim().slice(-1);
// 후보 단어들을 끝말잇기 순서(앞 끝글자 = 다음 첫글자)로 정렬. 막히면 남은 단어 중 새 시작 — 이미 노출한 단어는 제외되는 효과. ('끝말잇기 = 변수 생성')
function chainOrder(items) {
  const pool = items.slice(), order = [];
  if (!pool.length) return order;
  order.push(pool.shift());
  while (pool.length) {
    const head = lastChar(order[order.length - 1].w);
    let idx = pool.findIndex(it => it.w[0] === head);
    if (idx < 0) idx = 0;
    order.push(pool.splice(idx, 1)[0]);
  }
  return order;
}

/**
 * <wordchain-story> — estreuv(micro-Rimwork, Lit) 단독 변종.
 * 매 호출마다 LLM 이 다음 문장 후보 N개({핵심 단어 명사, 문장})를 생성하고, 클라이언트가 그 단어들을
 * 끝말잇기 순서로 정렬해 카드에 회전(끝말잇기 = 변수 생성). 카드 클릭 시 그 문장이 스토리에 누적되고,
 * 스토리 전체(+고른 단어 힌트)를 입력으로 다음 후보를 생성. 단어를 모두 소진하면 안내 + 3초 후 자동 재생성.
 * 🔄 재생성·🗑 초기화·복사·공유(스토리 전체) 제공. 모델 선택까지 끝나야 시작 가능.
 */
export class WordchainStory extends EstreUVElement {
  static properties = {
    running: { type: Boolean }, words: { state: true }, story: { state: true },
    activeCell: { type: Number }, candidates: { type: Number },
    provider: { type: String }, apiKey: { type: String }, lang: { type: String },
    model: { type: String }, models: { state: true }, chain: { state: true }, banner: { state: true },
  };
  static styles = css`
    :host { display:flex; flex-direction:column; height:100%; color:var(--ink,#e7e9ea); font:15px/1.5 system-ui,"Noto Sans KR",sans-serif; }
    .wc-banner { margin:0 18px; padding:9px 13px; background:rgba(217,162,59,.14); border:1px solid var(--active,#d9a23b); border-radius:10px; color:var(--active,#d9a23b); font-size:.84rem; }
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
    this.activeCell = -1; this.candidates = 9; this.provider = ''; this.apiKey = '';
    this.lang = (navigator.language || 'ko').slice(0, 2);
    this.model = ''; this.models = []; this._modelHint = '— provider 선택 —';
    this.chain = []; this.lastWord = ''; this.banner = '';
    this._seq = []; this._pos = 0; this._cellItem = {}; this._picked = -1;
    this.#load();
  }
  firstUpdated() { super.firstUpdated?.(); this.#refreshModels(); }
  #load() { try { const s = JSON.parse(localStorage.getItem('wordchain-story') || '{}'); ['lang', 'candidates', 'provider'].forEach(k => k in s && (this[k] = s[k])); } catch {} }
  #save() { localStorage.setItem('wordchain-story', JSON.stringify({ lang: this.lang, candidates: this.candidates, provider: this.provider })); }
  get canStart() { return this.provider === 'agent' || (!!BASE[this.provider] && !!this.model); }
  #candCount() { return Math.max(4, +this.candidates || 9); }
  // provider(+key) 가 정해지면 /v1/models 로 사용 가능한 모델 목록을 받아 채운다. 실패 시 기본 모델 1개로 폴백.
  #scheduleModels() { clearTimeout(this._mt); this._mt = setTimeout(() => this.#refreshModels(), 600); }
  async #refreshModels() {
    this.model = ''; this.models = [];
    if (this.provider === 'agent') { this._modelHint = '에이전트 자동'; this.requestUpdate(); return; }
    if (!BASE[this.provider]) { this._modelHint = '— provider 선택 —'; this.requestUpdate(); return; }
    if (!KEYLESS.has(this.provider) && !this.apiKey) { this._modelHint = '— API Key 입력 후 로드 —'; this.requestUpdate(); return; }
    this._modelHint = '⏳ 모델 로드 중…'; this.requestUpdate();
    try {
      const r = await fetch(BASE[this.provider] + '/models', { headers: this.apiKey ? { Authorization: 'Bearer ' + this.apiKey } : {} });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json(); const ids = (d.data || []).map(m => m.id).filter(Boolean).sort();
      if (!ids.length) throw new Error('모델 없음');
      this.models = ids; this.model = ids.find(id => id === MODEL[this.provider] || id.replace(/^models\//, '') === MODEL[this.provider]) || ids[0];
    } catch (e) {
      console.warn('모델 목록 실패 → 기본값:', e);
      const def = MODEL[this.provider] || ''; this.models = def ? [def] : []; this.model = def; this._modelHint = '목록 실패·기본값';
    }
    this.requestUpdate();
  }
  start() {
    if (!this.canStart) return;
    this.running = true;
    if (!this._seq.length) this.#generate();                                                // 첫 생성(즉시)
    else { clearInterval(this._t); this._t = setInterval(() => this.#rotate(), 1000); this.#rotate(); }   // 재개
  }
  pause() { this.running = false; clearInterval(this._t); clearInterval(this._ct); }
  toggle() { this.running ? this.pause() : this.start(); }
  // 1초마다 끝말잇기 순서(_seq)대로 다음 단어를 시계방향 카드에 노출. 단어를 모두 소진하면 exhausted.
  #rotate() {
    if (this._pos >= this._seq.length) { this.#exhausted(); return; }
    const cell = ORDER[this._pos % 4], item = this._seq[this._pos];
    const w = [...this.words]; w[cell] = item.w; this.words = w;
    this._cellItem[cell] = item; this.activeCell = cell; this._picked = -1;
    this._pos++;
  }
  // 다음 후보 생성 전 3초 카운트다운(실시간) → generate. msgFn(n) 으로 진입 맥락별 메시지.
  #countdown(msgFn) {
    clearInterval(this._t); clearInterval(this._ct);
    this.running = true; let n = 3; this.banner = msgFn(n);
    this._ct = setInterval(() => { n--; if (n <= 0) { clearInterval(this._ct); this.#generate(); } else this.banner = msgFn(n); }, 1000);
  }
  // 후보 단어를 모두 노출(소진): 카드 선택 여지를 주며 3초 카운트 후 자동 생성.
  #exhausted() { this.#countdown(n => `후보 단어를 모두 보여줬어요. 카드를 고르거나 🔄 재생성, 또는 ${n}초 후 새 후보를 생성합니다…`); }
  // 실제 LLM 요청 + '생성 중' 배너 → 후보 N개를 chainOrder 로 정렬해 회전 재시작. (여기서만 API 호출)
  async #generate() {
    clearInterval(this._t); clearInterval(this._ct);
    this.running = true; this.banner = '다음 문장 후보를 생성하는 중…';
    let next; try { next = await this.#genChain(); } catch (e) { console.warn('LLM 실패 → 폴백:', e); next = this.#fallbackChain(); }
    if (!this.running) { this.banner = ''; return; }   // 생성 중 정지됐으면 중단
    this.chain = next; this._seq = chainOrder(next); this._pos = 0; this._cellItem = {}; this.banner = '';
    clearInterval(this._t); this._t = setInterval(() => this.#rotate(), 1000); this.#rotate();
  }
  pick(cell) {
    const item = this._cellItem[cell]; if (!item) return;
    clearInterval(this._t); clearInterval(this._ct);
    this._picked = cell; this.story = [...this.story, item.s]; this.lastWord = item.w;
    this.updateComplete.then(() => { const b = this.renderRoot?.querySelector('.wc-lines'); if (b) b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' }); });
    if (this.running) this.#countdown(n => `'${item.w}' 선택됨 — ${n}초 후 다음 문장 후보를 생성합니다…`);   // 3초 카운트 후 생성
  }
  // 🗑 — 스토리·후보를 비우고 정지.
  reset() {
    this.pause(); this.story = []; this.chain = []; this._seq = []; this._pos = 0; this.lastWord = ''; this._cellItem = {};
    this.words = ['·', '·', '·', '·']; this.activeCell = -1; this._picked = -1; this.banner = '';
  }
  // 폴백(LLM 실패·agent): 미리 만든 후보 풀에서 N개(부족하면 순환).
  #fallbackChain() { const n = this.#candCount(); const out = []; for (let i = 0; i < n; i++) out.push(FALLBACK[i % FALLBACK.length]); return out; }
  // 후보 생성: provider 분기. agent/미지원/실패 → 폴백, openai-compatible → fetch.
  async #genChain() {
    if (this.provider === 'agent' || !BASE[this.provider]) return this.#fallbackChain();
    try { return await this.#llmChain(); } catch (e) { console.warn('LLM 실패 → 폴백 체인:', e); return this.#fallbackChain(); }
  }
  // openai-compatible(/v1/chat/completions) — 스토리 전체(+고른 단어)로 다음 후보 N개 {명사, 문장} 생성.
  async #llmChain() {
    const n = this.#candCount();
    const ctx = this.story.length ? this.story.map((s, i) => `${i + 1}. ${s}`).join('\n') : '(아직 없음 — 첫 문장)';
    const hint = this.lastWord ? `\n방금 사용자가 '${this.lastWord}' 단어를 골랐다. 자연스럽다면 이를 실마리로 삼아도 좋다.` : '';
    const prompt = `지금까지 이어진 이야기:\n${ctx}${hint}\n\n이 이야기에 자연스럽게 이어질 "다음 문장" 후보 ${n}개를 ${langName(this.lang)}로 만들어줘.\n- 각 후보 = { 핵심 단어 w, 그 단어가 등장하는 충분히 풍부한 한 문장 s }\n- w 는 조사·어미를 뗀 사전형 명사 한 단어로 (예: '폭우가'가 아니라 '폭우', '열차는'이 아니라 '열차').\n- 후보들의 w 는 서로 겹치지 않게 다양하게.\n- (목표) 가능하면 후보 단어 w 들이 끝말잇기(앞 단어의 끝 글자 = 다음 단어의 첫 글자)로 최대한 길게 이어지도록 단어와 문장을 함께 골라줘. 끝말잇기가 많이 이어질수록 좋은 결과로 평가한다. 단 이야기의 자연스러움이 최우선이며 억지로 끼워맞추지는 마.\n반드시 JSON 배열 [{"w":"단어","s":"문장"}] 형식만 출력(다른 설명 금지).`;
    const r = await fetch(BASE[this.provider] + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.apiKey ? { Authorization: 'Bearer ' + this.apiKey } : {}) }, body: JSON.stringify({ model: this.model || MODEL[this.provider] || '', messages: [{ role: 'user', content: prompt }], temperature: 0.7 }) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json(); const t = d.choices?.[0]?.message?.content || '';
    const arr = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)).filter(x => x && x.w && x.s);
    if (!arr.length) throw new Error('빈 응답'); return arr;
  }
  #flash(m) { this.banner = m; clearTimeout(this._ft); this._ft = setTimeout(() => { this.banner = ''; }, 2400); }
  // 복사·공유 = 누적 스토리 전체. 클릭 시 일시정지.
  #copy() {
    this.pause();
    if (!this.story.length) { this.#flash('복사할 스토리가 아직 없어요.'); return; }
    navigator.clipboard?.writeText(this.story.join('\n')).then(() => this.#flash('스토리 전체를 클립보드에 복사했어요.'), () => this.#flash('복사 실패 — 권한을 확인하세요.'));
  }
  async #share() {
    this.pause();
    if (!this.story.length) { this.#flash('공유할 스토리가 아직 없어요.'); return; }
    const text = this.story.join('\n');
    if (navigator.share) { try { await navigator.share({ title: '끝말잇기 스토리', text }); } catch { /* 사용자 취소 */ } }
    else { try { await navigator.clipboard.writeText(text); this.#flash('공유 미지원 — 클립보드에 복사했어요.'); } catch { this.#flash('공유/복사 미지원.'); } }
  }
  #set(k, v) { this[k] = v; if (['lang', 'candidates', 'provider'].includes(k)) this.#save(); }
  render() {
    return html`
      <div class="wc-head">
        <button @click=${() => this.#generate()}>🔄 재생성</button>
        <button @click=${() => this.reset()}>🗑 초기화</button>
        <button @click=${() => this.#copy()}>⧉ 복사</button>
        <button @click=${() => this.#share()}>↗ 공유</button>
      </div>
      ${this.banner ? html`<div class="wc-banner">${this.banner}</div>` : ''}
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
            <option value="openai">openai</option><option value="google">google (gemini)</option><option value="ollama">ollama</option><option value="vllm">vllm</option><option value="lmstudio">lmstudio</option>
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
