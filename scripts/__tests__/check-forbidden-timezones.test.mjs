import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKER = resolve(fileURLToPath(new URL('../check-forbidden-timezones.mjs', import.meta.url)));

function runChecker(files) {
  const dir = mkdtempSync(join(tmpdir(), 'timezone-guard-'));
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    copyFileSync(CHECKER, join(dir, 'scripts/check-forbidden-timezones.mjs'));
    for (const [path, content] of Object.entries(files)) {
      const target = join(dir, path);
      mkdirSync(resolve(target, '..'), { recursive: true });
      writeFileSync(target, content, 'utf8');
    }
    const result = spawnSync(process.execPath, ['scripts/check-forbidden-timezones.mjs'], {
      cwd: dir,
      encoding: 'utf8',
    });
    return {
      code: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('passes when timestamps are UTC and timezone rendering is local', () => {
  const result = runChecker({
    'src/example.ts': "const createdAt = '2026-06-05T01:00:00.000Z';\nconst tz = Intl.DateTimeFormat().resolvedOptions().timeZone;\n",
  });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Forbidden timezone scan OK/);
});

test('fails on fixed city timezone tokens', () => {
  const result = runChecker({
    'spec/example.md': 'Display at Asia/Kuala_Lumpur.\n',
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Asia\/Kuala_Lumpur/);
});

test('fails on fixed offset examples', () => {
  const result = runChecker({
    'src/example.ts': "const generatedAt = '2026-06-02T06:30:01+08:00';\n",
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /\+08:00 offset/);
});

test('skips read-only archive folders', () => {
  const result = runChecker({
    'skipped/legacy.md': 'Asia/Kuala_Lumpur is archived here.\n',
    '.release/legacy.md': 'UTC+8 is archived here.\n',
  });
  assert.equal(result.code, 0, result.stderr);
});
