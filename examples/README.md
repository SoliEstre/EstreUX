# EstreUX examples

`.eux` 한 벌을 **brew** 하면 같은 명세가 EstreUV(micro) / EstreUI(macro) / pair 세 가지 타깃 코드로 펼쳐진다 — 이 폴더는 그 결과를 담은 플래그십 예제다.

> 합성 검증용 최소 예제(`notif-toggle`)는 [`../spike/`](../spike/) 에 있다. 이 폴더는 **인터랙티브 데모** 한 벌이다.

## wordchain-story — 끝말잇기 스토리

AI가 잇는 연속 스토리 데모. 명세 한 벌이 세 변종으로 펼쳐져 있다.

| 파일 | 타깃 | 형태 |
|------|------|------|
| [`wordchain.eux`](wordchain.eux) | (expresso 소스) | `@component` 명세 |
| [`dist/estreuv/wordchain-story.js`](dist/estreuv/wordchain-story.js) | EstreUV (micro) | `EstreUVElement`(Lit) 커스텀 엘리먼트 |
| [`dist/estreui/wordchain-story.js`](dist/estreui/wordchain-story.js) | EstreUI (macro) | `EstreUI(host)` 함수형 primitive |
| [`dist/pair/wordchain-story.js`](dist/pair/wordchain-story.js) | pair | EstreUI 컨테이너가 EstreUV 엘리먼트를 호스팅 |

`dist/*` 는 **자동 생성물**이다(헤더에 source sha 기록). 직접 고치지 말고 `.eux` 를 고친 뒤 재-brew 한다 — drift 훅이 `.eux`↔산출물 일관성을 커밋 전에 검사한다.

### 동작

1. 매 호출마다 LLM 이 **다음 문장 후보 N개**를 `{ 핵심 단어(조사 뗀 명사), 그 단어가 등장하는 문장 }` 으로 생성한다.
2. 클라이언트가 그 단어들을 **끝말잇기 순서로 정렬**해 2×2 카드에 시계방향으로 회전시킨다. 끝말잇기는 "다음에 어떤 단어를 변수로 던질지" 고르는 게임 장치이고, 못 이으면 남은 단어로 점프한다(추가 호출 없음).
3. 카드를 클릭하면 그 문장이 스토리에 누적되고, **누적 스토리 전체 + 고른 단어**를 입력으로 다음 후보를 생성한다. 스토리가 길수록 맥락 연속성이 강해진다.
4. 후보 단어를 모두 소진하거나 단어를 고르면 3초 카운트다운 뒤 다음 후보를 생성한다(🔄 재생성·첫 시작은 즉시). 🗑 초기화·복사·공유(스토리 전체) 제공.

### 끝말잇기 goal — 모델 관전 포인트

생성 프롬프트에는 *"가능하면 후보 단어들이 끝말잇기로 최대한 길게 이어지도록, 단 이야기 자연스러움 우선"* 이라는 goal 이 들어간다. 모델이 이 goal 을 잘 따를수록 카드 회전의 끝말잇기 체인이 길어진다 — **끝말잇기가 잘 이어질수록 그 모델의 성능이 좋은 것**으로 가늠할 수 있다.

### provider

런타임 문장 생성은 사용자가 고른 LLM provider 로 한다(개발 시점 brew 와는 별개 — 이 데모 앱 자체가 런타임 LLM 앱이다).

- `agent` — 호스트 에이전트(키 불요). 미연동 환경에서는 내장 폴백 후보로 동작
- `openai` / `google`(Gemini OpenAI-호환 레이어) — API 키 필요
- `ollama` / `vllm` / `lmstudio` — 로컬 OpenAI-호환 엔드포인트(키 불요)

provider(+키)가 정해지면 `/v1/models` 로 모델 목록을 불러와 고르고, 그 모델로 `/v1/chat/completions` 를 호출한다. 브라우저 직접 호출이라 `google`·로컬은 CORS 가 열려 있고 `openai` 는 막힐 수 있다.

### 변종 사용

```js
// EstreUV — 커스텀 엘리먼트
import './dist/estreuv/wordchain-story.js';
// <wordchain-story></wordchain-story>

// EstreUI — 함수형 (host 컨테이너에 마운트)
import { wordchainStory } from './dist/estreui/wordchain-story.js';
const api = wordchainStory(document.querySelector('#host'));
api.start();   // start / pause / toggle / generate / reset / state

// pair — EstreUI 컨테이너가 EstreUV 엘리먼트를 호스팅
import { wordchainStoryPanel } from './dist/pair/wordchain-story.js';
wordchainStoryPanel(document.querySelector('#host'));
```

세 변종 모두 `estreuv` / `estreui` / `lit` 를 bare import 하므로 번들러나 import-map 으로 해석해 사용한다.

## drift 검사

```bash
node spike/drift-check.mjs examples/wordchain.eux
```

`.eux` ↔ `dist/*` 산출물의 source sha 일관성을 검사한다(불일치 = 재-brew 필요). 이 예제의 산출물은 brew provider `agent`(에이전트가 `.eux` 를 읽어 직접 변환)로 생성됐다 — 결정적 `template` PoC(`npm run brew`/`drift`)는 [`../spike/`](../spike/) 의 notif-toggle 전용이다.
