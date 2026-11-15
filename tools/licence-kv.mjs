#!/usr/bin/env node
// Synchronise licences.json vers le stockage KV « LICENCES » du Worker.
// Prérequis : wrangler installé et connecté (voir server/README.md), et
// l'id du namespace dans server/wrangler.toml.
//
//   node tools/licence-kv.mjs sync     → pousse toutes les clés dans KV
//   node tools/licence-kv.mjs sync --dry → affiche les commandes sans exécuter
//
// Après « node tools/licence.mjs add/block/... », lancer ce « sync » pour
// répercuter côté serveur (effet immédiat, sans redéploiement).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const licences = JSON.parse(fs.readFileSync(path.join(ROOT, 'licences.json'), 'utf8')).licences || [];
const toml = fs.readFileSync(path.join(ROOT, 'server', 'wrangler.toml'), 'utf8');
const nsId = (toml.match(/binding\s*=\s*"LICENCES"\s*,\s*id\s*=\s*"([^"]+)"/) || [])[1];
const dry = process.argv.includes('--dry');

if (process.argv[2] !== 'sync') { console.log('usage : node tools/licence-kv.mjs sync [--dry]'); process.exit(1); }
if (!nsId || nsId === 'À_RENSEIGNER') { console.error('Renseigne l\'id du namespace KV dans server/wrangler.toml.'); process.exit(1); }

for (const l of licences) {
  const value = JSON.stringify({ client: l.client || '', status: l.status || 'active', expires: l.expires || '' });
  const args = ['wrangler', 'kv', 'key', 'put', '--namespace-id', nsId, l.hash, value];
  if (dry) { console.log(args.join(' ')); continue; }
  execFileSync('npx', args, { cwd: path.join(ROOT, 'server'), stdio: 'inherit' });
  console.log(`✓ ${l.client || '(sans nom)'} [${l.status}]`);
}
console.log(dry ? '(simulation)' : `${licences.length} licence(s) synchronisée(s) dans KV.`);
