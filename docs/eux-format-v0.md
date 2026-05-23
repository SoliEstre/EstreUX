# `.eux` 포맷 v0 (Phase A 초안)

> EstreUX 의 자연어 중간 소스 형식. **약한 구조**(§11.0 #1 결정) — YAML/DSL 강제 대신
> `@directive` 섹션 + 자유 자연어 값. Phase A thin spike 가 검증한 최소 형태.
>
> **용어** (2026-05-23 확정): `.eux` 를 쓰는 행위 = **expresso** (의도를 농축해 표현 — `espresso`/`express`
> 동일 어근 `ex`+`premere`="짜내다"). `.eux` → 코드 변환 = **brew** (CLI `estreux brew`, 기존 `expand`
> 호환 별칭). γ 다중 타깃 = "한 번 brew 로 여러 잔(estreuv·estreui·pair)".

## 구조

| directive | 역할 | 예 |
| --- | --- | --- |
| `@component` | 컴포넌트 식별자(kebab) | `@component notif-toggle` |
| `@intent` | 한 줄 의도(자연어) | `@intent 알림 토글 + 배지` |
| `@expansion` | 결정성 trio | `temperature=0.0 model=… template=…` |
| `@targets` | γ-driven 다중 타깃 | `estreuv, estreui, pair` |
| `@state` | 반응 상태 (`name: type = default # 주석`) | `enabled: boolean = true` |
| `@behavior` | 동작 (`sig : 자연어 설명`) | `toggle : enabled 반전+영속` |
| `@render` | 렌더 묘사(자연어) | `enabled 면 🔔 …` |
| `@persist` | 영속 (`key=… fields=…`) | `localStorage key=notif-toggle fields=enabled,count` |

## 결정성 trio (재현성 layer)

`@expansion temperature + model + template` 셋이 박혀야 "같은 trio → 거의 동일한 결과"의
약한 재현 claim 성립. PoC 는 결정적 템플릿(`poc/deterministic-templater@v0`)이라 trio 고정 시
**바이트 동일**(S2). Phase B 는 LLM 으로 교체 — temperature=0 도 100% 결정성은
아니므로(모델 버전·batch·hardware) claim 은 "거의 동일"이 정직.

## provenance & drift

expand 산출물 머리에 provenance 헤더(`source sha256` + `target` + `trio`)를 박는다.
`drift-check` 가 산출물의 source sha 와 현재 `.eux` sha 를 비교 → 불일치면 drift(재생성 필요).
pre-commit hook 으로 걸어 spec ↔ 코드 표류를 커밋 전 차단.

## 아직 안 다룬 것 (Phase B+)

- 인라인 마커(`// <= …`, `/* <: … */`) — §11.0 #2, Phase B
- reverse sync(코드→`.eux`) — §11.0 #6
- brew provider 추상화 — §11.0 #4 (2026-05-23 확정). 3계층:
  - **기본 = 호스트 에이전트** (`agent/*`) · **서브에이전트** (`subagent/*`): EstreUX 가 에이전트 IDE(Claude Code Skill · Cursor · Antigravity) 안에서 동작할 때, 그 자리의 에이전트가 곧 brew expander — **별도 키·OAuth 불요**. γ 다중 타깃을 서브에이전트 병렬 위임에 매핑. *(에이전트 IDE 가 이미 LLM 접근을 가지므로 가장 자연스러운 기본값.)*
  - **부가 = API/OAuth** (provider-무관 수평): 프런티어/BYOK(Claude·GPT)·로컬 서버(**Ollama · vLLM · LM Studio**), 결정성 trio `model` prefix 로 선택. **헤드리스·CI·pre-commit 자동 drift 재생성** 등 사람 세션이 없는 경우용. 로컬/오픈웨이트는 함수호출·구조적 출력 강한 모델(예: **Nous Hermes** 계열) 적합.
  - **lock = `template`**: 결정적 PoC, trio 고정 시 바이트 동일.
  - 한계: 에이전트 모드는 인터랙티브(사람 세션 필요) → 자동화엔 부가 계층. 재현성은 LLM 일반 한계("거의 동일"), 바이트 동일은 `template` 만.
- 결정 휴리스틱(어느 layer로?) 자동화 — usage data 후
