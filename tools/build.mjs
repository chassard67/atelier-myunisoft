#!/usr/bin/env node
// Construit le dossier dist/ publié sur GitHub Pages :
//   dist/manifest.json        → liste des modules (lue par l'extension)
//   dist/lib/atm-runtime.js   → runtime commun
//   dist/<module>.js          → un fichier par module (copie de scripts/)
//   dist/atelier-myunisoft-extension.zip (si --zip) → la coquille à installer
//
// Les métadonnées viennent de l'en-tête ==UserScript== de chaque module
// (@name, @version, @description, @match, @exclude-match, @run-at, @connect,
// @noframes) — même format que Tampermonkey, rien à maintenir en double.
//
// Usage : node tools/build.mjs [--zip]

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'scripts');
const DIST = path.join(ROOT, 'dist');
const RUNTIME = 'lib/atm-runtime.js';

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

export function parseHeader(src, file) {
  const block = src.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  if (!block) throw new Error(`${file} : en-tête ==UserScript== introuvable`);
  const meta = { match: [], 'exclude-match': [], connect: [] };
  for (const line of block[1].split(/\r?\n/)) {
    const m = line.match(/^\s*\/\/\s*@([\w-]+)(?:\s+(.*?))?\s*$/);
    if (!m) continue;
    const [, key, value = ''] = m;
    if (Array.isArray(meta[key])) meta[key].push(value);
    else if (!(key in meta)) meta[key] = value; // 1re occurrence (description multi-ligne)
  }
  for (const k of ['name', 'version']) {
    if (!meta[k]) throw new Error(`${file} : @${k} manquant`);
  }
  if (!meta.match.length) throw new Error(`${file} : au moins un @match est requis`);
  if (/require\(['"]electron['"]\)/.test(src)) {
    throw new Error(`${file} : contient encore require('electron') — utiliser ATM.call()/ATM.http()`);
  }
  return meta;
}

export function build({ zip = false } = {}) {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'lib'), { recursive: true });

  const runtimeSrc = fs.readFileSync(path.join(SRC, RUNTIME), 'utf8');
  fs.writeFileSync(path.join(DIST, RUNTIME), runtimeSrc);

  const extManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/manifest.json'), 'utf8'));
  const cfgPath = path.join(ROOT, 'publish.json');
  const publishCfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};

  const scripts = [];
  const connect = new Set(publishCfg.connect || []);
  const files = fs
    .readdirSync(SRC)
    .filter((f) => f.endsWith('.js'))
    .sort();

  for (const file of files) {
    const src = fs.readFileSync(path.join(SRC, file), 'utf8');
    const meta = parseHeader(src, file);
    meta.connect.forEach((h) => connect.add(h));
    fs.writeFileSync(path.join(DIST, file), src);
    scripts.push({
      id: path.basename(file, '.js'),
      name: meta.name,
      version: meta.version,
      description: meta.description || '',
      file,
      sha256: sha256(src),
      matches: meta.match,
      excludeMatches: meta['exclude-match'],
      runAt: meta['run-at'] || 'document-idle',
      noframes: 'noframes' in meta,
    });
  }

  let commit = process.env.GITHUB_SHA || '';
  if (!commit) {
    try {
      commit = execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      commit = 'local';
    }
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13); // AAAAMMJJTHHMM
  const manifest = {
    format: 1,
    build: `${stamp}-${commit.slice(0, 7)}`,
    generatedAt: new Date().toISOString(),
    // Version minimale de la coquille requise par ces modules : à monter
    // dans publish.json quand un module utilise une nouveauté de l'extension.
    minExtensionVersion: publishCfg.minExtensionVersion || '1.0.0',
    latestExtensionVersion: extManifest.version,
    connect: [...connect].sort(),
    runtime: { file: RUNTIME, sha256: sha256(runtimeSrc) },
    scripts,
  };
  fs.writeFileSync(path.join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Petite page d'accueil (lien de téléchargement de l'extension + versions).
  const rows = scripts
    .map((s) => `<tr><td>${s.name}</td><td><code>${s.version}</code></td></tr>`)
    .join('');
  fs.writeFileSync(
    path.join(DIST, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Atelier MyUnisoft</title>
<style>body{font:14px system-ui,Segoe UI,Arial;max-width:640px;margin:40px auto;color:#111}
td{padding:4px 12px;border-bottom:1px solid #eee}code{font-family:Consolas,monospace}</style>
<h1>Atelier MyUnisoft</h1>
<p><a href="atelier-myunisoft-extension.zip">Télécharger l'extension Chrome</a> (v${extManifest.version})
— voir la procédure d'installation dans le dépôt (docs/INSTALLATION.md).</p>
<p>Publication <code>${manifest.build}</code></p><table>${rows}</table>`
  );

  if (zip) {
    const out = path.join(DIST, 'atelier-myunisoft-extension.zip');
    execSync(`cd "${path.join(ROOT, 'extension')}" && zip -qr "${out}" . -x ".*"`);
  }

  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const m = build({ zip: process.argv.includes('--zip') });
  console.log(`dist/ construit — publication ${m.build}`);
  for (const s of m.scripts) console.log(`  • ${s.id.padEnd(24)} v${s.version.padEnd(12)} ${s.runAt}`);
  console.log(`  hôtes @connect : ${m.connect.join(', ') || '(aucun)'}`);
}
