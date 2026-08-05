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
  let inChannels = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineNumber = index + 1;
    const directive = line.match(/^@([\w-]+)\b\s*(.*)$/);

    if (directive) {
      const [, name, rest] = directive;
      inChannels = name === 'channels';
      if (name === 'component') component = { value: rest.trim(), line: lineNumber };
      if (name === 'channels') channelsLine = lineNumber;
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
    const pointers = [];
    const invalidTokens = [];

    for (const token of tokens) {
      const pointer = token.match(/^pointer\(\s*([A-Za-z][\w-]*)\s*\)$/);
      if (pointer) pointers.push(pointer[1]);
      else if (/^[A-Za-z][\w-]*$/.test(token)) primary.push(token);
      else invalidTokens.push(token);
    }
    entries.push({ filePath, line: lineNumber, feature, primary, pointers, invalidTokens });
  }

  return { filePath, component, channelsLine, entries };
}

function listEuxFiles(channelsDir) {
  if (!existsSync(channelsDir) || !statSync(channelsDir).isDirectory()) return [];
  return readdirSync(channelsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.eux'))
    .map((entry) => resolve(channelsDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function skillFiles(channelsDir) {
  const skillsDir = resolve(channelsDir, 'skills');
  if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(skillsDir, entry.name, 'SKILL.md'))
    .filter((filePath) => existsSync(filePath));
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
      if (entry.feature !== 'default') {
        const grouped = featureEntries.get(entry.feature) || [];
        grouped.push(entry);
        featureEntries.set(entry.feature, grouped);
      }
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

  const availableSkills = skillFiles(channelsDir);
  for (const spec of specs) {
    for (const entry of spec.entries) {
      if (entry.invalid) continue;
      for (const channel of [...entry.primary, ...entry.pointers]) {
        const surface = CHANNEL_SURFACES[channel];
        if (!surface) {
          diagnostics.push({
            filePath: entry.filePath,
            line: entry.line,
            reason: `채널 ${channel}의 투영 규칙이 없음`,
          });
          continue;
        }

        const missing = channel === 'skill'
          ? (availableSkills.length ? [] : ['skills/*/SKILL.md'])
          : surface.files.filter((file) => !existsSync(resolve(channelsDir, file)));
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

function renderManifest(specs, channelsDir) {
  const firstSpec = specs.find((spec) => spec.component?.value);
  const component = firstSpec?.component?.value || basename(channelsDir);
  const pluginName = component.replace(/-plugin$/, '');
  const mcpPackage = readMcpPackage(channelsDir) || {};
  const channels = new Set(specs.flatMap((spec) => spec.entries.flatMap((entry) => [
    ...(entry.primary || []),
    ...(entry.pointers || []),
  ])));

  const lines = [
    '{',
    `  "name": ${JSON.stringify(pluginName)},`,
    `  "version": ${JSON.stringify(mcpPackage.version || '0.0.0')},`,
    `  "description": ${JSON.stringify(MANIFEST_DESCRIPTION)}${channels.has('mcp') ? ',' : ''}`,
  ];

  if (channels.has('mcp')) {
    const serverName = mcpPackage.name || `${pluginName}-mcp`;
    lines.push(
      '  "mcpServers": {',
      `    ${JSON.stringify(serverName)}: {`,
      '      "command": "node",',
      `      "args": ["${ROOT_TOKEN}/mcp/server.cjs"]`,
      '    }',
      '  }',
    );
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

function firstDiff(actual, expected) {
  const actualLines = actual.split(/\r?\n/);
  const expectedLines = expected.split(/\r?\n/);
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

  const manifestPath = resolve(options.channelsDir, '.claude-plugin/plugin.json');
  const rendered = renderManifest(specs, options.channelsDir);
  if (options.mode === 'write') {
    mkdirSync(dirname(manifestPath), { recursive: true });
    const previous = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null;
    if (previous === rendered) {
      console.log(`OK ${displayPath(manifestPath)}: 생성 결과와 이미 일치`);
    } else {
      writeFileSync(manifestPath, rendered);
      console.log(`OK ${displayPath(manifestPath)}: @channels에서 다시 생성`);
    }
    return;
  }

  if (!existsSync(manifestPath)) {
    console.error(`FAIL ${displayPath(manifestPath)}:1: 생성 결과와 대조할 manifest 실물 없음`);
    process.exitCode = 1;
    return;
  }
  const current = readFileSync(manifestPath, 'utf8');
  const diff = firstDiff(current, rendered);
  if (diff) {
    console.error(`FAIL ${displayPath(manifestPath)}:${diff.line}: 생성 결과와 불일치`);
    console.error(`  현재: ${diff.actual}`);
    console.error(`  생성: ${diff.expected}`);
    process.exitCode = 1;
    return;
  }

  const featureCount = specs.reduce((count, spec) => count + spec.entries.filter((entry) => entry.feature !== 'default').length, 0);
  console.log(`OK 채널 manifest 일치 — ${euxFiles.length}개 spec, ${featureCount}개 기능, 경로=${ROOT_TOKEN}`);
}

main();
