// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : wordchain-story.eux  (sha256:2a36455f04be)
// │ target : estreui   provider : agent/claude
// │ trio   : temp=0.4 model=agent/claude template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { EstreUI } from 'estreui';

// provider=agent 이거나 키 미설정·실패 시 폴백 끝말잇기 후보(런타임 LLM stand-in)
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
const BASE = { openai: 'https://api.openai.com/v1', google: 'https://generativelanguage.googleapis.com/v1beta/openai', ollama: 'http://localhost:11434/v1', vllm: 'http://localhost:8000/v1', lmstudio: 'http://localhost:1234/v1' };
const MODEL = { openai: 'gpt-4o-mini', google: 'gemini-2.0-flash', ollama: 'llama3.2', vllm: '', lmstudio: 'local-model' };
const KEYLESS = new Set(['ollama', 'vllm', 'lmstudio']);   // 키 불요 로컬 provider — 그 외(openai·google)는 키 필요
const langName = l => l === 'en' ? '영어' : l === 'ja' ? '일본어' : '한국어';

/**
 * wordchainStory — EstreUI(macro-Rimwork, jQuery-class primitive) 단독 변종.
 * 카드가 시계방향으로 후보 단어를 회전. 카드 클릭 시 그 문장이 스토리에 누적(스무스 스크롤)되고, 곧바로
 * 누적 스토리(+직전 단어 끝글자 끝말잇기)를 입력으로 다음 후보를 새로 생성(regenerate)해 회전 재개.
 * 후보를 한 바퀴 다 노출하도록 선택이 없으면(무한 회전 방지) 안내 배너 + 3초 카운트(exhausted) 후 새 후보 생성.
 * 1회 렌더 후 카드/스토리/모델/배너 영역만 부분 갱신(설정 입력 보존). 모델 선택까지 끝나야 시작 가능.
 */
export function wordchainStory(host) {
  const st = { running: false, words: ['·', '·', '·', '·'], story: [], active: -1, candidates: 9, provider: '', apiKey: '', model: '', models: [], _modelHint: '— provider 선택 —', lang: (navigator.language || 'ko').slice(0, 2), chain: [], lastWord: '', _pos: 0, _order: 0, _cellItem: {}, _picked: -1, _t: null, _ct: null, _ft: null };
  try { const s = JSON.parse(localStorage.getItem('wordchain-story') || '{}'); ['lang', 'candidates', 'provider'].forEach(k => k in s && (st[k] = s[k])); } catch {}
  const save = () => localStorage.setItem('wordchain-story', JSON.stringify({ lang: st.lang, candidates: st.candidates, provider: st.provider }));
  const canStart = () => st.provider === 'agent' || (!!BASE[st.provider] && !!st.model);
  const candCount = () => Math.max(4, +st.candidates || 9);

  // provider(+key) 가 정해지면 /v1/models 로 사용 가능한 모델 목록을 받아 채운다. 실패 시 기본 모델 1개로 폴백.
  let modelTimer = null;
  const scheduleModels = () => { clearTimeout(modelTimer); modelTimer = setTimeout(refreshModels, 600); };
  async function refreshModels() {
    st.model = ''; st.models = [];
    if (st.provider === 'agent') { st._modelHint = '에이전트 자동'; paintModels(); paintFoot(); return; }
    if (!BASE[st.provider]) { st._modelHint = '— provider 선택 —'; paintModels(); paintFoot(); return; }
    if (!KEYLESS.has(st.provider) && !st.apiKey) { st._modelHint = '— API Key 입력 후 로드 —'; paintModels(); paintFoot(); return; }
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

  // 폴백(LLM 실패·agent): lastWord 끝글자로 시작하는 항목 우선 정렬해 N개.
  function fallbackChain() {
    const n = candCount();
    if (!st.lastWord) return FALLBACK.slice(0, n);
    const head = st.lastWord.slice(-1);
    const m = FALLBACK.filter(x => x.w[0] === head), rest = FALLBACK.filter(x => x.w[0] !== head);
    return [...m, ...rest].slice(0, n);
  }
  // 후보 생성: provider 분기. agent/미지원/실패 → 폴백, openai-compatible → 선택 모델로 fetch.
  async function genChain() { if (st.provider === 'agent' || !BASE[st.provider]) return fallbackChain(); try { return await llmChain(); } catch (e) { console.warn('LLM 실패 → 폴백 체인:', e); return fallbackChain(); } }
  // openai-compatible(/v1/chat/completions) — 누적 스토리(+끝말잇기 제약)로 다음 후보 N개 생성.
  async function llmChain() {
    const n = candCount();
    const ctx = st.story.length ? st.story.map((s, i) => `${i + 1}. ${s}`).join('\n') : '(아직 없음 — 첫 문장)';
    const rule = st.lastWord
      ? `끝말잇기 규칙: 각 후보의 핵심 단어 w 는 반드시 '${st.lastWord.slice(-1)}' 글자로 시작해야 한다.`
      : '각 후보는 서로 다른 핵심 단어로 시작한다.';
    const prompt = `지금까지 이어진 이야기:\n${ctx}\n\n이 이야기에 자연스럽게 이어질 다음 문장 후보 ${n}개를 ${langName(st.lang)}로 만들어줘.\n${rule}\n각 후보는 {핵심 단어 w, 그 단어가 자연스럽게 등장하는 한 문장 s} 형식.\n반드시 JSON 배열 [{"w":"단어","s":"문장"}] 형식만 출력(다른 설명 금지).`;
    const r = await fetch(BASE[st.provider] + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(st.apiKey ? { Authorization: 'Bearer ' + st.apiKey } : {}) }, body: JSON.stringify({ model: st.model || MODEL[st.provider] || '', messages: [{ role: 'user', content: prompt }], temperature: 0.6 }) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json(); const t = d.choices?.[0]?.message?.content || '';
    const arr = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)).filter(x => x && x.w && x.s);
    if (!arr.length) throw new Error('빈 응답'); return arr;
  }

  function start() {
    if (!canStart()) return;
    st.running = true; paintFoot();
    if (!st.chain.length) regenerate();                                       // 첫 생성
    else { clearInterval(st._t); st._t = setInterval(rotate, 1000); rotate(); }   // 재개
  }
  function pause() { st.running = false; clearInterval(st._t); clearInterval(st._ct); paintFoot(); }
  function toggle() { st.running ? pause() : start(); }
  // 1초마다 다음 후보를 시계방향 카드에 노출. 후보 한 바퀴 다 노출하면(무한 회전 방지) exhausted.
  function rotate() {
    if (st._pos >= st.chain.length) { exhausted(); return; }
    const cell = ORDER[st._order % 4], item = st.chain[st._pos];
    st.words[cell] = item.w; st._cellItem[cell] = item; st.active = cell; st._picked = -1;
    st._order++; st._pos++; paintGrid();
  }
  // 후보 소진(끝말잇기 막힘): 안내 배너 + 3초 카운트. 그 안에 선택 없으면 새 후보 생성.
  function exhausted() {
    clearInterval(st._t);
    let n = 3;
    const msg = () => `끝말잇기를 더 이어갈 단어가 없어요. 카드를 선택하거나 ${n}초 후 새 문장을 생성합니다…`;
    showBanner(msg()); clearInterval(st._ct);
    st._ct = setInterval(() => { n--; if (n <= 0) { clearInterval(st._ct); regenerate(); } else showBanner(msg()); }, 1000);
  }
  // 누적 스토리(+직전 단어)를 입력으로 새 후보 N개 생성 후 회전 재시작.
  async function regenerate() {
    clearInterval(st._t); clearInterval(st._ct);
    showBanner('다음 문장 후보를 생성하는 중…');
    let next; try { next = await genChain(); } catch (e) { console.warn('LLM 실패 → 폴백:', e); next = fallbackChain(); }
    if (!st.running) { hideBanner(); return; }   // 생성 중 정지됐으면 중단
    st.chain = next; st._pos = 0; st._order = 0; st._cellItem = {};
    hideBanner(); clearInterval(st._t); st._t = setInterval(rotate, 1000); rotate();
  }
  function pick(cell) {
    const item = st._cellItem[cell]; if (!item) return;
    clearInterval(st._t); clearInterval(st._ct);
    st._picked = cell; st.story.push(item.s); st.lastWord = item.w; paintGrid(); paintStory();
    const b = EstreUI(host).find('.wc-lines')[0]; if (b) b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' });
    if (st.running) regenerate();   // 선택할 때마다 누적 스토리로 새 후보 N개
  }

  function showBanner(m) { const b = EstreUI(host).find('#banner')[0]; if (b) { b.textContent = m; b.hidden = false; } }
  function hideBanner() { const b = EstreUI(host).find('#banner')[0]; if (b) b.hidden = true; }
  function flash(m) { showBanner(m); clearTimeout(st._ft); st._ft = setTimeout(hideBanner, 2400); }
  // 복사·공유 = 누적 스토리 전체. 클릭 시 일시정지.
  function doCopy() {
    pause(); if (!st.story.length) { flash('복사할 스토리가 아직 없어요.'); return; }
    navigator.clipboard?.writeText(st.story.join('\n')).then(() => flash('스토리 전체를 클립보드에 복사했어요.'), () => flash('복사 실패 — 권한을 확인하세요.'));
  }
  async function doShare() {
    pause(); if (!st.story.length) { flash('공유할 스토리가 아직 없어요.'); return; }
    const text = st.story.join('\n');
    if (navigator.share) { try { await navigator.share({ title: '끝말잇기 스토리', text }); } catch { /* 사용자 취소 */ } }
    else { try { await navigator.clipboard.writeText(text); flash('공유 미지원 — 클립보드에 복사했어요.'); } catch { flash('공유/복사 미지원.'); } }
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
        .wc-banner{margin:10px 18px 0;padding:9px 13px;background:rgba(217,162,59,.14);border:1px solid var(--active,#d9a23b);border-radius:10px;color:var(--active,#d9a23b);font-size:.84rem}
        .wc-banner[hidden]{display:none}
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
        <div id="banner" class="wc-banner" hidden></div>
        <div class="wc"><div class="wc-story"><h3 style="margin:0 0 8px;font-size:.8rem;color:var(--muted,#9aa3ad)">지금까지의 스토리 (위 → 아래)</h3>${storyHtml()}</div>${gridHtml()}</div>
        <div class="wc-foot">
          <div><label>AI Provider</label><select id="provider"><option value="">— 선택 —</option><option value="agent">agent (현재 에이전트)</option><option value="openai">openai</option><option value="google">google (gemini)</option><option value="ollama">ollama</option><option value="vllm">vllm</option><option value="lmstudio">lmstudio</option></select></div>
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
    EstreUI(host).find('#copy').on('click', doCopy);
    EstreUI(host).find('#share').on('click', doShare);
    bindCards(); refreshModels();
  }
  renderOnce();
  return { start, pause, toggle, get state() { return st; } };
}
