// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : notif-toggle.eux  (sha256:db7e961e85a7)
// │ target : estreui
// │ trio   : temp=0.0 model=poc/deterministic-templater@v0 template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run expand` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { EstreUI } from 'estreui';

/**
 * notif-toggle — EstreUI(macro-Rimwork, jQuery-class primitive) 단독 변종. (PoC 대표 패턴)
   * enabled=true 면 🔔, false 면 🔕 버튼. 클릭하면 toggle.
   * count > 0 이면 버튼 우상단에 count 배지 표시.
 */
export function notifToggle(host) {
  const state = { enabled: true, count: 0, ...load() };
  function load() { try { return JSON.parse(localStorage.getItem('notif-toggle') || '{}'); } catch { return {}; } }
  function save() { localStorage.setItem('notif-toggle', JSON.stringify({ enabled: state.enabled, count: state.count })); }
  function toggle() { state.enabled = !state.enabled; save(); paint(); }
  function bump(n) { state.count += n; paint(); }
  function clear() { state.count = 0; paint(); }
  function paint() {
    EstreUI(host).html(`<button class="nt-btn">${state.enabled ? '🔔' : '🔕'}</button>${state.count > 0 ? `<span class="nt-badge">${state.count}</span>` : ''}`);
    EstreUI(host).find('.nt-btn').on('click', toggle);
  }
  paint();
  return { toggle, bump, clear, get state() { return state; } };
}
