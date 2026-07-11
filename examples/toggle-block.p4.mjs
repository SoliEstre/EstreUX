// examples/toggle-block.p4.mjs
//
// P4b dynamic-gate anchor for toggle-block.eux — executes the spec's @metamorphic
// properties (round_trip / idempotency / determinism) against the brewed estreuv
// implementation. Loaded by `spike/p4-check.mjs --run examples/toggle-block.eux`
// (P4b contract: `run(props)` export next to the .eux).
//
// Runtime + dev-deps + env overrides: same profile as num-keypad.p4.mjs (happy-dom
// bootstrap with force-registered DOM globals — see that file's header for the
// Node-Event-realm rationale and the estreuv in-tree-copy install note).
//
//   EUX_P4_IMPL  — alternative implementation module (default ./dist/estreuv/toggle-block.js)
//   EUX_P4_RUNS  — fast-check numRuns per property (default 25)

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = 20260711;
const RUNS = Math.max(1, parseInt(process.env.EUX_P4_RUNS || '25', 10) || 25);

const IMPL_PATH = process.env.EUX_P4_IMPL
  ? resolve(process.cwd(), process.env.EUX_P4_IMPL)
  : join(HERE, 'dist', 'estreuv', 'toggle-block.js');

const DOM_GLOBALS = [
  'Document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element',
  'Node', 'Text', 'Comment', 'CharacterData', 'EventTarget', 'CustomEvent',
  'Event', 'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'InputEvent',
  'customElements', 'DocumentFragment', 'ShadowRoot', 'MutationObserver',
  'navigator', 'requestAnimationFrame', 'cancelAnimationFrame',
  'getComputedStyle', 'CSSStyleSheet',
];

async function bootDomAndImpl() {
  let HD;
  try {
    HD = await import('happy-dom');
  } catch {
    throw new Error("dev-dep 'happy-dom' not installed — this anchor drives a Lit/shadow-DOM component and needs a DOM. Install happy-dom (plus lit + estreuv) next to the anchor.");
  }
  const win = new HD.Window();
  globalThis.window = win;
  globalThis.document = win.document;
  for (const k of DOM_GLOBALS) {
    if (win[k] === undefined) continue;
    try { globalThis[k] = win[k]; }
    catch { Object.defineProperty(globalThis, k, { value: win[k], configurable: true }); }
  }
  await import(pathToFileURL(IMPL_PATH).href); // side effect: customElements.define('toggle-block', ...)
  return win;
}

// ---------------------------------------------------------------------------
// harness helpers
// ---------------------------------------------------------------------------

async function mkToggle({ collapsed = false, label = 'p4' } = {}) {
  document.documentElement.removeAttribute('data-on-swipe');
  document.body?.removeAttribute?.('data-on-swipe');
  document.body.innerHTML = '';
  const el = document.createElement('toggle-block');
  el.label = label;
  document.body.appendChild(el);
  await el.updateComplete;
  if (collapsed !== el.collapsed) {
    el.setCollapsed(collapsed);
    await el.updateComplete;
  }
  return el;
}

function stateOf(el) {
  return {
    collapsed: el.collapsed,
    attr: el.getAttribute('data-collapsed'),
  };
}

// Structural render fingerprint — shadow markup plus the host attribute the
// arrow/body CSS keys off (:host([data-collapsed="1"])).
function renderFingerprint(el) {
  return `${el.getAttribute('data-collapsed')}::${el.shadowRoot.innerHTML}`;
}

// ---------------------------------------------------------------------------
// property mappings — one entry per @metamorphic clause in toggle-block.eux.
// ---------------------------------------------------------------------------

function buildMappings(fc) {
  return [
    {
      key: 'round_trip/toggle-twice-restores',
      match: p => p.kind === 'round_trip' && /toggle/.test(p.desc),
      note: 'header-click toggle x2 from either initial state restores both collapsed and the host data-collapsed attribute.',
      prop: fc => fc.asyncProperty(fc.boolean(), fc.string({ maxLength: 8 }), async (c0, label) => {
        const el = await mkToggle({ collapsed: c0, label });
        const before = stateOf(el);
        const header = el.shadowRoot.querySelector('.header');
        header.click();
        await el.updateComplete;
        if (el.collapsed === c0) return false;      // first toggle must actually flip
        header.click();
        await el.updateComplete;
        const after = stateOf(el);
        return after.collapsed === before.collapsed && after.attr === before.attr;
      }),
    },
    {
      key: 'idempotency/setCollapsed-same-v',
      match: p => p.kind === 'idempotency' && /setCollapsed/.test(p.desc),
      note: 'setCollapsed(v) with the current v repeated N times re-fires neither the data-collapsed reflection nor the toggle CustomEvent (at-most-once per actual transition).',
      prop: fc => fc.asyncProperty(fc.boolean(), fc.integer({ min: 1, max: 5 }), async (v, n) => {
        const el = await mkToggle({ collapsed: v });
        let events = 0;
        el.addEventListener('toggle', () => events++);
        const attrBefore = el.getAttribute('data-collapsed');
        for (let i = 0; i < n; i++) {
          el.setCollapsed(v);
          await el.updateComplete;
        }
        return events === 0 && el.getAttribute('data-collapsed') === attrBefore && el.collapsed === v;
      }),
    },
    {
      key: 'determinism/render-structure-by-state',
      match: p => p.kind === 'determinism' && /collapsed/.test(p.desc),
      note: 'two fresh instances with the same (collapsed, label) produce identical render structure — shadow markup + the data-collapsed host attribute the arrow rotation and body fold key off.',
      prop: fc => fc.asyncProperty(fc.boolean(), fc.string({ maxLength: 8 }), async (c, label) => {
        const a = await mkToggle({ collapsed: c, label });
        const fpA = renderFingerprint(a);
        const b = await mkToggle({ collapsed: c, label });
        return fpA === renderFingerprint(b);
      }),
    },
  ];
}

// ---------------------------------------------------------------------------
// runner contract
// ---------------------------------------------------------------------------

export async function run(props) {
  let fcm;
  try {
    fcm = await import('fast-check');
  } catch {
    throw new Error("dev-dep 'fast-check' not installed next to this anchor.");
  }
  const fc = fcm.default ?? fcm;
  await bootDomAndImpl();
  const mappings = buildMappings(fc);

  console.log(`    impl: ${IMPL_PATH}`);
  console.log(`    dom: happy-dom · fast-check seed=${SEED} numRuns=${RUNS}\n`);

  const failures = [];
  let passed = 0, skipped = 0;
  const used = new Set();

  for (const p of props) {
    const m = mappings.find(m => !used.has(m.key) && m.match(p));
    if (!m) {
      failures.push(`unmapped @metamorphic clause (${p.kind}): "${p.desc}" — no anchor implementation; conservative FAIL.`);
      console.log(`  ✗ FAIL [unmapped] ${p.kind}: ${p.desc}`);
      continue;
    }
    used.add(m.key);
    if (m.skip) { skipped++; console.log(`  ~ SKIP ${m.key}\n         ${m.skip}`); continue; }
    try {
      await fc.assert(m.prop(fc), { seed: SEED, numRuns: RUNS });
      passed++;
      console.log(`  ✓ PASS ${m.key} (${RUNS} runs)\n         ${m.note}`);
    } catch (e) {
      failures.push(`${m.key}: ${String(e.message).split('\n').slice(0, 6).join('\n')}`);
      console.log(`  ✗ FAIL ${m.key}\n         ${String(e.message).split('\n')[0]}`);
    }
  }

  const orphans = mappings.filter(m => !used.has(m.key));
  if (orphans.length) {
    console.log(`\n  note: ${orphans.length} anchor mapping(s) not exercised by the .eux: ${orphans.map(o => o.key).join(', ')} — clause-deletion verdicts belong to the static gate (P3 drift-check).`);
  }

  console.log(`\n  coverage: ${passed} attested · ${skipped} skipped (disclosed) · ${failures.length} failed — of ${props.length} clauses`);
  if (failures.length) {
    throw new Error(`P4 dynamic gate: ${failures.length} failure(s)\n` + failures.map(f => `  - ${f}`).join('\n'));
  }
}
