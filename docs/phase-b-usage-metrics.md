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

## 잔여 (Phase B 게이트의 마지막 조각)

- ~~**① 라이브보드 11 spec의 drift-check 게이트 편입**~~ — ✅ **완료 (2026-07-03)**: dist 11 산출 provenance 완비 확인·전수 PASS·허브 pre-commit `euxDriftGate` 편입(negative 테스트 포함 3-way 검증). X3 실측 활성화.
- **② 라이브 LLM 실연동 실측 1회** (openai-compatible 경로, API 키 보유) — provider 수평선택 검증. 승인 맥락 확보됨(d-google-brew ① 사용자 이행: expand.mjs 권한 + ESTREUX_LLM_API_KEY 등록).
- ② 완료 시 Phase B(다중 채널·reverse sync·Estrim) 착수 조건 충족으로 판정.
