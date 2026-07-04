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

## 마이그레이션 경로 — 타 프레임워크 → EstreUI/UV (distill 응용)

distill 은 **target-무관**이므로 원본이 React/Vue 등 타 프레임워크여도 경로는 동일하다: **타 fw 코드 → `.eux` distill → estreui/estreuv brew**. `.eux` 가 프레임워크 중립 명세라서 원본 관용구는 증류 시점에 의도로 환원되고, brew 가 타깃 관용구로 재구현한다.

관용구 매핑 (React → estreuv 기준, 실증 1호 `examples/react-notice-badge.eux`):

| React 원본 | `.eux` 명세 | estreuv brew 산출 |
| --- | --- | --- |
| props (+default) | `@state` 항목 (type·default) | reactive `properties` |
| `useState` | `@state` 내부 상태 항목 | reactive internal state (`state: true`) |
| `useEffect` + cleanup | `@behavior` 의 반응 서술 + 자원 회수 조건 | `updated()` 반응 + 타이머/리스너 lifecycle 제어 |
| `return null` 조건부 | `@behavior` visible 조건 | `render()` 분기 (빈 렌더) |
| 콜백 prop (`onX`) | `@behavior` 의 이벤트 통지 서술 | `CustomEvent` event-up |
| JSX + inline style | `@render` 자연어 | lit-html + shadow DOM `static styles` |

적용 지침:
- **컴포넌트 단위 점진 마이그레이션**이 경로다 — 대형 React/Vue SPA 의 일괄 전환은 여전히 비용 리스크([adoption 검토](adoption/estre-stack-adoption-review.md) 분류 유지). 위젯·페이지 구성물부터 하나씩 distill→brew 하고, 앱 셸 전환은 별도 판단.
- 증류 시 원본을 `@source` 로 추적하고(마이그레이션 감사 경로), 원본 파일은 `examples/migration-samples/` 처럼 참조 가능한 위치에 보존한다.
- 원본의 프레임워크 종속 관용구(hooks 규칙·context 등)는 명세로 올리지 말고 **의도로 환원**해서 적는다 — 그래야 estreui(클래스/jQuery)·estreuv(Lit) 어느 타깃으로도 brew 된다.

## 시드 3티어 증류 (EstreGenesis 정렬)
한 컴포넌트를 EstreGenesis 시드의 3티어에 맞춰 3 수준으로 증류해 전달한다:
- **러프(rough)**: `@intent` + 핵심 `@state`/`@behavior` 골자 — 빠른 의도 전달.
- **디테일(detail)**: 현행 `.eux` 수준(state 타입·default, behavior 설명, render, persist).
- **하이퍼디테일(hyper)**: 엣지케이스·접근성·성능·의존 주입·라운드트립 기준까지 — 결정적 brew 가능 수준.

## `@ports` — 호스트 계약 (격리 컴포넌트, v0.0.2+)

격리 컴포넌트(자체 전역 상태 접근 없이 호스트가 주입/통지로만 결합)는 호스트와의 계약을 `@behavior` 자연어에 녹이지 않고 **`@ports` 섹션**으로 구조화한다. 줄 prefix 로 방향을 구분:

| prefix | 의미 | 문법 |
| --- | --- | --- |
| `in` | **props-in** — 호스트가 `opts`/초기값으로 주입하는 정적/반응형 데이터 | `in <name> : <type>  # 설명` |
| `cmd` | **command-in** (v0.0.3) — 호스트가 호출하는 갱신 메서드(`setData`·`feed` 류, 컨트롤러에 노출) | `cmd <name>(<args>) : <설명>` |
| `out` | **events-out** — 컴포넌트가 호스트로 올리는 콜백 | `out <name>(<args>) : <설명>` |
| `deps` | **주입 의존** — 내부 생성 금지, `opts` 로 주입받음 | `deps <name> : <type>  # 설명` |

예 (ws-tabs):
```
@ports
cmd  setData(snap) : 호스트가 {channels, active} 스냅샷 주입(부분 병합 → 재렌더)
out  onSelect(key) : 탭(id)/그룹("group:<key>") 클릭 — 호스트에 활성 전환 요청
out  onClose(id) : ✕ 클릭 — 호스트에 채널 닫기 요청
```

- **`@state` 와 구분**: `@ports.in` 은 *초기 props*, `@ports.cmd` 는 *런타임 갱신 메서드*(계약), `@state` 는 *컴포넌트가 보관하는 내부 뷰 상태*. 격리 컴포넌트는 `in`/`cmd` 로 받아 `state` 에 보관하고 `out` 으로 통지한다.
- 모든 provider 가 포트 계약을 honor: `agent` 는 `@agent-brew` 스텁에 in/cmd/out/deps 를 "정확한 키·시그니처 준수" 지시로 렌더, `openai-compatible` 은 system 프롬프트로 전달.
- **하위호환**: `@ports` 없는 `.eux` 는 빈 계약으로 파싱(기존 산출물 drift 불변, 검증됨).
- **코드 무영향 메타 추가 라운드트립**: `@ports` 처럼 *기존 동작을 바꾸지 않는* 메타를 **증류된(검증 코드 보유) 컴포넌트**에 추가할 때는, agent re-brew(스텁 재생성 → 검증 본문 소실) 대신 **dist provenance 헤더의 `source` sha 만 새 `.eux` sha 로 갱신**(본문 유지)한다. drift-check 는 헤더 sha ↔ `.eux` sha 만 비교하므로 PASS 되고 검증 본문은 보존된다. (동작이 바뀌는 수정은 정식 re-brew → 본문 재구현.)

## `@styles` — 디자인 토큰·스타일 힌트 (vanilla, v0.0.4+)

`@render` 가 *구조·레이아웃*을 자연어로 담는다면, `@styles` 는 *디자인 토큰(색·크기 상수) + 셀렉터별 스타일 힌트*를 담아 brew 가 **결정적 CSS** 를 emit 하게 한다 — google 벤치마크에서 같은 `.eux` 가 모델마다 색·클래스를 임의 생성한 편차를 제거. `@render` 형제로 자유 텍스트(토큰 라인 + 셀렉터 압축 스타일).

예 (ws-conn-bar):
```
@styles
accent = var(--accent, #7a4dff)   # 연결/활성 강조색
.ws-conn    : flex·align center·gap 7px·12px·#cfcfe0·flex-wrap
.ws-dot2    : 8px 원·#888·전이; .on → accent
.ws-meta    : #999
.ws-repo    : accent·hover 밑줄
```

- vanilla 타깃은 이 명세로 CSS 를 1회 주입(injectStyle). estreuv/estreui 는 각 타깃 스타일 관례로 매핑.
- 토큰(`var(--x, fallback)`)은 호스트 테마와 결합, 셀렉터 힌트는 컴포넌트 자체 스타일.
- 하위호환: `@styles` 없으면 brew 가 `@render` 자연어로 스타일 추정(기존 동작).
- **공통 토큰 팔레트 (v0.0.5)**: 여러 컴포넌트가 공유하는 토큰(role 색·danger·status)은 각 `.eux` 가 중복 정의하지 않고 호스트 `:root` 의 디자인 시스템 변수를 `var(--ws-danger, #e0455e)` 형태로 참조한다 — SSoT=호스트 팔레트, fallback 으로 격리성 유지. 디자인 일관·테마 오버라이드 가능. (라이브보드 = `public/style.css :root --ws-*`)

## `@machine` — 파생데이터·상태머신 (reducer, v0.0.5+)

`cmd` 가 *reducer*(현 상태 × 이벤트 → 새 상태)일 때 — 예: tool-card 의 `feed(evt)` 가 phase 별로 단일 tool 상태를 누적 — 그 로직을 `@behavior` 자연어에 묻지 않고 **`@machine` 섹션**에 구조화 자연어로 명세한다: ① reducer dispatch(이벤트 키별 전이) ② 상태전이(from→to, 트리거·가드) ③ 파생필드 매핑(source→field).

예 (ws-tool-card):
```
@machine tool   # cmd feed(evt) 가 dispatch — (tool 상태, evt) → 새 tool 상태
states: running(초기) · done · error
dispatch feed(evt) by evt.phase:
  start  → init: title=toolCallName, status=running
  args   → accumulate: args = delta 누적(argsPreview 우선)
  end    → running→done
  result → set result, running→done
guard: evt.display.status="error" → →error (명시 우선)
derive:
  title  ← display.title || toolCallName || toolCallId
  result ← content || delta || resultPreview
  dkind/subtitle/summary/compact ← display 부분 병합(mergeDisplay)
```

- 보통 `cmd`(dispatch 진입점)와 짝 — `@ports cmd feed(evt)` + `@machine` reducer 명세.
- 단일 상태 단위(컴포넌트당 0~1 머신). 단순 props/setX 갱신 컴포넌트는 `@machine` 불요.
- 하위호환: 없으면 brew 가 `@behavior` 자연어로 추정(기존 동작).

## 발견된 표현력 갭 (dogfooding 누적 — EstreGenesis 시드 2.0 입력)
라이브보드 증류 dogfooding 중 발견된 `.eux` 표현력 한계 — 보강 후보:
- ~~**`@deps`/`@ports` 섹션 부재** (ws-fab-badge, claude-session-2)~~ → **해소 (v0.0.2, 2026-05-27)**: `@ports`(in/out/deps) 섹션 도입 — 위 "`@ports` 호스트 계약" 절 참조. parseEux 파서·spec 구조·agent 스텁·openai 프롬프트 전 경로 반영, 스모크(in 2·out 2·deps 1 렌더)·하위호환 drift PASS 검증. claude-session-2 가 증류 4종(ws-channel-input·ws-fab-badge·ws-conn-bar·ws-tabs)에 적용+re-brew 예정.
- ~~**디자인/스타일 토큰 표현 약함** (ws-fab-badge, claude-session-2; google 벤치마크 실증)~~ → **해소 (v0.0.4, 2026-05-27)**: `@styles` 섹션 도입(위 절) — 디자인 토큰 + 셀렉터 스타일 힌트로 brew 가 결정적 CSS emit. 파서·spec.styles·agent 스텁·openai 프롬프트 반영. 증류 5종 .eux 적용 예정(claude 분담).
- **`@state` 외부 결합 자연어 의존** (ws-fab-badge, claude-session-2): "호스트와 동기" 류 결합이 자연어. props-in/events-out 구조화로 brew 재현성↑.
- ~~**⭐ `@ports in` 의 command-in 미표현** (ws-tool-card)~~ → **해소 (v0.0.3, 2026-05-27)**: `@ports` 에 `cmd` prefix 추가 — command-in(`setData`·`feed` 등 호스트 호출 갱신 메서드, args 시그니처)을 props-in 과 분리. 파서(`in|cmd|out|deps`)·`spec.ports.cmd`·agent 스텁·openai 프롬프트 반영, 스모크 검증. 증류 5종 .eux 재적용 예정(claude 분담, 메타-only).
- ~~**파생데이터 / 상태머신 표현 부재** (ws-tool-card, claude-session-2)~~ → **해소 (v0.0.5, 2026-05-27)**: `@machine` 섹션 도입(위 절) — reducer dispatch·상태전이·파생필드를 구조화 자연어로. claude 의 tool-card reducer 분석(phase 전이·running→done/error 가드·파생필드 매핑) 입력. 파서·spec.machine·agent 스텁·openai 프롬프트 반영, 스모크 검증. tool-card 시범 적용(메타-only).
- **target 모듈 형식·DOM 클래스·스타일 명세 부재 → 모델 brew 편차** (google/gemini-2.5-flash 벤치마크, ws-conn-bar): 같은 `.eux` 를 `agent` vs `google` brew 비교 — `@ports`/`@state`/`@behavior` 는 **양쪽 충실 honor**(특히 @ports command-in `setStatus`·표시전용 out 없음 모델 무관 정확 = 계약 명시가 모델 재현성에 기여 ✓), 그러나 ① 모듈 형식(agent=ESM `export` / google=factory `return`) ② DOM 클래스(agent=`.ws-conn` 실제 일치 / google=`.ws-conn-bar` 임의) ③ 스타일(agent=CSS `var(--accent)` 주입 / google=주입 생략·호스트 의존) 편차. `@render`/`@targets` 의 모듈 형식·클래스·스타일 토큰 명세 강화 필요(위 스타일토큰 갭과 연결).
- ~~**@styles 토큰 공유/import 부재** (claude-session-2, @styles 적용 관찰)~~ → **해소 (v0.0.5, 2026-05-27)**: 공통 토큰(role 색·danger·status)을 호스트 `:root --ws-*` 디자인 시스템 변수로 승격하고 각 `.eux @styles` 가 `var(--ws-*, fallback)` 참조 — 위 "공통 토큰 팔레트" 항목. 중복 정의 제거·테마 일관. 5종 .eux/dist var 참조 적용(claude 분담).
<!-- codex 교차 검증·후속 증류 부족분은 보고 시 여기 누적 -->

