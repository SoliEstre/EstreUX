# `.eux` 포맷 v1 — Universal eXpression

> EstreUX 의 자연어 중간 소스 형식 v1. v0([eux-format-v0](eux-format-v0.md)·Phase A·UI 전용)에서 **전 개발 영역**(backend·protocol·state machine·data layer)으로 scope 가 확장(2026-05-30 "Estre **Universal** eXpression" 재정의)됨에 맞춰, 비-UI 증류에서 **이미 실사용되던 디렉티브를 정식화**한다.
>
> **쉽게 말하면** — `.eux` 는 "사람이 자연어로 *의도*를 적으면, 그걸 LLM(또는 결정적 템플릿)이 실제 *코드*로 풀어내는(brew) 중간 소스"예요. v0 는 UI 컴포넌트만 다뤘는데, 실제로 백엔드·프로토콜·상태머신을 증류해보니 UI 디렉티브로는 표현이 안 되는 게 많더라고요(예: 모듈 인터페이스, 상태 전이, 바이트 포맷). 그래서 v1 은 그 영역을 위한 디렉티브 4종과 "이 모듈은 어떤 종류인가"를 정하는 **프로파일** 개념을 추가해요.
>
> **용어**(v0 계승) — `.eux` 를 쓰는 행위 = **expresso**(의도를 농축해 표현). `.eux` → 코드 변환 = **brew**(CLI `estreux brew`). γ 다중 타깃 = "한 번 brew 로 여러 잔".

---

## 0. v0 → v1 한눈에

| | v0 (Phase A) | v1 (Universal) |
| --- | --- | --- |
| **scope** | UI 컴포넌트만 | 전 개발 영역(UI·backend·protocol·state machine·data) |
| **디렉티브** | 8종 (`@component`·`@intent`·`@expansion`·`@targets`·`@state`·`@behavior`·`@render`·`@persist`) | 8종 **+ 신규 4종** (`@ports`·`@machine`·`@source`·`@deps`) |
| **분류** | (없음 — 전부 UI 가정) | **컴포넌트 프로파일** 5종 (ui-component·backend-service·protocol-adapter·state-machine·supervisor) |

⚠️ **v1 은 "추가"이지 "교체"가 아니다.** v0 의 8 디렉티브·결정성 trio·provenance/drift 규칙은 **그대로 계승**돼요. UI 컴포넌트는 v0 와 똑같이 쓰면 되고, 비-UI 모듈만 새 디렉티브를 추가로 쓰면 돼요.

---

## 1. 공통 디렉티브 (v0 계승)

v0 의 8 디렉티브는 v1 에서도 동일하게 유효해요. (상세·예시는 [v0 문서](eux-format-v0.md) 참고)

| directive | 역할 | 한 줄 |
| --- | --- | --- |
| `@component` | 식별자(kebab) | 이 모듈의 이름 |
| `@intent` | 한 줄 의도 | "뭘 하는 모듈인가" 자연어 한 줄 |
| `@expansion` | 결정성 trio | `temperature=0.0 model=… template=…` (재현성 layer) |
| `@targets` | 다중 타깃 | 어떤 런타임으로 brew 할지 (§4 에서 분류 정비) |
| `@state` | 반응 상태 | `name: type = default # 주석` |
| `@behavior` | 동작 | `시그니처 : 자연어 설명` |
| `@render` | 렌더 묘사 | 화면에 뭘 그리나 (**ui-component 프로파일 전용** — §3) |
| `@persist` | 영속 | `key=… fields=…` (localStorage 전제 — backend DB 는 §6 C9 후속) |

---

## 2. 신규 디렉티브 (v1 · 비-UI 증류용)

> **왜 4종이 새로 필요했나** — UI 컴포넌트의 핵심은 "화면에 뭘 그리나(`@render`)"지만, 백엔드·프로토콜·상태머신 모듈의 핵심은 **"어떤 인터페이스로 연결되고(`@ports`)·어떤 상태로 흐르고(`@machine`)·원본이 어디고(`@source`)·뭐에 의존하나(`@deps`)"** 예요. v0 디렉티브로는 이걸 표현할 수 없어서 실제 증류 때 `@render N/A` 같은 빈 선언이 남발됐어요(아래가 그 해소책).

### `@ports` — 모듈의 입출구

**무엇** — 이 모듈이 무엇을 받고(`in`)·무슨 명령을 처리하고(`cmd`)·무엇을 내보내고(`out`)·무엇에 의존하나(`deps`).

**왜** — 백엔드/프로토콜 모듈은 "화면"이 없어요. 대신 "이 모듈에 뭘 넣으면 뭐가 나오나"라는 **인터페이스 계약**이 핵심이에요. `@ports` 가 그 계약을 적는 칸이에요.

**언제** — `backend-service`·`protocol-adapter`·`state-machine` 프로파일(비-UI 모듈). ui-component 에는 보통 안 써요.

**예시**:
```
@ports
  in: WSFrame(JSON envelope · type/name/value/targetAgentId)
  cmd: register(agentId) · relay(targetAgentId, msg) · close(agentId)
  out: AgentList broadcast · delivered Ack
  deps: ws-history(영속 store) · flap-dampening(중복 HELLO churn 방어)
```
→ "이 모듈은 WS 프레임을 받아서, register/relay/close 명령을 처리하고, AgentList 와 Ack 를 내보낸다. ws-history 와 flap-dampening 에 기댄다" 를 한눈에.

**`@ports.in` 의 semantics — `code-identifier` vs `input-channel`** (v1.1, drift-check 정합):

`@ports.in` 은 프로파일에 따라 의미가 달라요:
- **`code-identifier`** (ui-component·protocol-adapter): 호스트가 **정확한 이름·타입으로 주입하는 props**. 그 식별자가 산출 코드에 그대로 남아요(`wsUrl`·`role`). → `drift-check --contract` 가 산출물 **잔존 강검증**.
- **`input-channel`** (backend-service·supervisor): 소켓·HTTP·큐 같은 **입력 채널 개념**. `wsFrame`·`httpReq` 처럼 "무엇을 받나"의 묘사라 코드 식별자로 안 남아요(런타임이 `ws.on`·`req` 로 처리). → drift-check **강검증 면제**(개념 표현이라 grep 무의미).

**default = profile-implicit** — 프로파일이 위 매핑을 자동 결정해요. 프로파일 기본과 다르게 강제하려면 `@ports` 에 명시 한 줄:

```
@ports
  semantics: code-identifier      # 이 모듈의 ports.in 을 profile 기본과 다르게 강검증(또는 input-channel 로 면제)
  in   sessionId : string
```

`drift-check --contract` 는 **명시 `semantics:` 우선 · 없으면 profile-implicit** 으로 ports.in 잔존 검증을 분기해요. (2026-06-04 도그푸딩 G8 — `server.eux` ports.in(`wsFrame`/`httpReq`) false drift 해소에서 정식화. 도구측 1차 반영 = `④ drift-check ports.in profile-gated`, 본 절이 spec 정식 카테고리화.)

**`@profile` 미지정 + `@ports.in` 보유** 시엔 semantics 를 결정할 수 없어 drift-check 가 **강검증을 보류하고 warn**(프로파일 명시 권장)해요 — false drift 회피. (2026-06-04 G8b — EG dry-run 에서 `@profile` 미지정 canonical .eux 11개(runtime 4 + UI 7) 발견.)

### `@machine` — 상태와 전이

**무엇** — 이 모듈이 가질 수 있는 상태들(`states`)·상태를 바꾸는 사건(`dispatch`)·전이 조건(`guard`)·상태에서 파생되는 값(`derive`).

**왜** — 승인 흐름, 취소 흐름, 연결 lifecycle 같은 건 "지금 어떤 상태고, 무슨 일이 생기면 어디로 가나"가 본질이에요. 글로 풀면 흩어지는데, `@machine` 으로 적으면 brew 가 정확한 상태머신 코드를 만들 수 있어요.

**언제** — `state-machine` 프로파일 필수. 상태 전이가 있는 backend-service 도.

**예시**:
```
@machine
  states: idle → awaiting-approval → approved | rejected
  dispatch: submit(req) · approve(by) · reject(reason)
  guard: approve 는 awaiting-approval 에서만 · 이미 approved 면 무시(idempotent)
  derive: isFinal = (approved | rejected)
```

⚠️ **`@machine` 에 바이트 포맷을 욱여넣지 말 것** — 고정길이 와이어 전문의 바이트 레이아웃(offset·길이·인코딩)은 상태머신이 아니에요. 현재는 표현 수단이 없어 임시로 `@machine` 에 묻히는데, v1.x 후속(§6 C8)에서 전용 디렉티브로 분리 예정이에요.

### `@source` — 어디서 왔나 (추적성)

**무엇** — 이 `.eux` 가 증류한 원본 코드의 파일·라인.

**왜** — `.eux` → 코드(brew)는 일방향이 아니에요. **원본과 어긋났는지(drift) 검증**하려면 "원본이 어디였나"를 알아야 해요. `@source` 는 drift-check 의 추적성(provenance)과 직결돼요.

**언제** — 기존 코드를 `.eux` 로 역증류한 경우(backend dogfooding 처럼). 새로 expresso 하는 경우엔 생략 가능.

**예시**:
```
@source
  file: dashboard/live/server.cjs
  lines: 806-926 (relay 분기 + source/type 정규화)
```

### `@deps` — 다른 `.eux` 와의 연결

**무엇** — 이 모듈이 의존하는 **다른 `.eux` 파일** 참조(모듈 간 의존 그래프).

**왜** — 큰 시스템은 모듈 여러 개가 엮여요. `@deps` 로 "이 `.eux` 는 저 `.eux` 가 있어야 동작한다"를 적으면, brew 가 의존 순서를 알고·전체 그래프를 그릴 수 있어요. (`@ports.deps` 가 *런타임 의존*이라면, `@deps` 는 *`.eux` 소스 간 의존*이에요.)

**언제** — 여러 `.eux` 로 쪼갠 backend 시스템.

**예시**:
```
@deps
  - ws-core.eux (transport 기반)
  - history-store.eux (영속 계약)
```

---

## 2.5 운영 정책 디렉티브 — adapter contract (7종, v1.1)

> **왜 7종이 더 필요했나** — §2 의 `@ports`/`@machine` 은 *컴포넌트 spec*(이 모듈이 뭐고 내부적으로 어떻게 동작하나)을 표현해요. 그런데 런타임 어댑터(에이전트 ↔ 보드 게이트웨이 같은)는 *adapter contract*(이 모듈을 구현하는 adopter 가 **따라야 할 운영 정책**)를 표현해야 해요 — 연결 규칙·역할 진실·와이어 규약·라우팅·전달 보장·redaction·운영 원칙. 이건 "단일 vs 다중 책임" 문제가 아니라 **spec genre 차이**(component spec vs policy contract)예요. v1.1 은 이 7 축을 `metadata:` 통합 형식 대신 `@directive` super-set 으로 흡수해, parseEux/drift-check 단일 게이트를 유지하면서 정보 손실 0 으로 표현해요. (EG canonical `gateway-client.eux` 12-dim SSoT 의 §2 외 7 축 정합, 2026-06-04 협의 — Q1 결정 A.)

### `@runtime` — 실행 정책
engine · concurrency 모델 · keepAlive · poll interval + **anti-pattern 마커**(display heartbeat emit 금지 · auto_pong false · client-side idle heartbeat 를 agent activity 로 쓰지 말 것).
```
@runtime
  engine: turn-held (15s drain window)
  concurrency: single-connection
  keepAlive: ws-ping only (no app heartbeat)
  forbidden: display_heartbeat · auto_pong · idle_heartbeat_as_activity
```

### `@roles` — 역할 + 진실 원천
canonical roles + **role_truth doctrine**(server 분류 AgentList = 진실, `AgentHello.value.role` = hint) + onboard_ack per-role.
```
@roles
  canonical: board · main · local · upstream · collab
  role_truth: server AgentList authoritative; AgentHello.role = hint only
  onboard_ack: local→Delegate 대기 · upstream/collab→informational welcome + autonomous peer
  url_patterns: local_dev ws://host/ws · token_gated ?token= · upstream ?upstreamKey=<uk-…> · collab ?key=<ck-…>
  forbidden: generic key for upstream · client-side idle heartbeat as agent activity
```
> `url_patterns`/`forbidden` 은 EG gateway-client `connection_params.url_rules` 를 흡수해요 — role 별 URL 형식이 role contract 의 일부라 `@roles` 안에 두는 게 자연스러워요(별도 `@connection` directive 증식 회피, 2026-06-04 EG review 옵션 a).

### `@wire` — 와이어 규약 (C8 정식화)
envelope convention(CUSTOM-wrapped vs bare top-level) + ack tier 시맨틱(delivered/processed/decided). EG canonical `wire:` 섹션과 1:1 → `drift-check --wire` 로 산출 codec ↔ wire SSoT 검증.
```
@wire
  envelope: CUSTOM-wrapped {type:CUSTOM, name, value} | bare top-level {type, ...}
  ack_tier: delivered (transport) · processed (agent WILCO) · decided (user-decided gate cleared per Hyperbrief §11.1 — DECISION_RESPONSE/DECISION_DEFER/DECISION_REJECT_FRAMING 발화 시 resolve)
```

### `@routing` — 라우팅 분류
§13.16.9 4-group filter(board-directed | A2A-intent | handshake | notice) + telemetry 제외.
```
@routing
  groups: board-directed | A2A-intent | handshake | notice
  telemetry_exclude: codex-watch threadId/runId (reply-window 제외)
```

### `@delivery` — 전달 보장
dedup + msgId watermark + redelivery 정책 + at-most/at-least-once 시맨틱(§13.13.2).
```
@delivery
  dedup: msgId LRU watermark (1024 / 1h TTL)
  redelivery: pending FIFO · 30s threshold · max 3 · RelayUnreachable
  semantics: at-most-once default; at-least-once on RELAY_REDELIVERY
```

### `@redaction` — 민감정보 차단
credential/PII redaction hook — send/log 전 적용. (C7 `@hazards` 의 credential 표면과 정합 — Q4 결정 A: credential/무결성 한정.)
```
@redaction
  hook: pre-send + pre-log
  targets: credential (token/key) · PII · 실서비스명/워크스페이스명
```

### `@operation_discipline` — 운영 원칙
event-driven 운영 원칙 + anti-pattern 카탈로그.
```
@operation_discipline
  principle: event-driven (활동 연동 emit; 무활동 시 자율 heartbeat 금지)
  anti_patterns: false-alive heartbeat · ack storm · silent drop
```

**프로파일 정합**: 7 directive 는 **protocol-adapter**(런타임 어댑터·게이트웨이) 권장, **backend-service**(서버) 도 `@routing`/`@delivery`/`@redaction` 부분 채택. ui-component/state-machine/supervisor 는 보통 불요.

---

## 2.6 행동 계약 디렉티브 — `@invariants` (v1.2, P3)

> **왜** — §2 의 `@ports`/`@machine` 은 *인터페이스*(뭘 받고 뭘 내보내나)를 적지만, 큰 모듈의 본질은 *행동 계약*("이 모듈은 어떤 불변식을 지키나")이에요. drift-check v1 은 시그니처 존재만 검증해 빈 스텁도 PASS 하는 ★G3(큰 모듈 본질 누락)가 남았어요. `@invariants` 는 그 행동 계약을 적어 **P4(property test)의 입력**이자 **P3(정적 게이트)의 대상**이 돼요. (EG readiness `93a972b` + 협의 Q1~Q2, 2026-06-04.)

**무엇** — 이 모듈이 항상 지키는 불변식. 4 sub-section(클래스)로 묶어요:

| 클래스 | 의미 | 권장 vocabulary 키워드 |
|---|---|---|
| **`state`** | 상태 자체의 불변(경계·순서·단조·소속) | `bounded` · `ordered` · `monotonic` · `member-of` |
| **`temporal`** | 시간/순서(윈도우·만료·1회성·멱등) | `within` · `after` · `at-most-once` · `idempotent` · `expires-after` |
| **`transaction`** | 원자성·롤백 | `atomic` · `rollback-safe` · `dual-write` · `commit-then` · `persist-before` |
| **`causality`** | 인과·논리 관계 | `precedes` · `iff` · `implies` |

**표기법** — 수학기호(∀·⪯·↔)가 아니라 **자유텍스트 prose + 권장 vocabulary 키워드**(협의 Q1=c). 7 directive(§2.5) FREETEXT 선례와 일관, 인코딩 toolchain(BOM/CRLF/LSP renderer) 깨짐 회피, adopter 의 LLM-assisted 작성에 자연스러워요. 핵심 키워드를 prose 에 넣어 정적 grep 가능하게 해요.

**예시** (history-store — EG readiness lift):
```
@invariants
  state:
    - bounded: 채널별 링 버퍼는 HIST_CAP 을 넘지 않음 (|wsHistByChan[k]| ≤ HIST_CAP)
    - monotonic: 저장 타임스탬프는 emit 시점을 보존, replay 로 덮어쓰지 않음
  transaction:
    - dual-write atomic: mode B append 는 jsonl 과 sqlite 가 같이 성공하거나 같이 실패함
    - idempotent: backfillFromJsonl 은 1회/N회 실행 결과가 동일
    - persist-before: count_reconcile_gate(N=10) 통과 전 mode 전이 금지 (commit-then 순서)
  causality:
    - operator intent 가 auto-revert 에 precedes (운영자 변경이 자동 되돌림보다 우선)
    - backfill 완료 iff count-reconcile 통과
```

**cmd-local / transition-local 형식** — invariant 는 모듈 전역뿐 아니라 명령·전이 단위로도 적어요:
- `@ports.cmd` 의 **`pre`/`post`** — `append(ev): pre: currentMode member-of {A,B,C}` · `post: query() 가 ev 포함 (ev ∉ skip_set 일 때)`.
- `@ports.out` 의 **`post`** — events-out 발생 후 보장(예: `emit_a2a(...): post: 큐 head 삽입 ∧ ack_tier 기록`). stub 의 events-out marker(G7)가 이 절의 **anchor** — marker 시그니처가 `post` 의 detail 수준을 결정해요.
- `@machine` 의 **`guard`/`entry-post`** — 기존 `entry:`/`on:` 위에 `guard: <pre-condition>` + `entry-post: <post-condition>`. (`@machine HistoryStoreMode` 의 `guard:` 선례 일반화.)

**정적 검증** (drift-check `--invariant`, P3c) — invariant 는 본질이 *행동*이라 정적 grep 으로 위반을 잡을 수 없어요(실제 위반 검출은 P4 dynamic). 정적 게이트는 3가지만(협의 Q2=a):
1. `@invariants` 절 **존재** — P3 격상 대상 .eux 인지 게이트.
2. vocabulary **키워드 잔존** — 산출물에 `atomic`/`idempotent`/`monotonic` 등 핵심 키워드 흔적(vocab 카테고리 선례).
3. sub-section **일관성** — state/temporal/transaction/causality 중 ≥1 명시.

위반은 BlockerManifest(§13.20-shaped)로 surface. 정적 AST 부분검증은 over-engineering·false-positive 위험이라 비채택 — 본질 검증은 P4 로 위임(협의 Q2: (b) 비추천).

## 2.7 변성 성질 디렉티브 — `@metamorphic` (v1.2, P4 짝)

> **왜** — 어떤 성질은 단일 입출력이 아니라 *입력 변환 ↔ 출력 변환 관계*로만 검증돼요(라운드트립·멱등·결정성). `@metamorphic` 은 그런 성질을 적어 **P4 property test**(fast-check 류)의 자동 입력이 돼요. `@invariants` 와 짝 — 불변식 = 항상 참 / 변성성질 = 변환 관계.

**무엇** — equivalent-input → equivalent-output 관계. 3 패턴:
- **round-trip** — `f(g(x)) == x` (export→import · encode→decode)
- **idempotency** — `f(f(x)) == f(x)` (재실행 안전)
- **determinism** — 같은 입력 → 같은 출력 (probe once-per-process)

**예시** (history-store):
```
@metamorphic
  round_trip:
    - exportJsonl → JSONL → mode-B 재진입 → exportJsonl 이 byte-identical
  idempotency:
    - backfillFromJsonl 1회 == N회 (resume-safe)
  determinism:
    - probeRefusal 은 프로세스당 1회 평가 (startup gate)
```

`@metamorphic` 도 `@invariants` 와 동형으로 **sub-section(round_trip/idempotency/determinism)** 구조예요(1st cut dogfooding 정합). p4-check 는 sub-section 과 flat(`- kind: desc`) 양쪽을 파싱해요.

**P3 단계** — 절 형식만 정의(parseEux 파싱). **실행은 P4** — `@metamorphic` 절에서 property 를 자동 추출해 경량 framework(fast-check 류)로 검증. P4 1st 최적 = history-store(mode chain + byte-identity + backfill idempotency 3 성질).

> **`@hazards` 3-class (Q3, 별도 트랙)** — orchestration-state class 추가 합의(credential·integrity 외): 식별자 누설·wait/escalation state 누설·anonymous probe 흔적·handoff race window. 구체 list 는 P3a 1st cut(server-relay) drafting 시 협의. `@hazards` 절 정식화는 C8 트랙(§6)과 함께.

---

## 3. 컴포넌트 프로파일 — "이 모듈은 어떤 종류인가"

> **왜 프로파일이 필요한가** — v0 는 모든 모듈을 UI 로 가정해서, 백엔드 모듈도 `@render N/A (headless)` 같은 빈 선언을 강제로 달았어요. "이 모듈은 UI 가 아니다"라고 한 번 선언하면, 그런 빈 선언이 사라지고·각 종류에 맞는 디렉티브만 쓰게 돼요.

`@component` 옆(또는 `@intent` 직후)에 **프로파일**을 선언해요:

```
@component ws-core
@profile protocol-adapter
```

### 프로파일별 디렉티브 매트릭스

| 프로파일 | 필수 | 권장 | 금지/불요 |
| --- | --- | --- | --- |
| **ui-component** | `@render`·`@targets`(UI Rimwork) | `@state`·`@behavior`·`@persist` | `@ports`·`@machine` (보통 불요) |
| **backend-service** | `@ports`·`@source` | `@machine`·`@deps`·`@behavior` | `@render`(금지 — 화면 없음)·`@targets` UI Rimwork(금지) |
| **protocol-adapter** | `@ports` | `@machine`(핸드셰이크)·`@source` | `@render`(금지) |
| **state-machine** | `@machine` | `@ports`·`@source` | `@render`(금지) |
| **supervisor** | `@machine`·`@source` | `@deps`·`@behavior` | `@render`(금지)·`@ports.in`(면제 — 자가 발동) |

**쉽게** — UI 면 "화면(@render)" 필수·"포트(@ports)" 불요. 백엔드면 그 반대(@ports 필수·@render 금지). 누가 불러서가 아니라 *스스로 깨어나* 무언가를 지켜보는 모듈(워치독·워처)이면 supervisor — 받는 포트가 없는 대신 상태머신(@machine)으로 "언제 깨어나 뭘 하나"를 적어요. 프로파일만 정해두면 brew 가 "이건 화면 만들 필요 없는 모듈"이라고 알아서 처리해요.

### `supervisor` 프로파일 — 스스로 깨어나 지켜보는 모듈

**무엇** — 서버·브릿지가 살아있나 지켜보다 죽으면 되살리는 **워치독**(`ws-watchdog.cjs`), 또는 일정 주기로 깨어나 받은 편지함을 확인하는 **워처**(`ws-wait.sh`/self-wake)처럼, *누가 호출해서가 아니라 스스로*(폴링 또는 이벤트 트리거) 발동하는 백그라운드 감시·생명주기 관리 모듈이에요.

**왜 따로 두나** — backend-service 는 "뭘 받으면(@ports.in) 뭘 돌려준다"가 핵심인데, supervisor 는 **받는 입구가 없어요**. 그래서 backend-service 로 분류하면 `@ports.in N/A` 같은 빈 선언을 강제로 달게 돼요(EG canonical 6 모듈 중 self-wake-watcher·watchdog 2개가 실제로 이 어색함에 걸렸어요). supervisor 프로파일은 그 입구 요구를 면제해요.

**핵심 표현**:
- **`@ports.in` 면제** — 입구(inbound)가 없음. 대신 `@ports.cmd`(start/stop 같은 제어)·`@ports.out`(재기동했다·죽음 감지 같은 통지)만 쓸 수 있어요.
- **감시 대상은 `@deps`(또는 `@ports.deps`)에** — "내가 무엇을 지켜보나"(server:7878·메인 브릿지 등)를 의존으로 적어요.
- **`@machine` 으로 발동 lifecycle** — "유휴 → (주기/이벤트) 깨어남 → 점검 → 정상이면 재무장 / 죽었으면 재기동" 흐름을 상태머신으로.

**예시**:
```
@component ws-watchdog
@profile supervisor
@machine
  states: idle → probe → (alive: rearm) | (dead: respawn → rearm)
  dispatch: tick(interval) · onWSClose(target)
  guard: respawn 은 TCP 재확인 후에만 (false-positive 방어)
  derive: degraded = (respawn_count > threshold)
@deps
  - server.eux (감시 대상 :7878)
  - local-bridge.eux (감시 대상 메인 브릿지)
@source
  file: dashboard/live/ws-watchdog.cjs
```
→ "받는 입구는 없고, 주기적으로(또는 WS close 이벤트로) 깨어나 server·bridge 생존을 점검해 죽었으면 되살린다"를 한눈에. `@ports.in` 빈 선언 없이 깔끔하게.

---

## 4. `@targets` 분류 정비

v0 에서 `@targets` 가 UI Rimwork(`estreuv`·`estreui`·`pair`)만 가정해서, 백엔드가 잘못 `@targets estreuv` 를 쓰는 오류가 있었어요. v1 은 둘로 나눠요:

| 분류 | 값 | 누가 |
| --- | --- | --- |
| **UI Rimwork** | `estreuv` · `estreui` · `pair` | ui-component 프로파일 |
| **범용 런타임** | `vanilla` · `node` · (기타) | backend-service·protocol-adapter·state-machine |

→ ws-core 는 올바르게 `@targets vanilla`. backend 가 `estreuv` 를 쓰면 그건 분류 오류예요(brew 가 경고하도록 P2 게이트와 정합).

---

## 4.5 모듈 분리 임계 (soft-guideline, v1.1)

> **왜 임계가 필요한가** — 큰 모듈을 단일 `.eux` 로 증류하면 본질(구현 깊이)이 spec 표면으로 압축돼 누락돼요(허브 dogfooding G3/G6 — `server.cjs` 1072줄 → 1:8 압축, 본질 ~990줄이 빈 스텁인데 `--contract` PASS). `@deps` 모듈 분리로 본질을 나눠 담되, 언제 분리할지 입계가 필요해요. **soft-guideline — 권장이지 강제 아님.**

**권장 입계**:
- **단일 유지**: ~100줄 이하 + 단일 책임(단일 sub-domain)
- **분리 (@deps)**: >100줄 + 다중 관심사(직교 sub-domain 동거 — HTTP+WS+KEY-MGMT 처럼)

**도메인별 차등**:
- **backend-service**: ~100줄 단위 + 직교 sub-domain 분리 (예: `server` → core / relay / keys / history)
- **protocol-adapter**: CUSTOM cluster 별 분리 (예: `gateway-client` → handshake / a2a / attachments / key-mgmt)
- **ui-component**: 위젯 단위(자명)
- **single-responsibility 예외**: mode 전이 invariant 를 reducer 가 carry 하는 경우(`history-store` mode A/B/C) cross-eux invariant 표현 부담으로 **단일 유지** 권장

분리 시 부모 manifest `.eux` 가 `@deps` 로 sub-eux 를 참조하고 운영 정책(`@runtime`/`@roles` 등 §2.5)을 carry 해요.

---

## 5. 결정성·provenance·drift (v0 계승)

v0 와 동일해요:
- **결정성 trio** (`@expansion temperature + model + template`) — "같은 trio → 거의 동일한 결과"의 약한 재현 claim. 결정적 템플릿은 바이트 동일, LLM 은 "거의 동일"이 정직한 표현.
- **provenance 헤더** — brew 산출물 머리에 `source sha256 + target + trio` 를 박아요.
- **drift-check** — 산출물의 source sha 와 현재 `.eux` sha 비교 → 불일치면 drift(재생성 필요). pre-commit hook 으로 커밋 전 차단.
- **`drift-check --contract`** — v1 의 구조 게이트. `@ports`·`@state`·`@machine` 디렉티브 셋이 산출 코드의 실제 인터페이스와 일치하는지 검증(spike/drift-check.mjs 와 정합 필요).

---

## 6. 아직 안 다룬 것 (v1.x 후속)

> 더 많은 비-UI 증류 사례가 쌓인 뒤 정식화해요(과설계 회피 — RRP P3).
>
> **우선순위**(EG Constellation 1차지식 review 반영, 2026-06-01): **C7 HIGH > C8 MEDIUM > C9 MEDIUM-LOW**. C7 은 backend 증류에서 동시성 race·SSL 우회·token transit 같은 즉시 위험을 표기하는 거라 가장 급하고(EG redaction discipline 과 보완), C9 는 DB Mode-C 운영(Mode B 30일+ 누적·promotion-decision artifact) 시점에 RRP P3 와 정합시켜 정식화해요.

- **C7 보안/정합성 마커** *(HIGH)* — `[보안:]`·`[정합성:]` 같은 인라인 마커(동시성 race·NPE 전파·SSL 검증 우회 등 발견 표기). 현재 비공식 관행인데 backend 증류의 핵심 가치라 정식 문법 필요. 후보 디렉티브 `@hazards`/`@safety` + `drift-check --safety` 로 산출 코드의 hazard 패턴 verify.
- **C8 바이너리/와이어 포맷** *(MEDIUM)* — 바이트 레이아웃(offset·길이·인코딩) 전용 디렉티브(`@wire` 등). 지금 `@machine` 에 묻히는 걸 분리. EG canonical 의 `wire:` 섹션(handshake/envelope/message_shape)과 1:1 매핑 가능 → `drift-check --wire` 로 산출 codec ↔ wire SSoT 일치 검증.
- **C9 데이터/트랜잭션** *(MEDIUM-LOW)* — `@persist`(localStorage 전제)를 backend DB(스키마·쿼리·트랜잭션 경계·회계 흐름)로 확장하거나 `@data` 신설. DB Mode-C 시점 정식화(C7/C8 보다 후).

---

## 참조
- [eux-format-v0](eux-format-v0.md) — 현행 기반(8 디렉티브·결정성·drift)
- [concept-seed §10](../../EstreUF%20common%20workspace/drafts/2026-05-09-estreux-concept-seed.md) — Universal eXpression 재정의
- 허브 RRP `reports/2026-05-31-eux-spec-universal-expansion.md` — 본 v1 정식화의 근거(Research·Plan P1~P3)
