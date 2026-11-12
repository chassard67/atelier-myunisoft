// ==UserScript==
// @name         MyUnisoft - Consultation (fenêtre de consultation)
// @namespace    https://nicolas.chassard/myunisoft
// @version      1.1-ext
// @description  v1.1 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — aucun changement fonctionnel, le module tourne désormais dans l'extension (même contexte de page que le preload).
//               v1.0 (2026-07-31) : Module extrait de premium.js 3.31 lors de la scission
//               en modules demandée par Nicolas (cf. premium.js core pour le détail de la
//               scission et TMBC_TOOLKIT_CONTRACT.md pour le contrat commun entre modules).
//               Contient : mise en page scindée 50/50 Consultation/Écriture de la fenêtre de
//               consultation (.../child/consulting) quand le panneau de saisie est ouvert.
//               Copie verbatim du code correspondant dans premium.js 3.31 (cf.
//               CHANGELOG-premium-legacy.txt pour l'historique complet des versions
//               antérieures de ces fonctionnalités) — aucun changement de comportement visé
//               par cette extraction, seule son organisation en fichier séparé change.
// @author       Nicolas
// @match        https://connect.lgassocies.com/*
// @match        https://*.myunisoft.fr/*
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // Utilitaires partagés (cf. premium.js core + TMBC_TOOLKIT_CONTRACT.md).
  // Déstructuration volontairement large (tout le kit commun, même si ce
  // module n'utilise pas chaque entrée) pour que chaque module ait exactement
  // la même ligne d'import et reste facile à comparer/maintenir.
  const {
    isDisabled,
    isWideModeActive,
    isConsultWindow,
    detectMenuColor,
    readableTextOn,
    isMenuColorDarkNeutral,
    getSidebar,
    stripAccents,
    normalizeColumnName,
    columnCategoryFor,
    classifyCellValue,
    formatThousands,
    findGridColumnByColumnKey,
    MONO_FONT_STACK,
    getApiHeaders,
    registerScan,
    extendDebugHook,
  } = window.TMBC;


  // Page de consultation avec le Split natif activé (bouton "Split", icône
  // data-id="splitScreen") : le panneau "Validation" (consultation) et le
  // panneau "Ecriture" (saisie) sont natifs et empilés verticalement par
  // défaut. On les passe en côte à côte (gauche/droite) via CSS pur sur leur
  // conteneur parent commun — repéré en direct via DevTools : un <div> sans
  // classe, dont les deux seuls enfants sont .css-1rn3cte (bloc consultation
  // complet : en-tête + filtres + tableau) et .css-1cfzc65 (panneau
  // Ecriture). Aucun nœud DOM déplacé, seulement des styles CSS posés sur
  // des éléments existants (respecte la règle "jamais déplacer un nœud natif").
  // Ces noms de classe css-XXXXX sont générés par Emotion/MUI et pourraient
  // changer si l'appli est mise à jour — à revérifier si le split cesse de
  // fonctionner après une mise à jour de MyUnisoft.
  function applyConsultSplitLayout() {
    const left = document.querySelector('.css-1rn3cte');
    const right = document.querySelector('.css-1cfzc65');

    if (left && right && left.parentElement && left.parentElement === right.parentElement) {
      const parent = left.parentElement;
      parent.style.setProperty('display', 'flex', 'important');
      parent.style.setProperty('flex-direction', 'row', 'important');
      parent.style.setProperty('align-items', 'stretch', 'important');
      parent.style.setProperty('height', '100vh', 'important');
      parent.style.setProperty('overflow', 'hidden', 'important');

      left.style.setProperty('flex', '0 0 50%', 'important');
      left.style.setProperty('max-width', '50%', 'important');
      left.style.setProperty('height', '100%', 'important');
      left.style.setProperty('overflow-y', 'auto', 'important');

      right.style.setProperty('flex', '0 0 50%', 'important');
      right.style.setProperty('max-width', '50%', 'important');
      right.style.setProperty('height', '100%', 'important');
      right.style.setProperty('overflow-y', 'auto', 'important');

      parent.dataset.tmbcSplitApplied = '1';
    } else if (left && left.parentElement && left.parentElement.dataset.tmbcSplitApplied === '1') {
      // Split désactivé entre-temps (panneau Ecriture disparu) : on retire
      // nos styles pour revenir proprement à la mise en page native.
      const parent = left.parentElement;
      ['display', 'flex-direction', 'align-items', 'height', 'overflow'].forEach((p) =>
        parent.style.removeProperty(p)
      );
      ['flex', 'max-width', 'height', 'overflow-y'].forEach((p) => left.style.removeProperty(p));
      delete parent.dataset.tmbcSplitApplied;
    }
  }


  // Tournait de façon inconditionnelle dans premium.js 3.31 (hors du
  // gating isDisabled() — la fonction elle-même ne cible que les 2
  // classes de la fenêtre de consultation, sans effet ailleurs) : même
  // comportement conservé ici.
  function scanConsultation() {
    applyConsultSplitLayout();
  }

  registerScan(scanConsultation);
})();
