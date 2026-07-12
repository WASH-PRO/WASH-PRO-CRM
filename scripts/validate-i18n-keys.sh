#!/usr/bin/env bash
# Compare EN/RU i18n key paths (core + help + feature modules).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DASH="$ROOT/dashboard/src/i18n/messages"

ROOT="$ROOT" DASH="$DASH" node <<'NODE'
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.env.ROOT;
const DASH = process.env.DASH;

function flatten(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v, key));
    } else {
      out.push(key);
    }
  }
  return out;
}

function loadHelpObject(file) {
  let raw = fs.readFileSync(file, 'utf8');
  raw = raw.replace(/^import[\s\S]*?;\s*/gm, '');
  raw = raw.replace(/ satisfies [\w.]+/g, '');
  raw = raw.replace(/^export const \w+ = /m, '');
  raw = raw.trim().replace(/;?\s*$/, '');
  // eslint-disable-next-line no-eval
  return eval(`(${raw})`);
}

function comparePair(label, enObj, ruObj) {
  const enKeys = new Set(flatten(enObj));
  const ruKeys = new Set(flatten(ruObj));
  const missingInRu = [...enKeys].filter((k) => !ruKeys.has(k)).sort();
  const missingInEn = [...ruKeys].filter((k) => !enKeys.has(k)).sort();
  if (missingInRu.length || missingInEn.length) {
    console.error(`\n== ${label} ==`);
    if (missingInRu.length) {
      console.error(`  Missing in RU (${missingInRu.length}):`);
      missingInRu.slice(0, 20).forEach((k) => console.error(`    - ${k}`));
      if (missingInRu.length > 20) console.error(`    ... +${missingInRu.length - 20} more`);
    }
    if (missingInEn.length) {
      console.error(`  Missing in EN (${missingInEn.length}):`);
      missingInEn.slice(0, 20).forEach((k) => console.error(`    - ${k}`));
      if (missingInEn.length > 20) console.error(`    ... +${missingInEn.length - 20} more`);
    }
    return true;
  }
  console.log(`OK ${label} (${enKeys.size} keys)`);
  return false;
}

let failed = false;

if (comparePair('help/en.ts vs help/ru.ts', loadHelpObject(path.join(DASH, 'help/en.ts')), loadHelpObject(path.join(DASH, 'help/ru.ts')))) {
  failed = true;
}

const tsxScript = `
import { en } from './src/i18n/messages/en.ts';
import { ru } from './src/i18n/messages/ru.ts';
function flatten(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatten(v, key));
    else out.push(key);
  }
  return out;
}
const enKeys = new Set(flatten(en));
const ruKeys = new Set(flatten(ru));
const missingInRu = [...enKeys].filter((k) => !ruKeys.has(k));
const missingInEn = [...ruKeys].filter((k) => !enKeys.has(k));
if (missingInRu.length || missingInEn.length) {
  if (missingInRu.length) console.error('Missing in RU:', missingInRu.slice(0, 20));
  if (missingInEn.length) console.error('Missing in EN:', missingInEn.slice(0, 20));
  process.exit(1);
}
console.log('OK en.ts <-> ru.ts (' + enKeys.size + ' keys)');
`;

const tsx = spawnSync(
  'npx',
  ['--yes', 'tsx', '-e', tsxScript],
  { cwd: path.join(ROOT, 'dashboard'), encoding: 'utf8', stdio: 'pipe' }
);

if (tsx.status !== 0) {
  failed = true;
  console.error(tsx.stderr || tsx.stdout || 'tsx validation failed');
} else {
  process.stdout.write(tsx.stdout);
}

if (failed) process.exit(1);
NODE
