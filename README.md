# EstreUX

[![npm version](https://img.shields.io/npm/v/estreux.svg)](https://www.npmjs.com/package/estreux)
[![license: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-orange.svg)](LICENSE)
[![drift gate](https://github.com/SoliEstre/EstreUX/actions/workflows/drift-check.yml/badge.svg)](https://github.com/SoliEstre/EstreUX/actions/workflows/drift-check.yml)
[![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](https://nodejs.org)
[![zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue.svg)](package.json)

**Commit the spec. Generate the code. Let a gate catch them drifting apart.**

**[🇰🇷 한국어로 읽기 ↓](#estreux--한국어)**

---

## What is this?

When an AI writes your code, the code survives but the conversation that produced it evaporates. Three months later there is nowhere to ask "why is this code the way it is?"

EstreUX flips the direction. You write a short **spec in natural language** (a `.eux` file — Korean, English, whatever you think in), commit *that* to git as the source of truth, and generate the code from it. The generated code carries a hash of the spec, so if someone edits the spec without regenerating the code, or patches the code and forgets the spec, **the commit is blocked**. The spec can't quietly rot into a lie.

Two words you'll see everywhere here:

- **expresso** — writing a `.eux` spec (condensing your intent, like pulling a shot)
- **brew** — turning that spec into code

EstreUX is a **dev-time** tool. It leaves no trace at runtime: no library to ship, no LLM call in production, zero runtime dependencies.

## Quickstart

```bash
npm i -D estreux        # or: npx estreux (one-shot)

npx estreux brew  my-widget.eux    # spec → code
npx estreux drift my-widget.eux    # spec ↔ code consistency check
```

Hook the drift gate into git so it runs on every commit:

```bash
git config core.hooksPath .githooks   # or automatic via npm prepare
```

## What a spec looks like

A `.eux` file is a handful of sections written in plain sentences. This is a real line from [Rimlog](https://github.com/SoliEstre/Rimlog), an app whose entire skeleton is brewed from a 40-line spec (translated from the Korean original):

```
saveCapture : save the capture form (source name, quote, my thought, tags) —
              insert at the front of captures, persist to local storage,
              show a "Saved" toast, switch to the log tab.
```

One spec can also brew into **multiple targets**. A [word-chain demo](examples/) produced three versions from a single spec: an [EstreUI](https://github.com/SoliEstre/EstreUI.js) page app, a standalone [EstreUV](https://github.com/SoliEstre/EstreUV.js) web component, and the two paired.

## Does it actually save work?

Measured on real components (a numeric keypad and a collapsible block, distilled back from framework code): the lines a human has to maintain dropped **60–82%** — a 152-line keypad became a 28-line spec. The generated code itself is sometimes longer than the original; what shrinks is the part a person reads and edits. The [measurement log](docs/phase-b-usage-metrics.md) lives in this repo.

Not just UI, either: the format has been exercised on backend flows, protocol adapters, state machines, and a zero-dependency node server ([Rimlog's insight server](https://github.com/SoliEstre/Rimlog/blob/main/eux/insight-server.eux) is one spec).

## How the checking works

Generation without verification would just be trust. EstreUX ships the verification side too:

- **`estreux drift`** — static gates: does the generated code still match the spec's hash, interface contract, declared invariants, and CSS-loading strategy?
- **`p4-check`** — dynamic gate: the spec's `@metamorphic` section declares behavioral properties ("toggling twice restores the original state"), and they run as [fast-check](https://github.com/dubzzz/fast-check) property tests against the real implementation.

A cross-repo round-trip of this pipeline (intended change accepted, destructive change rejected, deterministic re-runs on both sides) is recorded in [reverse-sync-e2e-001](docs/reverse-sync-e2e-001.md).

## Status

Phase A (thin spike): mechanism, provenance, and tool contracts are proven. The default brew provider is your coding agent itself (Claude Code, Cursor, and friends — no extra API key). The full MVP (multi-channel brew, reverse sync, richer calibration) is Phase B, in progress. Honest caveat: natural-language specs trade precision for readability, and we are still measuring where that trade bites.

## Dig deeper

- [`.eux` format v1](docs/eux-format-v1.md) — directives, adapter contracts, behavioral contracts ([v0](docs/eux-format-v0.md) for the minimal core)
- [Brew adoption guide](docs/brew-adoption.md) — bringing an existing codebase into spec-land
- [Compact spec](docs/COMPACT-SPEC.md) — the dense, agent-oriented reference (terms, contracts, version history)
- [Reverse-sync spec](docs/reverse-sync-spec.md) — how code changes flow back into specs through accept/reject gates

## License

[Apache-2.0](LICENSE) © 2026 SoliEstre (Estre Soliette) — patent grant included by design for a standards-oriented meta layer. The runtime libraries ([EstreUI](https://github.com/SoliEstre/EstreUI.js) / [EstreUV](https://github.com/SoliEstre/EstreUV.js)) are MIT; the layers are license-compatible.

---

# EstreUX — 한국어

**명세를 커밋하고, 코드를 생성하고, 둘이 어긋나면 게이트가 막는다.**

## 이게 뭔가요?

AI가 코드를 써 주는 시대의 문제가 하나 있습니다. 코드는 남는데, 그 코드를 만들어 낸 대화와 의도는 증발합니다. 석 달 뒤에 "이 코드가 왜 이렇게 돼 있지?"라고 물을 곳이 없습니다.

EstreUX는 방향을 뒤집습니다. 짧은 **자연어 명세**(`.eux` 파일 — 한국어든 영어든 생각하는 언어로)를 쓰고, 그것을 git의 원본으로 커밋하고, 코드는 명세에서 생성합니다. 생성된 코드에는 명세의 해시가 박혀서, 명세만 고치거나 코드만 고치면 **커밋이 막힙니다**. 명세가 조용히 낡아서 거짓말이 되는 일을 게이트로 차단하는 겁니다.

여기서 계속 만나게 될 단어 두 개:

- **expresso** — `.eux` 명세를 쓰는 일 (의도를 에스프레소처럼 농축해서 뽑아내기)
- **brew** — 그 명세를 코드로 내리는 일

EstreUX는 **개발 시점** 도구입니다. 런타임에는 흔적이 없습니다 — 배포할 라이브러리도, 프로덕션 LLM 호출도, 런타임 의존성도 0입니다.

## 빠른 시작

```bash
npm i -D estreux        # 또는 일회성: npx estreux

npx estreux brew  my-widget.eux    # 명세 → 코드
npx estreux drift my-widget.eux    # 명세 ↔ 코드 정합 검사
```

커밋마다 drift 게이트가 돌도록 git에 연결:

```bash
git config core.hooksPath .githooks   # npm prepare 로도 자동 설정
```

## 명세는 이렇게 생겼습니다

`.eux` 파일은 평문 문장 몇 절로 돼 있습니다. 40줄 명세로 앱 골격 전체를 brew한 [Rimlog](https://github.com/SoliEstre/Rimlog)의 실제 한 줄:

```
saveCapture : 캡처 폼(소스명·인용·내 생각·태그) 저장 — captures 맨 앞 삽입 +
              로컬 스토리지 반영 + "저장됐어요" 토스트 + 기록 탭으로 전환.
```

명세 하나로 **여러 타깃**을 뽑을 수도 있습니다. [끝말잇기 데모](examples/)는 명세 한 장에서 세 버전([EstreUI](https://github.com/SoliEstre/EstreUI.js) 페이지 앱 / 단독 [EstreUV](https://github.com/SoliEstre/EstreUV.js) 웹컴포넌트 / 둘의 페어)이 나왔습니다.

## 정말 일이 줄어드나요?

실제 컴포넌트(숫자 키패드·접이식 블록을 프레임워크 코드에서 명세로 역증류)로 실측했습니다. 사람이 유지하는 줄 수가 **60~82%** 줄었고, 152줄 키패드가 28줄 명세가 됐습니다. 생성 코드 자체는 원본보다 길어지기도 합니다 — 줄어드는 건 사람이 읽고 고치는 쪽입니다. [측정 기록](docs/phase-b-usage-metrics.md)이 리포에 있습니다.

UI만도 아닙니다. 백엔드 흐름·프로토콜 어댑터·상태 머신·의존성 0 node 서버([Rimlog 인사이트 서버](https://github.com/SoliEstre/Rimlog/blob/main/eux/insight-server.eux)가 명세 한 장)까지 같은 포맷으로 다뤄 왔습니다.

## 검증은 어떻게 하나요?

검증 없는 생성은 그냥 믿음입니다. EstreUX는 검증 쪽도 같이 제공합니다:

- **`estreux drift`** — 정적 게이트: 생성 코드가 명세의 해시·인터페이스 계약·선언된 불변식·CSS 로딩 전략과 여전히 일치하는가
- **`p4-check`** — 동적 게이트: 명세의 `@metamorphic` 절이 행동 성질("두 번 토글하면 원상 복귀")을 선언하고, [fast-check](https://github.com/dubzzz/fast-check) property 테스트로 실제 구현에 대해 실행됩니다

이 파이프라인의 교차 리포 왕복 시험(의도 변경 수용·파괴 변경 거절·양측 결정적 재현)은 [reverse-sync-e2e-001](docs/reverse-sync-e2e-001.md)에 기록돼 있습니다.

## 현재 상태

Phase A(thin spike): 메커니즘·출처 추적·도구 계약은 검증됐습니다. 기본 brew provider는 여러분의 코딩 에이전트 자신입니다(Claude Code·Cursor 등 — 별도 API 키 불요). 풀 MVP(다중 채널 brew·reverse sync·캘리브레이션 고도화)는 Phase B로 진행 중입니다. 정직한 주의: 자연어 명세는 가독성을 얻는 대신 정밀도를 내주는 트레이드이고, 그 트레이드가 어디서 아픈지는 아직 측정 중입니다.

## 더 깊이

- [코드 말고 명세를 커밋해 봤습니다](https://estreui.tistory.com/6) — 이 방식으로 앱을 하나 만든 경험담 (블로그, 한국어)
- [`.eux` 포맷 v1](docs/eux-format-v1.md) — 디렉티브·어댑터 계약·행동 계약 (최소 코어는 [v0](docs/eux-format-v0.md))
- [Brew 도입 가이드](docs/brew-adoption.md) — 기존 코드베이스를 명세 체계로
- [압축 명세](docs/COMPACT-SPEC.md) — 에이전트·기여자용 고밀도 레퍼런스(용어·계약·버전 이력)
- [Reverse-sync 규격](docs/reverse-sync-spec.md) — 코드 변경이 명세로 되돌아오는 수용/거절 게이트

## 라이선스

[Apache-2.0](LICENSE) © 2026 SoliEstre (Estre Soliette) — 표준 지향 메타 레이어라 특허 grant가 포함된 Apache 2.0을 채택했습니다. 런타임 라이브러리([EstreUI](https://github.com/SoliEstre/EstreUI.js) / [EstreUV](https://github.com/SoliEstre/EstreUV.js))는 MIT이며, 레이어 간 라이선스는 상호 호환입니다.
