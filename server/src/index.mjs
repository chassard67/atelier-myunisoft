// Atelier MyUnisoft — serveur de licences (Cloudflare Worker).
//
// Rôle : ne livrer le CODE des modules Premium qu'aux clés de licence valides.
//   • /manifest.json          → métadonnées publiques (liste des fichiers,
//                               empreintes, release, catalogue). Pas de code.
//   • /licence?h=<hash>       → état d'une licence (pour l'interface de
//                               l'extension). On ne renvoie jamais la liste.
//   • /<fichier>.js           → le code d'un module : réservé à une clé valide
//                               (en-tête « x-atm-licence: <hash sha-256 de la
//                               clé> »), sinon HTTP 403. C'est LA barrière :
//                               sans clé valide, aucun code à débloquer.
//
// Les clés vivent dans le stockage KV « LICENCES » : une entrée par clé,
//   nom = sha-256(clé normalisée), valeur = {"client","status","expires"}.
//   status = "active" | "blocked" ; expires = "AAAA-MM-JJ" (optionnel).
//
// Le code des modules est intégré au déploiement (bundle.generated.json,
//   produit par tools/build-worker.mjs à partir de dist/). Publier une mise
//   à jour des modules = redéployer le Worker ; gérer une clé = une écriture
//   KV, sans redéploiement.

import bundle from '../bundle.generated.json';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'x-atm-licence, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/+/, '');

    // Métadonnées publiques (aucun code).
    if (path === 'manifest.json') return json(bundle.manifest);

    // État d'une licence, pour l'interface (jamais la clé en clair).
    if (path === 'licence') {
      const lic = await readLicence(env, url.searchParams.get('h') || '');
      return json(lic || { status: 'unknown' });
    }

    // Code d'un module : réservé aux clés valides.
    if (path.endsWith('.js')) {
      const code = bundle.files[path];
      if (code === undefined) return text('introuvable', 404);
      const hash = req.headers.get('x-atm-licence') || url.searchParams.get('h') || '';
      const lic = await readLicence(env, hash);
      if (!licenceOk(lic)) {
        return json({ error: 'licence', status: lic ? lic.status : 'missing' }, 403);
      }
      return new Response(code, {
        headers: { ...CORS, 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    return text('Atelier MyUnisoft');
  },
};

async function readLicence(env, hash) {
  if (!/^[0-9a-f]{64}$/.test(hash || '')) return null;
  const raw = await env.LICENCES.get(hash);
  if (!raw) return null;
  let o;
  try { o = JSON.parse(raw); } catch { return null; }
  if (o.expires && Date.parse(o.expires) < Date.now()) o.status = 'expired';
  return o;
}
const licenceOk = (lic) => !!lic && lic.status === 'active';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
function text(s, status = 200) {
  return new Response(s, { status, headers: { ...CORS, 'cache-control': 'no-store' } });
}
