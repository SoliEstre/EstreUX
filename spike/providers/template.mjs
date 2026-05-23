/**
 * template provider — 결정적 PoC expander (LLM stand-in).
 *
 * spec → 타깃별 코드 **본문**(provenance 헤더 제외, expand.mjs 가 헤더를 붙임)을 결정적으로 생성.
 * Phase B 에선 openai-compatible(또는 다른) provider 로 교체되며 같은 인터페이스를 따른다.
 *
 * 인터페이스: `async expand(spec, target, ctx) -> string(code body)`
 */
export const id = 'template';

function derive(spec) {
  const C = spec.component;
  const Cls = C.split(/[-_]/).map(s => s[0].toUpperCase() + s.slice(1)).join('');
  const pkey = spec.persist.key || C;
  const pfields = (spec.persist.fields || spec.state.map(s => s.name).join(',')).split(',').map(s => s.trim());
  const jsDefault = (s) => s.type === 'boolean' ? s.default : (s.type === 'number' ? s.default : JSON.stringify(s.default));
  const renderComment = spec.render.split('\n').map(l => '   * ' + l).join('\n');
  return { C, Cls, pkey, pfields, jsDefault, renderComment };
}

function genEstreuv(spec, d) {
  const props = spec.state.map(s => `${s.name}: { type: ${s.type === 'boolean' ? 'Boolean' : s.type === 'number' ? 'Number' : 'String'} }`).join(', ');
  const inits = spec.state.map(s => `this.${s.name} = ${d.jsDefault(s)};`).join(' ');
  const methods = spec.behavior.map(b => {
    if (b.name === 'toggle') return `  toggle() { this.enabled = !this.enabled; this.#save(); }`;
    if (b.name === 'bump') return `  bump(${b.args}) { this.count += ${b.args}; }`;
    if (b.name === 'clear') return `  clear() { this.count = 0; }`;
    return `  ${b.name}(${b.args}) { /* ${b.desc} */ }`;
  }).join('\n');
  return `import { EstreUVElement } from 'estreuv';
import { html } from 'lit';

/**
 * <${d.C}> — estreuv(micro-Rimwork, Lit) 단독 변종.
${d.renderComment}
 */
export class ${d.Cls} extends EstreUVElement {
  static properties = { ${props} };
  constructor() { super(); ${inits} this.#load(); }
${methods}
  #load() { try { const s = JSON.parse(localStorage.getItem('${d.pkey}') || '{}'); ${d.pfields.map(f => `if ('${f}' in s) this.${f} = s.${f};`).join(' ')} } catch {} }
  #save() { localStorage.setItem('${d.pkey}', JSON.stringify({ ${d.pfields.map(f => `${f}: this.${f}`).join(', ')} })); }
  render() {
    return html\`<button class="nt-btn" @click=\${() => this.toggle()}>\${this.enabled ? '🔔' : '🔕'}</button>\${this.count > 0 ? html\`<span class="nt-badge">\${this.count}</span>\` : ''}\`;
  }
}
customElements.define('${d.C}', ${d.Cls});
`;
}

function genEstreui(spec, d) {
  const stateInit = spec.state.map(s => `${s.name}: ${d.jsDefault(s)}`).join(', ');
  const lower = d.Cls.charAt(0).toLowerCase() + d.Cls.slice(1);
  return `// EstreUI 는 export 없는 classic-script 프레임워크 — v1.5.1+ 가 window 에 노출한 페이지
// 표면을 module-realm 에서 가져온다. 페이지 내부 DOM 은 EstreUI 관례대로 jQuery(handle.$host)로 그린다.
const { EstrePageHandler, EstreUiCustomPageManager } = window;

/**
 * ${d.C} — EstreUI(macro-Rimwork) 변종: estreUi 페이지 시스템에 article 로 마운트. (PoC 대표 패턴)
${d.renderComment}
 */
function build${d.Cls}($host) {
  const state = { ${stateInit}, ...load() };
  function load() { try { return JSON.parse(localStorage.getItem('${d.pkey}') || '{}'); } catch { return {}; } }
  function save() { localStorage.setItem('${d.pkey}', JSON.stringify({ ${d.pfields.map(f => `${f}: state.${f}`).join(', ')} })); }
  function toggle() { state.enabled = !state.enabled; save(); paint(); }
  function bump(n) { state.count += n; paint(); }
  function clear() { state.count = 0; paint(); }
  function paint() {
    $host.html(\`<button class="nt-btn">\${state.enabled ? '🔔' : '🔕'}</button>\${state.count > 0 ? \`<span class="nt-badge">\${state.count}</span>\` : ''}\`);
    $host.find('.nt-btn').on('click', toggle);
  }
  paint();
  return { toggle, bump, clear, get state() { return state; } };
}

/** EstreUI 페이지 핸들러 — onBring 에서 article($host)에 UI 빌드. */
class ${d.Cls}Handler extends EstrePageHandler {
  onBring(handle) { this._w = build${d.Cls}(handle.$host); }
}

export const ${lower}Alias = '${lower}';
export const ${lower}Pid = '$s&m=${lower}#root@main';
export { ${d.Cls}Handler };

/** 데모/검증 편의 — 매니저에 등록 후 바로 띄운다. 실제 앱은 PagesProvider 에 합쳐 넣는 게 표준. */
export function mount${d.Cls}(mgr) {
  const m = mgr || new EstreUiCustomPageManager();
  m.init({ [${lower}Alias]: ${lower}Pid }, { [${lower}Alias]: ${d.Cls}Handler });
  return m.bringPage(${lower}Alias);
}
`;
}

function genPair(spec, d) {
  return `import './../estreuv/${d.C}.js';

/**
 * ${d.C}-panel — pair 변종: EstreUI 컨테이너가 estreuv <${d.C}> 엘리먼트를 호스팅.
 * macro(EstreUI page/section) ↔ micro(estreuv widget) 페어링 시연.
 */
export function ${d.Cls.charAt(0).toLowerCase() + d.Cls.slice(1)}Panel(host) {
  host.innerHTML = \`<div class="nt-panel"><${d.C}></${d.C}></div>\`;
  const el = host.querySelector('${d.C}');
  return {
    bump: (n) => el.bump(n),
    clear: () => el.clear(),
    get enabled() { return el.enabled; },
    get count() { return el.count; },
  };
}
`;
}

const GEN = { estreuv: genEstreuv, estreui: genEstreui, pair: genPair };

export async function expand(spec, target /*, ctx */) {
  const gen = GEN[target];
  if (!gen) throw new Error(`template: unknown target '${target}'`);
  return gen(spec, derive(spec));
}
