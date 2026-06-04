# CHANGELOG — EstreUX

> EstreUX(`.eux` Universal eXpression) 변경 이력. 형식은 [Keep a Changelog](https://keepachangelog.com) 약식.

## 0.3.0 (2026-06-04)

`.eux` 를 **행동 계약 검증**(P3 정적 + P4 dynamic)까지 확장한 minor — Constellation brew dogfooding(EG 협업) 산출.

### Added
- **eux-format v1.1** — adapter contract 7 directive(`@runtime`/`@roles`/`@wire`/`@routing`/`@delivery`/`@redaction`/`@operation_discipline`) + `@ports.in` semantics(`code-identifier`|`input-channel`, profile-implicit default + 명시 `semantics:` override).
- **eux-format v1.2** — 행동 계약 디렉티브:
  - `@invariants` (state/temporal/transaction/causality 4 sub-section + 권장 vocabulary `bounded`/`atomic`/`idempotent`/`monotonic`/`precedes` 등) — P3 정적 게이트 대상.
  - `@metamorphic` (round_trip/idempotency/determinism sub-section) — P4 property test 입력.
  - `@ports.cmd` pre/post · `@ports.out` post · `@machine` guard/entry-post.
- **`spike/p4-check.mjs`** (신규) — `@metamorphic` 절 → fast-check property 실행(P4 dynamic). `drift-check`(정적 @invariants) ↔ `p4-check`(dynamic @metamorphic) 대칭. `fast-check` dev-dependency(런타임 deps-0 유지).
- **`drift-check --invariant`** — 행동 계약 정적 게이트 3종(절 존재 · sub-section 일관성 · vocabulary 키워드 잔존; 위반=BlockerManifest-shaped). 정적 한계 명시(실제 위반 검출은 P4 dynamic).
- **`drift-check --contract` 확장** — vocab 카테고리(7 directive 프로토콜 심볼 잔존) · `@machine` 멀티라인 YAML states + arrow transition(G2) · `@ports` in/cmd/out 통합 + ports.in profile-gated(G4/G8) + `@profile` 미지정 보류 warn(G8b).

### Changed
- `@agent-brew` stub — 7 directive · `@invariants`/`@metamorphic` 표시 + events-out/cmd 호출 marker(G7, `@ports.out.post` anchor).
- `parseEux` — 7 directive · `@invariants`/`@metamorphic` FREETEXT 파싱 + `@ports` out/cmd desc-optional(시그니처-only) + 인라인 주석 strip.

### Notes
- Constellation 2.0 brew dogfooding(EG 협업, EG v2.5.45~49) 산출 — 1-tier 5개 canonical `.eux`(history-store/server-relay/server-keys/server-core/server-history) `@invariants` 격상 + history-store `@metamorphic` fast-check 검증(100 runs × 3 property PASS).
- dogfooding 수확(도구 ↔ 실사용 feedback loop): causality 4번째 sub-section · `@metamorphic` sub-section 구조 · ports.in profile semantics — EG 실사용이 spec 을 정합·성숙시킨 사례 3회.
- 잔여(후속 cycle): full reference impl(history-store.cjs Mode B/C) · P4 server-relay 등 확장 · 3rd cut(local-bridge).

## 0.2.0 (2026-06-01)

`.eux` 규격을 **Universal eXpression**(전 개발 영역) 으로 정식 확장한 첫 minor.

### Added
- **Universal eXpression scope 명문화** — `.eux` 적용 범위를 UI 한정에서 **전 개발 영역**(backend·protocol·state machine·data layer)으로 정식 확장(2026-05-30 "Estre Unified eXperience → Universal eXpression" 재정의 반영).
- **`.eux` 포맷 v1** ([docs/eux-format-v1.md](docs/eux-format-v1.md)) — 비-UI 증류용 신규 디렉티브 4종:
  - `@ports` (in/cmd/out/deps) — 모듈의 입출구(인터페이스 계약).
  - `@machine` (states/dispatch/guard/derive) — 상태와 전이(상태머신·오케스트레이션).
  - `@source` (file/lines) — 원본 코드 추적성(drift-check provenance 직결).
  - `@deps` — 다른 `.eux` 간 의존 그래프.
  - v0 8 디렉티브·결정성 trio·provenance/drift 규칙은 **그대로 계승**(v1 은 추가이지 교체가 아님).
- **컴포넌트 프로파일** — `ui-component` / `backend-service` / `protocol-adapter` / `state-machine` / `supervisor`. 프로파일별 필수·금지 디렉티브 매트릭스 (`@render` 는 ui-component 전용 → backend `@render N/A` 빈 선언 남발 해소). `supervisor`(워치독·워처 패턴)는 `@ports.in` 면제 — 받는 입구 없이 스스로 깨어나 감시·재기동(EG review 반영).
- **`@targets` 분류 정비** — UI Rimwork(`estreuv`/`estreui`/`pair`) vs 범용 런타임(`vanilla`/`node`). backend 가 UI Rimwork 쓰던 타깃 오류 차단.

### Changed
- `package.json` description — scope 확장 반영(UI 함의 제거).
- README scope 절(2026-05-30·adb33de) 과 규격 문서 일치(이전엔 README 만 Universal, 규격은 v0 UI 전용으로 불일치였음).

### Notes
- 신규 디렉티브 4종은 ws-core(허브 라이브보드 WS 코어)·결제 도메인 backend A/B 도그푸딩(비-UI 19 컴포넌트)에서 **이미 실사용되던 것의 사후 정식화** — 위험 낮음(RRP 근거: 허브 `reports/2026-05-31-eux-spec-universal-expansion.md` P1~P2).
- **EG(EstreGenesis) Constellation 1차지식 review(2026-06-01) 반영**: ① `@machine`·`@ports` 4 element 가 EG canonical 6 `.eux`(gateway-client v2.5.3 등)와 정합 OK 확인(형식차는 brew 단계 interchangeable) ② **`supervisor` 프로파일 갭** 추가 — canonical 6 모듈 중 self-wake-watcher·watchdog 2개가 4 프로파일에 forced fit 되던 어색함 해소 ③ C7~C9 우선순위 **C7 HIGH > C8 MEDIUM > C9 MEDIUM-LOW** 명문화. EG 는 v1.x ship 시 자체 Constellation `.eux` 6개를 신규 디렉티브+프로파일로 incremental update 가능, drift-check `--contract` dogfooding sample(gateway-client.eux) 제공 가능.
- C7~C9(보안/정합성 인라인 마커·바이너리/와이어 포맷·DB/트랜잭션 `@data`)은 더 많은 비-UI 사례 축적 후 v1.x 후속에서 정식화(과설계 회피).

## 0.1.0 (2026-05-28)

- Phase A spike: UI 한정 `.eux` 포맷 v0 ([docs/eux-format-v0.md](docs/eux-format-v0.md)) — 8 디렉티브(`@component`·`@intent`·`@expansion`·`@targets`·`@state`·`@behavior`·`@render`·`@persist`).
- 결정적 템플릿 PoC(`spike/expand.mjs`·`spike/drift-check.mjs`), `create-estreui` 연계.
- 결정성 trio(temperature/model/template) + provenance 헤더 + drift-check pre-commit 게이트.
