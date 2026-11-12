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
