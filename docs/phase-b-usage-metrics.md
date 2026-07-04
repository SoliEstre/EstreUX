# Phase B 진입용 usage 측정 기록 (X1~X4)

> PM 009 Phase B 착수 조건("자체 dogfooding usage data로 결정 휴리스틱 1차 정착")의 **측정 기록 정본**.
> SPIKE.md §X1~X4가 "실측은 Phase B(실 usage)"로 미뤄둔 항목을, 이미 축적된 2개 프로젝트 dogfooding 실적으로 집계한다.
> 측정일 기준이며, 새 brew/증류 발생 시 섹션을 추가한다 (인덱스에 서사 누적 금지 — dated 섹션).

## 측정 스냅샷 — 2026-07-03

### 대상 인벤토리 (2 프로젝트 · 16 spec)

| 프로젝트 | spec 수 | brew 산출 | 비고 |
| --- | --- | --- | --- |
| EstreUX 자체 (examples + spike) | 4 | estreuv 1 · 3변종(pair/estreui/estreuv) 1 | http-checks-card(도입 가이드 PoC) · wordchain · notif-toggle · handle-calendar(css-asset fixture) |
| 허브 라이브 대시보드 (`dashboard/live/eux/`) | 11 | node 4 · vanilla 7 (11 산출) | 운영 인프라 증류 — watchdog/bridge/wait/tabs/conn-bar 등 실가동 코드의 스펙화 |

### X1 — 코드 작성량 절감 (spec LoC vs brew LoC)

| 집합 | spec 합계 | brew 산출 합계 | spec/brew 비율 |
| --- | --- | --- | --- |
| 라이브보드 11 spec (dist 보유분) | 433 L | 1,087 L | **40% (≈60% 절감)** |
| http-checks-card (도입 PoC) | 41 L | 183 L (estreuv) | 22% — hand-author 190L와 동등 산출 |
| notif-toggle (3변종) | 20 L | 79 L (23+28+28) | 25% |

해석: 사람이 유지하는 표면은 spec뿐이므로, 유지 대상 LoC 기준 **약 60~78% 절감**이 실측 범위. 라이브보드 집합(운영 코드 증류)이 40%로 보수적인 것은 supervisor류 스펙(@machine/guard 서술 밀도)이 높기 때문.

### X2 — 변종 산출 배수

- notif-toggle: **1 spec(20L) → 3 변종(pair/estreui/estreuv, 79L)** — 변종 추가의 spec 한계비용 0 실증.
- 라이브보드: 1 spec → 1 변종(node 또는 vanilla) 운용이 지배적 — 인프라 코드는 타깃이 단일해 변종 배수 수요가 낮음. **휴리스틱 후보: 변종 배수는 UI 컴포넌트에서, 인프라에선 문서화 가치가 지배.**

### X3 — drift 빈도

| 대상 | sha 게이트 | drift 발생 | 측정 |
| --- | --- | --- | --- |
| http-checks-card | ✓ estreuv | **0건** | 2026-06-17 도입 → 2026-07-03 pre-commit 전수 재검증 in sync |
| wordchain-story 3변종 | ✓ estreuv·estreui·pair | 0건 | 〃 |
| notif-toggle 3변종 | ✓ estreuv·estreui·pair | 0건 | 〃 |
| handle-calendar (css-asset) | ✓ loader | 0건 | 〃 |
| 라이브보드 11 spec | ✓ (2026-07-03 편입) | 0건 | provenance 11/11 완비 확인 + 전수 PASS + 허브 pre-commit `euxDriftGate` 편입(eux 변경 시 조건부 전수 검사, 3-way 검증) |

> EstreUX 자체 4 spec은 **전부 게이트 내 + pre-commit 훅에서 매 커밋 전수 검증**됨 (2026-07-03 커밋에서 실증 — 훅이 4 spec 8 산출을 자동 검사).

해석: 게이트가 있는 곳의 drift는 0 — 2026-07-03부로 **16 spec 전부 게이트 내**. 표본 기간이 짧아(2주) 빈도 곡선은 이후 커밋 이력에서 축적된다.

### X4 — 변종 간 절감 (유지보수)

- notif-toggle 3변종: spec 1회 수정 → 3 산출 재brew. 실수정 이력이 아직 없어 **정성 실증만**(구조 확보). 첫 spec-수정→재brew 사이클 발생 시 이 섹션에 기록.

## 결정 휴리스틱 1차 (측정 기반)

1. **spec 서술 밀도가 높은 인프라(supervisor/machine)도 40% 수준 절감** — 증류 가치 있음. 단 변종 배수 이득은 UI 컴포넌트에 집중.
2. **drift 방어는 게이트 편입이 전부** — 게이트 안 0건 vs 게이트 밖 측정불가. 새 증류는 dist 생성 시점에 drift-check 편입을 기본값으로.
3. **agent provider(직접 brew)가 기본 경로로 충분** — 16 spec 전부 agent brew로 산출, 라이브 LLM(openai-compatible) 실측은 잔여 항목(아래).

## 측정 스냅샷 — 2026-07-04 (Phase B B2 · V3 대체 파일럿 1호)

허브 [UI·UV·UX 정렬 리뷰](../../EstreUF%20common%20workspace/reports/2026-07-04-ui-uv-ux-alignment-review.md)가 편입한 **B2(EstreUI 매크로 구현→EstreUV 대체)** 의 첫 실증 — EstreUI 스톡 `EstreNumKeypadHandle` 재구현 (`examples/num-keypad.eux`, 커밋 5426bdc).

| 지표 | 값 | 비고 |
| --- | --- | --- |
| 원본 (본체 하드코딩) | 152 L (estreUi-handles.js:5340-5491) + 소비자 버튼 마크업 전체 | jQuery, DOM 프로토타입 없음(마크업 사용자 부담) |
| spec | 28 L | @source 역증류 추적 포함 |
| brew 산출 | estreuv 181 L + pair 33 L (agent brew) | 스타일·표준 레이아웃 shadow DOM 렌더 포함 |
| **X1 (유지 표면)** | **28 L / 152 L ≈ 82% 절감** | 지금까지 최고치 — 소형·계약 명확 핸들이 증류 최적점 |
| 소비 표면 | 버튼 마크업 전체 → `<num-keypad for="...">` 1줄 | V3 볼륨 이득의 소비자 측 |
| drift | in-sync 2/2, pre-commit 전수 PASS | 신규 spec 즉시 게이트 편입 (휴리스틱 #2 준수) |

관찰: 산출(181L)이 원본(152L)보다 큰 것은 원본이 렌더를 사용자 마크업에 떠넘긴 반면 UV 재구현은 레이아웃·스타일을 흡수했기 때문 — 시스템 총소유(본체 코드+소비 마크업)는 감소. **본체에서 실제 152L 제거(deprecate)는 fw 파트 결정 게이트**(질문 002 회신 후) — 제거 전까지 X1 은 "대체 준비 완료" 상태의 측정.

### 추가 실증 — 같은 날 (2026-07-04, 파일럿 2호 + B5)

| 대상 | 원본 | spec | brew 산출 | X1 | drift |
| --- | --- | --- | --- | --- | --- |
| **파일럿 2호** `toggle-block` (EstreToggleBlockHandle, handles.js:4520-4619) | 100 L + 외부 CSS·버튼 마크업 | 20 L | estreuv 82 + pair 39 | **80% 절감** | 2/2 in-sync |
| **B5 실증 1호** `notice-badge` (React 마이그레이션 — migration-samples/react-notice-badge.jsx) | 41 L (React hooks) | 23 L | estreuv 94 | 44% (경로 실증 목적) | 1/1 in-sync |

- 파일럿 2호 특이점: 원본이 접힘 표현을 외부 CSS 에 위임하던 것을 slot 셀프 렌더로 흡수 + 원본 계약(host `data-collapsed` 반영·전역 스와이프 가드·부모 `data-content-collapsed` 는 pair 어댑터 중계) 보존.
- B5 는 X1 지표보다 **경로 검증**(React 관용구 → `.eux` 의도 환원 → Lit 재구현)이 목적 — 매핑 표는 [BREW.md § 마이그레이션 경로](../BREW.md).
- 휴리스틱 #1 보강: 소형·계약 명확 핸들(NumKeypad 82%·ToggleBlock 80%)이 인프라 supervisor 류(40%)보다 절감 폭 큼 — **V3 대체는 소형 핸들부터 순차가 측정상으로도 유리**.

## 잔여 (Phase B 게이트의 마지막 조각)

- ~~**① 라이브보드 11 spec의 drift-check 게이트 편입**~~ — ✅ **완료 (2026-07-03)**: dist 11 산출 provenance 완비 확인·전수 PASS·허브 pre-commit `euxDriftGate` 편입(negative 테스트 포함 3-way 검증). X3 실측 활성화.
- ~~**② 라이브 LLM 실연동 실측 1회**~~ — ✅ **완료 (2026-07-03)**: `google/gemini-2.5-flash`(Gemini OpenAI-호환 레이어) 경유 notif-toggle 실 brew — **estreuv·estreui 2 타깃 라이브 산출**(`spike/llm-live/`), provenance·extractCode 파이프라인 정상, @state/@render 계약 반영 확인(Lit customElement + enabled 필드). pair 타깃은 google 측 지속 503(과부하)으로 미완 — 경로 검증 목적은 달성.
  - **관찰 1 (verbosity)**: agent brew 28L vs LLM 161L(estreuv)/252L(estreui) — 동일 spec에서 LLM 산출이 6~9배 verbose(JSDoc·방어 코드 포함). agent provider의 간결성이 X1 절감의 주요인.
  - **관찰 2 (가용성 매트릭스)**: 2.5-flash 성공 2회 후 지속 503 · 2.5-flash-lite 503 · 2.0-flash 404(retired) — 라이브 경로는 모델 가용성 변동에 노출, **재시도가 매 실행 전 타깃 재호출**이라 부분 실패 시 비효율(향후 개선 후보: 기존 산출 skip 옵션).
- **Phase B(다중 채널·reverse sync·Estrim) 착수 조건 충족 판정 — 2026-07-03.** 착수 순서는 EG parity-roadmap 조율과 조정.
