// examples/num-keypad.p4.mjs
//
// P4b dynamic-gate anchor for num-keypad.eux — executes the spec's @metamorphic
// properties (idempotency x2 / determinism x1) against the brewed estreuv
// implementation. Loaded by `spike/p4-check.mjs --run examples/num-keypad.eux`
// (P4b contract: `run(props)` export next to the .eux).
//
// Runtime: this is a UI component (Lit / shadow DOM), so the anchor boots a
// happy-dom Window and force-registers its DOM classes as Node globals BEFORE
// importing the implementation. Force-override matters: Node >=15 ships its own
// global Event/CustomEvent/EventTarget, and a conditional `if (!(k in globalThis))`
// registration lets @lit/context subclass Node's Event — which happy-dom's
// dispatchEvent then rejects ("parameter 1 is not of type 'Event'").
//
// Dev-deps (alongside fast-check): happy-dom, lit, estreuv (install estreuv as an
// in-tree copy, e.g. `npm pack .../packages/estreuv` then install the tarball — a
// file: symlink resolves lit from the monorepo's own node_modules and you get two
// lit instances in one realm).
//
// Env overrides:
//   EUX_P4_IMPL  — path to an alternative implementation module (default
//                  ./dist/estreuv/num-keypad.js next to this anchor). The
//                  reverse-sync e2e uses this to point at a mutated build.
//   EUX_P4_RUNS  — fast-check numRuns per property (default 25; DOM runs are slower).
//
// Determinism: fixed fast-check seed — same (anchor, impl) pair reproduces the
// same verdicts on either side.

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = 20260711;
const RUNS = Math.max(1, parseInt(process.env.EUX_P4_RUNS || '25', 10) || 25);

const IMPL_PATH = process.env.EUX_P4_IMPL
  ? resolve(process.cwd(), process.env.EUX_P4_IMPL)
  : join(HERE, 'dist', 'estreuv', 'num-keypad.js');

// ---------------------------------------------------------------------------
// DOM bootstrap — one Window for the whole run (customElements registry binds
// to the realm present at module import; per-run isolation is per-element).
// ---------------------------------------------------------------------------

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
  await import(pathToFileURL(IMPL_PATH).href); // side effect: customElements.define('num-keypad', ...)
  return win;
}

// ---------------------------------------------------------------------------
// harness helpers
// ---------------------------------------------------------------------------

// Net listener ledger on the target input — counts attempted add/remove calls per
// event type. This observes the wire/unwire discipline itself, so a removed
// duplicate-attach guard fails the ledger even though EventTarget dedupes
// same-(type, fn) registrations at the DOM layer.
function ledgerize(input) {
  const net = new Map();
  const bump = (type, d) => net.set(type, (net.get(type) || 0) + d);
  const origAdd = input.addEventListener.bind(input);
  const origRemove = input.removeEventListener.bind(input);
  input.addEventListener = (type, fn, opts) => { bump(type, +1); return origAdd(type, fn, opts); };
  input.removeEventListener = (type, fn, opts) => { bump(type, -1); return origRemove(type, fn, opts); };
  return net;
}

async function mkKeypad({ value = '', limitLength = 0, autoDivider = '', autoDividerPos = '', withLedger = false } = {}) {
  document.documentElement.removeAttribute('data-on-swipe');
  document.body.innerHTML = '';
  const input = document.createElement('input');
  input.id = 'p4-tgt';
  input.value = value;
  document.body.appendChild(input);
  const net = withLedger ? ledgerize(input) : null;
  const el = document.createElement('num-keypad');
  el.setAttribute('for', 'p4-tgt');
  if (limitLength) el.setAttribute('limit-length', String(limitLength));
  if (autoDivider) el.setAttribute('auto-divider', autoDivider);
  if (autoDividerPos) el.setAttribute('auto-divider-pos', autoDividerPos);
  document.body.appendChild(el);
  await el.updateComplete;
  return { el, input, net };
}

function shadowButton(el, label) {
  return [...el.shadowRoot.querySelectorAll('button')].find(b => b.textContent.trim() === label);
}

// ---------------------------------------------------------------------------
// property mappings — one entry per @metamorphic clause in num-keypad.eux,
// matched by (kind + stable ASCII token). Unmapped clause -> conservative FAIL.
// ---------------------------------------------------------------------------

function buildMappings(fc) {
  const digits = fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 0, maxLength: 12 })
    .map(a => a.join(''));

  return [
    {
      key: 'idempotency/resolveInput-once-vs-n',
      match: p => p.kind === 'idempotency' && /resolveInput/.test(p.desc),
      note: 'net listener ledger on the target input stays exactly 1 per wired event type across N re-resolve cycles (for-retarget round trips + detach/reattach); a dropped duplicate-attach guard or missing unwire inflates the ledger.',
      prop: fc => fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (n) => {
        const { el, input, net } = await mkKeypad({ autoDivider: '-', autoDividerPos: '3', withLedger: true });
        for (let i = 0; i < n; i++) {
          el.setAttribute('for', '');            // resolve -> null target (unwire)
          await el.updateComplete;
          el.setAttribute('for', 'p4-tgt');      // resolve -> same target (rewire)
          await el.updateComplete;
          document.body.removeChild(el);          // disconnect (unwire, 2nd channel)
          document.body.appendChild(el);          // reconnect (resolve again)
          await el.updateComplete;
        }
        for (const type of ['input', 'paste', 'cut', 'change', 'focus']) {
          if ((net.get(type) || 0) !== 1) return false;
        }
        // wiring liveness: boundary-length external input gets exactly one divider
        input.value = '123';
        input.dispatchEvent(new Event('input'));
        return input.value === '123-';
      }),
    },
    {
      key: 'idempotency/pressClear-once-vs-n',
      match: p => p.kind === 'idempotency' && /pressClear/.test(p.desc),
      note: 'CLR pressed once vs N times through the rendered shadow button — input.value lands on "" every time.',
      prop: fc => fc.asyncProperty(digits, fc.integer({ min: 1, max: 5 }), async (v, n) => {
        const { el, input } = await mkKeypad({ value: v });
        const clr = shadowButton(el, 'CLR');
        if (!clr) return false;
        for (let i = 0; i < n; i++) {
          clr.click();
          if (input.value !== '') return false;
        }
        return input.value === '';
      }),
    },
    {
      key: 'determinism/autoDivide-correction',
      match: p => p.kind === 'determinism' && /autoDivide/.test(p.desc),
      note: 'same (value, limitLength, autoDivider, autoDividerPos) driven through an external input event on two fresh setups yields the same corrected value.',
      prop: fc => fc.asyncProperty(
        digits,
        fc.integer({ min: 0, max: 10 }),
        fc.constantFrom('', '-', '.'),
        fc.uniqueArray(fc.integer({ min: 1, max: 9 }), { maxLength: 3 }),
        async (v, limit, divider, posList) => {
          const cfg = {
            limitLength: limit,
            autoDivider: divider,
            autoDividerPos: posList.join(','),
          };
          const run = async () => {
            const { input } = await mkKeypad(cfg);
            input.value = v;
            input.dispatchEvent(new Event('input'));
            return input.value;
          };
          return (await run()) === (await run());
        },
      ),
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
