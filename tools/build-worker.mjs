// Génère server/bundle.generated.json à partir de dist/ :
//   { manifest: <manifest.json>, files: { "premium.js": "<code>", ... } }
// À lancer après tools/build.mjs. Le Worker intègre ce bundle au déploiement.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'server', 'bundle.generated.json');

const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
const files = {};
for (const item of [manifest.runtime, ...manifest.scripts]) {
  files[item.file] = fs.readFileSync(path.join(DIST, item.file), 'utf8');
}
fs.writeFileSync(OUT, JSON.stringify({ manifest, files }));
const kb = (Buffer.byteLength(JSON.stringify({ manifest, files })) / 1024).toFixed(0);
console.log(`bundle.generated.json écrit (${Object.keys(files).length} fichiers, ${kb} Ko)`);
