// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : wordchain-story.eux  (sha256:a614ce3acdd5)
// │ target : estreui   provider : agent/claude
// │ trio   : temp=0.4 model=agent/claude template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { EstreUI } from 'estreui';

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
const ORDER = [0, 1, 3, 2];   // 시계방향
const BASE = { openai: 'https://api.openai.com/v1', ollama: 'http://localhost:11434/v1', vllm: 'http://localhost:8000/v1', lmstudio: 'http://localhost:1234/v1' };
const MODEL = { openai: 'gpt-4o-mini', ollama: 'llama3.2', vllm: '', lmstudio: 'local-model' };
const langName = l => l === 'en' ? '영어' : l === 'ja' ? '일본어' : '한국어';

/**
 * wordchainStory — EstreUI(macro-Rimwork, jQuery-class primitive) 단독 변종.
 * 끝말잇기 회전·카드 클릭 시 스토리 누적(스무스 스크롤)·~1.5초 자동 재개. 설정은 1회 렌더 후
 * 카드/스토리/모델 영역만 부분 갱신(설정 입력 보존). provider(+key) 정해지면 refreshModels 가
 * /v1/models 로 모델 목록을 받아 선택(모델 선택까지 끝나야 시작 가능). 런타임 문장 생성은 genChain provider 분기.
 */
export function wordchainStory(host) {
  const st = { running: false, words: ['·', '·', '·', '·'], story: [], active: 0, candidates: 9, provider: '', apiKey: '', model: '', models: [], _modelHint: '— provider 선택 —', lang: (navigator.language || 'ko').slice(0, 2), _chain: [], _pos: 0, _cellWord: {}, _picked: -1, _t: null };
  try { const s = JSON.parse(localStorage.getItem('wordchain-story') || '{}'); ['lang', 'candidates', 'provider'].forEach(k => k in s && (st[k] = s[k])); } catch {}
  const save = () => localStorage.setItem('wordchain-story', JSON.stringify({ lang: st.lang, candidates: st.candidates, provider: st.provider }));
  const canStart = () => st.provider === 'agent' || (!!BASE[st.provider] && !!st.model);

  // provider(+key) 가 정해지면 /v1/models 로 사용 가능한 모델 목록을 받아 채운다. 실패 시 기본 모델 1개로 폴백.
  let modelTimer = null;
  const scheduleModels = () => { clearTimeout(modelTimer); modelTimer = setTimeout(refreshModels, 600); };
  async function refreshModels() {
    st.model = ''; st.models = [];
    if (st.provider === 'agent') { st._modelHint = '에이전트 자동'; paintModels(); paintFoot(); return; }
    if (!BASE[st.provider]) { st._modelHint = '— provider 선택 —'; paintModels(); paintFoot(); return; }
    if (st.provider === 'openai' && !st.apiKey) { st._modelHint = '— API Key 입력 후 로드 —'; paintModels(); paintFoot(); return; }
    st._modelHint = '⏳ 모델 로드 중…'; paintModels(); paintFoot();
    try {
      const r = await fetch(BASE[st.provider] + '/models', { headers: st.apiKey ? { Authorization: 'Bearer ' + st.apiKey } : {} });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json(); const ids = (d.data || []).map(x => x.id).filter(Boolean).sort();
      if (!ids.length) throw new Error('모델 없음');
      st.models = ids; st.model = ids.includes(MODEL[st.provider]) ? MODEL[st.provider] : ids[0];
    } catch (e) {
      console.warn('모델 목록 실패 → 기본값:', e);
      const def = MODEL[st.provider] || ''; st.models = def ? [def] : []; st.model = def; st._modelHint = '목록 실패·기본값';
    }
    paintModels(); paintFoot();
  }

  // 런타임 끝말잇기 체인 생성: provider 분기. agent/미지원 → 폴백, openai-compatible → 선택 모델로 fetch.
  async function genChain() { if (st.provider === 'agent' || !BASE[st.provider]) return FALLBACK; try { return await llmChain(); } catch (e) { console.warn('LLM 실패 → 폴백 체인:', e); return FALLBACK; } }
  // openai-compatible(/v1/chat/completions) — 끝말잇기 단어 candidates 개 + 이야기 문장 생성.
  async function llmChain() {
    const n = Math.max(4, +st.candidates || 9);
    const prompt = `끝말잇기(앞 단어의 마지막 글자 = 다음 단어의 첫 글자) 규칙으로 이어지는 단어 ${n}개와, 각 단어가 자연스럽게 등장하며 하나로 이어지는 짧은 이야기 문장을 ${langName(st.lang)}로 만들어줘. 반드시 JSON 배열 [{"w":"단어","s":"문장"}] 형식만 출력(다른 설명 금지).`;
    const r = await fetch(BASE[st.provider] + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(st.apiKey ? { Authorization: 'Bearer ' + st.apiKey } : {}) }, body: JSON.stringify({ model: st.model || MODEL[st.provider] || '', messages: [{ role: 'user', content: prompt }], temperature: 0.4 }) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json(); const t = d.choices?.[0]?.message?.content || '';
    const arr = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)).filter(x => x && x.w && x.s);
    if (!arr.length) throw new Error('빈 응답'); return arr;
  }
  async function start() { if (!canStart()) return; if (!st._chain.length) st._chain = await genChain(); st.running = true; clearInterval(st._t); st._t = setInterval(rotate, 1000); rotate(); paintFoot(); }
  function pause() { st.running = false; clearInterval(st._t); paintFoot(); }
  function toggle() { st.running ? pause() : start(); }
  function rotate() { const cell = ORDER[st._pos % 4], item = st._chain[st._pos % st._chain.length]; st.words[cell] = item.w; st._cellWord[cell] = item; st.active = cell; st._pos++; paintGrid(); }
  function pick(cell) {
    const item = st._cellWord[cell]; if (!item) return;
    st._picked = cell; st.story.push(item.s); pause(); paintGrid(); paintStory();
    const b = EstreUI(host).find('.wc-lines')[0]; if (b) b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' });
    setTimeout(() => { if (canStart()) { st.running = true; clearInterval(st._t); st._t = setInterval(rotate, 1000); paintFoot(); } }, 1500);
  }
  const gridHtml = () => `<div class="wc-grid">${[0, 1, 2, 3].map(i => `<div class="wc-card ${st.active === i ? 'active' : ''} ${st._picked === i ? 'picked' : ''}" data-cell="${i}"><span class="wc-pos">${POS[i]}</span><span class="wc-word">${st.words[i]}</span></div>`).join('')}</div>`;
  const storyHtml = () => `<div class="wc-lines">${st.story.map(s => `<div class="wc-line">${s}</div>`).join('')}</div>`;
  function paintGrid() { const g = EstreUI(host).find('.wc-grid')[0]; if (g) g.outerHTML = gridHtml(); bindCards(); }
  function paintStory() { const l = EstreUI(host).find('.wc-lines')[0]; if (l) l.outerHTML = storyHtml(); }
  function paintFoot() { const t = EstreUI(host).find('#toggle')[0]; if (t) { t.textContent = st.running ? '⏸ 일시정지' : '▶ 시작'; t.disabled = !canStart(); t.className = st.running ? 'running' : ''; } }
  function paintModels() { const m = EstreUI(host).find('#model')[0]; if (!m) return; if (st.models.length) { m.innerHTML = st.models.map(id => `<option value="${id}"${id === st.model ? ' selected' : ''}>${id}</option>`).join(''); m.disabled = false; m.value = st.model; } else { m.innerHTML = `<option value="">${st._modelHint}</option>`; m.disabled = true; } }
  function bindCards() { EstreUI(host).find('.wc-card').on('click', e => pick(+e.currentTarget.dataset.cell)); }
  function renderOnce() {
    EstreUI(host).html(`
      <style>
        .wc-root{display:flex;flex-direction:column;height:100%;font:15px/1.5 system-ui,"Noto Sans KR",sans-serif}
        .wc-head{display:flex;gap:8px;justify-content:flex-end;padding:10px 18px 0}
        .wc{flex:1;min-height:0;display:flex;flex-direction:row-reverse;gap:18px;padding:18px}
        .wc-grid{display:grid;grid-template-columns:repeat(2,minmax(140px,200px));gap:14px;align-self:center}
        .wc-card{aspect-ratio:1.5;background:var(--panel,#171a21);border:1px solid var(--line,#2a2f3a);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;position:relative}
        .wc-card.active{border-color:var(--active,#d9a23b);box-shadow:0 0 0 1px var(--active,#d9a23b)}
        .wc-card.picked{border-color:var(--accent,#7a4dff)}
        .wc-pos{position:absolute;top:8px;left:10px;font-size:.6rem;color:var(--muted,#9aa3ad)}
        .wc-word{font-size:1.6rem;font-weight:700}
        .wc-story{flex:1.4 1 0;min-width:0;background:var(--panel2,#1e222b);border:1px solid var(--line,#2a2f3a);border-radius:12px;padding:12px 16px;display:flex;flex-direction:column}
        .wc-lines{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:6px}
        .wc-line{padding:6px 12px;background:var(--panel,#171a21);border:1px solid var(--line,#2a2f3a);border-left:3px solid var(--accent,#7a4dff);border-radius:9px;font-size:.95rem}
        .wc-foot{border-top:1px solid var(--line,#2a2f3a);padding:12px 18px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
        .wc-foot label{font-size:.66rem;color:var(--muted,#9aa3ad);display:block}
        .wc-foot select,.wc-foot input{background:var(--panel2,#1e222b);color:inherit;border:1px solid var(--line,#2a2f3a);border-radius:8px;padding:6px 9px;font:inherit;font-size:.84rem}
        #toggle{background:var(--done,#2fae66);color:#fff;border:0;font-weight:700;padding:10px 20px;border-radius:9px;cursor:pointer}
        #toggle:disabled{background:var(--panel2,#1e222b);color:var(--muted,#9aa3ad);cursor:not-allowed}
        #toggle.running{background:var(--active,#d9a23b)}
        #model{max-width:200px}
      </style>
      <div class="wc-root">
        <div class="wc-head"><button id="copy">⧉ 복사</button><button id="share">↗ 공유</button></div>
        <div class="wc"><div class="wc-story"><h3 style="margin:0 0 8px;font-size:.8rem;color:var(--muted,#9aa3ad)">지금까지의 스토리 (위 → 아래)</h3>${storyHtml()}</div>${gridHtml()}</div>
        <div class="wc-foot">
          <div><label>AI Provider</label><select id="provider"><option value="">— 선택 —</option><option value="agent">agent (현재 에이전트)</option><option value="openai">openai</option><option value="ollama">ollama</option><option value="vllm">vllm</option><option value="lmstudio">lmstudio</option></select></div>
          <div><label>API Key</label><input id="key" type="password" placeholder="sk-…"></div>
          <div><label>모델</label><select id="model" disabled><option value="">— provider 선택 —</option></select></div>
          <div><label>언어</label><select id="lang"><option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option></select></div>
          <div><label>문장 후보 수</label><input id="cand" type="number" min="1" max="30" value="${st.candidates}" style="width:64px"></div>
          <span style="flex:1"></span>
          <button id="toggle" disabled>▶ 시작</button>
        </div>
      </div>`);
    const $ = sel => EstreUI(host).find(sel)[0];
    $('#provider').value = st.provider; $('#lang').value = st.lang;
    EstreUI(host).find('#provider').on('change', e => { st.provider = e.target.value; save(); refreshModels(); });
    EstreUI(host).find('#key').on('input', e => { st.apiKey = e.target.value; scheduleModels(); });
    EstreUI(host).find('#model').on('change', e => { st.model = e.target.value; paintFoot(); });
    EstreUI(host).find('#lang').on('change', e => { st.lang = e.target.value; save(); });
    EstreUI(host).find('#cand').on('input', e => { st.candidates = +e.target.value; save(); });
    EstreUI(host).find('#toggle').on('click', toggle);
    EstreUI(host).find('#copy').on('click', () => { pause(); navigator.clipboard?.writeText(st.story.join('\n')); });
    EstreUI(host).find('#share').on('click', () => pause());
    bindCards(); refreshModels();
  }
  renderOnce();
  return { start, pause, toggle, get state() { return st; } };
}
