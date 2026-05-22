#!/usr/bin/env node
/**
 * estreux expand — Phase A thin spike PoC expander.
 *
 * 하나의 `.eux` 자연어 중간 소스 → `@targets` 에 명시된 다중 타깃(estreuv / estreui / pair)
 * 코드로 γ-driven expansion. 각 산출물에 provenance 헤더(source sha + trio)를 박아
 * drift-check 가 .eux ↔ 산출물 일관성을 감시할 수 있게 한다.
 *
 * ⚠ PoC 한정: 여기서 "expander" 는 **결정적 템플릿 매핑**(LLM stand-in)이다.
 * 단일 spec → 다중 타깃 구조·provenance·drift·재현성을 격리 검증하는 것이 목적이며,
 * 자연어 이해 기반 LLM expansion 은 Phase B 에서 같은 .eux 계약 위에 교체된다.
 * (LLM provider 는 provider-무관: 프런티어/BYOK + 로컬 Ollama·vLLM·LM Studio 수평 옵션, trio `model` 선택)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const euxPath = process.argv[2];
if (!euxPath) { console.error('usage: expand.mjs <file.eux>'); process.exit(2); }

const raw = readFileSync(euxPath, 'utf8');
const sha = createHash('sha256').update(raw).digest('hex').slice(0, 12);
const baseDir = dirname(resolve(euxPath));

// ---- .eux 파서 (약한 구조 — @directive 섹션) ----
function parseEux(text) {
  const spec = { component: '', intent: '', expansion: {}, targets: [], state: [], behavior: [], render: '', persist: {} };
  let section = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^@(\w+)\s*(.*)$/);
    if (m) {
      const [, key, rest] = m;
      if (key === 'component') spec.component = rest.trim();
      else if (key === 'intent') spec.intent = rest.trim();
      else if (key === 'expansion') rest.trim().split(/\s+/).forEach(kv => { const [k, v] = kv.split('='); spec.expansion[k] = v; });
      else if (key === 'targets') spec.targets = rest.split(',').map(s => s.trim()).filter(Boolean);
      else if (key === 'persist') { rest.trim().split(/\s+/).forEach(kv => { const [k, v] = kv.split('='); spec.persist[k] = v; }); section = null; }
      else section = key; // state / behavior / render
      continue;
    }
    if (section === 'state') {
      const sm = line.match(/^\s*(\w+)\s*:\s*(\w+)\s*=\s*([^#]+?)\s*(?:#\s*(.*))?$/);
      if (sm) spec.state.push({ name: sm[1], type: sm[2], default: sm[3].trim(), comment: (sm[4] || '').trim() });
    } else if (section === 'behavior') {
      const bm = line.match(/^\s*(\w+)(\([^)]*\))?\s*:\s*(.+)$/);
      if (bm) spec.behavior.push({ name: bm[1], args: (bm[2] || '()').replace(/[()]/g, ''), desc: bm[3].trim() });
    } else if (section === 'render') {
      if (line.trim()) spec.render += (spec.render ? '\n' : '') + line.trim();
    }
  }
  return spec;
}

const spec = parseEux(raw);
const trio = `temp=${spec.expansion.temperature} model=${spec.expansion.model} template=${spec.expansion.template}`;

function header(targetId) {
  return [
    '// ┌─ estreux:expanded ──────────────────────────────────────────────',
    `// │ source : ${spec.component}.eux  (sha256:${sha})`,
    `// │ target : ${targetId}`,
    `// │ trio   : ${trio}`,
    '// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run expand` 로 재생성 (drift-check 감시).',
    '// └─────────────────────────────────────────────────────────────────',
    '',
  ].join('\n');
}

const C = spec.component;                                  // 'notif-toggle'
const Cls = C.split(/[-_]/).map(s => s[0].toUpperCase() + s.slice(1)).join(''); // 'NotifToggle'
const pkey = spec.persist.key || C;
const pfields = (spec.persist.fields || spec.state.map(s => s.name).join(',')).split(',').map(s => s.trim());
const jsDefault = (s) => s.type === 'boolean' ? s.default : (s.type === 'number' ? s.default : JSON.stringify(s.default));
const renderComment = spec.render.split('\n').map(l => '   * ' + l).join('\n');

// ---- 타깃별 생성기 (단일 spec → 각 타깃) ----
function genEstreuv() {
  const props = spec.state.map(s => `${s.name}: { type: ${s.type === 'boolean' ? 'Boolean' : s.type === 'number' ? 'Number' : 'String'} }`).join(', ');
  const inits = spec.state.map(s => `this.${s.name} = ${jsDefault(s)};`).join(' ');
  const methods = spec.behavior.map(b => {
    if (b.name === 'toggle') return `  toggle() { this.enabled = !this.enabled; this.#save(); }`;
    if (b.name === 'bump') return `  bump(${b.args}) { this.count += ${b.args}; }`;
    if (b.name === 'clear') return `  clear() { this.count = 0; }`;
    return `  ${b.name}(${b.args}) { /* ${b.desc} */ }`;
  }).join('\n');
  return header('estreuv') + `import { EstreUVElement } from 'estreuv';
import { html } from 'lit';

/**
 * <${C}> — estreuv(micro-Rimwork, Lit) 단독 변종.
${renderComment}
 */
export class ${Cls} extends EstreUVElement {
  static properties = { ${props} };
  constructor() { super(); ${inits} this.#load(); }
${methods}
  #load() { try { const s = JSON.parse(localStorage.getItem('${pkey}') || '{}'); ${pfields.map(f => `if ('${f}' in s) this.${f} = s.${f};`).join(' ')} } catch {} }
  #save() { localStorage.setItem('${pkey}', JSON.stringify({ ${pfields.map(f => `${f}: this.${f}`).join(', ')} })); }
  render() {
    return html\`<button class="nt-btn" @click=\${() => this.toggle()}>\${this.enabled ? '🔔' : '🔕'}</button>\${this.count > 0 ? html\`<span class="nt-badge">\${this.count}</span>\` : ''}\`;
  }
}
customElements.define('${C}', ${Cls});
`;
}

function genEstreui() {
  const stateInit = spec.state.map(s => `${s.name}: ${jsDefault(s)}`).join(', ');
  return header('estreui') + `import { EstreUI } from 'estreui';

/**
 * ${C} — EstreUI(macro-Rimwork, jQuery-class primitive) 단독 변종. (PoC 대표 패턴)
${renderComment}
 */
export function ${Cls.charAt(0).toLowerCase() + Cls.slice(1)}(host) {
  const state = { ${stateInit}, ...load() };
  function load() { try { return JSON.parse(localStorage.getItem('${pkey}') || '{}'); } catch { return {}; } }
  function save() { localStorage.setItem('${pkey}', JSON.stringify({ ${pfields.map(f => `${f}: state.${f}`).join(', ')} })); }
  function toggle() { state.enabled = !state.enabled; save(); paint(); }
  function bump(n) { state.count += n; paint(); }
  function clear() { state.count = 0; paint(); }
  function paint() {
    EstreUI(host).html(\`<button class="nt-btn">\${state.enabled ? '🔔' : '🔕'}</button>\${state.count > 0 ? \`<span class="nt-badge">\${state.count}</span>\` : ''}\`);
    EstreUI(host).find('.nt-btn').on('click', toggle);
  }
  paint();
  return { toggle, bump, clear, get state() { return state; } };
}
`;
}

function genPair() {
  return header('pair') + `import './../estreuv/${C}.js';

/**
 * ${C}-panel — pair 변종: EstreUI 컨테이너가 estreuv <${C}> 엘리먼트를 호스팅.
 * macro(EstreUI page/section) ↔ micro(estreuv widget) 페어링 시연.
 */
export function ${Cls.charAt(0).toLowerCase() + Cls.slice(1)}Panel(host) {
  host.innerHTML = \`<div class="nt-panel"><${C}></${C}></div>\`;
  const el = host.querySelector('${C}');
  return {
    bump: (n) => el.bump(n),
    clear: () => el.clear(),
    get enabled() { return el.enabled; },
    get count() { return el.count; },
  };
}
`;
}

const gen = { estreuv: genEstreuv, estreui: genEstreui, pair: genPair };

// ---- expansion 실행 ----
const t0 = Date.now();
const written = [];
for (const id of spec.targets) {
  if (!gen[id]) { console.error(`unknown target: ${id}`); process.exit(2); }
  const out = resolve(baseDir, 'dist', id, `${C}.js`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, gen[id]());
  written.push({ id, out });
}
const ms = Date.now() - t0;
console.log(`estreux expand — ${spec.component}.eux (sha256:${sha})`);
console.log(`  trio: ${trio}`);
for (const w of written) console.log(`  ✓ ${w.id.padEnd(8)} → ${w.out.replace(baseDir + '/', '').replace(baseDir + '\\', '')}`);
console.log(`  ${written.length} targets in ${ms}ms`);
