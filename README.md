# Atelier MyUnisoft — extension Chrome

Personnalisation de l'interface MyUnisoft (Balance, Premium, Consultation, Dossier annuel, Grand livre…),
diffusée sous forme d'**extension Chrome installée en mode développeur**, avec **mise à jour
automatique des modules** sans réinstallation.

## Principe

```
┌──────────── Dépôt GitHub ────────────┐        push sur main
│ extension/   coquille stable (rare)  │ ───────────────────────┐
│ scripts/     modules (évoluent)      │                        ▼
│ tools/       build, serveur dev      │         GitHub Actions : node tools/build.mjs --zip
└──────────────────────────────────────┘                        │
                                                                ▼
                                  GitHub Pages (domaine perso) : manifest.json + modules + zip
                                                                │  toutes les 30 min / au démarrage
                                                                ▼  / bouton « Vérifier »
  Chrome de chaque utilisateur : la coquille télécharge, vérifie (SHA-256), met en cache
  et injecte les modules via chrome.userScripts (contexte de la page, comme le preload Electron).
```

- **Modifier un module** = éditer `scripts/xxx.js`, incrémenter `@version` + changelog, `git push`. C'est tout.
- **Modifier la coquille** (`extension/`) = rare ; les utilisateurs doivent alors retélécharger le zip
  (la fenêtre de l'extension les prévient si `minExtensionVersion` dans `publish.json` l'exige).

## Arborescence

| Chemin | Rôle |
|---|---|
| `extension/manifest.json` | Manifest V3. Clé publique incluse → ID stable `jbbopjilhekhfdhiookfphmildncoafp` quel que soit le dossier d'installation. |
| `extension/background.js` | Téléchargement/vérification/cache des modules, enregistrement `chrome.userScripts`, relais réseau, fenêtre de consultation agrandie. |
| `extension/bridge.js` | Pont page ⇄ extension (les modules tournent dans la page et n'ont pas accès à `chrome.*`). |
| `extension/popup.*` | Fenêtre de l'extension : versions, activer/désactiver chaque module, vérifier les MAJ, réglages. |
| `extension/config.js` | **URL de publication par défaut** (`baseUrl`) et réglages par défaut. |
| `scripts/lib/atm-runtime.js` | API `window.ATM` injectée avant chaque module (remplace `GM_*` et l'IPC Electron). |
| `scripts/*.js` | Un fichier = un module, en-tête `==UserScript==` identique à Tampermonkey. |
| `publish.json` | `minExtensionVersion` exigée par les modules publiés. |
| `tools/build.mjs` | Construit `dist/` (manifest + modules + zip de l'extension). |
| `tools/serve.mjs` | Serveur local `http://localhost:8787/` pour tester avant de pousser. |
| `tools/check.mjs` | Contrôle syntaxe + en-têtes. |

## Documentation

- [docs/INSTALLATION.md](docs/INSTALLATION.md) — installer l'extension (à transmettre aux utilisateurs)
- [docs/PUBLIER.md](docs/PUBLIER.md) — faire évoluer et publier un module
- [docs/PORTAGE.md](docs/PORTAGE.md) — correspondances Electron / Tampermonkey → extension
