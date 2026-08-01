# `@channels` 디렉티브 설계 v0 — 다중 채널 노출의 spec 표기 (B4)

> **상태**: 설계 draft v0 (2026-08-01) — 구현 전 결정 골격. PM 009 B4 트랙.
> **배경 입력**: EG REQ-2 회신(3채널 분리 설계·함정 7건) + 2026-08-01 실물 스니펫 3종(vendored 출처 `EstreGenesis @ 893b616 (v2.6.63)`).
> **역수입 예약**: EG 가 이 설계의 역수입을 요청함 — 특히 «한 기능 다채널»을 금지로 둘지 경고로 둘지. 결정 근거를 본문에 명시한다.

## 1. 왜 spec 에 채널 표기가 필요한가

EG 의 정직한 답이 출발점이다: **채널 표기 규약은 EG 스펙에 없다.** 채널 배정은 오직 디렉터리 위치로 표현되고(`skills/` 에 있으면 Skill, `mcp/` 에 있으면 MCP), 스펙 산문은 기능을 설명할 뿐 어느 채널로 나갈지는 구현이 정한다. 그 결과 EG 는:

- «같은 기능을 여러 채널에 중복 노출»을 기계로 못 막는다 — 규율로만 지킨다.
- «스펙엔 있는데 어느 채널에도 안 실린 기능»을 겪었다(스킬 추가 후 marketplace 미등록). 지금은 verify-nway 로 사후 대조한다.

EstreUX 는 spec 이 원본이다(코드는 산출물). 채널 배정이 구현 디렉터리에만 있으면 그 배정은 spec 바깥의 손 지식이 되고, 위 두 실패가 같은 모양으로 온다. 배정을 spec 절에 올리면 셋이 기계화된다: ① 중복 주력 검출 ② manifest 자동 생성 ③ 미배치 기능 검출.

## 2. 문법 — `@channels` 디렉티브 (frontmatter 아님)

`.eux` v1 은 metadata 통합 형식 대신 `@directive` 슈퍼셋으로 흡수하는 전례가 있다(v1.1 §2.5 — adapter contract 7종). 채널 태그도 같은 무늬로 얹는다. `@targets` 가 «어떤 런타임으로 brew 하나»(estreuv/estreui/vanilla)를 답하듯, `@channels` 는 **«어떤 노출 표면에 실리나»**(skill/mcp/hook/…)를 답한다 — 직교하는 두 축이므로 별도 디렉티브가 맞다.

```
@channels
  default : mcp                       # spec 수준 기본 — 절이 침묵하면 이 채널이 주력
  brewGuide : skill                   # 절 단위 오버라이드 — 기능(절) 이름 : 주력 채널
  driftGate : hook, pointer(mcp)     # 주력 1 + 포인터 병기 (§3)
```

- **spec 수준 기본**(`default:`) + **절 단위 오버라이드** 2층. 채널이 하나뿐인 spec 은 `default:` 한 줄로 끝난다 — 표기 비용이 채널 수에 비례하고, 대개는 1~2채널이라는 EG 실측과 정합.
- 채널 어휘 초판: `skill`(절차 문서) · `mcp`(도구 노출) · `hook`(수명주기 결속). 열린 집합 — 어댑터가 늘면 어휘만 는다(검사 로직 불변, EG «축을 데이터로 선언» 원칙).

## 3. 정책 결정: 다채널은 금지도 경고도 아닌 «주력 1 + 포인터»

EG 의 질문은 «금지 vs 경고» 이분법이었다. 결정은 제3안이다:

**한 기능(절)의 주력 채널은 정확히 1개(중복 주력 = 게이트 FAIL). 다른 채널에는 주력을 가리키는 포인터만 병기할 수 있다(`pointer(채널)` — 허용, 게이트 무관).**

근거: 중복 노출의 실제 해악은 «두 채널에서 접근 가능함»이 아니라 **«같은 기능의 두 구현이 조용히 갈라짐»**(N-way 드리프트)이다. 주력이 1개면 드리프트할 표면이 1개다. 포인터는 내용을 갖지 않으므로(주력 위치를 가리키는 참조) 갈라질 것이 없고, 발견 가능성(discoverability)은 유지된다. REQ-2 의 «성격별 1채널 주력 + 포인터» 원칙의 문법화이기도 하다. 전면 금지는 발견 가능성을 버리고, 경고는 «규율로만 지킴»의 재판이 된다 — 해악의 원인(구현 이중화)만 정확히 금지하고 무해한 것(참조 병기)은 열어 둔다.

## 4. 기계화 3종 (검사·생성)

| # | 검사/생성 | 판정 | 참조 실물 (EG) |
|---|---|---|---|
| ① | **중복 주력 검출** — 두 절이 같은 기능 식별자에 서로 다른 주력을 선언, 또는 한 절에 주력 2+ | FAIL | verify-nway 계열 |
| ② | **manifest 자동 생성** — `@channels` 를 읽어 plugin.json `mcpServers`·hooks.json·skills/ 뼈대 투영. 손으로 옮기지 않는다 | 생성 | `codex/gen-codex-adapter.cjs` (인벤토리→config 재생성) |
| ③ | **미배치 검출** — `@channels` 에 선언된 채널·절이 산출 트리에 부재(또는 marketplace 미등록) | FAIL | EG 실사고(스킬 추가 후 marketplace 미등록) |

drift-check 에 얹는다(P2/P3 게이트와 같은 단일 관문 원칙). ②의 출력물은 EG 실물 트리 구조를 따른다: `plugins/<name>/.claude-plugin/plugin.json` + `hooks/hooks.json` + `mcp/server.cjs` + `skills/<name>/SKILL.md` + 루트 `marketplace.json` 등록. 경로 표기는 전부 `${CLAUDE_PLUGIN_ROOT}` (설치 경로가 어댑터별 상이 — 절대·상대 경로는 설치본에서만 깨진다).

## 5. 함정 선반영 (EG 함정 7건 중 «먼저 밟는 순서» 상위 2)

1. **N-way 버전 갈라짐** — plugin.json·marketplace.json·mcp/package.json 이 각자 버전 문자열을 든다(EG 실측: Hyperbrief 0.5.6 vs 0.6.0). 대응: ②의 생성기가 버전을 **단일 소스에서 투영**하고, 검사는 «축을 표면 목록 데이터로 선언»하는 EG verify-nway-version 형태를 vendored 로 가져온다 — 표면이 늘면 목록만 는다.
2. **MCP serverInfo.version 하드코딩** — 증상이 없어 오래 간다(클라이언트가 로그에만 씀). 대응: 생성기 템플릿이 처음부터 `version: require('./package.json').version` 을 박는다.

## 6. 다음 단계 (PM 009 ⓑ~ⓓ 정렬)

- ⓑ estreux repo `channels/` 스캐폴드 — REQ-2 성격별 주력 배정(Skill=brew 절차 / MCP=distill·brew·drift-check tools / hook=drift 게이트)을 본 문법으로 첫 표기
- ⓒ manifest 생성기 구현(§4-②)
- ⓓ N-way 버전 검사 축 선언(§5-1, EG 형태 vendored)
- 문법 확정 후 eux-format v1.4 로 `@channels` 정식 등재 + EG 에 역수입용 설계 회신
