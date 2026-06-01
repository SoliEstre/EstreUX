# CHANGELOG — EstreUX

> EstreUX(`.eux` Universal eXpression) 변경 이력. 형식은 [Keep a Changelog](https://keepachangelog.com) 약식.

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
- **컴포넌트 프로파일** — `ui-component` / `backend-service` / `protocol-adapter` / `state-machine`. 프로파일별 필수·금지 디렉티브 매트릭스 (`@render` 는 ui-component 전용 → backend `@render N/A` 빈 선언 남발 해소).
- **`@targets` 분류 정비** — UI Rimwork(`estreuv`/`estreui`/`pair`) vs 범용 런타임(`vanilla`/`node`). backend 가 UI Rimwork 쓰던 타깃 오류 차단.

### Changed
- `package.json` description — scope 확장 반영(UI 함의 제거).
- README scope 절(2026-05-30·adb33de) 과 규격 문서 일치(이전엔 README 만 Universal, 규격은 v0 UI 전용으로 불일치였음).

### Notes
- 신규 디렉티브 4종은 ws-core(허브 라이브보드 WS 코어)·결제 도메인 backend A/B 도그푸딩(비-UI 19 컴포넌트)에서 **이미 실사용되던 것의 사후 정식화** — 위험 낮음(RRP 근거: 허브 `reports/2026-05-31-eux-spec-universal-expansion.md` P1~P2).
- C7~C9(보안/정합성 인라인 마커·바이너리/와이어 포맷·DB/트랜잭션 `@data`)은 더 많은 비-UI 사례 축적 후 v1.x 후속에서 정식화(과설계 회피).

## 0.1.0 (2026-05-28)

- Phase A spike: UI 한정 `.eux` 포맷 v0 ([docs/eux-format-v0.md](docs/eux-format-v0.md)) — 8 디렉티브(`@component`·`@intent`·`@expansion`·`@targets`·`@state`·`@behavior`·`@render`·`@persist`).
- 결정적 템플릿 PoC(`spike/expand.mjs`·`spike/drift-check.mjs`), `create-estreui` 연계.
- 결정성 trio(temperature/model/template) + provenance 헤더 + drift-check pre-commit 게이트.
