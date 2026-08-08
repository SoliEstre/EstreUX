#!/usr/bin/env node
//
// estreux 채널 manifest 생성기 — channels/*.eux @channels → Claude 플러그인 manifest.
//
// 기본 동작은 검사다. 선언의 주력 중복과 실물 배치를 먼저 확인한 뒤,
// 메모리에서 다시 만든 manifest 를 커밋된 손 스캐폴드와 바이트 단위로 대조한다.
// `--write` 는 같은 검사를 통과한 경우에만 manifest 를 덮어쓴다.
//
// 사용법: node spike/gen-channel-manifest.mjs [--check|--write] [--channels-dir <경로>]
//
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_CHANNELS_DIR = resolve(REPO_ROOT, 'channels');
const ROOT_TOKEN = '${CLAUDE_PLUGIN_ROOT}';
const MANIFEST_DESCRIPTION = 'Commit the spec, generate the code, let a gate catch them drifting apart — estreux tools as Skill / MCP / hook channels.';
const MANAGED_MANIFEST_FIELDS = new Set(['name', 'version', 'description', 'mcpServers']);

// Claude 플러그인은 Skill 과 hook 을 약속된 디렉터리에서 자동 발견한다.
// 따라서 manifest 에는 MCP 경로만 쓰고, 나머지 채널은 실물 존재를 검사한다.
const CHANNEL_SURFACES = {
  mcp: {
    files: ['mcp/server.cjs', 'mcp/package.json'],
    label: 'MCP 서버',
  },
  hook: {
    files: ['hooks/hooks.json'],
    label: 'hook 설정',
  },
  skill: {
    files: [],
    label: 'Skill 문서',
  },
};

function parseArgs(argv) {
  let mode = 'check';
  let channelsDir = DEFAULT_CHANNELS_DIR;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') mode = 'check';
    else if (arg === '--write') mode = 'write';
    else if (arg === '--channels-dir') {
      if (!argv[i + 1]) throw new Error('--channels-dir 뒤에 경로가 필요함');
      channelsDir = resolve(argv[++i]);
    } else {
      throw new Error(`알 수 없는 인자: ${arg}`);
    }
  }

  return { mode, channelsDir };
}

function displayPath(filePath, baseDir = process.cwd()) {
  const rel = relative(baseDir, filePath).replace(/\\/g, '/');
  return rel && !rel.startsWith('../') ? rel : basename(filePath);
}

function stripComment(line) {
  return line.replace(/\s+#.*$/, '').trimEnd();
}

function parseEux(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const entries = [];
  let component = null;
  let channelsLine = null;
  let channelsNone = null;
  let inChannels = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineNumber = index + 1;
    const directive = line.match(/^\s*@([\w-]+)\b\s*(.*)$/);

    if (directive) {
      const [, name, rest] = directive;
      inChannels = name === 'channels';
      if (name === 'component') component = { value: rest.trim(), line: lineNumber };
      if (name === 'channels') {
        channelsLine = lineNumber;
        const none = stripComment(rest).trim().match(/^none\s*(?::\s*(.*))?$/);
        if (none) channelsNone = { line: lineNumber, reason: (none[1] || '').trim() };
      }
      continue;
    }
    if (!inChannels || !stripComment(line).trim()) continue;

    const body = stripComment(line);
    const assignment = body.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$/);
    if (!assignment) {
      entries.push({ filePath, line: lineNumber, invalid: '기능 : 채널 형식이 아님' });
      continue;
    }

    const feature = assignment[1];
    const tokens = assignment[2].split(',').map((token) => token.trim()).filter(Boolean);
    const primary = [];
    const primaryPhysicalNames = [];
    const pointers = [];
    const invalidTokens = [];

    for (const token of tokens) {
      const pointer = token.match(/^pointer\(\s*([A-Za-z][\w-]*)\s*\)$/);
      if (pointer) pointers.push(pointer[1]);
      else {
        const primaryToken = token.match(/^([A-Za-z][\w-]*)(?:\(\s*([^()\/\\]+?)\s*\))?$/u);
        const physicalName = primaryToken?.[2]?.trim();
        if (primaryToken && physicalName !== '.' && physicalName !== '..') {
          primary.push(primaryToken[1]);
          primaryPhysicalNames.push(physicalName || null);
        } else {
          invalidTokens.push(token);
        }
      }
    }
    entries.push({
      filePath,
      line: lineNumber,
      feature,
      primary,
      primaryPhysicalNames,
      pointers,
      invalidTokens,
    });
  }

  return { filePath, component, channelsLine, channelsNone, entries };
}

function listEuxFiles(channelsDir) {
  if (!existsSync(channelsDir) || !statSync(channelsDir).isDirectory()) return [];
  return readdirSync(channelsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.eux'))
    .map((entry) => resolve(channelsDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function validateSpecs(specs, channelsDir) {
  const diagnostics = [];
  const featureEntries = new Map();

  if (specs.length === 0) {
    diagnostics.push({ filePath: channelsDir, line: 1, reason: 'channels/*.eux 입력이 없음' });
    return diagnostics;
  }

  for (const spec of specs) {
    if (!spec.component?.value) {
      diagnostics.push({ filePath: spec.filePath, line: 1, reason: '@component 선언이 없음' });
    }
    if (!spec.channelsLine) {
      diagnostics.push({ filePath: spec.filePath, line: 1, reason: '@channels 선언이 없음' });
    } else if (spec.channelsNone) {
      if (!spec.channelsNone.reason) {
        diagnostics.push({
          filePath: spec.filePath,
          line: spec.channelsNone.line,
          reason: '@channels none에는 비어 있지 않은 사유가 필요함',
        });
      }
      if (spec.entries.length > 0) {
        diagnostics.push({
          filePath: spec.filePath,
          line: spec.channelsNone.line,
          reason: '@channels none과 배정 블록이 함께 있어 어느 쪽이 참인지 판정할 수 없음',
        });
      }
    } else if (spec.entries.length === 0) {
      diagnostics.push({ filePath: spec.filePath, line: spec.channelsLine, reason: '@channels 배정이 비어 있음' });
    }

    for (const entry of spec.entries) {
      if (entry.invalid) {
        diagnostics.push({ filePath: entry.filePath, line: entry.line, reason: entry.invalid });
        continue;
      }
      if (entry.invalidTokens.length) {
        diagnostics.push({
          filePath: entry.filePath,
          line: entry.line,
          reason: `해석할 수 없는 채널 표기: ${entry.invalidTokens.join(', ')}`,
        });
      }
      if (entry.primary.length !== 1) {
        const reason = entry.primary.length === 0
          ? `기능 ${entry.feature}의 주력 채널이 없음`
          : `기능 ${entry.feature}에 주력 채널 ${entry.primary.length}개 선언: ${entry.primary.join(', ')}`;
        diagnostics.push({ filePath: entry.filePath, line: entry.line, reason });
      }
      const grouped = featureEntries.get(entry.feature) || [];
      grouped.push(entry);
      featureEntries.set(entry.feature, grouped);
    }
  }

  for (const [feature, entries] of featureEntries) {
    if (entries.length < 2) continue;
    const channels = entries.flatMap((entry) => entry.primary);
    for (const entry of entries) {
      diagnostics.push({
        filePath: entry.filePath,
        line: entry.line,
        reason: `기능 ${feature}의 주력 선언이 ${entries.length}곳에 중복됨: ${channels.join(', ')}`,
      });
    }
  }

  for (const spec of specs) {
    for (const entry of spec.entries) {
      if (entry.invalid) continue;
      const exposures = [
        ...entry.primary.map((channel, index) => ({
          channel,
          physicalName: entry.primaryPhysicalNames[index],
          isPrimary: true,
        })),
        ...entry.pointers.map((channel) => ({ channel, physicalName: null, isPrimary: false })),
      ];
      for (const { channel, physicalName, isPrimary } of exposures) {
        const surface = CHANNEL_SURFACES[channel];
        if (!surface) {
          diagnostics.push({
            filePath: entry.filePath,
            line: entry.line,
            reason: `채널 ${channel}의 투영 규칙이 없음`,
          });
          continue;
        }

        // 주력 skill 은 실물 이름을 «선언» 해야 한다 — 없을 때 기능 키를 실물 이름으로 «간주» 하면,
        // 이름이 어긋난 배치에서 조용히 엉뚱한 경로를 재게 된다(협업 프로젝트 실측: 설치본 114 스킬 중
        // 디렉터리명 ≠ 정본 이름 3건). 「부재」를 「일치」로 읽는 기본값은 v1.5 `none` 이 세운 원칙
        // — «없음»과 «안 적음»을 한 모양으로 만들지 않는다 — 을 이름 축에서 되살린다.
        if (channel === 'skill' && isPrimary && !physicalName) {
          diagnostics.push({
            filePath: entry.filePath,
            line: entry.line,
            reason: `기능 ${entry.feature}의 skill 실물 이름이 선언되지 않음 — \`${entry.feature} : skill(<디렉터리명>)\` 형식으로 적을 것`,
          });
          continue;
        }
        // ⚠ 알려진 약점: pointer(skill) 은 실물 이름을 실을 자리가 없어 전역 존재 검사로 남는다.
        //    즉 이 축은 포인터에 대해서는 「그 기능의 스킬이 있다」를 보장하지 않는다.
        const expectedFiles = channel === 'skill'
          ? (isPrimary ? [`skills/${physicalName}/SKILL.md`] : surface.files)
          : surface.files;
        const missing = expectedFiles.filter((file) => !existsSync(resolve(channelsDir, file)));
        if (missing.length) {
          diagnostics.push({
            filePath: entry.filePath,
            line: entry.line,
            reason: `기능 ${entry.feature}의 ${surface.label} 실물 없음: ${missing.join(', ')}`,
          });
        }
      }
    }
  }

  const components = specs.filter((spec) => spec.component?.value);
  const componentNames = new Set(components.map((spec) => spec.component.value));
  if (componentNames.size > 1) {
    for (const spec of components) {
      diagnostics.push({
        filePath: spec.filePath,
        line: spec.component.line,
        reason: `한 manifest 아래 @component가 갈라짐: ${[...componentNames].join(', ')}`,
      });
    }
  }

  const needsMcp = specs.some((spec) => spec.entries.some((entry) => (
    [...(entry.primary || []), ...(entry.pointers || [])].includes('mcp')
  )));
  if (needsMcp && existsSync(resolve(channelsDir, 'mcp/package.json'))) {
    const packagePath = resolve(channelsDir, 'mcp/package.json');
    let mcpPackage = null;
    try {
      mcpPackage = JSON.parse(readFileSync(packagePath, 'utf8'));
    } catch {
      diagnostics.push({ filePath: packagePath, line: 1, reason: 'MCP package.json을 해석할 수 없음' });
    }
    if (mcpPackage && (!mcpPackage.name || !mcpPackage.version)) {
      diagnostics.push({ filePath: packagePath, line: 1, reason: 'MCP package.json의 name 또는 version이 없음' });
    }
  }

  return diagnostics;
}

function readMcpPackage(channelsDir) {
  const packagePath = resolve(channelsDir, 'mcp/package.json');
  if (!existsSync(packagePath)) return null;
  try {
    return JSON.parse(readFileSync(packagePath, 'utf8'));
  } catch {
    return null;
  }
}

function renderManifest(specs, channelsDir, existingManifest = {}) {
  const firstSpec = specs.find((spec) => spec.component?.value);
  const component = firstSpec?.component?.value || basename(channelsDir);
  const pluginName = component.replace(/-plugin$/, '');
  const mcpPackage = readMcpPackage(channelsDir) || {};
  const channels = new Set(specs.flatMap((spec) => spec.entries.flatMap((entry) => [
    ...(entry.primary || []),
    ...(entry.pointers || []),
  ])));

  const properties = [
    `  "name": ${JSON.stringify(pluginName)}`,
    `  "version": ${JSON.stringify(mcpPackage.version || '0.0.0')}`,
    `  "description": ${JSON.stringify(MANIFEST_DESCRIPTION)}`,
  ];

  if (channels.has('mcp')) {
    const serverName = mcpPackage.name || `${pluginName}-mcp`;
    properties.push([
      '  "mcpServers": {',
      `    ${JSON.stringify(serverName)}: {`,
      '      "command": "node",',
      `      "args": ["${ROOT_TOKEN}/mcp/server.cjs"]`,
      '    }',
      '  }',
    ].join('\n'));
  }

  for (const [key, value] of Object.entries(existingManifest)) {
    if (MANAGED_MANIFEST_FIELDS.has(key)) continue;
    const [firstLine, ...rest] = JSON.stringify(value, null, 2).split('\n');
    properties.push([
      `  ${JSON.stringify(key)}: ${firstLine}`,
      ...rest.map((line) => `  ${line}`),
    ].join('\n'));
  }

  return ['{', properties.join(',\n'), '}'].join('\n') + '\n';
}

function firstDiff(actual, expected) {
  const actualLines = actual.replace(/\r?\n$/, '').split(/\r?\n/);
  const expectedLines = expected.replace(/\r?\n$/, '').split(/\r?\n/);
  const count = Math.max(actualLines.length, expectedLines.length);
  for (let index = 0; index < count; index++) {
    if (actualLines[index] !== expectedLines[index]) {
      return {
        line: index + 1,
        actual: actualLines[index] ?? '(줄 없음)',
        expected: expectedLines[index] ?? '(줄 없음)',
      };
    }
  }
  return null;
}

function printDiagnostics(diagnostics) {
  for (const diagnostic of diagnostics) {
    console.error(`FAIL ${displayPath(diagnostic.filePath)}:${diagnostic.line}: ${diagnostic.reason}`);
  }
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`FAIL spike/gen-channel-manifest.mjs:1: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const euxFiles = listEuxFiles(options.channelsDir);
  const specs = euxFiles.map(parseEux);
  const diagnostics = validateSpecs(specs, options.channelsDir);
  if (diagnostics.length) {
    printDiagnostics(diagnostics);
    console.error(`FAIL 채널 manifest 검사 실패 (${diagnostics.length}건)`);
    process.exitCode = 1;
    return;
  }

  const featureCount = specs.reduce((count, spec) => count + spec.entries.filter((entry) => entry.feature !== 'default').length, 0);
  const noneCount = specs.filter((spec) => spec.channelsNone).length;
  const skillFeatureCount = specs.reduce((count, spec) => count + spec.entries.filter((entry) => (
    [...(entry.primary || []), ...(entry.pointers || [])].includes('skill')
  )).length, 0);
  const skillSummary = skillFeatureCount === 0
    ? 'skill 선언 기능 0개(검사 없음)'
    : `skill 선언 기능 ${skillFeatureCount}개`;

  const manifestPath = resolve(options.channelsDir, '.claude-plugin/plugin.json');
  const previous = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null;
  let existingManifest = {};
  if (previous !== null) {
    try {
      existingManifest = JSON.parse(previous);
      if (!existingManifest || Array.isArray(existingManifest) || typeof existingManifest !== 'object') throw new Error();
    } catch {
      console.error(`FAIL ${displayPath(manifestPath)}:1: 기존 manifest 를 해석할 수 없음`);
      process.exitCode = 1;
      return;
    }
  }
  const rendered = renderManifest(specs, options.channelsDir, existingManifest);
  if (options.mode === 'write') {
    mkdirSync(dirname(manifestPath), { recursive: true });
    if (previous === rendered) {
      console.log(`OK ${displayPath(manifestPath)}: 생성 결과와 이미 일치`);
    } else {
      writeFileSync(manifestPath, rendered);
      console.log(`OK ${displayPath(manifestPath)}: @channels에서 다시 생성`);
    }
    console.log(`OK 채널 manifest 요약 — ${euxFiles.length}개 spec, ${featureCount}개 기능, none ${noneCount}개, ${skillSummary}, 경로=${ROOT_TOKEN}`);
    return;
  }

  if (previous === null) {
    console.error(`FAIL ${displayPath(manifestPath)}:1: 생성 결과와 대조할 manifest 실물 없음`);
    process.exitCode = 1;
    return;
  }
  const diff = firstDiff(previous, rendered);
  if (diff) {
    console.error(`FAIL ${displayPath(manifestPath)}:${diff.line}: 생성 결과와 불일치`);
    console.error(`  현재: ${diff.actual}`);
    console.error(`  생성: ${diff.expected}`);
    process.exitCode = 1;
    return;
  }

  console.log(`OK 채널 manifest 일치 — ${euxFiles.length}개 spec, ${featureCount}개 기능, none ${noneCount}개, ${skillSummary}, 경로=${ROOT_TOKEN}`);
}

main();
