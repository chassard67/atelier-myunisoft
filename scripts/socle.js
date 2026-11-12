// ==UserScript==
// @name         Socle Atelier (diagnostic + notes de mise à jour)
// @namespace    https://nicolas.chassard/myunisoft
// @version      1.1.0
// @description  v1.1.0 (2026-11-12) : affiche une fenêtre « mise à jour activée » (notes de version publiées dans
//               publish.json → release, ou mise à jour de l'extension elle-même), une seule fois par mise à jour.
//               v1.0.0 (2026-11-12) : trace dans la console les versions chargées et expose window.ATM_INFO.
// @author       Nicolas
// @match        https://connect.lgassocies.com/*
// @match        https://*.myunisoft.fr/*
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  window.ATM_INFO = { extVersion: ATM.extVersion, build: ATM.build, settings: ATM.settings };
  ATM.log(`extension ${ATM.extVersion} · modules ${ATM.build}`);

  // Fenêtres de consultation (popup) : pas de fenêtre de notes, la page
  // principale s'en charge.
  if (window.opener && /\/child\//.test(location.pathname)) return;

  const MODAL_ID = 'atm-update-notice';

  function el(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  function showNotices(notices) {
    if (!notices.length || document.getElementById(MODAL_ID)) return;
    const overlay = el(
      'div',
      'position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;font:14px/1.45 system-ui,Segoe UI,Arial,sans-serif'
    );
    overlay.id = MODAL_ID;
    const box = el('div', 'background:#fff;border-radius:10px;width:min(560px,92vw);max-height:80vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.35)');
    const head = el('div', 'background:rgb(23,42,70);color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:600;font-size:15px', 'Atelier MyUnisoft — mise à jour activée');
    box.appendChild(head);
    const body = el('div', 'padding:14px 18px;color:#111827');
    for (const n of notices) {
      body.appendChild(el('div', 'font-weight:600;margin:6px 0 4px', n.title + (n.date ? ' — ' + n.date : '')));
      if (n.lines && n.lines.length) {
        const ul = el('ul', 'margin:0 0 8px;padding-left:20px');
        n.lines.forEach((l) => ul.appendChild(el('li', 'margin:3px 0', l)));
        body.appendChild(ul);
      }
    }
    box.appendChild(body);
    const foot = el('div', 'padding:10px 18px 16px;text-align:right');
    const ok = el('button', 'background:rgb(23,42,70);color:#fff;border:0;border-radius:6px;padding:8px 18px;font:inherit;cursor:pointer', 'OK, compris');
    const close = () => {
      overlay.remove();
      ATM.call('notices-ack', { ids: notices.map((n) => n.id) }).catch(() => {});
    };
    ok.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    foot.appendChild(ok);
    box.appendChild(foot);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    ok.focus();
  }

  ATM.onReady(() => {
    // Petit délai : laisse l'appli s'afficher avant la fenêtre.
    setTimeout(() => {
      ATM.call('notices-get')
        .then((list) => showNotices(Array.isArray(list) ? list : []))
        .catch(() => {});
    }, 1500);
  });
})();
