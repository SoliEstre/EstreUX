/**
 * agent provider — 에이전트(IDE 세션 또는 서브에이전트)가 직접 brew (기본 provider).
 *
 * trio `model = agent/<name>` (예: agent/claude). **일반적인 brew = 요청받은 에이전트(IDE 세션 또는
 * 서브에이전트)가 직접 수행**하며 이 provider 가 기본이다. openai-compatible provider 사용은 엔드포인트·키 등
 * 추가 정보가 필요하고, 주로 **AI 모델별 brew 품질 벤치마크**(여러 모델의 expansion 비교) 목적이다.
 *
 * 동작: 외부 호출 없이, spec 을 구조화한 **brew 계약(@agent-brew 지시 + 명세 요약)** 을 본문으로 반환한다.
 * expand.mjs 가 이를 provenance 헤더와 함께 `dist/<target>/<component>.js` 로 쓰면, 에이전트가 그 파일을
 * 열어 `@agent-brew` 블록 지시대로 실제 <target> 코드로 **본문을 대체**한다(헤더는 유지 → drift-check 통과).
 *
 * target 무관(estreuv/estreui/pair/vanilla/… 임의) — 코드 생성은 에이전트가 하므로 template 의 하드코딩
 * 제약이 없다. 라이브보드 같은 vanilla DOM 컴포넌트도 이 경로로 brew 한다.
 *
 * 인터페이스: `async expand(spec, target, ctx) -> string(code body)` (template/openai 와 동일)
 */
export const id = 'agent';

export async function expand(spec, target, ctx) {
  const st = spec.state.map(s => `//     ${s.name}: ${s.type} = ${s.default}${s.comment ? '   — ' + s.comment : ''}`).join('\n');
  const bh = spec.behavior.map(b => `//     ${b.name}(${b.args}): ${b.desc}`).join('\n');
  const rd = spec.render.split('\n').map(l => '//     ' + l).join('\n');
  const p = spec.ports || { in: [], out: [], deps: [] };
  const pin = p.in.map(x => `//     ${x.name}: ${x.type}${x.comment ? '   — ' + x.comment : ''}`).join('\n');
  const pout = p.out.map(x => `//     ${x.name}(${x.args}): ${x.desc}`).join('\n');
  const pdeps = p.deps.map(x => `//     ${x.name}: ${x.type}${x.comment ? '   — ' + x.comment : ''}`).join('\n');
  const model = (ctx && ctx.modelName) || 'agent';
  return [
    '/* ┌─ @agent-brew ───────────────────────────────────────────────────',
    ` * │ 에이전트(${model})가 직접 brew — 아래 명세를 target="${target}" 코드로 구현하고`,
    ' * │ 이 @agent-brew 블록 전체를 실제 코드로 대체하세요. (위 provenance 헤더는 유지 → drift-check)',
    ' * │ 외부 LLM provider(openai-compatible)는 키·엔드포인트 추가 정보가 필요하므로,',
    ' * │ 기본은 brew 요청을 받은 에이전트(또는 서브에이전트)의 직접 구현입니다.',
    ' * │',
    ` * │ component : ${spec.component}`,
    ` * │ intent    : ${spec.intent}`,
    ' * │ ports.in  (props 주입 — 호스트가 setData/opts 로 전달, 정확한 키·타입 준수):',
    pin || '//     (none)',
    ' * │ ports.out (events-out 콜백 — 호스트로 통지, 정확한 시그니처 준수):',
    pout || '//     (none)',
    ' * │ ports.deps(주입 의존 — 내부 생성 금지, opts 로 주입받아 사용):',
    pdeps || '//     (none)',
    ' * │ state     :',
    st || '//     (none)',
    ' * │ behavior  :',
    bh || '//     (none)',
    ' * │ render    :',
    rd || '//     (none)',
    ` * │ persist   : ${JSON.stringify(spec.persist)}`,
    ` * │ targets   : ${spec.targets.join(', ')}`,
    ' * └──────────────────────────────────────────────────────────────────',
    ' */',
    `// TODO(@agent-brew): "${spec.component}" 를 ${target} 코드로 구현 — 위 명세 참조.`,
    '',
  ].join('\n');
}
