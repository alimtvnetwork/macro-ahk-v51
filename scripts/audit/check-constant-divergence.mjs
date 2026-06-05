#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { DEFAULT_SPEC_ROOT, listMarkdownFiles } from './spec-file-list.mjs';

const ROOT_ARG = '--root=';
const SOT_ARG = '--sot=';
const DEFAULT_SOT_REL = '01-prompt-spec/reference/05-runtime-defaults.md';
const NUMERIC_VALUE = String.raw`(?:\d{1,3}(?:[ _]\d{3})+|\d+(?:_\d+)*)(?:\.\d+)?`;
const RUNTIME_ROW_RE = /^\|\s*`([^`]+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|/gm;
const NUMBER_RE = new RegExp(String.raw`\b${NUMERIC_VALUE}\b`, 'g');

const specRoot = getArg(ROOT_ARG, DEFAULT_SPEC_ROOT);
const sotPath = resolve(specRoot, getArg(SOT_ARG, DEFAULT_SOT_REL));
const runtimeDefaults = readRuntimeDefaults(sotPath);
const failures = scanSpecFiles(specRoot, sotPath, runtimeDefaults);

if (failures.length === 0) {
  process.stdout.write('[check-constant-divergence] OK — spec constants match runtime defaults\n');
  process.exit(0);
}

writeFailureReport(failures);
process.exit(1);

function getArg(prefix, fallback) {
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function readRuntimeDefaults(filePath) {
  if (existsSync(filePath)) {
    return parseRuntimeDefaults(readFileSync(filePath, 'utf8'));
  }

  writeMissingSot(filePath);
  process.exit(1);
}

function parseRuntimeDefaults(fileText) {
  return new Map(Array.from(fileText.matchAll(RUNTIME_ROW_RE)).map((match) => {
    return [match[1], buildRuntimeDefault(match[2], match[3])];
  }));
}

function buildRuntimeDefault(defaultText, rangeText) {
  return {
    defaultValue: normalizeValue(defaultText.trim()),
    allowedValues: new Set(extractNumbers(`${defaultText} ${rangeText}`)),
  };
}

function scanSpecFiles(rootPath, canonicalSotPath, defaults) {
  return listMarkdownFiles(rootPath).flatMap((filePath) => {
    return scanSpecFile(filePath, canonicalSotPath, defaults);
  });
}

function scanSpecFile(filePath, canonicalSotPath, defaults) {
  if (resolve(filePath) === canonicalSotPath) {
    return [];
  }

  return readFileSync(filePath, 'utf8').split(/\r?\n/).flatMap((lineText, index) => {
    return scanLine(filePath, lineText, index + 1, defaults);
  });
}

function scanLine(filePath, lineText, lineNumber, defaults) {
  return Array.from(defaults.entries()).flatMap(([constantName, runtimeDefault]) => {
    return scanLineForConstant(filePath, lineText, lineNumber, constantName, runtimeDefault);
  });
}

function scanLineForConstant(filePath, lineText, lineNumber, constantName, runtimeDefault) {
  const literalValue = extractAssignedConstantValue(lineText, constantName);
  if (literalValue === null) {
    return [];
  }

  if (literalValue === runtimeDefault.defaultValue) {
    return [];
  }

  return [buildFailure(filePath, lineNumber, lineText, constantName, literalValue, runtimeDefault.defaultValue)];
}

function extractAssignedConstantValue(lineText, constantName) {
  const escapedConstant = escapeRegExp(constantName);
  const assignmentRe = new RegExp(String.raw`\b${escapedConstant}\b\s*(?:=|:|is|defaults?\s+to|must\s+be)\s*(?:\*\*)?` + String.raw`(${NUMERIC_VALUE})`, 'i');
  const match = lineText.match(assignmentRe);

  return match ? normalizeNumber(match[1]) : null;
}

function buildFailure(filePath, lineNumber, lineText, constantName, actualValue, expectedValue) {
  return {
    path: relative('.', filePath),
    line: lineNumber,
    missing: `${constantName}=${expectedValue}`,
    excerpt: lineText.trim(),
    reason: `${constantName} is documented as ${actualValue}, but runtime defaults declare ${expectedValue}.`,
  };
}

function normalizeValue(valueText) {
  const numericMatch = valueText.match(NUMBER_RE);

  return numericMatch ? normalizeNumber(numericMatch[0]) : valueText;
}

function extractNumbers(text) {
  return Array.from(text.matchAll(NUMBER_RE)).map((match) => normalizeNumber(match[0]));
}

function normalizeNumber(value) {
  return String(Number(value.replace(/[ _]/g, '')));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function writeMissingSot(filePath) {
  process.stderr.write('[check-constant-divergence] CODE RED — runtime defaults source-of-truth missing:\n');
  process.stderr.write(`  - path: ${filePath}\n`);
  process.stderr.write('    missing: 01-prompt-spec/reference/05-runtime-defaults.md\n');
  process.stderr.write('    reason: Constant divergence cannot be audited without the canonical defaults table.\n');
}

function writeFailureReport(items) {
  process.stderr.write(`[check-constant-divergence] CODE RED — ${items.length} divergent constant line(s):\n`);
  for (const item of items) {
    process.stderr.write(`  - path: ${item.path}\n`);
    process.stderr.write(`    line: ${item.line}\n`);
    process.stderr.write(`    missing: ${item.missing}\n`);
    process.stderr.write(`    excerpt: ${item.excerpt}\n`);
    process.stderr.write(`    reason: ${item.reason}\n`);
  }
}