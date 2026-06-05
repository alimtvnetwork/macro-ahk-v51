#!/usr/bin/env node
/**
 * Blocks fixed timezone/city/country tokens from source, specs, docs, workflows,
 * and memory. Timestamps must be stored as UTC and rendered with the user's
 * local timezone at display time.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  '.git',
  '.release',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'skipped',
]);

const SKIP_FILES = new Set([
  'bun.lockb',
  'package-lock.json',
  'pnpm-lock.yaml',
]);

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mmd',
  '.ps1',
  '.sh',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const FORBIDDEN_PATTERNS = [
  { label: 'Asia/Kuala_Lumpur', regex: /Asia\/Kuala_Lumpur/g },
  { label: 'Kuala_Lumpur', regex: /Kuala_Lumpur/g },
  { label: 'Kuala Lumpur', regex: /Kuala Lumpur/g },
  { label: 'Malaysia', regex: /\bMalaysia\b/g },
  { label: 'Malaysian', regex: /\bMalaysian\b/g },
  { label: 'MYT', regex: /\bMYT\b/g },
  { label: 'UTC+8', regex: /UTC\+0?8\b/g },
  { label: '+08:00 offset', regex: /\+08:00/g },
  { label: 'render-time hyphenation', regex: /\brender-time\b/g },
  { label: 'formatRelativeMy', regex: /\bformatRelativeMy\b/g },
  { label: 'resetAtMyt', regex: /\bresetAtMyt\b/g },
  { label: 'nowMalaysiaIso', regex: /\bnowMalaysiaIso\b/g },
  { label: 'computeNextMytMidnight', regex: /\bcomputeNextMytMidnight\b/g },
];

function hasTextExtension(fileName) {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1) {
    return false;
  }
  return TEXT_EXTENSIONS.has(fileName.slice(dot));
}

function collectFiles(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(ROOT, fullPath).replaceAll('\\\\', '/');
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        collectFiles(fullPath, out);
      }
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (SKIP_FILES.has(entry.name) || !hasTextExtension(entry.name)) {
      continue;
    }
    out.push(relPath);
  }
}

const files = [];
collectFiles(ROOT, files);

const hits = [];
for (const file of files) {
  const body = readFileSync(join(ROOT, file), 'utf8');
  const lines = body.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of FORBIDDEN_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        hits.push({ file, line: index + 1, label: pattern.label, text: line.trim() });
      }
    }
  }
}

if (hits.length > 0) {
  console.error('Forbidden hardcoded timezone tokens found. Store UTC and render with the user local timezone.');
  for (const hit of hits) {
    console.error(`${hit.file}:${hit.line} [${hit.label}] ${hit.text}`);
  }
  process.exit(1);
}

console.log(`Forbidden timezone scan OK (${files.length} text files checked).`);
