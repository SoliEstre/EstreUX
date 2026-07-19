// examples/tab-block.p4.mjs
//
// P4b dynamic-gate anchor for tab-block.eux — executes the spec's @metamorphic
// properties (round_trip / idempotency / determinism) against the brewed estreuv
// implementation. Loaded by `spike/p4-check.mjs --run examples/tab-block.eux`
// (P4b contract: `run(props)` export next to the .eux).
//
// Pilot #3 note — the determinism clause here is the FIRST live exercise of the
// reverse-sync-spec §4 UI snapshot-equivalence pattern: the render fingerprint is
// the tabset shadow markup PLUS the per-surface data-tab-selected distribution
// (shadow li + light-DOM contents), i.e. exactly the surfaces the original
// EstreUI CSS/consumer code keys off (@hazards: attribute name + "1"/"" domain).
//
// Runtime + dev-deps + env overrides: same profile as num-keypad.p4.mjs (happy-dom
// bootstrap with force-registered DOM globals — see that file's header for the
// Node-Event-realm rationale and the estreuv in-tree-copy install note). The
// happy-dom top-level-child-expression class (1st-e2e finding 2) does not apply:
// tab-block's template wraps expressions in ul/div (avoided at spec stage).
//
//   EUX_P4_IMPL  — alternative implementation module (default ./dist/estreuv/tab-block.js)
//   EUX_P4_RUNS  — fast-check numRuns per property (default 25)
//   EUX_P4_SEED  — fast-check seed (default 20260711) — env hook per pilot-3 request

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = parseInt(process.env.EUX_P4_SEED || '20260711', 10) || 20260711;
const RUNS = Math.max(1, parseInt(process.env.EUX_P4_RUNS || '25', 10) || 25);

const IMPL_PATH = process.env.EUX_P4_IMPL
  ? resolve(process.cwd(), process.env.EUX_P4_IMPL)
  : join(HERE, 'dist', 'estreuv', 'tab-block.js');

const DOM_GLOBALS = [
  'Document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element',
  'Node', 'Text', 'Comment', 'CharacterData', 'EventTarget', 'CustomEvent',
  'Event', 'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'InputEvent',
  'PointerEvent', 'customElements', 'DocumentFragment', 'ShadowRoot',
  'MutationObserver', 'navigator', 'requestAnimationFrame', 'cancelAnimationFrame',
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
  await import(pathToFileURL(IMPL_PATH).href); // side effect: customElements.define('tab-block', ...)
  return win;
}

// ---------------------------------------------------------------------------
// harness helpers
// ---------------------------------------------------------------------------

// Lit batches property→render; selectTab() flips `selected` mid-cycle and also
// pokes attributes imperatively (#applySurfaces), so settle two microtask
// rounds before reading either surface.
async function settle(el) {
  await el.updateComplete;
  await el.updateComplete;
}

// <tab-block tabs="l1,l2,…"> + N light-DOM content children [data-tab-id=1..N]
// (the documented usage shape — light contents are the second reflected surface).
async function mkTab(labels) {
  document.body.innerHTML = '';
  const el = document.createElement('tab-block');
  el.tabs = labels.join(',');
  for (let i = 1; i <= labels.length; i++) {
    const d = document.createElement('div');
    d.setAttribute('data-tab-id', String(i));
    d.textContent = 'content-' + i;
    el.appendChild(d);
  }
  document.body.appendChild(el);
  await settle(el);
  return el;
}

// Selection state across BOTH reflected surfaces (@invariants member-of):
// shadow tabset li[data-tab-id] + light [data-tab-id] children, each with
// data-tab-selected ∈ {"1",""}.
function surfacesOf(el) {
  const shadow = [...(el.renderRoot?.querySelectorAll('.tabset li[data-tab-id]') ?? [])]
    .map(li => `${li.dataset.tabId}=${li.getAttribute('data-tab-selected') ?? ''}`);
  const light = [...el.querySelectorAll('[data-tab-id]')]
    .map(d => `${d.dataset.tabId}=${d.getAttribute('data-tab-selected') ?? ''}`);
  return { selected: el.selected, shadow: shadow.join('|'), light: light.join('|') };
}

function sameState(a, b) {
  return a.selected === b.selected && a.shadow === b.shadow && a.light === b.light;
}

// §4 UI snapshot-equivalence fingerprint — the tabset shadow markup plus the
// per-surface data-tab-selected distribution (what CSS/consumers key off).
function renderFingerprint(el) {
  const s = surfacesOf(el);
  return `${el.shadowRoot.innerHTML}§shadow:${s.shadow}§light:${s.light}`;
}

// label arbitrary: nonempty, comma-free, trim-stable (matches #labels parsing).
// Built from the fc.array/constantFrom subset the sibling anchors already use
// (no fc.stringOf — keeps the anchor portable across fast-check majors).
function labelsArb(fc, { minTabs, maxTabs }) {
  return fc.array(
    fc.array(fc.constantFrom(...'abcdefghij'), { minLength: 1, maxLength: 4 }).map(cs => cs.join('')),
    { minLength: minTabs, maxLength: maxTabs },
  );
}

// ---------------------------------------------------------------------------
// property mappings — one entry per @metamorphic clause in tab-block.eux.
// ---------------------------------------------------------------------------

function buildMappings(fc) {
  return [
    {
      key: 'round_trip/next-then-prev',
      match: p => p.kind === 'round_trip' && /next-then-prev/.test(p.desc),
      note: 'from any non-last tab, selectNextTab() then selectPrevTab() restores selected and the data-tab-selected distribution on BOTH surfaces (bounded-move round trip).',
      prop: fc => fc.asyncProperty(
        labelsArb(fc, { minTabs: 2, maxTabs: 6 }).chain(labels =>
          fc.record({ labels: fc.constant(labels), start: fc.integer({ min: 1, max: labels.length - 1 }) })),
        async ({ labels, start }) => {
          const el = await mkTab(labels);
          el.selectTab(start);
          await settle(el);
          const before = surfacesOf(el);
          el.selectNextTab();
          await settle(el);
          if (el.selected !== start + 1) return false;   // next from non-last must actually move
          el.selectPrevTab();
          await settle(el);
          return sameState(surfacesOf(el), before);
        },
      ),
    },
    {
      key: 'idempotency/reselect-same-id',
      match: p => p.kind === 'idempotency' && /reselect-same-id/.test(p.desc),
      note: 'selectTab(current id) repeated N times leaves the selection-state set of both surfaces unchanged (the clause constrains surface state, not event dedup — original selectTab re-fires tabchange by design).',
      prop: fc => fc.asyncProperty(
        labelsArb(fc, { minTabs: 1, maxTabs: 6 }).chain(labels =>
          fc.record({
            labels: fc.constant(labels),
            id: fc.integer({ min: 1, max: labels.length }),
            n: fc.integer({ min: 1, max: 5 }),
          })),
        async ({ labels, id, n }) => {
          const el = await mkTab(labels);
          el.selectTab(id);
          await settle(el);
          const before = surfacesOf(el);
          for (let i = 0; i < n; i++) {
            el.selectTab(id);
            await settle(el);
          }
          return sameState(surfacesOf(el), before);
        },
      ),
    },
    {
      key: 'determinism/render-structure-by-state',
      match: p => p.kind === 'determinism' && /render-structure-by-state/.test(p.desc),
      note: 'two fresh instances at the same (tabs, selected) produce identical render structure — tabset shadow markup + per-surface data-tab-selected distribution. First live exercise of the reverse-sync-spec §4 UI snapshot-equivalence pattern.',
      prop: fc => fc.asyncProperty(
        labelsArb(fc, { minTabs: 1, maxTabs: 6 }).chain(labels =>
          fc.record({ labels: fc.constant(labels), id: fc.integer({ min: 1, max: labels.length }) })),
        async ({ labels, id }) => {
          const a = await mkTab(labels);
          a.selectTab(id);
          await settle(a);
          const fpA = renderFingerprint(a);   // capture before mkTab clears body
          const b = await mkTab(labels);
          b.selectTab(id);
          await settle(b);
          return fpA === renderFingerprint(b);
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
