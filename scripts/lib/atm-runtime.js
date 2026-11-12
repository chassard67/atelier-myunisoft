// Atelier MyUnisoft — runtime commun injecté AVANT chaque module.
//
// Expose window.ATM dans le contexte de la page (monde MAIN). Idempotent :
// injecté une fois par module, mais initialisé une seule fois par page.
//
// API :
//   ATM.settings                → réglages de l'extension (lecture synchrone)
//   ATM.extVersion / ATM.build  → versions (coquille / publication des modules)
//   ATM.call(type, payload)     → appel brut au service worker (Promise)
//   ATM.http({url, method, headers, body, responseType}) → remplace GM_xmlhttpRequest
//                                 (hôte autorisé seulement s'il est déclaré en @connect)
//   ATM.getValue(key, def) / ATM.setValue(key, value)    → remplacent GM_getValue/GM_setValue
//                                 (asynchrones ici : renvoient des Promise)
//   ATM.onReady(fn)             → exécute fn quand le DOM est prêt, même si
//                                 le module est injecté après DOMContentLoaded
//   ATM.setZoom(facteur)        → zoom de l'onglet (ex-webFrame.setZoomFactor d'Electron)
//   ATM.diag(texte)             → télécharge diag-N.txt (ex-IPC 'tmbc-diag' d'Electron)
//   ATM.log(...)                → console.log préfixé

(function () {
  'use strict';
  if (window.ATM && window.ATM.__ready) return;

  const CH = '__atm_bridge_v1';
  const TIMEOUT_MS = 30000;
  const boot = window.__ATM_BOOT || {};
  const pending = new Map();
  let seq = 0;
  let diagCounter = 0;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.ch !== CH || d.dir !== 'res') return;
    const p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    clearTimeout(p.timer);
    if (d.ok) p.resolve(d.data);
    else p.reject(new Error(d.error || 'Erreur extension'));
  });

  function call(type, payload) {
    return new Promise((resolve, reject) => {
      const id = 'atm-' + ++seq + '-' + Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Délai dépassé (' + type + ')'));
      }, TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      whenBridgeReady().then(() =>
        window.postMessage({ ch: CH, dir: 'req', id, type, payload }, location.origin)
      );
    });
  }

  // Le pont (bridge.js) et les modules démarrent tous deux à document_start
  // sans ordre garanti : on attend qu'il ait posé son marqueur avant d'envoyer,
  // sinon un appel très précoce serait perdu.
  let bridgeReady = null;
  function whenBridgeReady() {
    if (!bridgeReady) {
      bridgeReady = new Promise((resolve) => {
        const t0 = Date.now();
        (function poll() {
          const root = document.documentElement;
          if ((root && root.getAttribute('data-atm-bridge') === '1') || Date.now() - t0 > 5000) {
            resolve();
          } else {
            setTimeout(poll, 25);
          }
        })();
      });
    }
    return bridgeReady;
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  window.ATM = Object.freeze({
    __ready: true,
    extVersion: boot.extVersion || null,
    build: boot.build || null,
    settings: Object.freeze({ ...(boot.settings || {}) }),
    call,
    http: (opts) => call('http', opts),
    getValue: async (key, def = null) => {
      const v = await call('store-get', { key });
      return v === null ? def : v;
    },
    setValue: (key, value) => call('store-set', { key, value }),
    onReady,
    setZoom: (factor) => call('set-zoom', { factor }),
    diag: (text) => {
      // Fichier texte téléchargé dans le dossier Téléchargements (Electron
      // l'écrivait à côté de main.js, avec une capture d'écran en plus).
      diagCounter += 1;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([String(text)], { type: 'text/plain;charset=utf-8' }));
      a.download = 'diag-' + stamp + '-' + diagCounter + '.txt';
      (document.body || document.documentElement).appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
      console.log('[Atelier] diagnostic téléchargé :', a.download);
    },
    log: (...args) => console.log('%c[Atelier]', 'color:#10b981;font-weight:bold', ...args),
  });
})();
