# reverse-sync e2e 2차 — P3c 스테이지 정리 반영 왕복 시험 (2026-07-17)

> [reverse-sync-spec v0.2.2](reverse-sync-spec.md) §6 후속 — [1차](reverse-sync-e2e-001.md) 발견 4(f4=(b)) 해소 상태에서 P3/P4 분별력 재실측 → w_s/w_d 캘리브레이션 제안. 시나리오 합의 = A2A `b3-e2e2-propose-mroribhe-szoxud` 왕복 (EG ACCEPT: S1~S3 그대로·S4 skip·seed 는 `EUX_P4_SEED` 패치 전 기본 20260711 회귀축).
> 역할 분담: 허브 = 실행·리포트 / EG = 대조 (1차 동일).

## 실행 조건

- 러너: `spike/drift-check.mjs --invariant` (P3c, v0.2.2 스테이지 구분 반영) · `spike/p4-check.mjs --run` · fast-check **seed=20260711 고정**(anchor 상수 — EG `EUX_P4_SEED` env 훅은 차기 컷) · numRuns 25
- 대상: toggle-block (S1·S2·S3-R3v2) · num-keypad (S3-R2) — 1차와 동일 파일럿
- brew-with-invariants 각인: dist provenance 헤더 `// │ invariants: brewed` 마커 + spec `@invariants` 절의 vocabulary 를 계약 주석으로 각인 (agent provider 직접 brew, 코드 동작 무변경 — P4 로 비파괴 확인)

## 결과 매트릭스

| 런 | 대상 | 조작 | P3c 결과 | P4 결과 | 판정 |
| --- | --- | --- | --- | --- | --- |
| **S1** | toggle-block (estreuv+pair) | brew-with-invariants re-brew — 마커+vocab 4종(member-of·at-most-once·precedes·implies) 각인 | vocab **4/4 잔존**·exit 0 (잔존 게이트 활성 첫 통과) | 3/3 attested·exit 0 (각인 비파괴) | **P3 양성 실측 ✓** |
| **S2** | toggle-block (estreuv 만 변형) | S1 dist 에서 vocab 각인 블록만 제거 (마커 유지 — 최소 차이) | estreuv **0/4 → 본질 손실 drift·exit 1** · pair 4/4 통과 (검출 국소성) | (비실행 — 주석 변형은 P4 무반응 클래스) | **P3 검출 실측 ✓ — P3 고유 분별력 첫 실증** |
| **S3-R2** | num-keypad | 1차 R2 파괴 변형 재실행 (resolveInput 가드+unwire 제거) | — | 정확히 `idempotency/resolveInput-once-vs-n` 만 FAIL (counterexample `[1]`)·나머지 2 PASS·exit 1 | **reject 분기 회귀 ✓ — 1차와 동일 재현** |
| **S3-R3v2** | toggle-block | 1차 R3 v2 의도 변형 재실행 (`#reflectCollapsed()` 헬퍼 분리) | — | 3/3 attested·exit 0 | **soft-accept 분기 회귀 ✓ — 1차와 동일 재현** |

종료 상태: toggle-block dist = S1 각인본(정본 채택 — 마커 규약 첫 실배치), num-keypad dist = 1차 정본 복원. 변형본은 `.e2e-tmp/` 보존.

## 실패 클래스 × 게이트 직교성 (1차+2차 종합)

| 실패 클래스 | 실례 | P3 (정적) | P4 (동적) |
| --- | --- | --- | --- |
| **(a) 계약 서술 손실** — dist 에서 invariant 계약 흔적 소멸 | S2 (vocab 각인 제거) | **검출** (본질 손실) | 통과 (주석 무반응) |
| **(b) 행동 위반** — 형태 유지·의미 파손 | 1차 발견 1 (private-bind TypeError) · R2 (가드 제거) | 통과 (절 텍스트 멀쩡) | **검출** (counterexample 산출) |
| 의도 리팩토링 (계약 보존) | R3 v2 | 통과 | 통과 |

두 게이트는 **직교** — 중첩 방어가 아니라 상호 배타적 실패 클래스를 전담한다. 1차의 "실질 분별력 전부 P4"는 P3 정의역 오류(발견 4)에 의한 착시였음이 확인됨.

## w_s/w_d 캘리브레이션 제안 (§4 확정 후보)

**제안: w_s = 0.3 / w_d = 0.7** (초기 임의값 0.5/0.5 대체). 논거:

1. **증거력 비대칭**: P4 는 위반의 counterexample 을 산출(강한 증거)·P3 잔존은 grep 수준(주석 각인만으로 충족 가능한 약한 증거 — S1 이 그 실례).
2. **위험도 비대칭**: 역동기화의 주 위험은 행동 위반(형태 유지·의미 파손 — 사람 눈에 안 보임). 계약 서술 손실은 재-brew 로 복구 가능한 메타 손실.
3. **임계 조합 정합** (soft-accept accuracy ≥ 0.9 기준): P4 1절 실패(3절 중)만으로 0.7×⅔+0.3 = 0.77 → reject. P3 1절 손실(4중 3 잔존)은 0.3×¾+0.7 = 0.925 → soft-accept 유지(사람 리뷰 큐행). 행동 위반이 더 치명적이라는 실측과 정합하는 비대칭.
4. **하한 방어**: P3 전멸(S2 클래스)은 가중치 이전에 drift exit 1 (BlockerManifest-shaped) — w_s 가 낮아도 본질 손실 클래스는 게이트 자체가 차단. hard-fail class (§3) 도 가중치 무관.

분모 분포(§4 기록): toggle-block P3 vocab 4·P4 3절 / num-keypad P4 3절 — 1차 13절 분포와 합산 시에도 컴포넌트당 3~7 유지. N_min 재검토 입력 불변.

**확정 절차**: EG 대조 회신에서 본 제안 합의 시 spec §4 에 확정 기록 → v1.0 승격 판단.

## 잔여

- [ ] EG 대조 회신 (본 리포트 발신 `b3-e2e2-report-*` 스레드) → w_s/w_d 확정 → spec §4 기록·v1.0 판단
- [ ] EG `EUX_P4_SEED` env 훅 소패치(차기 컷) → 신규 seed 축(20260718) 재실행분은 패치 후 선택 실행
- [ ] (1차 이월) 발견 2: anchor 규약 주석 반영(EG) + Playwright 실브라우저 승격 검토(중기)
