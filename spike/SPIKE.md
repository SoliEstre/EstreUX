# EstreUX Phase A — thin spike 결과

> 상위: 허브 워크스페이스(비공개 조율)의 PM 009 / Rule 7 리포트.
> 일자: 2026-05-22 · 작성: Claude Opus 4.7 (1M context)
> 결정 반영: Q-EUX-1 sister repo / **Q-EUX-2 합성 예제(격리) 우선** / Q-EUX-3 publish Phase B.

## 목적

휴리스틱 grounding 데이터가 얇은 단계라, 풀 MVP 전에 **메커니즘·구조·도구 계약**을 합성
예제로 격리 검증한다 — 단일 `.eux` → 다중 타깃 expansion 이 기계적으로 성립하는가, 재현
가능한가, drift 를 잡는가.

## 무엇을 만들었나

- `.eux` 포맷 v0 (약한 구조 `@directive`) — [docs/eux-format-v0.md](../docs/eux-format-v0.md)
- 합성 예제 `notif-toggle.eux` (알림 on/off 토글 + 안 읽은 배지 + localStorage 영속)
- `expand.mjs` — γ-driven PoC expander (결정적 템플릿, 무의존). 한 spec → `estreuv`/`estreui`/`pair` 3 변종 + provenance 헤더
- `drift-check.mjs` — 산출물 source sha ↔ 현재 `.eux` sha 비교, 불일치 시 exit 1 (pre-commit 용)

## 검증 결과

| # | 기준 | 결과 |
| --- | --- | --- |
| **S1** | 한 `.eux` → 3 변종 산출 + 빌드/문법 통과 | ✅ PASS — 3 변종 생성(4ms), 전부 `node --check` 문법 OK, drift-check in-sync |
| **S2** | 동일 trio 재현성 | ✅ PASS — 재-expand 시 **바이트 동일**(sha256 동일). PoC 가 결정적 템플릿이라 100% 결정적 |
| **S3** | drift 검증 | ✅ PASS — `.eux` 1줄 수정(재생성 안 함) → 3 변종 모두 DRIFT 탐지(exit 1). 복원+재생성 → in-sync |

### baseline (prerequisite)

| metric | Phase A 기록 | 비고 |
| --- | --- | --- |
| **X1** (코드 작성) | spec ~20 LoC → 3 변종 ×~40 LoC, expand 4ms | 수기 3 변종 동등 작성 대비 절감 **실측은 Phase B**(실 usage) |
| **X3** (drift 빈도) | 0 (신규) · 탐지 메커니즘 가동 | 빈도는 usage 후 측정 |

## 발견 / 한계 (정직)

1. **PoC expander = 결정적 템플릿** (LLM stand-in). 자연어 `@render` 묘사는 구조적으로만
   해석됨 — 진짜 NL 이해는 Phase B(LLM). S2 의 "100% 결정성"은 PoC 특성이고, LLM 단계에선
   "거의 동일"로 약화됨이 정직.
2. **estreui 변종은 대표 패턴** — EstreUI 실 API 정합은 Phase B 에서 강결합 데모로 검증. estreuv
   변종은 실 API(`EstreUVElement`)에 맞춤.
3. **브라우저 렌더**는 격리(Q-EUX-2) 유지를 위해 syntax+구조 검증까지만. 실 렌더는 estreuv
   강결합 데모/플래그십 슬라이스(2단계)에서.
4. **결정 휴리스틱**(어느 layer로 펼칠지)은 본 spike 가 다루지 않음 — `@targets` 명시로 우회.
   자동 휴리스틱은 usage data 후(§11.0 #7).

## 다음 (Phase A 마무리 → B)

- (2단계) 플래그십 데모 1 페이지 슬라이스로 같은 흐름 재현 → 실 evidence
- pre-commit hook 실제 설치(`drift-check`) + CI
- LLM provider 추상화 인터페이스 → `expand` 의 템플릿 자리에 주입. **provider-무관**: 프런티어/BYOK(Claude·GPT 등)와 로컬 서버(**Ollama·vLLM·LM Studio** 등) 수평 옵션, trio `model` 선택. 로컬/오픈웨이트는 함수호출·구조적 출력 강한 모델(예: **Nous Hermes** 계열) 적합 — Hermes류 tool-use 연동 참고
- estreux/create-estreux npm **가용성 확인만**(publish 는 Phase B, Q-EUX-3)
