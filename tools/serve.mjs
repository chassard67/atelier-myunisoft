#!/usr/bin/env node
// Serveur de développement : sert dist/ sur http://localhost:8787/ et
// reconstruit à chaque lecture de manifest.json. Permet de tester une
// modification dans Chrome AVANT de la pousser sur GitHub :
//   1. node tools/serve.mjs
//   2. fenêtre de l'extension → Avancé → « Dev local »
//   3. modifier scripts/xxx.js → « Vérifier les mises à jour » → recharger l'onglet
//   4. une fois validé : git push, puis remettre la source normale dans l'extension.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8787;
const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.zip': 'application/zip' };

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try {
      if (urlPath === '/manifest.json' || urlPath === '/') {
        const m = build();
        console.log(new Date().toLocaleTimeString('fr-FR'), 'reconstruit', m.build);
      }
      const file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
      if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
        return res.end('introuvable');
      }
      res.writeHead(200, {
        'Content-Type': (TYPES[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      console.error(e.message);
      res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
      res.end(e.message);
    }
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Atelier MyUnisoft — serveur dev sur http://localhost:${PORT}/ (Ctrl+C pour arrêter)`);
  });
