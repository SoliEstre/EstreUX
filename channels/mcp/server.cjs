#!/usr/bin/env node
// estreux MCP channel — 스캐폴드 스텁 (B4 ⓑ). 도구 배선은 ⓒ manifest 생성기와 함께 채워진다.
// 채널 배정의 SSoT = ../estreux-plugin.eux @channels 절.
// serverInfo.version 은 반드시 package.json 동적 참조 — 하드코딩은 컷마다 조용히 갈라진다 (EG 함정 2 실측).

const SERVER_INFO = { name: 'estreux-mcp', version: require('./package.json').version };

// 스캐폴드 단계: MCP wire 미구현. 실행되면 자기 정체만 알리고 종료한다 —
// «없음»과 «미구현»을 구분해 부재로 위장한 고장을 만들지 않기 위한 정직한 스텁.
console.error(`[${SERVER_INFO.name}] v${SERVER_INFO.version} — scaffold stub. tools (distill/brew/drift-check) land with B4-c.`);
process.exit(1);
