#!/usr/bin/env node
/**
 * check-changelog-entry.mjs
 *
 * Verifies that `changelog.md` contains an entry for the current
 * version declared in `manifest.json` (the canonical bumped-version
 * source). The version is auto-extracted from `manifest.json` — no
 * value needs to be passed in via CLI args or env vars.
 *
 * The entry MUST match the canonical project template:
 *   ## [vX.Y.Z] — YYYY-MM-DD <Title>
 *
 * Rules:
 *   - Heading level: exactly `##`
 *   - Version: bracketed, lowercase `v` prefix, matches EXTENSION_VERSION
 *   - Separator: an em dash (—) surrounded by single spaces
 *   - Date: ISO `YYYY-MM-DD` (real-looking, no Feb 30 enforcement — just shape)
 *   - Title: at least one non-empty word after the date
 *
 * Exits 1 (CI failure) when:
 *   - the version cannot be parsed from constants.ts
 *   - changelog.md is missing
 *   - no heading matches the canonical template for the current version
 *
 * Why: a version bump without a changelog entry leaves users
 * unable to discover what changed between releases.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = resolve(ROOT, "manifest.json");
const CHANGELOG = resolve(ROOT, "changelog.md");

function fail(msg) {
    console.error(`❌ ${msg}`);
    process.exit(1);
}

if (!existsSync(MANIFEST)) fail(`Missing required file: ${MANIFEST}`);
if (!existsSync(CHANGELOG)) fail(`Missing required file: ${CHANGELOG}`);

let manifest;
try {
    manifest = JSON.parse(readFileSync(MANIFEST, "utf-8"));
} catch (err) {
    fail(
        `Could not parse JSON from ${MANIFEST}: ${err?.message ?? String(err)}. ` +
        `Reason: manifest.json must be valid JSON for the changelog check to ` +
        `extract the current version field.`
    );
}
const version = manifest?.version;
if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    fail(
        `Could not read a valid "version" field from ${MANIFEST}. ` +
        `Found: ${JSON.stringify(version)}. ` +
        `Expected pattern: "version": "X.Y.Z"`
    );
}

const changelogTxt = readFileSync(CHANGELOG, "utf-8");

const escaped = version.replace(/\./g, "\\.");

// Canonical template: `## [vX.Y.Z] — YYYY-MM-DD <Title>`
const canonicalRe = new RegExp(
    `^##\\s+\\[v${escaped}\\]\\s+—\\s+(\\d{4}-\\d{2}-\\d{2})\\s+\\S.*$`,
    "m"
);

// Loose detector — any heading mentioning this version — used to give a
// targeted error message when an entry exists but has the wrong shape.
const looseRe = new RegExp(
    `^#{1,6}.*${escaped}.*$`,
    "m"
);

const expected = `## [v${version}] — YYYY-MM-DD <Short title>`;

const canonicalMatch = changelogTxt.match(canonicalRe);
if (!canonicalMatch) {
    if (looseRe.test(changelogTxt)) {
        console.error("❌ Changelog entry for current version does not match the required template.");
        console.error(`   Found a heading mentioning v${version}, but it must be exactly:`);
        console.error(`     ${expected}`);
        console.error("");
        console.error("   Required:");
        console.error("     • Heading level `##` (two hashes)");
        console.error("     • Bracketed version with lowercase `v` prefix: `[v" + version + "]`");
        console.error("     • Em dash `—` (U+2014) surrounded by single spaces");
        console.error("     • ISO date `YYYY-MM-DD`");
        console.error("     • Non-empty title after the date");
    } else {
        console.error("❌ Changelog entry missing for current version.");
        console.error(`   manifest.json version = "${version}"`);
        console.error(`   Expected heading in changelog.md:`);
        console.error(`     ${expected}`);
    }
    process.exit(1);
}

// Extra sanity: date components must be plausible (month 01-12, day 01-31).
const [, dateStr] = canonicalMatch;
const [, , mm, dd] = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
const month = Number(mm);
const day = Number(dd);
if (month < 1 || month > 12 || day < 1 || day > 31) {
    console.error(`❌ Changelog entry for v${version} has an invalid date: ${dateStr}`);
    console.error(`   Expected ISO date YYYY-MM-DD with month 01-12 and day 01-31.`);
    process.exit(1);
}

console.log(`✅ Changelog entry for v${version} matches required template (${dateStr}).`);
process.exit(0);