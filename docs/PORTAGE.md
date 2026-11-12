# Porter un script Electron / Tampermonkey vers l'extension

Les modules tournent dans le **contexte de la page** (monde MAIN), exactement comme le preload
Electron avec `contextIsolation:false` : `window.fetch` / `XMLHttpRequest` sont ceux de MyUnisoft,
donc le reniflage réseau de Balance fonctionne tel quel avec `@run-at document-start`.

| Avant | Extension |
|---|---|
| `const { ipcRenderer } = require('electron')` | supprimer (refusé par `tools/build.mjs`) |
| `ipcRenderer.invoke('fetch-meteo-status')` | `ATM.call('meteo-status')` |
| `GM_xmlhttpRequest({url, onload})` | `const r = await ATM.http({ url }); r.status, r.body` + `@connect` de l'hôte |
| `GM_getValue(k, d)` / `GM_setValue(k, v)` | `await ATM.getValue(k, d)` / `await ATM.setValue(k, v)` (asynchrones) |
| `localStorage` / `sessionStorage` | inchangé (stockage du site) |
| `process.versions.electron` (`isElectron`) | `ATM.settings.centerLayout` (réglage dans la fenêtre de l'extension) |
| `window.addEventListener('DOMContentLoaded', start)` | `ATM.onReady(start)` — **obligatoire** en `document-idle`, l'événement est déjà passé |
| `credentials.json` + pré-remplissage | supprimé : gestionnaire de mots de passe de Chrome |
| `setWindowOpenHandler` (fenêtre consultation plein écran, réutilisée) | `window.open(url, 'nom')` réutilise déjà la fenêtre nommée ; l'agrandissement est fait par l'extension (réglage « Agrandir automatiquement la fenêtre de consultation ») |
| Menu Electron (DevTools, zoom, connexion) | fonctions natives de Chrome |
| `#tmb-force-new` (Maj+clic) | inchangé : `window.open(url, '_blank'…)` côté module |

Ajout d'un appel au service worker (rare, nécessite une nouvelle version de la coquille) :
ajouter une entrée dans `PAGE_HANDLERS` de `extension/background.js`.
