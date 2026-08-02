# /estreux-brew — spec 을 코드로 내리는 표준 절차

> 스캐폴드 스텁 (B4 ⓑ) — 채널 배정 SSoT 는 [../../estreux-plugin.eux](../../estreux-plugin.eux) `@channels` 절.
> 이 스킬은 brewGuide 기능의 주력 채널(Skill)이다. 실행 도구(brew/drift)는 MCP 채널이 주력이고, 여기서는 절차만 안내한다.

## 절차 (표준 왕복)

1. **expresso** — 의도를 `.eux` spec 으로 농축한다. 한 절 = 한 기능, 문장으로.
2. **brew** — `npx estreux brew <spec>.eux` (또는 MCP `brewTool`). 산출 코드에 provenance sha 가 각인된다.
3. **drift 확인** — `npx estreux drift <spec>.eux`. spec ↔ dist 정합이 어긋나면 여기서 잡힌다.
4. **커밋** — drift 게이트(hook 채널)가 커밋점에서 한 번 더 지킨다. spec 과 dist 는 같은 커밋으로.

## 규율

- spec 이 원본, 코드는 산출물 — 코드를 직접 고쳤으면 reverse-sync 게이트를 거쳐 spec 으로 되돌린다.
- 이 문서는 절차의 주력 표면이다. 도구 사용법 상세는 MCP 채널 도구 설명이 정본.
