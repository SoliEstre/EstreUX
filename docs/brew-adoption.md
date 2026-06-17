# 다운스트림 brew 도입 가이드 — `.eux` ↔ 코드 N-way 해소

> 실프로젝트에서 EstreUX `brew` 흐름을 채택해 **`.eux`와 산출 코드의 수동 N-way 동기화를 없애는** 방법.
> 배경: 실전 도그푸딩 1호에서 `.eux`(설계 스펙)와 `.js`(구현)를 **둘 다 손으로** 작성·동기화하는 마찰이 보고됨. 그 마찰은 brew 흐름(생성 + drift-check)을 채택하지 않아 발생한다 — EstreUX는 이미 단방향 생성 + 드리프트 감지를 제공한다.

---

## 0. 한 줄

`estreux brew <file.eux>` → `@agent-brew` 스텁 → 에이전트가 본문 구현(provenance 헤더 유지) → `drift-check` PASS. 이후 `.eux`만 SSoT로 고치고 re-brew하면 코드가 따라온다. **양쪽 손동기화 불필요.**

---

## 1. 전제 — 정식 `.eux` 형식

brew 파서(`parseEux`)는 정식 디렉티브만 읽는다. 비표준 헤더로 쓴 `.eux`는 변환이 필요하다:

| 비표준(hand-author 흔한 형태) | 정식 EstreUX |
| --- | --- |
| `@element <tag>` | `@component <tag>` |
| `@props` (속성 나열) | `@ports` 의 `in <name> : <type>` |
| `@const` (상수/팔레트) | `@styles` 토큰 + 본문 상수 (전용 슬롯은 검토 중) |
| `@style-tokens` | `@styles` |

정식 골격:
```
@component <tag>
@profile ui-component
@intent <한 줄 의도>
@expansion model=agent/claude
@targets estreuv         # estreui / pair 도 가능(γ 다중 타깃)

@ports
in   <name> : <type>     # props 주입
deps <name> : <type>     # 주입 의존(전역 직접 참조 금지 — 호스트가 주입)
out  <name>(<args>)      # 이벤트 콜백

@state
<name> : <type> = <default>

@behavior
<name>(<args>) : <설명>

@render
<자연어 — 구조·레이아웃>

@styles
<토큰명> = <값>          # 디자인 토큰
.<selector> : <스타일 힌트>

@persist localStorage key=... fields=...   # 영속 필요 시
```

## 2. brew 흐름 (4 스텝)

1. **생성**: `node spike/expand.mjs <file.eux>` (또는 `estreux brew <file.eux>`) → `dist/<target>/<comp>.js`에 **provenance 헤더 + `@agent-brew` 계약 스텁**(전체 명세 + 구현 지시) 생성.
2. **구현**: 에이전트(IDE 세션/서브에이전트)가 그 파일을 열어 `@agent-brew` 블록을 **실제 `<target>` 코드로 대체**. **provenance 헤더(`// │ source : … sha256:…`)는 그대로 둔다** — drift-check 기준선.
3. **검증**: `node spike/drift-check.mjs <file.eux>` → 헤더 sha ↔ 현 `.eux` sha 일치 확인(`✓ in sync`). `--contract`로 인터페이스 계약, `--invariant`로 행동 계약 정적 게이트도.
4. **표류 차단**: `git config core.hooksPath .githooks`(또는 `npm install`의 `prepare`) → 커밋 전 `.eux`↔산출물 drift를 hook이 막는다.

## 3. 이후 수정 (N-way가 사라지는 지점)

- **동작 변경**: `.eux`만 고치고 re-brew → 스텁 재생성 → 본문 재구현 → drift PASS. `.eux`가 SSoT.
- **메타-only 변경**(동작 불변, 예: `@ports` 주석 추가): agent re-brew(검증 본문 소실) 대신 **dist provenance 헤더의 `source` sha만 새 `.eux` sha로 갱신**(본문 유지). drift-check는 sha만 비교하므로 PASS.

## 4. 케이스 — `http-checks-card` (hand-author → brew 전환 PoC)

실전 도그푸딩 1호의 외부-체크 카드를 brew 흐름으로 전환한 PoC([`examples/http-checks-card.eux`](../examples/http-checks-card.eux) → [`examples/dist/estreuv/http-checks-card.js`](../examples/dist/estreuv/http-checks-card.js), drift `✓ in sync`):

- **형식 변환**: 원래 `@element`/`@props`/`@const`로 작성돼 파서가 못 읽음 → `@component`/`@ports.in`/`@styles`로 변환.
- **`@const` 분해**: `MS_MAX`·등급 색 팔레트를 `@styles` 토큰 + 본문 상수로 분해(전용 `@const` 슬롯 표준화는 후속 검토).
- **전역 → 주입**: 원본이 `window.<ChartDetail>`을 직접 참조 → `@ports.deps chartDetail`로 주입받게 변환(격리성↑, 호스트 결합 명시).
- 결과: 산출 183줄 ≈ hand-author 190줄(동등). 이후 이 타일은 `.eux` 수정 → re-brew로 관리 → N-way 소멸.

> 다른 타일도 같은 절차로 전환하면 프로젝트 전체에서 손동기화가 사라진다. 한 번에 1개씩 옮겨도 무방(brew 안 한 파일은 그대로 hand-author로 공존).

## 5. 참고

- `.eux` 형식 전체: [docs/eux-format-v1.md](eux-format-v1.md) · brew provider/증류: [BREW.md](../BREW.md)
- provider: 기본 `agent`(에이전트 직접, 키 불요) · `openai-compatible`(모델 벤치마크) · `template`(결정적 PoC).
