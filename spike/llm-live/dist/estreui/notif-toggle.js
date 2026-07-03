// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : notif-toggle.eux  (sha256:bc2d6448e081)
// │ profile: ui-component
// │ target : estreui   provider : openai-compatible
// │ trio   : temp=0 model=google/gemini-2.5-flash template=estreux/v0.0.1
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
/**
 * Injects CSS into the document head if not already present.
 * @param {string} id - The ID for the style element.
 * @param {string} css - The CSS string to inject.
 */
function injectCSS(id, css) {
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }
}

// Define the CSS for the component based on rendering description and common UI patterns.
const COMPONENT_CSS_ID = 'notif-toggle-styles';
const COMPONENT_CSS = `
  .notif-toggle-container {
    position: relative;
    display: inline-block;
    line-height: 1; /* Prevent extra space around icons */
  }

  .notif-toggle-button {
    background: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 10px 15px;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 60px; /* Ensure consistent size */
    min-height: 60px;
    box-sizing: border-box;
    transition: background 0.2s ease;
    color: inherit; /* Inherit text color */
  }

  .notif-toggle-button:hover {
    background: #e0e0e0;
  }

  .notif-toggle-button:active {
    background: #d0d0d0;
  }

  .notif-toggle-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background-color: #ff4d4f; /* Red */
    color: white;
    border-radius: 50%;
    padding: 4px 8px;
    font-size: 12px;
    font-weight: bold;
    min-width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    pointer-events: none; /* Don't block button clicks */
    transform: scale(1);
    transform-origin: center;
    transition: transform 0.2s ease-out, opacity 0.2s ease-out;
    z-index: 1; /* Ensure badge is above button */
  }

  .notif-toggle-badge.hidden {
    transform: scale(0);
    opacity: 0;
  }
`;

/**
 * Factory function for the notif-toggle estreui module.
 * @param {object} opts - Options for the component.
 * @param {HTMLElement} opts.target - The DOM element to mount the component into.
 * @returns {object} The component controller.
 */
export default function createNotifToggle(opts) {
  const { target } = opts;
  if (!target) {
    console.error("estreui: notif-toggle requires a 'target' HTMLElement in opts.");
    return;
  }

  // Inject styles once into the document head
  injectCSS(COMPONENT_CSS_ID, COMPONENT_CSS);

  // --- State Management ---
  const PERSIST_KEY = 'notif-toggle';
  let state = {
    enabled: true, // 알림 수신 여부
    count: 0,      // 안 읽은 알림 수
  };

  /**
   * Loads state from localStorage.
   * Initializes with defaults if no persisted state or parsing fails.
   */
  function _loadState() {
    try {
      const persisted = localStorage.getItem(PERSIST_KEY);
      if (persisted) {
        const parsed = JSON.parse(persisted);
        // Only load specified fields and ensure types
        if (typeof parsed.enabled === 'boolean') {
          state.enabled = parsed.enabled;
        }
        if (typeof parsed.count === 'number' && !isNaN(parsed.count)) {
          state.count = parsed.count;
        }
      }
    } catch (e) {
      console.warn('Failed to load notif-toggle state from localStorage, using defaults:', e);
      // Revert to default state if loading fails
      state = { enabled: true, count: 0 };
    }
  }

  /**
   * Saves current state to localStorage.
   */
  function _saveState() {
    try {
      // Only persist specified fields
      const toPersist = {
        enabled: state.enabled,
        count: state.count,
      };
      localStorage.setItem(PERSIST_KEY, JSON.stringify(toPersist));
    } catch (e) {
      console.error('Failed to save notif-toggle state to localStorage:', e);
    }
  }

  // Load initial state on component creation
  _loadState();

  // --- DOM Elements ---
  const container = document.createElement('div');
  container.className = 'notif-toggle-container';

  const button = document.createElement('button');
  button.className = 'notif-toggle-button';
  button.setAttribute('aria-label', 'Toggle notifications');

  const badge = document.createElement('span');
  badge.className = 'notif-toggle-badge';

  container.appendChild(button);
  container.appendChild(badge);
  target.appendChild(container);

  // --- Rendering Logic ---
  function _render() {
    // Update button icon and accessibility attributes
    button.textContent = state.enabled ? '🔔' : '🔕';
    button.setAttribute('aria-pressed', state.enabled ? 'true' : 'false');
    button.setAttribute('aria-label', state.enabled ? 'Notifications enabled' : 'Notifications disabled');

    // Update badge visibility and text
    if (state.count > 0) {
      badge.textContent = state.count > 99 ? '99+' : state.count.toString();
      badge.classList.remove('hidden');
      badge.setAttribute('aria-hidden', 'false');
      badge.setAttribute('aria-live', 'polite'); // Announce changes to screen readers
      badge.setAttribute('aria-label', `${state.count} unread notifications`);
    } else {
      badge.classList.add('hidden');
      badge.setAttribute('aria-hidden', 'true');
      badge.removeAttribute('aria-live');
      badge.removeAttribute('aria-label');
    }
  }

  // Perform initial render
  _render();

  // --- Behavior Methods ---

  /**
   * Toggles the 'enabled' state (notification reception on/off) and persists it.
   */
  function toggle() {
    state.enabled = !state.enabled;
    _saveState();
    _render();
  }

  /**
   * Adds 'n' to the 'count' state (unread notifications) and persists it.
   * Ensures count does not go below zero.
   * @param {number} n - The number to add to the count.
   */
  function bump(n) {
    if (typeof n !== 'number' || isNaN(n)) {
      console.warn('notif-toggle: bump(n) expects a number for n, received:', n);
      return;
    }
    state.count = Math.max(0, state.count + n); // Ensure count doesn't go below 0
    _saveState();
    _render();
  }

  /**
   * Resets the 'count' state (unread notifications) to 0 and persists it.
   */
  function clear() {
    state.count = 0;
    _saveState();
    _render();
  }

  // --- Event Listeners ---
  button.addEventListener('click', toggle);

  // --- Controller API ---
  const controller = {
    // Expose behavior methods as specified in @behavior
    toggle,
    bump,
    clear,

    /**
     * Cleans up the component by removing event listeners and DOM elements.
     */
    destroy() {
      button.removeEventListener('click', toggle);
      container.remove();
    },

    // Optional: Expose current state for debugging or external checks
    _getState() {
      return { ...state };
    }
  };

  return controller;
}
