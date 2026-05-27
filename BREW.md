# EstreUX brew 가이드 — `.eux` → 코드

> `.eux` 자연어 중간 레이어를 타깃 코드로 expansion(**brew**)하는 방법. provider 선택·에이전트 직접 brew·증류(distill)·시드 3티어.
> 동작: [`spike/expand.mjs`](spike/expand.mjs)(brew) · [`spike/drift-check.mjs`](spike/drift-check.mjs)(라운드트립 감시) · [`spike/providers/`](spike/providers/).

## provider 선택 (trio `model = <provider>/<name>`)

| provider | 예 | 용도 |
| --- | --- | --- |
| **`agent`** (기본) | `agent/claude` | **요청받은 에이전트(IDE 세션 또는 서브에이전트)가 직접 brew.** 외부 연결·키 불요. 일반적 경로. |
| `template` / `poc` | `template/deterministic` | 결정적 PoC stand-in(notif-toggle 등 고정 컴포넌트). 구조·provenance·drift 재현성 검증용. 임의 컴포넌트 brew 불가. |
| openai-compatible | `openai/gpt-4o` · `ollama/…` · `vllm`·`lmstudio`·`azure` | **AI 모델별 brew 품질 벤치마크**(여러 모델의 expansion 비교) 목적. 엔드포인트·키 등 추가 정보 필요. |

> 일반 brew = `agent`(요청 에이전트 직접). API(openai-compatible)는 **모델별 brew 벤치마크**일 때 — 추가 정보가 필요하므로 기본이 아니다.

## 에이전트 brew (기본 흐름)
1. `node spike/expand.mjs <file.eux>` (`model=agent/…`) → `dist/<target>/<comp>.js` 에 **provenance 헤더 + `@agent-brew` 계약**(spec 요약 + 지시) 스텁 생성.
2. 에이전트(요청받은 IDE 세션/서브에이전트)가 그 파일을 열어 `@agent-brew` 블록 지시대로 **실제 `<target>` 코드로 본문 대체** — provenance 헤더는 **유지**(drift-check 통과).
3. `node spike/drift-check.mjs <file.eux>` → `.eux` sha ↔ 생성물 provenance sha 일치 확인.
4. `.eux` 를 고치면 재 brew(헤더 sha 갱신) → drift 해소. (pre-commit hook 으로 표류 차단)

- **target 무관**(estreuv/estreui/pair/vanilla/…): `agent` provider 는 `template` 의 컴포넌트 하드코딩 제약이 없어 임의 컴포넌트·임의 타깃 brew 가능 — 예: 라이브보드 vanilla DOM 컴포넌트.

## 증류 (distill — 코드 → `.eux`)
기존 검증 코드를 `.eux` 로 **역추출**. brew(신규 생성)보다 **검증된 동작 보존 + `.eux` 표현력을 실제 코드로 시험**하는 데 적합(운영 중 자산 — 예: 라이브보드). 에이전트가 코드를 읽어 `@component`/`@intent`/`@state`/`@behavior`/`@render`/`@persist` 명세를 작성하고, brew 라운드트립(증류→brew→drift)으로 표현력·일관성을 검증한다. 증류 중 발견되는 부족분(provider·target·표현력)은 EstreUX 를 그 자리에서 보강(dogfooding).

## 시드 3티어 증류 (EstreGenesis 정렬)
한 컴포넌트를 EstreGenesis 시드의 3티어에 맞춰 3 수준으로 증류해 전달한다:
- **러프(rough)**: `@intent` + 핵심 `@state`/`@behavior` 골자 — 빠른 의도 전달.
- **디테일(detail)**: 현행 `.eux` 수준(state 타입·default, behavior 설명, render, persist).
- **하이퍼디테일(hyper)**: 엣지케이스·접근성·성능·의존 주입·라운드트립 기준까지 — 결정적 brew 가능 수준.
