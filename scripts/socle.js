// ==UserScript==
// @name         Socle Atelier (diagnostic)
// @namespace    https://nicolas.chassard/myunisoft
// @version      1.0.0
// @description  Trace dans la console les versions chargées et expose
//               window.ATM_INFO — sert à vérifier en un coup d'œil que
//               l'extension et les modules sont bien actifs sur la page.
// @author       Nicolas
// @match        https://connect.lgassocies.com/*
// @match        https://*.myunisoft.fr/*
// @run-at       document-start
// @noframes
// ==/UserScript==
//
// CHANGELOG
// 1.0.0 (2026-11-12) — création : trace console + window.ATM_INFO.

(function () {
  'use strict';
  window.ATM_INFO = { extVersion: ATM.extVersion, build: ATM.build, settings: ATM.settings };
  ATM.log(`extension ${ATM.extVersion} · modules ${ATM.build}`);
})();
