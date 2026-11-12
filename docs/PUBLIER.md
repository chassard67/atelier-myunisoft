# Faire évoluer et publier un module

## Cycle normal

1. Modifier `scripts/<module>.js`.
2. Incrémenter `@version` et ajouter une entrée en tête du **CHANGELOG** du fichier (règle projet).
3. Tester en local (ci-dessous).
4. `node tools/check.mjs` puis `git commit` + `git push` sur `main`.
5. GitHub Actions publie en ~1 min. Chaque Chrome récupère la nouvelle version à sa prochaine
   vérification (≤ 30 min, au démarrage, ou bouton « Vérifier les mises à jour »), puis au
   prochain chargement de page.

> Le CDN de GitHub Pages peut garder l'ancienne version jusqu'à ~10 min. Si une vérification
> renvoie « Empreinte incorrecte… », c'est ce cache : l'ancienne version reste active, réessayer
> plus tard. L'extension ne remplace **jamais** un module par un fichier non vérifié.

## Tester avant de pousser (serveur local)

```bash
node tools/serve.mjs          # sert le dépôt sur http://localhost:8787/
```

Dans Chrome : icône Atelier → **Avancé** → **Dev local**. Ensuite, à chaque modification :
**Vérifier les mises à jour** → recharger l'onglet MyUnisoft. Les erreurs apparaissent dans la
console de la page, avec le nom du fichier (`atelier-myunisoft/<module>.js`).

Une fois validé : pousser, puis remettre l'URL normale (Avancé → coller l'URL → Enregistrer).

## Nouveau module

Créer `scripts/<id>.js` avec l'en-tête :

```js
// ==UserScript==
// @name         Nom affiché dans l'extension
// @namespace    https://nicolas.chassard/myunisoft
// @version      1.0.0
// @description  Une ligne de description
// @match        https://connect.lgassocies.com/*
// @match        https://*.myunisoft.fr/*
// @run-at       document-idle        (ou document-start pour renifler le réseau)
// @connect      hote.externe.fr      (seulement si ATM.http() vers un autre domaine)
// @noframes
// ==/UserScript==
```

Rappel de la règle projet : ne pas créer un module qui scanne la même page en parallèle d'un
autre — fusionner dans le module du domaine concerné.

## Modifier la coquille (`extension/`)

À éviter autant que possible (chaque utilisateur doit réinstaller le zip).

1. Modifier, incrémenter `version` dans `extension/manifest.json`.
2. Si des modules dépendent de la nouveauté : monter `minExtensionVersion` dans `publish.json`
   → les utilisateurs en retard voient la pastille **EXT**.
3. Pousser : le zip publié est reconstruit automatiquement.
4. Ne jamais modifier ni supprimer la clé `key` du manifest (elle fixe l'ID de l'extension et donc
   les réglages enregistrés chez les utilisateurs).

## Annoncer une mise à jour aux utilisateurs

Dans `publish.json` → `release` : changer `version` et écrire les `notes`. Au push, chaque
utilisateur voit **une fois** la fenêtre « mise à jour activée » à son prochain chargement de
MyUnisoft. Sans changement de `release.version`, la publication reste silencieuse (correctifs).

Une mise à jour de la coquille (`extension/`, version du manifest) affiche aussi cette fenêtre,
avec les notes de `EXTENSION_NOTES` dans `extension/config.js`.

## Fonctionnalités par défaut

`publish.json` → `catalog` : groupes et interrupteurs affichés dans l'extension. Un élément
`"type": "module"` active/désactive un fichier de `scripts/` ; `"type": "setting"` est un réglage
lu par les modules via `TMBC.feature('id', défaut)` (ou `ATM.settings.id`). `default` fixe la valeur
pour tous les utilisateurs qui n'y ont pas touché. `required` = toujours chargés ;
`dependencies` = modules chargés automatiquement avec un autre.

## Licences (bloquer un client)

```bash
node tools/licence.mjs add "Cabinet Dupont"     # affiche la clé à transmettre (une seule fois)
node tools/licence.mjs list
node tools/licence.mjs block "Cabinet Dupont"   # suspend
node tools/licence.mjs unblock "Cabinet Dupont" # réactive
node tools/licence.mjs add "Cabinet Dupont" --expires 2027-12-31   # clé avec échéance
node tools/licence.mjs expires "Cabinet Dupont" 2028-12-31         # prolonger (« none » = sans échéance)
```

Échéance : le jour suivant la date, la licence est publiée « expired » par la republication
automatique quotidienne (03:17 UTC) et le client voit ses fonctionnalités coupées comme une
suspension. Sans PC : on peut aussi modifier `licences.json` directement sur github.com
(crayon « Edit », champs `status` = `active`/`blocked` et `expires`), puis « Commit changes ».
Seule la création d'une clé demande l'outil (il faut calculer l'empreinte).

Puis commit + push. Effet chez le client à la prochaine vérification de son extension (≤ 30 min,
démarrage de Chrome, ou bouton « Vérifier ») : plus aucun module injecté, bandeau « licence
suspendue » dans MyUnisoft, pastille **LIC** sur l'icône. Hors ligne, une licence déjà validée
reste utilisable 14 jours (`LICENCE_GRACE_DAYS`). Seules les empreintes SHA-256 des clés sont
dans le dépôt. `"licenceRequired": false` dans `publish.json` désactive le contrôle pour tous.

**Limite** : tant que le dépôt est public, le code des modules reste lisible et l'extension
installée en mode développeur peut être modifiée par un utilisateur averti. Le blocage arrête
l'usage normal ; pour le rendre robuste, il faut servir les modules depuis un serveur qui vérifie
la clé (dépôt privé + petit service, ex. Cloudflare Worker).
