#!/usr/bin/env node
// Gestion des licences Atelier MyUnisoft.
//
// licences.json (dans le dépôt) ne contient QUE l'empreinte SHA-256 de chaque
// clé : la clé en clair n'est affichée qu'une fois, à la création — à
// transmettre au client (et à garder de votre côté si besoin).
//
//   node tools/licence.mjs add "Cabinet Dupont"        → crée une clé active
//   node tools/licence.mjs list                        → liste les licences
//   node tools/licence.mjs block "Cabinet Dupont"      → suspend (client ou n° de la liste)
//   node tools/licence.mjs unblock "Cabinet Dupont"    → réactive
//   node tools/licence.mjs remove "Cabinet Dupont"     → supprime
//
// Puis : git commit + push → effet chez le client à la prochaine vérification
// de son extension (≤ 30 min, démarrage de Chrome ou bouton « Vérifier »).

import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'licences.json');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I

const load = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { licences: [] });
const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2) + '\n');
const hash = (k) => createHash('sha256').update(String(k).trim().toUpperCase(), 'utf8').digest('hex');

function newKey() {
  const bytes = randomBytes(12);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `ATM-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

function find(d, who) {
  const n = Number(who);
  if (Number.isInteger(n) && n >= 1 && n <= d.licences.length) return d.licences[n - 1];
  const byClient = d.licences.filter((l) => l.client.toLowerCase() === String(who).toLowerCase());
  if (byClient.length === 1) return byClient[0];
  if (byClient.length > 1) throw new Error(`Plusieurs licences pour « ${who} » : utilisez le n° de la liste.`);
  const byKey = d.licences.find((l) => l.hash === hash(who));
  if (byKey) return byKey;
  throw new Error(`Licence introuvable : ${who}`);
}

const [cmd, ...args] = process.argv.slice(2);
const d = load();
const today = new Date().toISOString().slice(0, 10);

try {
  switch (cmd) {
    case 'add': {
      const client = args.join(' ').trim();
      if (!client) throw new Error('Usage : node tools/licence.mjs add "Nom du client"');
      const key = newKey();
      d.licences.push({ hash: hash(key), client, status: 'active', created: today });
      save(d);
      console.log(`Licence créée pour « ${client} » :\n\n    ${key}\n\nÀ transmettre au client (elle n'est PAS conservée en clair). Puis git commit + push.`);
      break;
    }
    case 'block':
    case 'unblock': {
      const l = find(d, args.join(' '));
      l.status = cmd === 'block' ? 'blocked' : 'active';
      l.updated = today;
      save(d);
      console.log(`« ${l.client} » : ${l.status === 'active' ? 'réactivée' : 'SUSPENDUE'}. Puis git commit + push.`);
      break;
    }
    case 'remove': {
      const l = find(d, args.join(' '));
      d.licences = d.licences.filter((x) => x !== l);
      save(d);
      console.log(`« ${l.client} » supprimée. Puis git commit + push.`);
      break;
    }
    case 'list':
    case undefined: {
      if (!d.licences.length) console.log('Aucune licence.');
      d.licences.forEach((l, i) =>
        console.log(`${String(i + 1).padStart(3)}. ${l.status === 'active' ? 'active   ' : 'SUSPENDUE'}  ${l.client}  (créée ${l.created || '?'}${l.updated ? ', modifiée ' + l.updated : ''})`)
      );
      break;
    }
    default:
      throw new Error('Commandes : add | list | block | unblock | remove');
  }
} catch (e) {
  console.error('Erreur : ' + e.message);
  process.exit(1);
}
