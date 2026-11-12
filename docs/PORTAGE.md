# Porter un script Electron / Tampermonkey vers l'extension

**Ordre et chargement** : tous les modules actifs sont injectés en UN seul bloc, à `document_start`,
dans l'ordre de `publish.json` → `order` (= ordre des `require()` de `preload.js`). `premium.js`
définit donc toujours `window.TMBC` avant les autres. Chaque module est isolé par un `try/catch` :
une erreur au chargement de l'un n'empêche pas les suivants. `socle` et `premium` sont
obligatoires (interrupteur grisé dans l'extension). Un module sans `@match` reçoit
`defaultMatches` de `publish.json`.

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
| `require('electron').ipcRenderer.send('tmbc-diag', txt)` | `window.ATM.diag(txt)` → télécharge `diag-….txt` (sans capture d'écran) |
| `webFrame.setZoomFactor(f)` | `window.ATM.setZoom(f)` (zoom propre à l'onglet) ; Ctrl+molette = zoom natif de Chrome |
| `credentials.json` + pré-remplissage (`autofill.js`) | supprimé : gestionnaire de mots de passe de Chrome |
| `setWindowOpenHandler` (fenêtre consultation plein écran, réutilisée) | `window.open(url, 'nom')` réutilise déjà la fenêtre nommée ; l'agrandissement est fait par l'extension (réglage « Agrandir automatiquement la fenêtre de consultation ») |
| Menu Electron (DevTools, zoom, connexion) | fonctions natives de Chrome |
| `#tmb-force-new` (Maj+clic) | inchangé : `window.open(url, '_blank'…)` côté module |

Ajout d'un appel au service worker (rare, nécessite une nouvelle version de la coquille) :
ajouter une entrée dans `PAGE_HANDLERS` de `extension/background.js`.
