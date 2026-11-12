#!/usr/bin/env node
// Vérifie la syntaxe de tous les fichiers JS (modules, runtime, extension)
// et la validité des en-têtes ==UserScript==. À lancer avant chaque push.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHeader } from './build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = ['scripts', 'scripts/lib', 'extension', 'tools'];
let failed = 0;
for (const d of dirs) {
  for (const f of fs.readdirSync(path.join(ROOT, d)).filter((x) => x.endsWith('.js') || x.endsWith('.mjs'))) {
    const p = path.join(ROOT, d, f);
    try {
      execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' });
      if (d === 'scripts') parseHeader(fs.readFileSync(p, 'utf8'), f, { matches: ['https://example.com/*'] });
      console.log('  ok  ', path.join(d, f));
    } catch (e) {
      failed++;
      console.log('  ERR ', path.join(d, f), '\n', String(e.stderr || e.message));
    }
  }
}
process.exit(failed ? 1 : 0);
