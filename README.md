# EstreUX

**EstreUX** (Unified eXperience) — Estre 생태계의 **개발 시점 메타-레이어**. 자연어 중간 소스
`.eux` 를 **brew**(LLM 변환)로 EstreUI(macro-Rimwork) / EstreUV(micro-Rimwork) 코드로 펼친다.
*(`.eux` 작성 = **expresso** · `.eux` → 코드 변환 = **brew**.)*
γ-EstreUX-driven: **한 `.eux` spec → 다중 타깃(UI 단독 / UV 단독 / 페어) 자동 생성** = 한 번 brew 로 여러 잔.
런타임에는 흔적이 없다(런타임 LLM 의존 0).

> **상태: Phase A — thin spike** (2026-05-22~). 메커니즘·구조·도구 계약을 격리 검증 중.
> 풀 MVP(다중 채널·reverse sync·Estrim 통합)는 EstreUV 1.0 GA + usage data 후(Phase B).
> 기획·근거: 허브 워크스페이스(비공개 조율)의 PM 009 / Rule 7 리포트.

## Phase A spike 실행

```bash
npm run brew     # (=expand 별칭) notif-toggle.eux → dist/{estreuv,estreui,pair}/notif-toggle.js
npm run drift    # .eux ↔ 산출물 일관성 검사
npm run spike    # brew + drift

# 임의 .eux 대상 CLI (brew/expand/drift 서브명령):
node bin/estreux.mjs brew  <file.eux>    # .eux → 변종 생성 (expand 별칭)
node bin/estreux.mjs drift <file.eux>    # .eux ↔ 산출물 검사
```

- 합성 예제: [`spike/notif-toggle.eux`](spike/notif-toggle.eux) (알림 토글 위젯)
- 플래그십 예제: [`examples/`](examples/) (끝말잇기 스토리 — 1 spec → 3 변종 인터랙티브 데모, brew provider=`agent`)
- `.eux` 포맷: [`docs/eux-format-v0.md`](docs/eux-format-v0.md)
- spike 결과: [`spike/SPIKE.md`](spike/SPIKE.md)
- brew provider (2026-05-23 확정): **기본 = 호스트 에이전트/서브에이전트** (에이전트 IDE 안에서 별도 키 없이 brew, γ 타깃 병렬 위임 — 실구현 Phase B) · **부가 = API/OAuth** (로컬 Ollama·vLLM·LM Studio · BYOK, 헤드리스·CI용) · **lock = `template`** (결정적 PoC, 현 Phase A 사용). [`spike/providers/`](spike/providers/), trio `model` prefix 로 선택.
- drift 훅: `git config core.hooksPath .githooks` (또는 `npm install` 시 `prepare` 가 자동 설정). 커밋 전 `.eux`↔산출물 drift 를 차단.

## 다운스트림에서 brew 엔진 가져오기

EstreUX 는 **deps-0 brew 엔진**(소스 ~21KB)이라 다운스트림(시드 마이그레이션 등)이 GitHub 전체 clone(+`.git`) 없이 경량으로 참조할 수 있다.

- **npm 발행 전 (현재) — `giget` 경량 fetch** (brew 엔진만, tarball·`.git` 없음·캐시):
  ```bash
  npx giget gh:SoliEstre/EstreUX/spike#v0.1.0 ./estreux-engine
  node ./estreux-engine/expand.mjs brew <file.eux>
  ```
- **npm 발행 후**:
  ```bash
  npm i -D estreux        # 또는 npx estreux (일회성)
  npx estreux brew <file.eux>
  ```

> `git+ssh` / `github:` dependency 도 가능하나, `prepare` hook(dev hook 설정)이 소비자 환경에서 실행되므로 **`giget` 경량 fetch 또는 npm 발행본을 권장**한다. 버전 고정은 tag(`#v0.1.0`) 또는 semver(`~0.1.0` — 0.x 는 caret 이 minor 를 막으므로 tilde 권장).

## 범위 주의 (PoC)

Phase A expander 는 **결정적 템플릿 매핑**(LLM stand-in)이다. 단일 spec → 다중 타깃 구조,
provenance, drift, 재현성을 검증하는 것이 목적이며, **자연어 이해 기반 LLM expansion 은 Phase B**
에서 같은 `.eux` 계약 위에 교체된다. LLM provider 는 **provider-무관**(특정 기본 없음) — 프런티어/
BYOK(Claude·GPT 등)와 로컬 서버(Ollama·vLLM·LM Studio 등)를 수평 옵션으로(trio `model` 선택).

## 라이선스

**Apache License 2.0** (Copyright 2026 SoliEstre (Estre Soliette) — [LICENSE](LICENSE) · [NOTICE](NOTICE)).
표준 지향 메타-레이어라 **특허 grant** 포함된 Apache 2.0 채택 (런타임 라이브러리 EstreUI/EstreUV 는
MIT — 레이어별 라이선스, 상호 호환). **npm 발행 준비 완료** (2026-05-28, v0.1.0) — `files` 화이트리스트로
brew 엔진만 배포(13파일·~21KB), 내부 자산(examples/dist·adoption·hooks) 제외. `npm publish` 실행은 메인테이너 게이트.
