// ┌─ estreux:expanded ──────────────────────────────────────────────
// │ source : http-checks-card.eux  (sha256:ae7a2b9d5717)
// │ profile: ui-component
// │ target : estreuv   provider : agent
// │ trio   : temp=undefined model=agent/claude template=undefined
// │ ⚠ 자동 생성물 — 직접 수정 금지. `npm run brew` 로 재생성 (drift-check 감시).
// └─────────────────────────────────────────────────────────────────
import { html, css } from 'lit';
import { EstreUVElement } from 'estreuv';

// ── @styles 토큰 → 응답시간 게이지 등급(고정 최대 + 구간별 색) ──
const MS_MAX = 2000;                 // msMax: 게이지 고정 최대(ms) — 초과는 100%(failure)
const GRADES = [
    { key: 'good',    max: 200,      color: '#34c759' },  // ≤200
    { key: 'fine',    max: 500,      color: '#8fd14f' },  // ≤500
    { key: 'bad',     max: 1000,     color: '#ffd60a' },  // ≤1000
    { key: 'issue',   max: 2000,     color: '#ff9f0a' },  // ≤2000
    { key: 'failure', max: Infinity, color: '#ff4d4f' },  // 초과/down
];
function grade(up, ms) {
    if (!up || ms == null) return GRADES[GRADES.length - 1];   // down/미상 = failure
    return GRADES.find((g) => ms <= g.max) || GRADES[GRADES.length - 1];
}

export class HttpChecksCard extends EstreUVElement {

    static properties = {
        ...EstreUVElement.properties,
        server: { type: String },          // @ports.in — 모니터 대상 가상 서버 id
        chartDetail: { attribute: false }, // @ports.deps — 응답시간 그래프 오프너(주입)
        rows: { state: true },             // @state
        online: { state: true },
    };

    static styles = css`
        :host { display: block; font-family: system-ui, sans-serif; }
        .card {
            background: var(--hc-card, #1a1d23);
            color: var(--hc-text, #e8eaed);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 12px;
            padding: 12px 14px;
        }
        .head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .ic { font-size: 1rem; }
        .name { font-weight: 700; font-size: 1.0rem; }
        .count {
            margin-left: auto; font-size: 0.74rem; font-variant-numeric: tabular-nums;
            padding: 2px 8px; border-radius: 999px;
            color: var(--hc-ok, #34c759);
            border: 1px solid color-mix(in srgb, var(--hc-ok, #34c759) 45%, transparent);
            background: color-mix(in srgb, var(--hc-ok, #34c759) 12%, transparent);
        }
        .count.bad {
            color: var(--hc-crit, #ff4d4f);
            border-color: color-mix(in srgb, var(--hc-crit, #ff4d4f) 45%, transparent);
            background: color-mix(in srgb, var(--hc-crit, #ff4d4f) 12%, transparent);
        }
        .rows { display: flex; flex-direction: column; gap: 2px; }
        .row {
            display: flex; align-items: center; gap: 8px;
            padding: 4px 6px; border-radius: 7px; cursor: pointer;
            transition: background 120ms ease;
        }
        .row:hover { background: rgba(255,255,255,0.05); }
        .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--hc-crit, #ff4d4f); }
        .dot.on { background: var(--hc-ok, #34c759); box-shadow: 0 0 5px var(--hc-ok, #34c759); }
        .id {
            font-size: 0.82rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            flex: 0 0 28%;
        }
        .bar {
            flex: 1 1 auto; height: 6px; border-radius: 3px; overflow: hidden;
            background: linear-gradient(90deg,
                color-mix(in srgb, #34c759 20%, transparent) 0 10%,
                color-mix(in srgb, #8fd14f 20%, transparent) 10% 25%,
                color-mix(in srgb, #ffd60a 20%, transparent) 25% 50%,
                color-mix(in srgb, #ff9f0a 20%, transparent) 50% 100%);
        }
        .bar > span { display: block; height: 100%; border-radius: 3px; transition: width 120ms ease; }
        .grade {
            font-size: 0.7rem; font-weight: 700; flex: none; min-width: 50px; text-align: right;
            font-variant-numeric: tabular-nums;
        }
        .ms {
            font-size: 0.76rem; color: var(--hc-dim, #9aa0a6);
            font-variant-numeric: tabular-nums; flex: none; min-width: 48px; text-align: right;
        }
        .row.down .id { color: var(--hc-crit, #ff4d4f); }
        .row.down .ms { color: var(--hc-crit, #ff4d4f); font-weight: 700; }
        .empty { color: var(--hc-dim, #9aa0a6); font-size: 0.82rem; padding: 10px 0; }
        .hint { margin-top: 6px; font-size: 0.68rem; color: var(--hc-dim, #9aa0a6); }
    `;

    constructor() {
        super();
        this.server = '@checks';
        this.chartDetail = null;
        this.rows = [];
        this.online = false;
        this._offs = [];
    }

    // @behavior resync — 데이터코어 latest 의 check.<id>.up/.ms 를 id별로 묶어 rows(실패 먼저 → id순)
    resync() {
        const dc = window.DATACORE;
        if (!dc || !this.server) return;
        const s = dc.server(this.server);
        this.online = !!(s && s.online);
        const latest = (s && s.latest) || {};
        const map = {};
        for (const [k, v] of Object.entries(latest)) {
            let m;
            if ((m = k.match(/^check\.(.+)\.up$/))) (map[m[1]] = map[m[1]] || {}).up = v.value;
            else if ((m = k.match(/^check\.(.+)\.ms$/))) (map[m[1]] = map[m[1]] || {}).ms = v.value;
        }
        const rows = Object.entries(map).map(([id, o]) => ({ id, up: o.up === 1, ms: o.ms }));
        rows.sort((a, b) => (a.up === b.up ? a.id.localeCompare(b.id) : (a.up ? 1 : -1)));
        this.rows = rows;
    }

    connectedCallback() {
        super.connectedCallback();
        this.resync();
        const dc = window.DATACORE;
        if (dc) {
            this._offs.push(
                dc.on('init', () => this.resync()),
                dc.on('metrics', (m) => { if (m.server === this.server) this.resync(); }),
                dc.on('presence', (m) => { if (m.server === this.server) this.resync(); }),
            );
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._offs.forEach((off) => { try { off(); } catch {} });
        this._offs = [];
    }

    // @behavior rowClick — @ports.deps chartDetail 로 통지(전역 직접 참조 대신 주입 의존)
    rowClick(id) {
        if (this.chartDetail) this.chartDetail.open({ server: this.server, metric: 'check.' + id + '.ms' });
    }

    render() {
        const rows = this.rows;
        const up = rows.filter((r) => r.up).length;
        return html`
            <div class="card">
                <div class="head">
                    <span class="ic">🌐</span>
                    <span class="name">외부 체크</span>
                    <span class="count ${up < rows.length ? 'bad' : ''}">${up}/${rows.length} 정상</span>
                </div>
                ${rows.length ? html`
                    <div class="rows">
                        ${rows.map((r) => {
                            const g = grade(r.up, r.ms);
                            const pct = r.up ? (r.ms != null ? Math.min(100, r.ms / MS_MAX * 100) : 0) : 100;
                            const msText = r.up ? (r.ms != null ? Math.round(r.ms) + 'ms' : '—') : '실패';
                            return html`
                            <div class="row ${r.up ? '' : 'down'}"
                                 @click=${() => this.rowClick(r.id)}
                                 title="${r.id} — ${g.key} (${msText}) · 눌러서 응답시간 그래프">
                                <span class="dot ${r.up ? 'on' : ''}"></span>
                                <span class="id">${r.id}</span>
                                <span class="bar"><span style="width:${pct}%; background:${g.color};"></span></span>
                                <span class="grade" style="color:${g.color};">${g.key}</span>
                                <span class="ms" style="color:${g.color};">${msText}</span>
                            </div>`;
                        })}
                    </div>
                    <div class="hint">응답시간 게이지: 고정 최대 ${MS_MAX}ms · good ≤200 · fine ≤500 · bad ≤1000 · issue ≤2000 · 초과·실패=failure</div>
                ` : html`<div class="empty">외부 체크 대기 중…</div>`}
            </div>
        `;
    }
}

if (!customElements.get('http-checks-card')) {
    customElements.define('http-checks-card', HttpChecksCard);
}
