/**
 * openai-compatible provider — Ollama / vLLM / LM Studio / OpenAI 공통 어댑터.
 *
 * 넷 다 OpenAI 호환 `/v1/chat/completions` 를 제공하므로 하나의 어댑터로 **수평** 지원.
 * provider 선택은 trio `model` prefix(`ollama/…`·`vllm/…`·`lmstudio/…`·`openai/…`)로.
 * 로컬/오픈웨이트는 함수호출·구조적 출력에 강한 모델(예: Nous Hermes 계열)이 expansion 에 적합 —
 * Hermes 류 tool-use/structured-output 연동을 향후 프롬프트 계약 설계의 참고로 둔다.
 *
 * 인터페이스: `async expand(spec, target, ctx) -> string(code body)`
 * ⚠ Phase A 검증은 template provider 로 수행(라이브 LLM 없음). 본 어댑터는 인터페이스·호출 경로용.
 * 설정: ESTREUX_LLM_BASE_URL (기본 provider별), ESTREUX_LLM_API_KEY / OPENAI_API_KEY.
 */
export const id = 'openai-compatible';

const DEFAULT_BASE = {
  ollama: 'http://localhost:11434/v1',
  vllm: 'http://localhost:8000/v1',
  lmstudio: 'http://localhost:1234/v1',
  openai: 'https://api.openai.com/v1',
  azure: '',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai',   // Gemini OpenAI-호환 레이어
};

function buildMessages(spec, target) {
  const system = [
    'You are EstreUX, a code expander for the Estre ecosystem.',
    `Expand the given .eux natural-language spec into a single "${target}" module.`,
    'Targets — estreuv: a Lit-based micro-rimwork custom element; estreui: a jQuery-class macro-rimwork module; pair: an EstreUI container hosting the estreuv element.',
    'Honor the @ports section as the host contract — in: props injected by the host (exact keys/types), cmd: command-in methods the host calls to update the component (expose with exact signatures on the returned controller, e.g. setData/feed), out: event-out callbacks the component invokes on the host (exact signatures), deps: injected dependencies (never construct internally, receive via opts).',
    'Honor the @state / @behavior / @render / @persist sections. Output ONLY code in one ```js fenced block, no prose.',
  ].join('\n');
  const user = 'TARGET: ' + target + '\n\n.eux spec (parsed):\n' + JSON.stringify(spec, null, 2);
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

function extractCode(text) {
  const m = String(text).match(/```(?:js|javascript|ts)?\s*\n([\s\S]*?)```/);
  return (m ? m[1] : String(text)).trim() + '\n';
}

export async function expand(spec, target, ctx) {
  const provider = ctx.modelProvider;
  const model = ctx.modelName;
  const base = process.env.ESTREUX_LLM_BASE_URL || DEFAULT_BASE[provider];
  const key = process.env.ESTREUX_LLM_API_KEY || process.env.OPENAI_API_KEY || '';
  if (!base) throw new Error(`openai-compatible: provider '${provider}' 의 baseURL 미설정 — ESTREUX_LLM_BASE_URL 필요`);
  if (typeof fetch !== 'function') throw new Error('global fetch 필요 (Node 18+)');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model,
      temperature: Number(ctx.expansion.temperature) || 0,
      messages: buildMessages(spec, target),
    }),
  });
  if (!res.ok) throw new Error(`LLM 요청 실패 ${provider} ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  return extractCode(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '');
}
