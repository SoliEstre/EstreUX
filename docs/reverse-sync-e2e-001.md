# reverse-sync e2e 1차 — 첫 왕복 시험 실행 기록 (2026-07-11)

> [reverse-sync-spec v0.2](reverse-sync-spec.md) §6 의 첫 e2e: 파일럿 산출물에 의도 변경 1건 + 파괴 변경 1건을 가해 판정이 soft-accept/reject 로 갈리는지 검증 + EG 대조군(history-store) determinism cross-check.
> 역할 분담: 허브 = 실행·리포트 / EG = anchor 3종 작성(v2.5.141 + 후속 전달분)·대조. 시나리오 합의 = A2A `b3-e2e-plan-mrfxaaq8-ehtz57` 왕복.

## 실행 조건

- 러너: `spike/p4-check.mjs --run` (허브 정본) · fast-check **seed=20260711 고정** · numRuns 25(UI)/30(store)
- 러닝 환경: happy-dom + lit 3.3.3 + estreuv 1.0.0 (in-tree tarball — `npm pack packages/estreuv`; file: symlink 는 lit 2-realm 유발로 금지) — [examples/package.json](../examples/package.json)
- anchor: `examples/num-keypad.p4.mjs` · `examples/toggle-block.p4.mjs` (EG 작성·전달) · EG 리포 `constellation/history-store.p4.mjs` (v2.5.141 `cd97dc3`)

## 결과 매트릭스

| 런 | 대상 | 변경 | P4 결과 | 판정 매핑 (§3) |
| --- | --- | --- | --- | --- |
| 정상 | num-keypad (re-brew 본) | — | 3/3 attested · exit 0 | 통과 — EG 패치본 검증과 동일 재현 |
| 정상 | toggle-block (현행 dist) | — | 3/3 attested · exit 0 | 통과 — EG 검증과 동일 재현 |
| **R1** | history-store (EG anchor+impl, 허브 러너·허브 환경) | — | 6 attested · 1 skipped(공개) · 0 failed · exit 0 | **EG 자체 검증 ① 과 동일 — determinism cross-check ✓** |
| **R2** | num-keypad | 파괴: resolveInput 중복부착 가드+unwire 제거 | 정확히 `idempotency/resolveInput-once-vs-n` 만 FAIL (counterexample `[1]`) · 나머지 2 PASS · exit 1 | **reject 분기 ✓** — EG 사전 실증과 동일 |
| R3 v1 | toggle-block | 의도: render 헤더를 private getter 로 분리 | `round_trip` FAIL (`.header` null) | **환경 기인 거짓 양성** — 발견 #2, 판정 무효 |
| **R3 v2** | toggle-block | 의도: `updated()` 반영 블록을 `#reflectCollapsed()` 헬퍼로 분리 (render 비접촉) | 3/3 attested · exit 0 | **soft-accept 분기 ✓** (P4 축) |

**§6 요건 충족**: 의도 변경 → soft-accept / 파괴 변경 → reject 판정 분기 확인. seed 고정으로 양측 재현 동일성(R1) 확인.

## 분모 분포 (§4 캘리브레이션 데이터 — EG 검토 개선 3)

| spec | @metamorphic 절 | 구성 | 비고 |
| --- | --- | --- | --- |
| num-keypad | 3 | idempotency 2 · determinism 1 | @invariants 5 별도 |
| toggle-block | 3 | round_trip 1 · idempotency 1 · determinism 1 | @invariants 4 별도 |
| history-store | 7 | round_trip 3 · idempotency 2 · determinism 2 | 1 절 명시 SKIP(archive 표면 부재 — 공개 갭) |

총 13절 · 컴포넌트당 3~7. UI 소형 컴포넌트의 분모(3)는 §4 최소 밀도 기준은 충족하나 accuracy 1절 차이가 ±33%p — **N_min 절대 하한(v0.3+ 재검토) 필요성을 지지하는 실측**.

## 발견 (4건)

1. **num-keypad dist 인스턴스화 결함** (EG 발견 → 허브 re-brew): constructor 의 `this.#onInput = this.#onInput.bind(this)` — private *메서드* 재대입은 스펙상 TypeError, createElement 즉시 throw. **bound private arrow field** (`#onInput = () => {...}`) 로 re-brew (spec 불변 → sha `ab6e1e98564f` 유지, drift in-sync). 절 텍스트는 멀쩡해 P3 는 통과 — **P4 동적 게이트 고유 가치 실증 #1**.
2. **happy-dom 에서 lit top-level child expression 전부 무시**: shadow 템플릿 최상위의 `${expr}` 는 nested TemplateResult 든 문자열이든 렌더되지 않음(마커 주석은 보존되나 lit 의 part 순회가 실패 — 격리 재현 완료). R3 v1 이 이 때문에 false-FAIL. **환경 기인 거짓 양성 클래스가 실존** — §3 게이트는 "clause 위반 실패"와 "러닝 환경 실패"를 구분해야 하며, Playwright 실브라우저 승격 시 소멸하는 층. anchor 작성 규약에 "top-level expression 을 만드는 변형 금지(또는 환경 한계 명기)" 추가 권고.
3. **러너 CRLF 함정** (p4-check·drift-check 공통): 정규식 `.` 이 `\r` 을 매치하지 않아 `(.+)$` 절 추출이 CRLF spec 에서 0건 (sub-section 키는 `\s*$` 가 `\r` 을 소비해 통과 → 섹션 진입은 되나 절만 전멸). LF 인 허브 파일럿에선 잠복, CRLF 인 EG spec 의 R1 초회 실행에서 발현. `split(/\r?\n/)` 로 수정(3곳). **cross-repo e2e 가 아니면 발견 불가였던 결함 — e2e 왕복의 가치 실증 #2**.
4. **P3c vocab 잔존 검사의 시딩 경로 false-fail**: `drift-check --invariant` 의 vocabulary 잔존 검사는 산출물에 invariant 흔적이 각인된 것을 전제하나, 시딩(코드 무영향 메타 라운드트립) 경로 spec 은 dist 에 흔적이 없어 구조적 fail (양 파일럿 0/5·0/4). 해소 후보: (a) 시딩 spec dist 를 vocab 각인과 함께 re-brew (b) vocab 검사를 brew-with-invariants 산출물에만 적용(스테이지 구분) (c) P4 attest 존재 시 warn 강등. **w_s/w_d 캘리브레이션 전 P3c 스테이지 정리 선행 필요**.

## w_s/w_d 캘리브레이션 입력 (1차)

이번 e2e 에서 실질 분별력은 전부 P4(동적) — 결함 검출(발견 1)·파괴 분기(R2)·의도 통과(R3 v2). P3 는 sub-section 일관성 검사만 유효했고 vocab 검사는 false-fail(발견 4). 초기값 0.5/0.5 대비 **w_d 상향이 실측 방향**이나, P3c 스테이지 정리(발견 4 해소) 후 재평가가 순서. 판정: **캘리브레이션 확정은 2차 e2e(P3c 정리 반영) 로 유보**.

## EG 대조 (2026-07-11, 당일 회신)

**매트릭스 전항 EG 기록과 일치 — 1차 왕복 시험 상호 확인 종결** (§6 판정 분기 요건 실측 폐쇄). 발견별 합의:

- **f3 (러너 CRLF)**: EG 측 러너 사본 없음(in-place 직실행 — `1df1fe0` 이 곧 EG 실행 경로). 잠복 경위 실측 확인: EG 워크트리 .eux 도 autocrlf 로 CRLF 물질화됐었으나 실행들이 이전 LF 상태를 우연히 탔음. **예방축**: EG v2.5.142 `.gitattributes *.eux text eol=lf` + 허브 미러(본 커밋) — 사고 클래스 원천 차단.
- **f4 (P3c vocab)**: **(b) 스테이지 구분으로 확정** — vocab-잔존 grep 의 정의역은 brew-with-invariants 산출물이므로 시딩 경로 적용은 정의역 밖(구조적 false-fail 당연). 임시조치로 (c) warn 강등 수용 가능하나 종착은 (b). w_s/w_d 유보 동의.
- **f2 (happy-dom)**: 환경-기인 거짓 양성 클래스 실존·§3 구분 필요 동의. anchor 대응 — 차기 개정 시 규약 주석에 "top-level child expr 회피(래핑)" 명기 + 근본 해소는 Playwright 승격(anchor property 층 무수정 재사용).
- **N_min**: 소형 UI 분모 3(±33%p) 이 N_min 필요성을 지지한다는 판단 동의.

## 잔여

- [x] 발견 4 → **(b) 구현 완료 (2026-07-17)**: P3c vocab 검사를 brew-with-invariants 스테이지로 한정 — dist 헤더 `invariants: brewed` 마커 자기선언 규약([spec §6b](reverse-sync-spec.md)), 마커 없는 시딩 dist 는 정의역 밖 skip. 검증: 시딩 파일럿 2종 false-fail 해소(exit 0) + 합성 마커 케이스 양/음성. → **2차 e2e 당일 완료 ([e2e-002](reverse-sync-e2e-002.md)) — w_s/w_d = 0.3/0.7 제안, EG 대조 게이트**
- [ ] 발견 2: anchor 규약 주석 반영(EG, 차기 개정) + (중기) Playwright 실브라우저 승격 검토
- [ ] Mode-B(sqlite dual) 절 3종: EG full 구현 랜딩 시 projection → 실절 실행 승격 (EG 소관)
