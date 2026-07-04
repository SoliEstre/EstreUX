# Estre 스택 도입·dogfooding 검토 제안서 (중립 템플릿)

> 임의 프로젝트에서 **Estre 스택(EstreUI · EstreUV · EstreUX)** 도입을 검토할 때 채워 쓰는 양식.
> 도입 타당성 검토와 동시에 EstreUX **Phase B dogfooding usage data**(실 프로젝트 marginal cost 측정)를 수집하는 이중 목적을 가진다.
> `〈…〉` 로 표시된 부분을 대상 프로젝트 정보로 채운다. 특정 프로젝트 식별정보는 이 템플릿 사본(대상 프로젝트 쪽)에만 적고, EstreUX/허브 저장소에는 남기지 않는다.

---

## 0. 한 줄 요약

`〈프로젝트명〉` 의 `〈대상 영역/컴포넌트〉` 에 Estre 스택을 **파일럿 규모로 점진 도입**해, 멀티타겟 생성(`.eux`→brew)의 실효(개발 비용 절감·재현성)를 측정하고 확대 여부를 판단한다.

## 1. 배경·목적

- **도입 측 목적**: `〈프로젝트〉` 의 `〈문제/니즈 — 예: 위젯 재사용, 멀티 출력(웹/임베드), no-build 경량화, 레거시 모더나이즈〉` 해결.
- **Estre 측 목적 (dogfooding)**: EstreUX 는 "한 `.eux` 명세 → 여러 타겟(estreuv/estreui/pair) 자동 생성" 의 메타 레이어다. Phase B 진입 게이트가 **자체 dogfooding usage data**(실 프로젝트에 적용해 본 결정 휴리스틱·절감 데이터)이므로, 실제 프로젝트 적용이 양측 모두에 가치가 있다.
- 외부 사용자 텔레메트리가 아니라 **메인테이너 자신의 프로젝트에서의 실측**이 핵심이다.

## 2. Estre 스택 한눈에

| 레이어 | 패키지 | 역할 | 기술 / 배포 |
| --- | --- | --- | --- |
| **macro**-Rimwork | EstreUI | 페이지·섹션 흐름, 네이티브-라이크 라이프사이클(onShow 등), 네비게이션 | jQuery-class primitive · classic `<script>` · no-build · PWA/WVCA |
| **micro**-Rimwork | EstreUV | 위젯 컴포넌트("tile"), 자기등록 커스텀 엘리먼트 | Lit class primitive · ESM · no-build(import map) · ~4.3KB |
| **meta** 레이어 | EstreUX | `.eux`(expresso) → brew → estreuv/estreui/pair **3 변종** 자동 생성 | dev-time only · 런타임 의존 0 · drift 검사로 spec↔코드 동기 |

- **핵심 가치 축**: ① no-build(import map만) ② 한 의도 → 다중 타겟(marginal cost↓) ③ vibe coding 의 재현 불가능성을 git-영속·재현가능으로 전환.

## 3. 적합성 검토

| 항목 | 체크 | 비고 |
| --- | --- | --- |
| 빌드리스 수용 가능(import map, 번들러 없이) | ☐ | Estre 는 no-build 전제 |
| jQuery(EstreUI) / Lit(EstreUV) 스택 수용 | ☐ | 기존 React/Vue 성숙 SPA 면 마이그레이션 비용 큼 |
| 점진 도입 여지(일부 영역만) | ☐ | 전면 교체 불필요 — 위젯/페이지 단위 격리 가능 |
| 멀티 출력 니즈(웹+임베드/페어) | ☐ | γ-EstreUX 의 3 변종이 유효한 경우 가치↑ |
| 모바일/PWA·네이티브-라이크 UX | ☐ | EstreUI 의 주 타겟 |

- **적합 시나리오**: 레거시(jQuery/ASP/PHP/JSP) 모더나이즈 · 모바일 우선 SPA/PWA · 재사용 위젯 다수 · 동일 컴포넌트를 단독/페어로 여러 곳에 배치.
- **주의/비적합**: 이미 무거운 빌드 파이프라인·대형 React/Vue 앱(**일괄** 전환 비용), 팀의 jQuery/Lit 비선호, EstreUX 가 아직 Phase A(성숙도 미완)인 점.
- **점진 경로 (2026-07-04)**: 타 프레임워크 앱도 **컴포넌트 단위 distill→brew 마이그레이션**은 지원 경로 — [BREW.md § 마이그레이션 경로](../BREW.md) + 실증 `examples/react-notice-badge.eux`. 일괄 전환이 아니라 위젯부터 점진 이관.

## 4. 적용 범위·단계 (파일럿 → 확대)

1. **파일럿 대상 선정** — `〈독립적·재사용성 있고 적당히 단순한 컴포넌트/위젯 1개〉`. 핵심 경로 밖이라 롤백이 쉬운 것 우선.
2. **`.eux`(expresso) 작성** — 의도(상태/행동/렌더)를 자연어 농축 명세로.
3. **brew** — `estreux brew 〈spec〉.eux` → estreuv(micro) / estreui(macro) / pair 3 변종 생성.
4. **프로젝트 적용** — 대상 영역에 변종 마운트, 동작·디자인 확인(필요 시 실 LLM provider 연동).
5. **측정·평가** — §5 지표 수집 → §7 Go/No 판단 → 확대 또는 격리 롤백.

## 5. dogfooding 측정 항목 (Phase B usage data)

| 지표 | 측정 | 의미 |
| --- | --- | --- |
| **X1** | spec LoC vs 3 변종 산출 LoC · 작성 시간 | 멀티타겟 marginal cost 절감 |
| **X3** | drift 빈도(수정 후 재생성 필요 횟수) | spec↔코드 동기 유지 비용 |
| **brew 패턴** | 어떤 `.eux` 표현이 잘/안 brew 되나 | 결정 휴리스틱 1차 컨벤션의 입력 |
| 변종 일관성 | 3 변종 동작·재현(같은 spec → 같은 결과) | γ-EstreUX 신뢰도 |

## 6. 기대효과 / 리스크·완화

- **기대효과**: 한 의도로 다중 타겟 동시 확보(marginal cost↓) · no-build 경량 · spec git-영속으로 재현가능 · 레거시 점진 현대화.
- **리스크 → 완화**
  - EstreUX Phase A(성숙도 미완) → **파일럿 격리**(핵심 외 영역, 롤백 용이)로 한정.
  - 학습 곡선(.eux 문법·brew 흐름) → 단순 컴포넌트 1개로 시작, 산출 코드 직접 검토.
  - 생태계 초기·락인 우려 → 산출물은 평범한 estreuv(Lit)/estreui(jQuery) 코드라 **Estre 제거 후에도 독립 동작** 가능.

## 7. 검토 체크리스트 / Go·No 의사결정

- ☐ 파일럿 컴포넌트 1개 선정 (`〈…〉`)
- ☐ no-build·스택 호환 확인(§3)
- ☐ `.eux` 작성 → brew → 3 변종 산출 + 적용
- ☐ 약 1주 파일럿 운영 → X1·X3·brew 패턴 기록(§5)
- **Go** — marginal cost 절감/재현성이 학습·도입 비용을 상회 → 적용 범위 확대
- **No** — 미달 시 파일럿 격리분만 롤백(핵심 영향 0), 측정 데이터는 EstreUX 휴리스틱 입력으로 보존

---

### 부록 — 채울 항목 요약

`〈프로젝트명〉` · `〈대상 영역/컴포넌트〉` · `〈현재 스택/빌드〉` · `〈해결할 니즈〉` · `〈파일럿 일정〉`
