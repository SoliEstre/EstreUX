# Reverse Sync 판정 규격 (B3) — draft v0.1

> **상태**: DRAFT v0.1 (2026-07-04) — 허브 작성, EG 검토 대기 (REQ-1 협의 스레드)
> **입력**: EG REQ-1 검토서 v0.1(2026-07-04, B3×P3/P4 접속 설계 — 허브 전체 수용) + [eux-format v1.2 §2.6/§2.7](eux-format-v1.md) + PM 009 B3(본질결정 #6)
> **목적**: 결과 코드 수정 → `.eux` 갱신(reverse sync)의 **판정 파이프라인과 수용 기준**을 규격화한다. PM 009 성공 기준 "sync 정확도 >90%"의 조작적 정의가 본 문서다.

## 1. 정의

- **reverse sync** — 산출물 코드가 (사람/에이전트에 의해) 수정된 뒤, 그 변경을 원 `.eux` 로 역반영(역-distill)해 spec↔code 정합을 회복하는 절차.
- **protected clauses** — 역반영 시 보존이 검증되어야 하는 계약 집합: `@invariants`(§2.6 — state/temporal/transaction/causality) + `@metamorphic`(§2.7) + `@ports` `pre`/`post` + `@machine` `guard`/`entry-post`.
- **accuracy** — `accuracy(.eux → .eux') = 보존-판정 통과 clause 수 / 총 계약 clause 수`. P3/P4 가 이 분모·분자를 제공한다.

## 2. 판정 파이프라인 (2층)

```
code edit → 역-distill 후보 .eux'
  → [P3 정적 게이트]  parse-diff 로 protected clause 삭제·약화 검출 (실행 불요)
       · hard-fail class 위반 → 즉시 reject
  → [P4 동적 게이트]  @metamorphic property 를 갱신 전/후 코드에 실행 (p4-check)
       · "형태 유지·의미 파손" 케이스 검출
  → accuracy = w_s · 정적보존율 + w_d · 동적 pass 율
  → 판정 (§3)
```

- **P3 = 정적 판정층** — B3 실패모드 (a) *계약 훼손* 대응. 판정기 = drift-check `--invariant` 확장 (허브 소관).
- **P4 = 동적 판정층** — B3 실패모드 (b) *의미 드리프트* 대응. 판정기 = p4-check runner (EG 소관, fast-check 류).

## 3. 판정 outcome (3종 — auto-accept 없음)

| outcome | 조건 | 후속 |
| --- | --- | --- |
| **soft-accept** | hard-fail == 0 **∧** accuracy ≥ 0.9 | `.eux'` 채택 + **사람 리뷰 큐** 등재 (자동 확정 아님) |
| **reject** | hard-fail ≥ 1 **∨** accuracy < 0.9 | 역반영 폐기, 코드 변경자에게 사유 반환 |
| **contract-change proposal** | protected clause 자체의 수정이 *의도된* 스펙 진화일 때 | 자동갱신 금지 — **human-gate** 로 분리 상정(제안서 형태로 사람 결정) |

- **hard-fail class**: `@hazards` 연계 clause(integrity/credential — 예: revoke_persistence_first·dual_write_atomicity) 는 **1건 위반 = reject**. ">90%" 는 hard 0 전제의 soft 임계로만 유효하다.

## 4. 규격 파라미터

- **clause 최소 밀도** (분모 희박 spec 과대평가 방지, REQ-1 r1): P3 격상 대상 `.eux` 는 `@ports.cmd` 당 `pre`/`post` ≥1 **또는** `@invariants` sub-section ≥2 를 충족해야 accuracy 판정 유효. 미달 spec 은 판정 불가(insufficient-denominator)로 표기 — reject 아님.
- **가중치 w_s/w_d** (REQ-1 r4): 초기값 0.5/0.5 는 **임의값**이며 규범 아님 — B2 파일럿(num-keypad·toggle-block, `@invariants`/`@metamorphic` 시딩 완료 `349c4d0`) e2e 실측으로 캘리브레이션 후 본 절에 확정 기록한다.
- **UI 어댑테이션** (REQ-1 r2): UI 매크로류(캘린더 등)는 서버류와 property 성격이 달라 `@metamorphic` 에 **스냅샷 등가**(같은 상태 → 같은 렌더 구조) 패턴을 허용한다 — determinism 의 UI 특화형. 세부는 B2 3호(캘린더 전 단계)에서 실증 후 보강.

## 5. 소유 경계 (REQ-1 합의)

| 산출물 | 소유 |
| --- | --- |
| 본 규격 + eux-format v1.2 §2.6/§2.7 (기작성) + parseEux | 허브 |
| P3 정적 diff 판정기 (drift-check `--invariant` 확장) | 허브 |
| `@invariants`/`@metamorphic` 어휘 rubric (P3, 6 spec prose invariant 1차 재료) | EG |
| P4 metamorphic runner (p4-check, fast-check 류) | EG |
| 게이트 정책 (본 문서 §3) | 허브 주도 · EG 검토 |

## 6. e2e 파일럿 (진입 준비 완료)

- 허브 측: `examples/num-keypad.eux`(@invariants 5·@metamorphic 3) · `examples/toggle-block.eux`(4·3) — 시딩 완료, drift in-sync, p4-check 파싱 확인.
- EG 측 대조군: `history-store.eux` (byte-identity·idempotency·mode-chain round-trip 최다 — REQ-1 지정).
- 첫 e2e = 파일럿 산출물에 의도 변경 1건(계약 보존) + 파괴 변경 1건(clause 위반)을 가해 §3 판정이 각각 soft-accept/reject 로 갈리는지 검증.

## 7. 변경 이력

- v0.1 (2026-07-04) — 초안. EG REQ-1 검토서 v0.1 수용 내용의 규격화(2단 게이트·3 outcome·밀도 기준·캘리브레이션 유보·소유 경계). EG 검토 요청 발신.
