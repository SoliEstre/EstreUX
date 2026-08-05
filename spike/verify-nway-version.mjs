#!/usr/bin/env node
//
// estreux N-way 버전 검사기 — 한 패키지의 여러 버전 표면이 갈라졌는지 점검.
//
// 축과 표면은 아래 VERSION_AXES 데이터가 전부다. 버전 표면이 늘면 검사 로직을
// 고치지 않고 파일·추출 방법·라벨 선언만 추가한다. 파일이 아직 없으면 경고하고
// 비교에서 제외하지만, 존재하는 파일을 읽거나 값을 추출하지 못하면 검사 실패다.
//
// 사용법: node spike/verify-nway-version.mjs [--check] [--channels-dir <경로>]
//
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_CHANNELS_DIR = resolve(REPO_ROOT, 'channels');

// JSON path 의 객체 항목은 배열에서 일치하는 원소를 고르는 선언이다.
// marketplace 파일은 아직 없지만 설계에 등록된 표면이므로 미리 축에 올려 둔다.
// SKILL.md 는 현재 버전 머리말이 없어 버전 표면이 아니다. 머리말을 추가하는 컷에서
// 이 배열에 정규식 표면 한 줄만 더하면 된다.
const VERSION_AXES = [
  {
    label: 'estreux 채널 플러그인 버전 축',
    surfaces: [
      {
        file: '.claude-plugin/plugin.json',
        extract: { type: 'json', path: ['version'] },
        label: 'Claude 플러그인 manifest',
      },
      {
        file: 'mcp/package.json',
        extract: { type: 'json', path: ['version'] },
        label: 'MCP package',
      },
      {
        file: 'README.md',
        extract: {
          type: 'regex',
          pattern: /plugin\.json\s*·\s*mcp\/package\.json 의 버전\(현재\s+v?(\d+\.\d+\.\d+)\)/,
        },
        label: '채널 README 현재 버전',
      },
      {
        file: '../.claude-plugin/marketplace.json',
        extract: {
          type: 'json',
          path: ['plugins', { key: 'name', equals: 'estreux' }, 'version'],
        },
        label: 'Claude marketplace 등록',
      },
    ],
  },
];

function parseArgs(argv) {
  let mode = 'check';
  let channelsDir = DEFAULT_CHANNELS_DIR;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') mode = 'check';
    else if (arg === '--channels-dir') {
      if (!argv[i + 1]) throw new Error('--channels-dir 뒤에 경로가 필요함');
      channelsDir = resolve(argv[++i]);
    } else {
      throw new Error(`알 수 없는 인자: ${arg}`);
    }
  }

  return { mode, channelsDir };
}

function jsonPathLabel(path) {
  return path.map((part) => (
    typeof part === 'object'
      ? `[${part.key}=${JSON.stringify(part.equals)}]`
      : String(part)
  )).join('.').replace('.[', '[');
}

function valueAtJsonPath(root, path) {
  let value = root;

  for (const part of path) {
    if (typeof part === 'object') {
      if (!Array.isArray(value)) return undefined;
      value = value.find((item) => item?.[part.key] === part.equals);
    } else {
      value = value?.[part];
    }
    if (value == null) return undefined;
  }

  return value;
}

function extractValue(text, extract) {
  if (extract.type === 'json') {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { error: 'JSON을 해석할 수 없음' };
    }

    const value = valueAtJsonPath(parsed, extract.path);
    if (value == null || String(value).trim() === '') {
      return { error: `JSON 키 경로에 값 없음: ${jsonPathLabel(extract.path)}` };
    }
    return { value: String(value).trim() };
  }

  if (extract.type === 'regex') {
    const match = text.match(extract.pattern);
    const group = extract.group ?? 1;
    if (!match || match[group] == null || String(match[group]).trim() === '') {
      return { error: '정규식으로 값을 찾지 못함' };
    }
    return { value: String(match[group]).trim() };
  }

  return { error: `알 수 없는 추출 방법: ${extract.type}` };
}

function inspectSurface(surface, channelsDir) {
  const filePath = resolve(channelsDir, surface.file);
  if (!existsSync(filePath)) return { ...surface, status: 'missing' };

  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    return { ...surface, status: 'error', error: '파일을 읽을 수 없음' };
  }

  const extracted = extractValue(text, surface.extract);
  if (extracted.error) return { ...surface, status: 'error', error: extracted.error };
  return { ...surface, status: 'present', value: extracted.value };
}

function tableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function printTable(rows) {
  console.error('  | 표면 | 파일 | 값 |');
  console.error('  | --- | --- | --- |');
  for (const row of rows) {
    const value = row.status === 'present'
      ? row.value
      : row.status === 'missing'
        ? '없음 (파일 없음)'
        : `오류 (${row.error})`;
    console.error(`  | ${tableCell(row.label)} | ${tableCell(row.file)} | ${tableCell(value)} |`);
  }
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`FAIL spike/verify-nway-version.mjs:1: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  let failedAxes = 0;
  let warnings = 0;

  for (const axis of VERSION_AXES) {
    const rows = axis.surfaces.map((surface) => inspectSurface(surface, options.channelsDir));
    const missing = rows.filter((row) => row.status === 'missing');
    const errors = rows.filter((row) => row.status === 'error');
    const present = rows.filter((row) => row.status === 'present');
    const values = new Set(present.map((row) => row.value));

    for (const row of missing) {
      warnings++;
      console.warn(`WARN ${axis.label}: ${row.label} 없음 — ${row.file}`);
    }

    if (errors.length || values.size > 1) {
      failedAxes++;
      const reason = errors.length && values.size > 1
        ? '버전 갈라짐과 추출 오류'
        : errors.length
          ? '추출 오류'
          : `버전 ${values.size}종으로 갈라짐`;
      console.error(`FAIL ${axis.label}: ${reason}`);
      printTable(rows);
      continue;
    }

    if (values.size === 0) {
      warnings++;
      console.warn(`WARN ${axis.label}: 비교할 수 있는 버전 값이 없어 검사 건너뜀`);
      continue;
    }

    console.log(`OK ${axis.label} 일치 — ${[...values][0]} (${present.length}/${rows.length} 표면)`);
  }

  if (failedAxes) {
    console.error(`FAIL N-way 버전 검사 실패 (${failedAxes}개 축, 경고 ${warnings}건)`);
    process.exitCode = 1;
    return;
  }

  console.log(`OK N-way 버전 검사 통과 (${VERSION_AXES.length}개 축, 경고 ${warnings}건)`);
}

main();
