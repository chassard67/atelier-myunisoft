# Serveur de licences (Cloudflare Worker)

Ne livre le **code** des modules Premium qu'aux clés de licence valides.
Le socle public et l'interface ne contiennent plus de secret exploitable :
sans clé valide, le serveur renvoie 403 et il n'y a aucun code à débloquer.

## Mise en place (une fois)

1. **Namespace KV** (stockage des clés)
   - Cloudflare → Workers & Pages → KV → *Create namespace* → nom `LICENCES`.
   - Copier son **ID** dans `server/wrangler.toml` (`kv_namespaces … id`).

2. **Account ID**
   - Cloudflare → Workers & Pages (barre de droite) → *Account ID*.
   - Le mettre en secret GitHub `CLOUDFLARE_ACCOUNT_ID` (voir plus bas).

3. **Jeton de déploiement** (pour GitHub Actions)
   - Cloudflare → My Profile → API Tokens → *Create Token* →
     modèle **« Edit Cloudflare Workers »** → inclure le compte et la zone.
   - Dépôt GitHub → Settings → Secrets and variables → Actions →
     `CLOUDFLARE_API_TOKEN` = le jeton, `CLOUDFLARE_ACCOUNT_ID` = l'ID.

4. **Adresse**
   - Par défaut le Worker est servi sur `https://atelier-myunisoft.<sous-domaine>.workers.dev`.
   - Pour une adresse propre (`https://atelier.tondomaine.fr`) : Worker →
     Settings → Triggers → *Custom Domains* → ajouter le sous-domaine
     (DNS déjà chez Cloudflare = automatique).

## Déploiement

    node tools/build.mjs          # construit dist/
    node tools/build-worker.mjs   # dist/ → server/bundle.generated.json
    cd server && npx wrangler deploy

En CI, le workflow GitHub fait les trois à chaque publication.

## Gérer les licences (sans redéploiement)

    node tools/licence.mjs add "Cabinet Dupont" --expires 2027-12-31
    node tools/licence-kv.mjs sync        # pousse vers KV (effet immédiat)

`block` / `unblock` / `expires` puis `sync` : idem.
