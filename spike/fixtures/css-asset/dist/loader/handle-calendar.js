// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : handle-calendar.eux  (sha256:69cd424fb357)
// │ profile: css-asset
// │ target : loader   provider : agent
// │ trio   : temp=undefined model=agent/claude template=undefined
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
//
// css-asset 로더 — handle-calendar (RCSS v1.3, forward-synth: 로딩 코드 생성·CSS 생성 금지).
// manifest(@source/@owns/@trigger/@load/@css-deps/@tokens)를 소비해, 무거운 캘린더
// 스타일시트를 핸들 최초 사용 시점(on-handle-active)에 1회 주입(ensureStylesheet)한다.
// deps-0 vanilla. 실 CSS 는 @source 가 referencing only — 이 로더는 바이트를 복제하지 않는다.

// manifest — .eux 디렉티브의 런타임 투영(SSoT 동기: drift-check --css gate3 가 이 정합을 감시).
const MANIFEST = {
  component: 'handle-calendar',
  source: './handle-calendar.css',                 // @source — 실 CSS (sha drift gate1)
  owns: ['.calendar-root', '.calendar-grid', '.calendar-cell'],   // @owns — 소유 셀렉터 (gate2)
  trigger: { kind: 'handle-first-use', selector: '.calendar-root' },   // @trigger
  load: 'on-handle-active',                        // @load — 핸들 활성 시 온디맨드
  size: '105KB',                                   // @size — raw 예산
  cssDeps: ['base-tokens'],                        // @css-deps — CSS-asset 그래프
  tokens: ['--cal-bg', '--cal-border'],            // @tokens — :root var SSoT 브릿지
};

let _loaded = null;

// ensureStylesheet — @source 스타일시트를 1회만 주입(idempotent). 중복 호출/이미 존재 시 같은 Promise 반환.
export function ensureStylesheet(href = MANIFEST.source) {
  if (_loaded) return _loaded;
  _loaded = new Promise((resolve, reject) => {
    const existing = document.querySelector(`link[data-css-asset="${MANIFEST.component}"]`);
    if (existing) return resolve(existing);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.cssAsset = MANIFEST.component;
    link.onload = () => resolve(link);
    link.onerror = () => reject(new Error(`css-asset load 실패: ${href}`));
    document.head.appendChild(link);
  });
  return _loaded;
}

// registerHandle — @trigger handle-first-use:.calendar-root / @load on-handle-active.
//   .calendar-root 핸들이 처음 활성화(pointerover)될 때 스타일시트를 온디맨드 로드하고 핸들러를 해제한다.
//   반환값으로 수동 해제 가능. eager 가 아니므로 초기 페이로드에는 105KB 가 들어가지 않는다.
export function registerHandle(root = document) {
  const sel = MANIFEST.trigger.selector;
  const handler = (e) => {
    const el = e.target && e.target.closest ? e.target.closest(sel) : null;
    if (!el) return;
    ensureStylesheet();                                  // on-handle-active: 첫 사용 시 1회
    root.removeEventListener('pointerover', handler, true);
  };
  root.addEventListener('pointerover', handler, true);
  return () => root.removeEventListener('pointerover', handler, true);
}

export default { ensureStylesheet, registerHandle, MANIFEST };
