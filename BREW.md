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

## `@ports` — 호스트 계약 (격리 컴포넌트, v0.0.2+)

격리 컴포넌트(자체 전역 상태 접근 없이 호스트가 주입/통지로만 결합)는 호스트와의 계약을 `@behavior` 자연어에 녹이지 않고 **`@ports` 섹션**으로 구조화한다. 줄 prefix 로 방향을 구분:

| prefix | 의미 | 문법 |
| --- | --- | --- |
| `in` | **props-in** — 호스트가 `setData`/`opts` 로 주입하는 데이터 | `in <name> : <type>  # 설명` |
| `out` | **events-out** — 컴포넌트가 호스트로 올리는 콜백 | `out <name>(<args>) : <설명>` |
| `deps` | **주입 의존** — 내부 생성 금지, `opts` 로 주입받음 | `deps <name> : <type>  # 설명` |

예 (ws-tabs):
```
@ports
in   channels : list          # 호스트가 setData 로 주입하는 채널 스냅샷
in   active : string           # 활성 키
out  onSelect(key) : 탭/그룹 클릭 — 호스트에 활성 전환 요청
out  onClose(id) : ✕ 클릭 — 호스트에 채널 닫기 요청
deps storage : KeyValueStore   # (옵션) 영속 의존 주입
```

- **`@state` 와 구분**: `@ports.in` 은 *주입 인터페이스*(계약), `@state` 는 *컴포넌트가 보관하는 내부 뷰 상태*. 격리 컴포넌트는 `in` 으로 받아 `state` 에 보관하고 `out` 으로 통지한다.
- 모든 provider 가 포트 계약을 honor: `agent` 는 `@agent-brew` 스텁에 in/out/deps 를 "정확한 키·시그니처 준수" 지시로 렌더, `openai-compatible` 은 system 프롬프트로 전달.
- **하위호환**: `@ports` 없는 `.eux` 는 빈 계약으로 파싱(기존 산출물 drift 불변, 검증됨).
- **코드 무영향 메타 추가 라운드트립**: `@ports` 처럼 *기존 동작을 바꾸지 않는* 메타를 **증류된(검증 코드 보유) 컴포넌트**에 추가할 때는, agent re-brew(스텁 재생성 → 검증 본문 소실) 대신 **dist provenance 헤더의 `source` sha 만 새 `.eux` sha 로 갱신**(본문 유지)한다. drift-check 는 헤더 sha ↔ `.eux` sha 만 비교하므로 PASS 되고 검증 본문은 보존된다. (동작이 바뀌는 수정은 정식 re-brew → 본문 재구현.)

## 발견된 표현력 갭 (dogfooding 누적 — EstreGenesis 시드 2.0 입력)
라이브보드 증류 dogfooding 중 발견된 `.eux` 표현력 한계 — 보강 후보:
- ~~**`@deps`/`@ports` 섹션 부재** (ws-fab-badge, claude-session-2)~~ → **해소 (v0.0.2, 2026-05-27)**: `@ports`(in/out/deps) 섹션 도입 — 위 "`@ports` 호스트 계약" 절 참조. parseEux 파서·spec 구조·agent 스텁·openai 프롬프트 전 경로 반영, 스모크(in 2·out 2·deps 1 렌더)·하위호환 drift PASS 검증. claude-session-2 가 증류 4종(ws-channel-input·ws-fab-badge·ws-conn-bar·ws-tabs)에 적용+re-brew 예정.
- **디자인/스타일 토큰 표현 약함** (ws-fab-badge, claude-session-2): 구체 스타일(px·색)이 `@render` 자연어에만. vanilla 는 CSS 주입이 필요한데 디자인 토큰/스타일 슬롯 표현이 없어 하드코딩·`var(--accent)` 폴백으로 처리. 스타일 토큰 참조 표현 검토.
- **`@state` 외부 결합 자연어 의존** (ws-fab-badge, claude-session-2): "호스트와 동기" 류 결합이 자연어. props-in/events-out 구조화로 brew 재현성↑.
<!-- codex 교차 검증·후속 증류 부족분은 보고 시 여기 누적 -->

