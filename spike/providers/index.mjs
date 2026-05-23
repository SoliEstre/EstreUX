/**
 * LLM provider 레지스트리 — provider-무관 수평 옵션.
 *
 * trio `model` 형식: `<provider>/<name>[@<sha>]`
 *   예) template/deterministic-templater@v0 · ollama/llama3.3:70b@<sha> ·
 *       vllm/Hermes-3-Llama-3.1-70B · lmstudio/… · openai/gpt-4o
 *
 * 특정 provider 를 기본으로 두지 않는다(품질=프런티어/BYOK, 비용·오프라인=로컬).
 */
import * as template from './template.mjs';
import * as openaiCompatible from './openai-compatible.mjs';

const OPENAI_COMPAT = new Set(['ollama', 'vllm', 'lmstudio', 'openai', 'azure']);

export function parseModel(model) {
  const lhs = String(model || '').split('@')[0];
  const slash = lhs.indexOf('/');
  return {
    provider: slash >= 0 ? lhs.slice(0, slash) : lhs,
    name: slash >= 0 ? lhs.slice(slash + 1) : '',
  };
}

export function resolveProvider(model) {
  const { provider } = parseModel(model);
  if (provider === 'template' || provider === 'poc') return template;
  if (OPENAI_COMPAT.has(provider)) return openaiCompatible;
  throw new Error(`알 수 없는 LLM provider: '${provider}' (지원: template, ${[...OPENAI_COMPAT].join(', ')})`);
}
