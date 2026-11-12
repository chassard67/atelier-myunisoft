// Atelier MyUnisoft — pont page ⇄ extension.
//
// Les modules tournent dans le monde MAIN (contexte de la page) et n'ont donc
// pas accès à chrome.runtime. Ce petit script de contenu (monde ISOLÉ, chargé
// à document_start) relaie leurs demandes au service worker via
// window.postMessage. Côté page, c'est ATM.call() (scripts/lib/atm-runtime.js)
// qui parle à ce pont.
//
// Sécurité : seules les actions listées dans PAGE_HANDLERS (background.js)
// existent, et les requêtes réseau ne partent que vers les hôtes @connect.

(() => {
  const CH = '__atm_bridge_v1';

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const d = event.data;
    if (!d || d.ch !== CH || d.dir !== 'req') return;

    const reply = (resp) =>
      window.postMessage({ ch: CH, dir: 'res', id: d.id, ...resp }, location.origin);

    try {
      chrome.runtime.sendMessage({ atm: 'page', type: d.type, payload: d.payload }, (resp) => {
        if (chrome.runtime.lastError) {
          reply({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          reply(resp || { ok: false, error: 'Pas de réponse' });
        }
      });
    } catch (e) {
      // Extension rechargée pendant que la page était ouverte : le contexte
      // de ce script est invalidé, il faut recharger l'onglet.
      reply({ ok: false, error: 'Extension rechargée — recharger la page (' + e.message + ')' });
    }
  });

  // Signale à la page que le pont est prêt (utile pour du debug).
  document.documentElement && document.documentElement.setAttribute('data-atm-bridge', '1');
})();
