# channels/ — estreux 3채널 노출 스캐폴드 (B4)

estreux 도구를 코딩 에이전트 하네스에 노출하는 플러그인 골격. **채널 배정의 SSoT 는 [estreux-plugin.eux](estreux-plugin.eux) 의 `@channels` 절**이고, 이 디렉토리는 그 첫 손 표본이다 — B4-c 의 manifest 생성기가 spec 에서 이 구조를 재현하면 그것이 생성기의 첫 검증이 된다.

## 구조 (EG 실물 트리 준거)

```
channels/
  estreux-plugin.eux        # @channels 첫 실표기 — 배정 SSoT
  .claude-plugin/plugin.json  # manifest (mcpServers 선언, ${CLAUDE_PLUGIN_ROOT})
  skills/estreux-brew/SKILL.md  # Skill 채널 — brew 절차 (brewGuide 주력)
  mcp/server.cjs            # MCP 채널 — distill/brew/drift-check tools (스텁)
  mcp/package.json          # 버전 단일소스 (serverInfo 가 동적 참조)
  hooks/hooks.json          # hook 채널 — drift 게이트 (스텁)
```

## 정책 (channels-design-v0 §3)

한 기능의 **주력 채널은 정확히 1개**, 다른 채널에는 포인터만 병기한다 — 중복 노출의 해악은 접근성이 아니라 두 구현이 조용히 갈라지는 것이므로, 드리프트 표면을 1개로 강제한다.

## 함정 선반영 (EG 실측 2건)

- plugin.json · mcp/package.json 의 버전(현재 0.0.1)은 **단일 소스 투영 대상** — 지금은 손 스캐폴드라 값이 복제돼 있고, B4-d 의 N-way 버전 검사 축이 이 갈라짐을 감시하게 된다. 그 전까지 버전 bump 는 두 파일을 함께.
- `mcp/server.cjs` 의 serverInfo.version 은 package.json 동적 참조 — 하드코딩 금지.

## 상태

- ⓑ 스캐폴드 (이 디렉토리) — 2026-08-02
- ⓒ manifest 생성기 (spec → 이 구조 투영) — 예정
- ⓓ N-way 버전 검사 축 — 예정
- 설계 근거: [docs/channels-design-v0.md](../docs/channels-design-v0.md)
