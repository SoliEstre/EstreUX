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
  // 프로파일 (eux-format v1 §3): 비-UI 는 @render 생략 · supervisor 는 @ports.in 면제
  const profile = spec.profile || 'ui-component';
  const isUI = profile === 'ui-component';
  const isSupervisor = profile === 'supervisor';

  const st = spec.state.map(s => `//     ${s.name}: ${s.type} = ${s.default}${s.comment ? '   — ' + s.comment : ''}`).join('\n');
  const bh = spec.behavior.map(b => `//     ${b.name}(${b.args}): ${b.desc}`).join('\n');
  const rd = spec.render.split('\n').map(l => '//     ' + l).join('\n');
  const sd = (spec.styles || '').split('\n').filter(Boolean).map(l => '//     ' + l).join('\n');
  const md = (spec.machine || '').split('\n').filter(Boolean).map(l => '//     ' + l).join('\n');
  const srcD = (spec.source || '').split('\n').filter(Boolean).map(l => '//     ' + l).join('\n');
  const depsD = (spec.deps || '').split('\n').filter(Boolean).map(l => '//     ' + l).join('\n');
  // v1.1 §2.5 adapter contract 7종 (protocol-adapter/backend-service 가 주 사용 — 값 있을 때만 표시)
  const fmtDir = (k) => (spec[k] || '').split('\n').filter(Boolean).map(l => '//     ' + l).join('\n');
  const runtimeD = fmtDir('runtime'), rolesD = fmtDir('roles'), wireD = fmtDir('wire'), routingD = fmtDir('routing');
  const deliveryD = fmtDir('delivery'), redactionD = fmtDir('redaction'), opD = fmtDir('operation_discipline');
  const p = spec.ports || { in: [], cmd: [], out: [], deps: [] };
  const pin = p.in.map(x => `//     ${x.name}: ${x.type}${x.comment ? '   — ' + x.comment : ''}`).join('\n');
  const pcmd = (p.cmd || []).map(x => `//     ${x.name}(${x.args})${x.desc ? ': ' + x.desc : ''}`).join('\n');
  const pout = p.out.map(x => `//     ${x.name}(${x.args})${x.desc ? ': ' + x.desc : ''}`).join('\n');
  const pdeps = p.deps.map(x => `//     ${x.name}: ${x.type}${x.comment ? '   — ' + x.comment : ''}`).join('\n');
  const model = (ctx && ctx.modelName) || 'agent';

  const L = [
    '/* ┌─ @agent-brew ───────────────────────────────────────────────────',
    ` * │ 에이전트(${model})가 직접 brew — 아래 명세를 target="${target}" 코드로 구현하고`,
    ' * │ 이 @agent-brew 블록 전체를 실제 코드로 대체하세요. (위 provenance 헤더는 유지 → drift-check)',
    ' * │ 외부 LLM provider(openai-compatible)는 키·엔드포인트 추가 정보가 필요하므로,',
    ' * │ 기본은 brew 요청을 받은 에이전트(또는 서브에이전트)의 직접 구현입니다.',
    ' * │',
    ` * │ component : ${spec.component}`,
    ` * │ profile   : ${profile}`,
    ` * │ intent    : ${spec.intent}`,
  ];
  if (srcD) L.push(' * │ source    (역증류 원본 — 이 코드의 출처, 참조·정합용):', srcD);
  if (!isSupervisor) L.push(' * │ ports.in  (props 주입 — 호스트가 opts/초기값으로 전달, 정확한 키·타입 준수):', pin || '//     (none)');
  L.push(' * │ ports.cmd (command-in — 호스트가 호출하는 갱신 메서드, 정확한 시그니처로 컨트롤러에 노출):', pcmd || '//     (none)');
  L.push(' * │ ports.out (events-out 콜백 — 호스트로 통지, 정확한 시그니처 준수):', pout || '//     (none)');
  L.push(' * │ ports.deps(주입 의존 — 내부 생성 금지, opts 로 주입받아 사용):', pdeps || '//     (none)');
  L.push(' * │ state     :', st || '//     (none)');
  L.push(' * │ behavior  :', bh || '//     (none)');
  if (isUI) {
    L.push(' * │ render    :', rd || '//     (none)');
    L.push(' * │ styles    (디자인 토큰·셀렉터 스타일 — 결정적 CSS 로 emit, 1회 주입):', sd || '//     (none)');
  }
  L.push(' * │ machine   (파생데이터/상태머신 — reducer dispatch·상태전이·파생필드, 명세대로 구현):', md || '//     (none)');
  // v1.1 §2.5 adapter contract — 격리 어댑터/서비스의 와이어·라우팅·전달·역할·운영 계약. 정확히 준수.
  if (runtimeD) L.push(' * │ runtime   (런타임 계약 — engine/concurrency/keepAlive/poll/forbidden):', runtimeD);
  if (rolesD) L.push(' * │ roles     (역할 계약 — canonical/role_truth/url_patterns/onboard_ack/forbidden):', rolesD);
  if (wireD) L.push(' * │ wire      (와이어 계약 — envelope/ack_tier/handshake, 시그니처·필드 정확히):', wireD);
  if (routingD) L.push(' * │ routing   (라우팅 계약 — groups/telemetry_exclude/priority/gate):', routingD);
  if (deliveryD) L.push(' * │ delivery  (전달 계약 — semantics/msgId/liveness/termination/deadlock vocab):', deliveryD);
  if (redactionD) L.push(' * │ redaction (편집 계약 — hook/targets/authority, 로그·발신 양 경로):', redactionD);
  if (opD) L.push(' * │ operation (운영 규율 — principle/upstream_peer/wait_state/anti_patterns):', opD);
  if (depsD) L.push(' * │ deps      (.eux 소스 의존 — 모듈 그래프, 참조용):', depsD);
  L.push(` * │ persist   : ${JSON.stringify(spec.persist)}`);
  L.push(` * │ targets   : ${spec.targets.join(', ')}`);
  L.push(' * └──────────────────────────────────────────────────────────────────');
  L.push(' */');
  L.push(`// TODO(@agent-brew): "${spec.component}" 를 ${target} 코드로 구현 — 위 명세 참조.`);
  L.push('');
  return L.join('\n');
}
