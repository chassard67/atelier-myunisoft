// ==UserScript==
// @name         MyUnisoft - Premium (core)
// @namespace    https://nicolas.chassard/myunisoft
// @version      4.19-ext
// @description  v4.19 (2026-11-17, demandé par Nicolas) : menu clic droit de la SAISIE — ajout de « Insérer une ligne »
//               à côté de « Supprimer la ligne » (menu MUI natif), qui déclenche la même action que Ctrl + + (ajout
//               d'une ligne). On n'ajoute que notre propre <li> en fin de menu, aucun nœud natif n'est déplacé/retiré.
//               v4.18 (2026-11-17, retour de Nicolas) : les cellules de DATE ne reçoivent plus la police à chasse fixe
//               (Consolas, plus large) : elle débordait d'une colonne native calibrée pour la police par défaut et
//               tronquait la date (colonne Date de la saisie « 26/10/202… »). Seuls les montants restent en Consolas.
//               v4.17 (2026-11-15, retour de Nicolas) : le centrage « grand écran » ne s'applique plus qu'au-delà de
//               2200 px de large (au lieu de 1920) : un portable Full HD (1920×1080, ex. Acer N19H5) n'est plus centré ;
//               seuls les vrais grands écrans (2560, ultra-wide, 4K) le sont.
//               v4.16 (2026-11-13) : l'aligneur de cellules ignore aussi Consultation Premium et Balance Premium (le total Crédit
//               de Consultation Premium était remis à gauche).
//               v4.15 (2026-11-13, demandé par Nicolas) : panneau compact des méga-menus (Tenue, Révision,
//               Déclarations, Paramètres… resserrés et collés à la barre bleue, ajouté le 2026-10-22) supprimé :
//               les menus retrouvent leur affichage MyUnisoft natif. L'aligneur de cellules ignore aussi la
//               surimpression Grand Livre Premium (#tmbc-glp-root), qui gère ses propres alignements.
//               v4.14 (2026-11-12, demandes de Nicolas) : (1) bouton PREMIUM de la barre du haut supprimé (activation
//               fonctionnalité par fonctionnalité dans l'extension) et ancien drapeau tmbc-scripts-disabled effacé ;
//               (2) réglages de l'extension lus via feature() : lignes de séparation des tableaux (gridLines), chiffres
//               en Consolas (monoFont), statut MyUnisoft/météo (showStatus, désactivé par défaut) ; (3) nouvel utilitaire
//               partagé TMBC.ensurePremiumMenuItem() (entrée « XXX Premium » clonée sous une entrée native du menu).
//               v4.13 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — fetchStatusColor passe par ATM.call('meteo-status') (au lieu de l'IPC) ; isElectron = réglage « Centrer le contenu » de l'extension (ATM.settings.centerLayout) ; isConsultWindow ne dépend plus d'Electron ; Ctrl+molette laissé au zoom natif de Chrome (webFrame absent) ; zoom 90 % par défaut via ATM.setZoom (zoom de l'onglet) ; diagnostic Ctrl+Alt+D téléchargé en diag-N.txt (ATM.diag).
//               v4.8 (2026-10-22) : cause réelle de MyU Vision décalé/tronqué trouvée par diagnostic en direct dans l'appli : c'est un custom element <myu-vision-chat> à shadow DOM, placé dans le papier du menu de gauche ; le translateX appliqué au menu (centrage 60vw) devient le bloc conteneur de son panneau position:fixed et overflow:hidden le rogne. Détection corrigée (shadowRoot > [role=dialog] non aria-hidden, largeur > 50) : tant que le panneau est ouvert, le menu n'est plus translaté. Diagnostic temporaire retiré (sauvegarde : *.bak-diag-version).
//               v4.7 (2026-10-22) : correctif v4.6 insuffisant — MyU Vision n'est pas un MuiDrawer mais un <div role="dialog" aria-label="MyU Vision"> (HTML fourni par Nicolas). Détecté désormais directement (aria-hidden="false", ou tout role="dialog" dans le menu) : tant qu'il est ouvert, le menu n'est plus translaté (hypothèse : le dialogue, rendu dans le menu, était décalé et rogné par ce translateX) et la mise en page native est rendue (classe html.tmbc-side-panel-open).
//               v4.6 (2026-10-22) : MyU Vision (panneau latéral natif = 2e MuiDrawer docké) s'affichait à gauche, tronqué, avec le centrage à 60vw sur écran large (OK en mode pleine largeur). positionDrawerNextToContent() cible désormais le drawer du menu (getSidebar().closest) au lieu du premier drawer docké, et quand un autre drawer docké a une largeur > 8px pose la classe html.tmbc-side-panel-open qui rend la mise en page au natif (CSS dans ULTRAWIDE_STYLE) et retire le décalage du menu ; log console "[side-panel] ouvert/fermé" pour diagnostic. Sauvegarde : premium.js.bak-pre-sidepanel.
//               v4.5 (2026-10-21) : le bouton "Statut" se positionne désormais au-dessus du plus haut des items natifs du bas de menu ("MyU Vision (BÊTA)" ajouté par MyUnisoft + "Nouveautés") au lieu de seulement au-dessus de "Nouveautés", où il recouvrait MyU Vision (findBottomNativeItemsTop). Sauvegarde : premium.js.bak-pre-statut.
//               v4.4 (2026-08-05, diagnostiqué en direct suite au bug remonté par Nicolas sur les
//               colonnes Début/Fin de Saisie Premium qui restaient vides : "RIEN NE S'affiche" /
//               "ca marche toujours pas.") : installApiHeaderSniffer() ne captait le jeton API
//               (lastApiHeaders) QUE depuis les appels faits via XMLHttpRequest. Or les nouveaux
//               appels de saisie-premium.js (résolution cut-off CCA/PCA, cf. son changelog v2.57/
//               v2.58) utilisent fetch(), et rien ne garantit que TOUTE l'appli native le fasse
//               aussi via XHR — confirmé en direct que lastApiHeaders restait bloqué sur un jeton
//               expiré (window.__tmbcDebug.decodeToken() -> expired:true) pendant plusieurs
//               minutes malgré une utilisation active (changement de journal/période). Fix :
//               window.fetch est maintenant AUSSI patché (même principe que balance.js : capture
//               de la référence d'origine, toujours rappelée ensuite, jamais de remplacement
//               complet) pour capter l'Authorization de tout fetch() vers prod-ws.myunisoft.fr,
//               qu'il vienne de l'appli native ou de n'importe quel module de ce projet — dès
//               qu'un seul appel réussit avec un jeton frais, tous les modules qui lisent
//               getApiHeaders() en bénéficient. v4.3 (2026-08-04) : sniffer réseau temporaire (v4.2) retiré — cause du "PJ FOGLIA
//               invisible en Saisie Premium" trouvée via l'onglet Network de DevTools (pas via ce
//               sniffer XHR/fetch, resté muet : le clic PJ natif charge l'aperçu via une balise
//               <img>, jamais capté par un patch XHR/fetch). Root cause + fix réels dans
//               saisie-premium.js v2.52 (champ "pj_list" déjà présent dans la réponse /entries,
//               jamais lu jusque-là).
// v4.1 (2026-08-01) : zoom Electron par défaut à 90% ("un cran zoom -", demande
//               explicite de Nicolas) en Affichage Premium — appliqué une seule fois par
//               chargement de page (defaultZoomApplied), pour ne pas écraser en boucle (scan()
//               tourne toutes les ~1s) un zoom que l'utilisateur ajusterait ensuite lui-même via
//               Ctrl+molette (wireCtrlWheelZoom, déjà existant) : c'est un point de départ, pas
//               un verrou. N'agit qu'en Affichage Premium (branche !isDisabled() de scan()) — en
//               Affichage MyUnisoft natif, le zoom natif à 100% reste inchangé. v4.0 (2026-07-31)
//               : SCISSION DU SCRIPT, demandée par Nicolas — premium.js
//               devenait trop volumineux (4350+ lignes) à force d'accumuler des
//               fonctionnalités spécifiques à une seule page/grille. Découpé en :
//               - premium.js (ce fichier, CORE) : uniquement ce qui est commun à TOUTES
//                 les pages — bouton Premium on/off, widget Statut, icône "agrandir"
//                 (mode pleine largeur), positionnement du menu/de la fenêtre, bouton
//                 "remonter en haut", zoom Ctrl+molette, style de base des tableaux
//                 (bordures/police numérique/en-têtes 2 lignes), utilitaires partagés
//                 (détection couleur du thème, normalisation de noms de colonnes,
//                 formatage de nombres, sniffing du jeton API, etc.), ET l'orchestrateur
//                 commun (scan() + MutationObserver + setInterval) partagé par tous les
//                 modules via window.TMBC.registerScan().
//               - menus.js : modifications du menu latéral (icône active, chevron,
//                 masquage Qonto/Boîte à outils, libellé "Accueil", tooltips menu réduit).
//               - revision.js : Dossier de Révision (renommage des onglets de cycle,
//                 stepper "Editions courantes", en-tête colonne "Elements").
//               - consultation.js : fenêtre de consultation (mise en page scindée
//                 Consultation/Écriture).
//               - suivi-semaine.js : tableau maison "Suivi de vos sociétés" / Semaine.
//               - saisie.js : module "Saisie" (nouvelle écriture).
//               Chaque module est un fichier autonome qui lit les utilitaires partagés
//               sur window.TMBC (rempli par CE fichier, qui doit donc être chargé EN
//               PREMIER parmi les modules "métier", cf. preload.js) et s'enregistre via
//               window.TMBC.registerScan(fn) au lieu de poser son propre
//               MutationObserver/setInterval — un seul scheduler pour toute l'appli,
//               comme l'exigeait déjà la règle du projet ("ne pas recréer plusieurs
//               scripts qui scannent la même page en parallèle").
//               Aucun changement de comportement visé par cette scission : chaque
//               fonction déplacée est une copie verbatim de son ancienne version dans
//               premium.js 3.31, seule leur ORGANISATION change. Historique complet des
//               versions 1.x-3.31 conservé ci-dessous pour référence.
// @author       Nicolas
// @match        https://connect.lgassocies.com/*
// @match        https://*.myunisoft.fr/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      meteo.myunisoft.fr
// @noframes
// ==/UserScript==


(function () {
  'use strict';

  // window.TMBC : namespace partagé, rempli en bas de ce fichier une fois
  // tous les utilitaires définis. Les modules métier (menus.js, revision.js,
  // consultation.js, suivi-semaine.js, saisie.js, et balance.js à terme) le
  // lisent au chargement via une déstructuration (cf. TMBC_TOOLKIT_CONTRACT.md).
  window.TMBC = window.TMBC || {};

  const FLAG_KEY = 'tmbc-scripts-disabled';

  // (2026-07-31) Bascule indépendante du FLAG_KEY : désactive UNIQUEMENT la
  // limitation de largeur .pageContent à 60vw sur écran ultra-large
  // (ULTRAWIDE_STYLE) et le décalage du menu qui va avec
  // (positionDrawerNextToContent), sans désactiver le reste des
  // fonctionnalités Premium — demandé par Nicolas ("agrandir la page sur la
  // totalité de la largeur, comme si on décochait premium, mais en gardant
  // les autres fonctionnalités").
  const WIDE_MODE_KEY = 'tmbc-wide-mode';

  const WIDE_MODE_BTN_ID = 'tmbc-wide-mode-toggle';

  const PREMIUM_BTN_ID = 'tmbc-nch-toggle';

  const METEO_BTN_ID = 'mui-meteo-btn';

  const METEO_DOT_ID = 'mui-meteo-dot';

  const METEO_MODAL_ID = 'mui-meteo-modal';

  const WIDGET_URL = 'https://meteo.myunisoft.fr/widget/compact/';

  const STYLE_ID = 'tmbc-premium-style';


  const STATUS_COLORS = {
    operational: '#10b981',
    degraded: '#f97316',
    partial_outage: '#eab308',
    major_outage: '#f97316',
    maintenance: '#a177ff',
    danger: '#f97316',
  };


  const DEFAULT_MENU_COLOR = 'rgb(23, 42, 70)';


  // (2026-11-12, v4.14) Le bouton PREMIUM de la barre du haut est supprimé :
  // chaque fonctionnalité s'active/désactive désormais dans l'extension. On
  // efface un éventuel ancien drapeau « désactivé » (posé par ce bouton) qui
  // bloquerait sinon tout, sans plus aucun moyen de le réactiver.
  try {
    localStorage.removeItem(FLAG_KEY);
  } catch (e) {
    /* stockage indisponible */
  }

  function isDisabled() {
    return localStorage.getItem(FLAG_KEY) === '1';
  }

  // Réglages de l'extension (fenêtre de l'icône Atelier) : true/false par
  // fonctionnalité ; def = valeur si le réglage n'est pas publié.
  const ATM_SETTINGS = (window.ATM && window.ATM.settings) || {};
  function feature(key, def) {
    return key in ATM_SETTINGS ? !!ATM_SETTINGS[key] : def;
  }

  // Entrée « XXX Premium » ajoutée juste sous une entrée native du méga-menu
  // (clone de l'entrée native, nouveau nœud : rien de natif déplacé). Même
  // technique que Consultation Premium. onClick reçoit nativeLi, pour pouvoir
  // déclencher la navigation native après avoir posé un mode.
  function premiumMenuDossierOpen() {
    const m = /^\/tab\/(\d+)\//.exec(location.pathname);
    return !!(m && m[1] !== '0');
  }
  function closeNativeMegaMenu() {
    const dlg = document.querySelector('.MuiDialog-root:has(.dialogContainer__menu)') || document.querySelector('[role=dialog]');
    if (!dlg) return;
    dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
  }
  function ensurePremiumMenuItem({ nativeId, id, label, onClick, onNativeClick, enabled }) {
    const existing = document.querySelector('li[data-id="' + id + '"]');
    if (!enabled || !premiumMenuDossierOpen()) {
      if (existing) existing.remove();
      return;
    }
    const nativeLi = document.querySelector('li[data-id="' + nativeId + '"]');
    if (!nativeLi) return;
    if (onNativeClick && !nativeLi.dataset.tmbcPremiumHooked) {
      nativeLi.dataset.tmbcPremiumHooked = '1';
      nativeLi.addEventListener('click', () => onNativeClick(), true);
    }
    if (existing) return;
    const li = nativeLi.cloneNode(true);
    li.setAttribute('data-id', id);
    li.removeAttribute('aria-selected');
    li.classList.remove('Mui-selected');
    delete li.dataset.tmbcPremiumHooked;
    const span = li.querySelector('span');
    if (span) span.textContent = label;
    li.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onClick(nativeLi);
    });
    nativeLi.parentElement.insertBefore(li, nativeLi.nextSibling);
  }


  function isWideModeActive() {
    return localStorage.getItem(WIDE_MODE_KEY) === '1';
  }


  function isColorUsable(color) {
    if (!color) return false;
    if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return false;
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return false;
    const [r, g, b] = [+m[1], +m[2], +m[3]];
    if (r > 245 && g > 245 && b > 245) return false;
    return true;
  }


  function detectMenuColor() {
    const candidates = [
      '.MuiDrawer-root .MuiPaper-root',
      '.MuiDrawer-paper',
      'nav.MuiDrawer-root',
      '[class*="Sidebar"]',
      '[class*="sidebar"]',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const bg = getComputedStyle(el).backgroundColor;
      if (isColorUsable(bg)) return bg;
    }
    return DEFAULT_MENU_COLOR;
  }


  function readableTextOn(bgColor) {
    const m = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#fff';
    const [r, g, b] = [+m[1], +m[2], +m[3]];
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#111' : '#fff';
  }


  // (2026-07-31) Distingue thème "noir" (menu gris très foncé/neutre) du
  // thème bleu par défaut — utilisé pour ne toucher qu'au thème bleu sur
  // certains ajustements (barre d'accent du menu, bouton replier/déplier)
  // que Nicolas veut garder inchangés en thème noir. Heuristique : sombre
  // (composante max < 70) ET peu saturé (peu d'écart entre composantes,
  // contrairement au bleu par défaut rgb(23,42,70) qui a un écart net
  // rouge/bleu) plutôt qu'une liste de couleurs exactes, fragile.
  function isMenuColorDarkNeutral(bgColor) {
    const m = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return false;
    const [r, g, b] = [+m[1], +m[2], +m[3]];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    return max < 70 && saturation < 0.25;
  }


  function applyPremiumButtonState(btn) {
    const menuColor = detectMenuColor();
    if (isDisabled()) {
      btn.style.backgroundColor = '#fff';
      btn.style.color = menuColor;
      btn.style.borderColor = menuColor;
      btn.title = 'Scripts MyUnisoft desactives - cliquer pour reactiver';
    } else {
      btn.style.backgroundColor = menuColor;
      btn.style.color = readableTextOn(menuColor);
      btn.style.borderColor = menuColor;
      btn.title = 'Scripts MyUnisoft actives - cliquer pour desactiver';
    }
  }


  function buildPremiumButton() {
    const btn = document.createElement('button');
    btn.id = PREMIUM_BTN_ID;
    btn.type = 'button';
    btn.textContent = 'PREMIUM';
    btn.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'height:34px',
      'min-width:60px',
      'padding:0 12px',
      'margin:0 8px',
      'border-radius:17px',
      'border:2px solid',
      'font-family:Arial,Helvetica,sans-serif',
      'font-size:9px',
      'letter-spacing:.3px',
      'font-weight:700',
      'line-height:1',
      'cursor:pointer',
      'box-sizing:border-box',
      'flex:0 0 auto',
    ].join(';');
    applyPremiumButtonState(btn);
    btn.addEventListener('click', () => {
      if (isDisabled()) localStorage.removeItem(FLAG_KEY);
      else localStorage.setItem(FLAG_KEY, '1');
      location.reload();
    });
    return btn;
  }


  function findSearchButton() {
    const svg = document.querySelector('svg[data-testid="SearchRoundedIcon"]');
    if (!svg) return null;
    return svg.closest('button') || svg.closest('[role="button"]');
  }


  function findToolbarContainerNearAvatar() {
    const avatar = document.querySelector('.MuiAvatar-root');
    if (!avatar) return null;
    let container = avatar.parentElement;
    for (let i = 0; i < 8 && container; i++) {
      const rect = container.getBoundingClientRect();
      if (container.children.length >= 8 && rect.width > 300) return container;
      container = container.parentElement;
    }
    return null;
  }


  function resetFloatingStyles(btn) {
    btn.style.position = '';
    btn.style.top = '';
    btn.style.left = '';
    btn.style.right = '';
    btn.style.zIndex = '';
    btn.style.boxShadow = '';
  }


  function mountFloating() {
    if (document.getElementById(PREMIUM_BTN_ID)) return;
    if (!document.body) return;
    const btn = buildPremiumButton();
    btn.style.position = 'fixed';
    btn.style.top = '8px';
    btn.style.right = '8px';
    btn.style.zIndex = '99999';
    btn.style.boxShadow = '0 2px 6px rgba(0,0,0,.25)';
    document.body.appendChild(btn);
  }


  function scanPremiumButton() {
    const existing = document.getElementById(PREMIUM_BTN_ID);
    const searchBtn = findSearchButton();

    if (searchBtn && searchBtn.parentElement) {
      if (existing && existing.nextElementSibling === searchBtn) {
        applyPremiumButtonState(existing);
        return;
      }
      const btn = existing || buildPremiumButton();
      resetFloatingStyles(btn);
      searchBtn.parentElement.insertBefore(btn, searchBtn);
      return;
    }

    if (existing) {
      applyPremiumButtonState(existing);
      return;
    }

    const container = findToolbarContainerNearAvatar();
    if (container) {
      container.insertBefore(buildPremiumButton(), container.firstChild);
      return;
    }

    mountFloating();
  }


  function getSidebar() {
    return document.querySelector('.MuiDrawer-root .MuiPaper-root');
  }


  // (2026-07-31, demandé par Nicolas) Icône "agrandir" en haut à gauche du
  // menu (sur le carton logo) : bascule WIDE_MODE_KEY, qui désactive
  // uniquement la limitation de largeur .pageContent à 60vw sur écran
  // ultra-large (cf. ULTRAWIDE_STYLE / positionDrawerNextToContent) — pas
  // un simple raccourci vers isDisabled()/FLAG_KEY, qui coupe TOUTES les
  // fonctionnalités Premium ; ici on garde tout le reste actif. Uniquement
  // pertinent en Electron (la restriction 60vw ne s'applique qu'en
  // Electron, cf. ULTRAWIDE_STYLE), donc pas de bouton hors Electron.
  function ensureWideModeButton() {
    if (!isElectron) return;
    const sidebar = getSidebar();
    if (!sidebar) return;

    let btn = document.getElementById(WIDE_MODE_BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = WIDE_MODE_BTN_ID;
      btn.type = 'button';
      btn.style.cssText = [
        'position:absolute',
        'top:8px',
        'left:8px',
        'width:26px',
        'height:26px',
        'padding:0',
        'border:none',
        'border-radius:6px',
        'cursor:pointer',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'z-index:2',
      ].join(';');
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="3" y1="21" x2="10" y2="14"></line>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
        </svg>
      `;
      btn.addEventListener('click', () => {
        if (isWideModeActive()) localStorage.removeItem(WIDE_MODE_KEY);
        else localStorage.setItem(WIDE_MODE_KEY, '1');
        location.reload();
      });
      sidebar.appendChild(btn);
    }

    const active = isWideModeActive();
    btn.title = active ? 'Revenir à la largeur centrée' : 'Agrandir en pleine largeur';
    btn.style.color = '#fff';
    btn.style.background = active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)';
  }


  function fetchStatusColor(callback) {
    window.ATM
      .call('meteo-status')
      .then((classes) => {
        if (!classes) return callback(null);
        for (const cls of classes) {
          if (STATUS_COLORS[cls]) return callback(STATUS_COLORS[cls]);
        }
        callback(null);
      })
      .catch(() => callback(null));
  }


  function updateStatusDot() {
    const dot = document.getElementById(METEO_DOT_ID);
    if (!dot) return;
    fetchStatusColor((color) => {
      if (color) dot.style.background = color;
    });
  }


  function createMeteoModal() {
    if (document.getElementById(METEO_MODAL_ID)) return;
    if (!document.body) return;

    const modal = document.createElement('div');
    modal.id = METEO_MODAL_ID;
    modal.style.position = 'fixed';
    modal.style.width = '340px';
    modal.style.height = '220px';
    modal.style.background = '#fff';
    modal.style.borderRadius = '10px';
    modal.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
    modal.style.zIndex = '9999';
    modal.style.display = 'none';
    modal.style.overflow = 'hidden';

    const menuColor = detectMenuColor();
    modal.innerHTML = `
      <div style="
          height:32px;
          background:${menuColor};
          color:${readableTextOn(menuColor)};
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:0 10px;
          font-size:13px;
      ">
          <span>Meteo</span>
          <button id="mui-meteo-close" style="
              background:none;
              border:none;
              color:inherit;
              cursor:pointer;
              font-size:16px;
          ">x</button>
      </div>
      <iframe
          src="${WIDGET_URL}"
          style="width:100%; height:calc(100% - 32px); border:0;">
      </iframe>
    `;

    document.body.appendChild(modal);
    document.getElementById('mui-meteo-close').onclick = () => (modal.style.display = 'none');
  }


  function toggleMeteoModal() {
    const modal = document.getElementById(METEO_MODAL_ID);
    const btn = document.getElementById(METEO_BTN_ID);
    if (!modal || !btn) return;

    if (modal.style.display === 'block') {
      modal.style.display = 'none';
      return;
    }

    const rect = btn.getBoundingClientRect();
    const modalHeight = 220;
    const padding = 12;

    let top = rect.top;
    const maxTop = window.innerHeight - modalHeight - padding;
    if (top > maxTop) top = maxTop;
    if (top < padding) top = padding;

    modal.style.top = `${top}px`;
    modal.style.left = `${rect.right + padding}px`;
    modal.style.display = 'block';
  }


  // (2026-07-31, demandé par Nicolas) Trouve le bouton natif "Nouveautés",
  // ancré tout en bas du menu (dernier enfant du menu, aligné en bas via
  // align-items:flex-end sur son conteneur flex-grow) — recherché par texte
  // plutôt que par classe, aucune classe stable identifiée pour ce bouton.
  function findNouveautesButton(sidebar) {
    const els = sidebar.querySelectorAll('button, [role="button"], a');
    for (const el of els) {
      if (el.id === METEO_BTN_ID) continue;
      if (/nouveaut/i.test(el.textContent || '')) return el;
    }
    return null;
  }


  // Retourne le "top" (viewport) du plus haut des items natifs ancrés en bas
  // du menu ("MyU Vision", "Nouveautés"), ou null si aucun n'est trouvé.
  function findBottomNativeItemsTop(sidebar) {
    let minTop = null;
    const els = sidebar.querySelectorAll('button, [role="button"], a, li, [role="menuitem"]');
    for (const el of els) {
      if (el.id === METEO_BTN_ID || el.closest('#' + METEO_BTN_ID)) continue;
      const txt = (el.textContent || '').trim();
      if (!txt || txt.length > 40) continue; // exclut les gros conteneurs
      if (!/nouveaut|myu\s*vision/i.test(txt)) continue;
      const r = el.getBoundingClientRect();
      if (!r.height) continue;
      if (minTop === null || r.top < minTop) minTop = r.top;
    }
    return minTop;
  }


  function injectMeteoButton() {
    const sidebar = getSidebar();
    if (!sidebar) return;

    let btn = document.getElementById(METEO_BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = METEO_BTN_ID;
      btn.style.position = 'absolute';
      btn.style.left = '0';
      btn.style.width = '100%';
      btn.style.padding = '6px 10px';
      btn.style.borderRadius = '6px';
      btn.style.border = 'none';
      btn.style.boxSizing = 'border-box';
      btn.style.cursor = 'pointer';
      btn.style.background = 'rgba(255,255,255,0.15)';
      btn.style.color = '#fff';
      btn.style.fontSize = '13px';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'space-between';
      btn.style.zIndex = '1';

      btn.innerHTML = `
          <span>Statut</span>
          <span id="${METEO_DOT_ID}" style="
              width:14px;
              height:14px;
              border-radius:50%;
              background:#9ca3af;
          "></span>
      `;

      btn.onclick = toggleMeteoModal;
      sidebar.appendChild(btn);

      updateStatusDot();
    }

    positionMeteoButton(sidebar, btn);
  }


  // (2026-07-31, demandé par Nicolas : "descend le widget statut ... tout en
  // bas, au dessus de nouveautés") Positionné juste au-dessus du bouton
  // natif "Nouveautés" plutôt qu'à un top fixe (l'ancien top:130px fixe se
  // retrouvait, selon la taille de fenêtre/le contenu du menu, à recouvrir
  // ce bouton natif au lieu de rester dans l'espace vide sous le logo — "il
  // disparait à tort" signalé par Nicolas). Recalculé à chaque scan() pour
  // rester juste si le menu change de hauteur. Repli : juste au-dessus du
  // bord inférieur du menu si "Nouveautés" est introuvable.
  function positionMeteoButton(sidebar, btn) {
    const sbRect = sidebar.getBoundingClientRect();
    const MARGIN = 8;
    const btnHeight = btn.getBoundingClientRect().height || 33;
    // (2026-10-21) MyUnisoft a ajouté un item "MyU Vision (BÊTA)" juste
    // au-dessus de "Nouveautés" : Statut s'affichait par-dessus. On se place
    // désormais au-dessus du PLUS HAUT des items natifs du bas de menu.
    const nouveautes = findBottomNativeItemsTop(sidebar);
    let top;
    if (nouveautes !== null) {
      top = nouveautes - sbRect.top - btnHeight - MARGIN;
    } else {
      top = sbRect.height - btnHeight - MARGIN;
    }
    btn.style.top = Math.max(0, Math.round(top)) + 'px';
  }


  // La fenêtre Electron s'ouvre désormais toujours en plein écran (cf.
  // main.js) — cette règle limite .pageContent à 3/5 (60%) de la largeur,
  // CENTRÉ (contrairement à l'usage navigateur/Tampermonkey classique où le
  // contenu reste aligné à gauche).
  // ATTENTION : centrer le conteneur .page EN ENTIER (menu + contenu
  // ensemble, en changeant sa largeur réelle) casse certaines pages —
  // constaté en direct sur "Vue d'ensemble" (bandes bleues, widgets mal
  // positionnés), probablement des composants qui calculent leur propre
  // largeur en JS avant le rétrécissement CSS et ne se réajustent pas. On
  // centre donc SEULEMENT .pageContent (approche qui ne casse rien), et le
  // menu est repositionné séparément par un simple décalage visuel
  // (transform, cf. positionDrawerNextToContent) qui ne change la largeur
  // réelle d'aucun élément.
  // (2026-11-12, extension Chrome) « isElectron » désigne désormais le mode de mise en
  // page « bureau » (contenu centré à 60vw sur ultra-wide, bouton pleine largeur...),
  // piloté par le réglage « Centrer le contenu » de la fenêtre de l'extension.
  const isElectron = !!(window.ATM && window.ATM.settings && window.ATM.settings.centerLayout);

  // La fenêtre de consultation (.../child/consulting) a sa propre mise en
  // page gérée par applyConsultSplitLayout (plein écran, scindée en 50/50
  // consultation/écriture) — elle ne doit PAS recevoir en plus le centrage
  // à 60vw prévu pour la fenêtre principale, sinon son contenu se retrouve
  // lui-même rétréci et centré à l'intérieur d'une mise en page déjà pensée
  // pour occuper toute la largeur.
  const isConsultWindow = location.pathname.includes('/child/consulting');


  const ULTRAWIDE_STYLE = isConsultWindow || isWideModeActive()
    ? '' // fenêtre de consultation, ou mode "pleine largeur" (WIDE_MODE_KEY) activé : aucune restriction
    : isElectron
    ? `
      @media (min-width: 2200px) {
        .pageContent, main, [role="main"], .MuiContainer-root {
          max-width: 60vw !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        /* .dialogContainer (le contenu du panneau) ET .MuiDialog-paper (le
           VRAI fond blanc du panneau, un élément distinct qui l'englobe et
           s'étire lui aussi nativement sur presque toute la largeur) —
           contraints tous les deux à la largeur de .pageContent, sinon le
           fond blanc déborde largement de chaque côté du contenu même une
           fois celui-ci correctement centré. */
        .dialogContainer, .MuiDialog-paper {
          max-width: 60vw !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        /* .dialogContainer__header s'étire NATIVEMENT sur toute la largeur
           de .dialogContainer (~pleine largeur d'écran sur ultra-wide), et
           son justify-content:space-between écarte donc le titre et la
           croix de fermeture aux deux extrémités opposées — un bug natif de
           MyUnisoft sur très grand écran, indépendant de notre centrage,
           juste jamais visible avant. On force ce header à ne prendre que
           la largeur de son contenu réel, pour garder titre et croix
           proches l'un de l'autre. */
        .dialogContainer__header {
          width: fit-content !important;
          max-width: fit-content !important;
          justify-content: flex-start !important;
          gap: 16px;
        }
        /* BUG CORRIGÉ (2026-07-31, retour de Nicolas : "la partie déclaration
           est anormalement réduite, contrairement aux autres menus") —
           vérifié en direct (inspection DOM réelle) : le méga-menu de
           navigation "Déclarations" (et probablement d'autres menus du même
           type) utilise EXACTEMENT les mêmes classes .dialogContainer /
           .dialogContainer__header que les VRAIS panneaux de contenu qu'on
           veut recentrer/rétrécir à 60vw — mais rendu à l'intérieur d'un
           .MuiDialog-paperFullScreen (contrairement aux dialogs de contenu
           classiques). On neutralise donc nos contraintes de largeur
           uniquement pour ce cas plein écran, en réappliquant après-coup
           (règle plus spécifique, même !important, l'emporte à priorité
           égale car déclarée après). */
        .MuiDialog-paperFullScreen .dialogContainer,
        .MuiDialog-paperFullScreen .dialogContainer__header {
          max-width: none !important;
          width: auto !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          justify-content: space-between !important;
        }
        /* (2026-10-22, "quand je clique sur MyU Vision, la fenêtre se met à
           gauche") Quand un panneau latéral natif est ouvert (MyU Vision :
           2e MuiDrawer docké, normalement de largeur 0), le centrage à 60vw
           + le décalage du menu le faisaient apparaître à gauche, tronqué.
           positionDrawerNextToContent() pose la classe tmbc-side-panel-open
           sur <html> dans ce cas : on rend alors sa mise en page au natif
           (même rendu que le mode "pleine largeur", qui fonctionnait). */
        /* tmbc 2026-10-22 : méga-menus en haut */
  .MuiDialog-paperFullScreen .dialogContainer{justify-content:flex-start!important}
  /* (v4.15) panneau compact des méga-menus (2026-10-22) retiré : rendu natif. */
  html.tmbc-side-panel-open .pageContent,
        html.tmbc-side-panel-open main,
        html.tmbc-side-panel-open [role="main"],
        html.tmbc-side-panel-open .MuiContainer-root,
        html.tmbc-side-panel-open .dialogContainer,
        html.tmbc-side-panel-open .MuiDialog-paper {
          max-width: none !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
      }
    `
    : `
      @media (min-width: 2200px) {
        .pageContent, main, [role="main"], .MuiContainer-root {
          max-width: 60vw !important;
          margin-left: 0 !important;
          margin-right: auto !important;
        }
        .dialogContainer__menu, .dialogContainer__header {
          max-width: 60vw !important;
          margin-left: 0 !important;
          margin-right: auto !important;
        }
        /* cf. commentaire équivalent ci-dessus (branche isElectron) : le
           méga-menu "Déclarations" (.MuiDialog-paperFullScreen) ne doit pas
           recevoir cette contrainte de largeur. */
        .MuiDialog-paperFullScreen .dialogContainer__menu,
        .MuiDialog-paperFullScreen .dialogContainer__header {
          max-width: none !important;
          width: auto !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
      }
    `;



  // --- DIAGNOSTIC TEMPORAIRE (2026-10-22) : Ctrl+Alt+D --------------------
  // Écrit diag-N.txt + diag-N.png (à côté de main.js) : champs d'en-tête de la
  // Saisie (Année/Mois/Période/Journal/Devise) et arbre du méga-menu plein
  // écran (Déclarations/Paramètres), avec styles calculés. À RETIRER ensuite.
  let diagKeyInstalled = false;
  function installDiagKey() {
    if (diagKeyInstalled) return;
    diagKeyInstalled = true;
    document.addEventListener(
      'keydown',
      (ev) => {
        if (!(ev.ctrlKey && ev.altKey && (ev.key === 'd' || ev.key === 'D'))) return;
        try {
          const lines = ['DIAG ' + new Date().toISOString() + ' url=' + location.pathname + ' iw=' + innerWidth + ' ih=' + innerHeight, 'html.class ' + document.documentElement.className];
          const fmt = (e) => {
            const r = e.getBoundingClientRect();
            const cs = getComputedStyle(e);
            return [e.tagName, String(e.className).replace(/css-\w+/g, '').slice(0, 45), 'rect=' + [r.left, r.top, r.width, r.height].map(Math.round).join(','), 'pos=' + cs.position, 'left=' + cs.left, 'top=' + cs.top, 'vis=' + cs.visibility, 'disp=' + cs.display, 'mt=' + cs.marginTop, 'ml=' + cs.marginLeft, 'ai=' + cs.alignItems, 'as=' + cs.alignSelf, 'jc=' + cs.justifyContent, 'fd=' + cs.flexDirection, 'mark=' + (e.getAttribute('data-tmbc-premium-hidden') || '')].join(' | ');
          };
          ['Année', 'Mois', 'Période (mm/aaaa)', 'Journal', 'Devise'].forEach((t) => {
            Array.from(document.querySelectorAll('body *'))
              .filter((el) => el.children.length === 0 && el.textContent.trim() === t)
              .slice(0, 3)
              .forEach((el) => {
                lines.push('LABEL "' + t + '" ' + fmt(el));
                let a = el.parentElement;
                for (let i = 0; i < 4 && a && a !== document.body; i++, a = a.parentElement) lines.push('   ANC' + i + ' ' + fmt(a));
              });
          });
          ['tmbc-saisie-period-field', 'tmbc-saisie-mois-relocated-label'].forEach((id) => {
            const el = document.getElementById(id);
            lines.push('OURS#' + id + ' ' + (el ? fmt(el) : 'absent'));
          });
          const m = document.querySelector('.MuiDialog-paperFullScreen');
          if (m) {
            lines.push('--- MEGA MENU ---');
            const walk = (e, d) => {
              if (d > 6) return;
              lines.push('  '.repeat(d) + fmt(e));
              Array.from(e.children).slice(0, 8).forEach((c) => walk(c, d + 1));
            };
            walk(m, 0);
          }
          const gl = document.getElementById('tmbc-gl-panel');
          if (gl) {
            lines.push('--- GRAND LIVRE ---');
            const tr = gl.querySelector('tr.tot');
            if (tr) {
              lines.push('TOT HTML: ' + tr.outerHTML.slice(0, 1500));
              Array.from(tr.children).forEach((td, i) => {
                const cs = getComputedStyle(td);
                const r = td.getBoundingClientRect();
                lines.push('td' + i + ' text=' + td.textContent + ' ta=' + cs.textAlign + ' dir=' + cs.direction + ' disp=' + cs.display + ' pad=' + cs.paddingLeft + '/' + cs.paddingRight + ' rect=' + [r.left, r.top, r.width, r.height].map(Math.round).join(',') + ' fam=' + cs.fontFamily.slice(0, 30));
              });
            }
          }
          window.ATM.diag(lines.join('\n'));
        } catch (err) {
          console.log('[diag] erreur', err);
        }
      },
      true
    );
  }



  // Repositionne le menu de gauche (.MuiDrawer-root.MuiDrawer-docked) juste
  // à côté de .pageContent une fois celui-ci centré — un simple décalage
  // visuel (transform), qui ne modifie la largeur réelle d'aucun élément et
  // ne perturbe donc pas les widgets qui mesurent leur propre taille en JS.
  function positionDrawerNextToContent() {
    if (!isElectron || isConsultWindow) return; // inutile en Electron sur la fenêtre de consultation
    const media = window.matchMedia('(min-width: 2200px)');
    // Le menu de gauche = le drawer docké qui contient le papier de navigation
    // (getSidebar()), PAS simplement le premier drawer docké : un panneau latéral
    // (MyU Vision) est lui aussi un MuiDrawer docké.
    const sidebarPaper = getSidebar();
    const drawer = sidebarPaper ? sidebarPaper.closest('.MuiDrawer-root') : null;
    const content = document.querySelector('.pageContent');
    if (!drawer || !content) return;

    // Panneau latéral ouvert ? (autre drawer docké ayant une vraie largeur)
    // MyU Vision = <div role="dialog" aria-label="MyU Vision" aria-hidden="false">
    // (constaté via l'inspecteur, classes myu-vision-*). Il est (ou est placé
    // dans) un descendant du menu : le translateX qu'on applique au menu le
    // décale/rogne donc avec lui, d'où le panneau tronqué à gauche. Tant qu'il
    // est ouvert, on ne translate plus le menu.
    // Diagnostic réel (2026-10-22) : MyU Vision est le custom element
    // <myu-vision-chat> (shadow DOM, donc invisible à document.querySelector),
    // rendu DANS le papier du menu de gauche (position:fixed). Notre translateX
    // sur le menu en fait le bloc conteneur du panneau (fixed relatif au menu
    // transformé) et son overflow:hidden le rogne : panneau décalé/tronqué.
    const myuHost = document.querySelector('myu-vision-chat');
    const myuDialog = myuHost && myuHost.shadowRoot && myuHost.shadowRoot.querySelector('[role="dialog"]');
    const myuVisionOpen =
      !!myuDialog &&
      myuDialog.getAttribute('aria-hidden') !== 'true' &&
      myuDialog.getBoundingClientRect().width > 50;
    const otherOpen =
      myuVisionOpen ||
      Array.from(document.querySelectorAll('.MuiDrawer-root.MuiDrawer-docked')).some(
        (d) => d !== drawer && d.getBoundingClientRect().width > 8
      );
    if (document.documentElement.classList.contains('tmbc-side-panel-open') !== otherOpen) {
      document.documentElement.classList.toggle('tmbc-side-panel-open', otherOpen);
      console.log('[side-panel] panneau latéral ' + (otherOpen ? 'ouvert' : 'fermé'));
    }
    if (otherOpen) {
      drawer.style.removeProperty('transform');
      return;
    }

    if (!media.matches || isWideModeActive()) {
      // Écran normal, ou mode "pleine largeur" (WIDE_MODE_KEY) activé : pas
      // de centrage actif, on annule tout décalage résiduel.
      drawer.style.removeProperty('transform');
      return;
    }

    const contentRect = content.getBoundingClientRect();
    const drawerRect = drawer.getBoundingClientRect();
    // drawerRect tient déjà compte d'un transform précédent : on calcule le
    // décalage à partir de la position SANS transform pour ne pas cumuler
    // les décalages d'un passage à l'autre.
    const currentTransform = drawer.style.transform;
    let baseLeft = drawerRect.left;
    if (currentTransform) {
      const match = /translateX\(([-\d.]+)px\)/.exec(currentTransform);
      if (match) baseLeft -= parseFloat(match[1]);
    }
    const offset = contentRect.left - (baseLeft + drawerRect.width);
    drawer.style.setProperty('transform', `translateX(${Math.round(offset)}px)`, 'important');
  }


  function injectPremiumStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const menuColor = detectMenuColor();
    const menuText = readableTextOn(menuColor);

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      ${feature('gridLines', true) ? `
      table:not(.tmb-table) td, table:not(.tmb-table) th,
      .bodyRow > div, [class*="headerCell"]:not([class*="Content"]) {
        border-right: 1px solid #d9dee5 !important;
        box-sizing: border-box;
      }
      table:not(.tmb-table) td:last-child, table:not(.tmb-table) th:last-child,
      .bodyRow > div:last-child, [class*="headerCell"]:not([class*="Content"]):last-child {
        border-right: none !important;
      }
      [class*="headerCellContent"] {
        border-right: none !important;
      }
      .MuiDataGrid-cell, .MuiDataGrid-columnHeader {
        border-right: 1px solid #d9dee5 !important;
        box-sizing: border-box;
      }
      .MuiDataGrid-cell:last-of-type, .MuiDataGrid-columnHeader:last-of-type {
        border-right: none !important;
      }

      /* Léger espace entre le texte/la valeur et la ligne verticale de
         séparation des colonnes, quel que soit le type de tableau
         (jamais collé au bord). box-sizing:border-box déjà posé ci-dessus
         garantit que ce padding ne fait pas déborder les largeurs fixes. */
      table:not(.tmb-table) td, table:not(.tmb-table) th,
      .bodyRow > div, [class*="headerCell"]:not([class*="Content"]),
      .MuiDataGrid-cell, .MuiDataGrid-columnHeader {
        padding-left: 6px !important;
        padding-right: 6px !important;
      }
      ` : ''}

      ${feature('monoFont', true) ? `
      .tmbc-numeric {
        font-family: Consolas, "Courier New", monospace !important;
        font-variant-numeric: tabular-nums;
      }
      .tmbc-mono-font {
        font-family: Consolas, "Courier New", monospace !important;
        font-variant-numeric: tabular-nums;
      }
      ` : ''}

      /* En-têtes de colonnes sur 2 lignes plutôt que tronqués avec "..."
         (ex. "Référence dossier", "Expert comptable") — la grille native
         limite nativement à une seule ligne avec ellipsis. */
      [class*="headerCellContent"] {
        white-space: normal !important;
        overflow: visible !important;
        text-overflow: clip !important;
        line-height: 1.15 !important;
        word-break: break-word;
      }

      /* Centrage vertical du contenu de l'en-tête (utile une fois le texte
         passé sur 2 lignes ci-dessus). ATTENTION :
         - ne PAS forcer une hauteur explicite ici (ex. height:46px) — testé
           en direct, ça provoque la disparition de tous les en-têtes sauf
           le premier, probablement un conflit avec le calcul JS interne de
           la grille (virtualisation, positions calculées en supposant une
           hauteur de ligne fixe à 32px). La ligne s'agrandit déjà
           naturellement toute seule grâce au retour à la ligne ci-dessus.
         - "display: flex" (sans inline-) fait de chaque cellule un bloc de
           niveau bloc — comme le conteneur parent ne les empile pas
           lui-même horizontalement (il comptait sur inline-block d'origine
           pour l'écoulement des colonnes côte à côte), les cellules se
           retrouvaient chacune sur sa propre ligne (colonnes empilées
           verticalement). "inline-flex" corrige ça : centrage vertical du
           texte À L'INTÉRIEUR de chaque cellule, tout en gardant les
           cellules elles-mêmes côte à côte comme avant. */
      .vtHeader [data-role="cell"] {
        display: inline-flex !important;
        align-items: center !important;
      }
      .vtHeader [class*="headerCell"]:not([class*="Content"]) {
        display: inline-flex !important;
        align-items: center !important;
      }

      /* Icone de tri retiree dans tous les tableaux (2026-07-30) — le tri au
         clic sur l'entete reste actif, seul l'indicateur visuel disparait.
         .icon-tri : grille native "vtHeader" (ex. Suivi de vos societes).
         .MuiDataGrid-sortIcon / svg [ArrowUpward|ArrowDownward]Icon : grilles
         MUI DataGrid eventuelles ailleurs dans l'appli. */
      .icon-tri,
      .MuiDataGrid-sortIcon,
      svg[data-testid="ArrowUpwardIcon"],
      svg[data-testid="ArrowDownwardIcon"] {
        display: none !important;
      }

      ${ULTRAWIDE_STYLE}

      .MuiTab-root, .MuiToggleButton-root, .MuiButton-outlined[role="tab"] {
        background: #fff !important;
        color: ${menuColor} !important;
        border: 1px solid ${menuColor} !important;
        font-weight: 500;
      }
      .MuiTab-root.Mui-selected,
      .MuiToggleButton-root.Mui-selected,
      [aria-selected="true"].MuiTab-root,
      [aria-selected="true"].MuiButton-outlined {
        background: ${menuColor} !important;
        color: ${menuText} !important;
        font-weight: 700 !important;
        border-color: ${menuColor} !important;
      }

      .tmbc-menu-tooltip {
        position: fixed;
        background: ${menuColor};
        color: ${menuText};
        font-size: 12px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 4px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 100000;
        box-shadow: 0 2px 6px rgba(0,0,0,.25);
      }
    `;
    document.head.appendChild(style);
  }


  function removePremiumStyle() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }


  const NUMERIC_RE = /^[+-]?[\d\s .]+([,.]\d+)?\s?%?$/;

  const DATE_RE = /^\d{2}\/\d{2}\/\d{2,4}$/;


  function tagNumericCells(root) {
    const cells = root.querySelectorAll('td:not(.tmbc-scanned), .bodyRow > div:not(.tmbc-scanned)');
    cells.forEach((cell) => {
      cell.classList.add('tmbc-scanned');
      const text = cell.textContent.trim();
      // (v4.18) les DATES ne reçoivent plus la police mono (Consolas) : plus large que la
      // police native, elle débordait d'une colonne native dimensionnée pour cette dernière
      // (colonne Date de la saisie tronquée « 26/10/202… »). Seuls les montants restent mono.
      if (text && /\d/.test(text) && NUMERIC_RE.test(text) && !DATE_RE.test(text)) {
        cell.classList.add('tmbc-numeric');
      }
    });
  }


  const MONTHS = {
    janvier: '01', janv: '01', jan: '01',
    fevrier: '02', fevr: '02', fev: '02',
    mars: '03', mar: '03',
    avril: '04', avr: '04',
    mai: '05',
    juin: '06',
    juillet: '07', juil: '07', juill: '07',
    aout: '08',
    septembre: '09', sept: '09', sep: '09',
    octobre: '10', oct: '10',
    novembre: '11', nov: '11',
    decembre: '12', dec: '12',
  };


  function stripAccents(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }


  function detectYearContext() {
    const periodInput = document.querySelector('input[name="period"]');
    if (periodInput && /^\d{4}$/.test(periodInput.value)) {
      return { singleYear: +periodInput.value };
    }
    const m = document.body.innerText.match(
      /Du\s+(\d{2})\/(\d{2})\/(\d{4})\s+au\s+(\d{2})\/(\d{2})\/(\d{4})/
    );
    if (m) {
      return {
        rangeStart: { month: +m[2], year: +m[3] },
        rangeEnd: { month: +m[5], year: +m[6] },
      };
    }
    return null;
  }


  function yearForMonth(monthNum, ctx) {
    if (!ctx) return null;
    if (ctx.singleYear) return ctx.singleYear;
    const { rangeStart, rangeEnd } = ctx;
    if (rangeStart.month <= rangeEnd.month) return rangeStart.year;
    return monthNum >= rangeStart.month ? rangeStart.year : rangeEnd.year;
  }


  function replaceMonthTextIn(container, ctx) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const raw = node.textContent.trim();
      if (!raw) continue;
      const norm = stripAccents(raw).toLowerCase().replace(/\.$/, '');
      const mm = MONTHS[norm];
      if (mm) {
        const yy = yearForMonth(+mm, ctx);
        node.textContent = yy ? mm + '/' + String(yy).slice(-2) : mm;
      }
    }
  }


  function frenchifyMonthHeaders() {
    const ctx = detectYearContext();
    document.querySelectorAll('[class*="headerCellContent"]:not(.tmbc-month-done)').forEach((span) => {
      replaceMonthTextIn(span, ctx);
      span.classList.add('tmbc-month-done');
    });
    document.querySelectorAll('table:not(.tmb-table) th:not(.tmbc-month-done)').forEach((th) => {
      replaceMonthTextIn(th, ctx);
      th.classList.add('tmbc-month-done');
    });
  }


  const DOSSIER_MAX_CHARS = 40;

  let dossierMaxWidthPx = null;


  function measureDossierMaxWidth(font) {
    if (dossierMaxWidthPx) return dossierMaxWidthPx;
    const canvas = document.createElement('canvas');
    const ctx2d = canvas.getContext('2d');
    ctx2d.font = font || '13px Arial';
    dossierMaxWidthPx = Math.ceil(ctx2d.measureText('M'.repeat(DOSSIER_MAX_CHARS)).width) + 24;
    return dossierMaxWidthPx;
  }


  function capDossierColumnWidth() {
    const headerCells = document.querySelectorAll('[class*="headerCell"]:not([class*="Content"])');
    let dossierHeader = null;
    headerCells.forEach((h) => {
      if (!dossierHeader && h.textContent.trim() === 'Dossier') dossierHeader = h;
    });
    if (!dossierHeader || dossierHeader.dataset.tmbcWidthCapped) return;

    const sampleBodyCell = document.querySelector('.bodyRow > div');
    const bodyCellFont = sampleBodyCell ? getComputedStyle(sampleBodyCell).font : getComputedStyle(dossierHeader).font;
    const maxWidthPx = measureDossierMaxWidth(bodyCellFont);

    const currentWidth = dossierHeader.getBoundingClientRect().width;
    if (currentWidth <= maxWidthPx) {
      dossierHeader.dataset.tmbcWidthCapped = '1';
      return;
    }

    const colIndex = Array.from(dossierHeader.parentElement.children).indexOf(dossierHeader);
    dossierHeader.style.width = maxWidthPx + 'px';
    dossierHeader.style.maxWidth = maxWidthPx + 'px';
    document.querySelectorAll('.bodyRow').forEach((row) => {
      const cell = row.children[colIndex];
      if (cell) {
        cell.style.width = maxWidthPx + 'px';
        cell.style.maxWidth = maxWidthPx + 'px';
      }
    });
    dossierHeader.dataset.tmbcWidthCapped = '1';
  }


  const LEFT_TEXT_COLUMN_NAMES = new Set(
    [
      'intitule',
      'intitule du compte',
      'piece 1',
      'piece 2',
      'reference dossier',
      'utilisateur',
      'profil',
      'nom',
      'prenom',
      'groupe bancaire',
      'libelle',
      'n° cpte',
      'n° compte',
      'numero de compte',
      'dossier',
      'elements',
    ].map(normalizeColumnName)
  );

  const MONO_FONT_COLUMN_NAMES = new Set(
    [
      'reference dossier',
      'id dossier',
      'siren/siret',
      'n° cpte',
      'n° compte',
      'numero de compte',
      'date',
      'debit',
      'credit',
      'solde',
      'montant',
    ].map(normalizeColumnName)
  );

  // Colonnes toujours centrées quel que soit leur contenu (icônes PJ /
  // commentaire notamment), prioritaire sur la classification texte/numérique
  // habituelle et sur LEFT_TEXT_COLUMN_NAMES.
  // REGLE (2026-07-30) : le centrage n'est plus le comportement PAR DEFAUT
  // d'une colonne texte (cf. styleDataCell/centerGridHeaderCell plus bas, qui
  // alignent maintenant à gauche par défaut) — seules les colonnes listées ICI
  // restent centrées. Ajouter un nom (normalisé : minuscule, sans accents) à
  // cette liste pour chaque nouvelle exception communiquée.
  const FORCE_CENTER_COLUMN_NAMES = new Set(
    ['pj', 'commentaire', 'commentaires', 'commentaire(s)'].map(normalizeColumnName)
  );

  // Certaines colonnes (ex. la colonne "libellé de poste" des états
  // financiers/Bilan) n'ont AUCUN libellé d'en-tête visible — impossible de
  // les repérer par nom. On les repère alors par leur data-column-key
  // technique à la place (ex. "titre", vu en direct sur la page Bilan
  // actif/passif/Compte de résultat).
  const LEFT_TEXT_COLUMN_KEYS = new Set(['titre']);


  function normalizeColumnName(s) {
    return stripAccents((s || '').trim().toLowerCase()).replace(/\s+/g, ' ');
  }


  function columnCategoryFor(name, key) {
    const n = normalizeColumnName(name);
    const keyMatch = key && LEFT_TEXT_COLUMN_KEYS.has(String(key).toLowerCase());
    return {
      left: LEFT_TEXT_COLUMN_NAMES.has(n) || !!keyMatch,
      mono: MONO_FONT_COLUMN_NAMES.has(n),
      forceCenter: FORCE_CENTER_COLUMN_NAMES.has(n),
    };
  }


  const PURE_NUMBER_RE = /^-?\d[\d\s\u00A0]*([.,]\d+)?$/;


  function classifyCellValue(text) {
    const t = text.trim();
    if (!t) return null;
    return PURE_NUMBER_RE.test(t) ? 'numeric' : 'text';
  }


  function formatThousands(numStr) {
    const clean = numStr.replace(/[\s\u00A0]/g, '');
    const neg = clean.startsWith('-');
    let rest = neg ? clean.slice(1) : clean;
    const decimalMatch = rest.match(/([.,]\d+)$/);
    let decimalPart = '';
    if (decimalMatch) {
      decimalPart = decimalMatch[1];
      rest = rest.slice(0, rest.length - decimalPart.length);
    }
    const withSep = rest.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
    return (neg ? '-' : '') + withSep + decimalPart;
  }


  function replaceCellLeafText(cell, newText) {
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.textContent.trim()) node = walker.nextNode();
    if (node && node.textContent.trim() !== newText) node.textContent = newText;
  }


  function centerInnerFlexContainers(cell) {
    cell.querySelectorAll('*').forEach((el) => {
      const display = getComputedStyle(el).display;
      if ((display === 'flex' || display === 'inline-flex') && el.style.justifyContent !== 'center') {
        el.style.justifyContent = 'center';
      }
    });
  }


  // Force l'alignement en !important : un style inline classique
  // (cell.style.textAlign = ...) ne bat pas une règle CSS !important de
  // l'appli native — setProperty avec la priorité 'important' le permet.
  function setAlign(el, value) {
    // (2026-10-22) le panneau Grand livre gère lui-même ses alignements (cellules vides ou
    // montants à 0,00 des lignes de total remis à gauche par cet aligneur générique).
    if (el.closest && el.closest('#tmbc-gl-panel, #tmbc-glp-root, #tmbc-cp-panel, #tmb-root')) return;
    el.style.setProperty('text-align', value, 'important');
  }


  // Le texte d'un en-tête est souvent rendu à l'intérieur d'un <button>
  // (bouton de tri de colonne) — les navigateurs appliquent
  // "text-align: center" par défaut DIRECTEMENT sur tout <button>, ce qui
  // n'est PAS une valeur héritée et bat donc l'alignement posé sur le <div>
  // parent, même en !important. On force l'alignement aussi sur le bouton
  // (et le span de libellé) pour couvrir ce cas.
  function setAlignDeep(el, value) {
    setAlign(el, value);
    el.querySelectorAll('button, [class*="headerCellContent"]').forEach((child) => setAlign(child, value));
  }


  function styleDataCell(cell, colName, colKey) {
    if (cell.closest && cell.closest('#tmbc-gl-panel, #tmbc-glp-root, #tmbc-cp-panel, #tmb-root')) return;
    const cat = columnCategoryFor(colName, colKey);
    if (cat.mono) {
      cell.classList.add('tmbc-mono-font');
    }
    if (cat.forceCenter) {
      setAlignDeep(cell, 'center');
      centerInnerFlexContainers(cell);
      return;
    }
    if (cat.left) {
      setAlignDeep(cell, 'left');
      return;
    }
    // REGLE (2026-07-30) : plus de centrage par défaut. Une cellule "icône
    // seule" (pas de texte, des enfants) ou une cellule texte classique
    // restent désormais alignées à gauche, comme LEFT_TEXT_COLUMN_NAMES —
    // seul FORCE_CENTER_COLUMN_NAMES (traité plus haut) centre encore.
    const text = cell.textContent.trim();
    if (!text && cell.children.length > 0) {
      setAlignDeep(cell, 'left');
      return;
    }
    const kind = classifyCellValue(text);
    if (!kind) return;
    if (kind === 'numeric') {
      setAlignDeep(cell, 'right');
      cell.classList.add('tmbc-numeric');
      const formatted = formatThousands(text);
      if (formatted !== text) replaceCellLeafText(cell, formatted);
    } else {
      setAlignDeep(cell, 'left');
    }
  }


  // Centre un en-tête de colonne — réservé aux colonnes FORCE_CENTER
  // désormais (cf. règle 2026-07-30 : plus de centrage par défaut).
  function centerGridHeaderCell(headerCell) {
    setAlignDeep(headerCell, 'center');
    const btn = headerCell.querySelector('button');
    if (btn && btn.style.justifyContent !== 'center') btn.style.justifyContent = 'center';
  }


  // Le textContent du wrapper "headerCell" peut inclure des éléments
  // additionnels (icônes de tri, tooltips) en plus du libellé visible ; on
  // lit en priorité le span [class*="headerCellContent"] qui ne contient
  // que le texte réellement affiché (ex. "Intitulé", "PJ", "Commentaire(s)").
  function getHeaderLabelText(headerCell) {
    const contentEl = headerCell.querySelector('[class*="headerCellContent"]');
    return (contentEl || headerCell).textContent.trim();
  }


  // data-column-key ("label", "comments", "document_entries", ...) est un
  // identifiant STABLE posé à la fois sur la cellule d'en-tête et sur la
  // cellule de donnée correspondante — contrairement à une correspondance
  // par position dans une liste globale (document.querySelectorAll), qui se
  // désynchronise dès que plusieurs grilles/onglets existent en même temps
  // dans le DOM (constaté en direct : "Intitulé"/"Commentaire(s)" recevaient
  // le style d'une tout autre colonne). On construit donc une table
  // key -> libellé à partir des en-têtes, puis chaque cellule de donnée se
  // résout via sa propre clé, sans jamais dépendre de sa position.
  function buildColumnKeyToNameMap() {
    const map = {};
    document.querySelectorAll('[class*="headerCell"]:not([class*="Content"])').forEach((h) => {
      const cellWrapper = h.closest('[data-column-key]');
      if (!cellWrapper) return;
      const key = cellWrapper.getAttribute('data-column-key');
      if (key && !map[key]) map[key] = getHeaderLabelText(h);
    });
    return map;
  }


  function styleDataColumnsGrid() {
    const columnKeyToName = buildColumnKeyToNameMap();

    // En-têtes : résolus via leur propre data-column-key quand disponible.
    document.querySelectorAll('[class*="headerCell"]:not([class*="Content"])').forEach((h) => {
      const cellWrapper = h.closest('[data-column-key]');
      const key = cellWrapper && cellWrapper.getAttribute('data-column-key');
      const name = key ? columnKeyToName[key] : getHeaderLabelText(h);
      const cat = columnCategoryFor(name, key);
      // Colonne technique sans clé (case à cocher, etc.) et sans règle
      // connue : on ne la touche pas, comme avant.
      if (!key && !cat.left && !cat.forceCenter) return;
      if (cat.forceCenter) {
        centerGridHeaderCell(h);
      } else {
        // cat.left ou défaut (2026-07-30) : plus de centrage par défaut.
        setAlignDeep(h, 'left');
      }
    });

    // Cellules de données portant data-column-key : correspondance directe
    // et fiable, sans dépendre de leur position dans la ligne. Le nom peut
    // être vide (en-tête sans libellé visible, ex. colonne "titre" du
    // Bilan) — on continue quand même, columnCategoryFor peut classer la
    // colonne via sa clé technique même sans nom.
    document.querySelectorAll('.bodyRow > [data-column-key]').forEach((cell) => {
      const key = cell.getAttribute('data-column-key');
      const name = columnKeyToName[key];
      if (!name && !LEFT_TEXT_COLUMN_KEYS.has(String(key).toLowerCase())) return;
      styleDataCell(cell, name, key);
    });

    // Repli pour les lignes qui n'auraient PAS data-column-key (autres
    // grilles éventuelles) : ancien comportement positionnel, uniquement
    // sur les lignes concernées.
    const headerCellsPositional = Array.from(
      document.querySelectorAll('[class*="headerCell"]:not([class*="Content"])')
    );
    const headerNamesPositional = headerCellsPositional.map((h) => getHeaderLabelText(h));
    document.querySelectorAll('.bodyRow').forEach((row) => {
      if (row.querySelector('[data-column-key]')) return; // déjà traité ci-dessus
      Array.from(row.children).forEach((cell, i) => {
        const cat = columnCategoryFor(headerNamesPositional[i]);
        if (i === 0 && !cat.left && !cat.forceCenter) return;
        styleDataCell(cell, headerNamesPositional[i]);
      });
    });
  }


  function styleDataColumnsTable() {
    document.querySelectorAll('table').forEach((table) => {
      if (table.classList.contains('tmb-table')) return;
      const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
      if (!headerRow) return;
      const headerNames = Array.from(headerRow.children).map((th) => getHeaderLabelText(th));
      Array.from(headerRow.children).forEach((th, i) => {
        const cat = columnCategoryFor(headerNames[i]);
        if (i === 0 && !cat.left && !cat.forceCenter) return;
        if (cat.forceCenter) {
          setAlignDeep(th, 'center');
        } else {
          // cat.left ou défaut (2026-07-30) : plus de centrage par défaut.
          setAlignDeep(th, 'left');
        }
      });
      table.querySelectorAll('tbody tr').forEach((row) => {
        Array.from(row.children).forEach((cell, i) => {
          const cat = columnCategoryFor(headerNames[i]);
          if (i === 0 && !cat.left && !cat.forceCenter) return;
          styleDataCell(cell, headerNames[i]);
        });
      });
    });
  }


  function styleDataColumnsMuiGrid() {
    document.querySelectorAll('.MuiDataGrid-root').forEach((grid) => {
      const fieldToName = {};
      grid.querySelectorAll('.MuiDataGrid-columnHeader[data-field]').forEach((h) => {
        const titleEl = h.querySelector('.MuiDataGrid-columnHeaderTitle');
        fieldToName[h.getAttribute('data-field')] = (titleEl ? titleEl.textContent : h.textContent).trim();
      });
      grid.querySelectorAll('.MuiDataGrid-cell[data-field]').forEach((cell) => {
        const field = cell.getAttribute('data-field');
        const name = fieldToName[field];
        if (!name) return;
        const cat = columnCategoryFor(name);
        if (cat.mono) cell.classList.add('tmbc-mono-font');
        if (cat.forceCenter) {
          setAlignDeep(cell, 'center');
        } else if (cat.left) {
          setAlignDeep(cell, 'left');
        }
      });
    });
  }


  function styleDataColumns() {
    styleDataColumnsGrid();
    styleDataColumnsTable();
    styleDataColumnsMuiGrid();
  }


  function getActiveDossierTabId() {
    const m = location.pathname.match(/\/tab\/(\d+)\//);
    return m ? 'tab-' + m[1] : null;
  }


  function highlightActiveDossierTab() {
    const menuColor = detectMenuColor();
    const menuText = readableTextOn(menuColor);
    const activeId = getActiveDossierTabId();

    const companyButtons = Array.from(document.querySelectorAll('.navBar .YpwYqA button[data-id]')).filter((b) =>
      /^ID:\s*\d+/.test(b.getAttribute('aria-label') || '')
    );
    // Bouton "maison" (data-id="tab--2") : pas d'aria-label "ID: N" donc
    // exclu du filtre ci-dessus par construction — géré séparément, actif
    // quand AUCUN onglet société n'est actif (URL sans /tab/<id>/, ex. vue
    // globale hors contexte d'un dossier précis).
    const homeButton = document.querySelector('.navBar .YpwYqA button[data-id="tab--2"]');

    function styleActive(btn) {
      btn.style.setProperty('background-color', menuColor, 'important');
      btn.style.setProperty('color', menuText, 'important');
      btn.style.fontWeight = '700';
      btn.style.setProperty('border', '1px solid ' + menuColor, 'important');
    }
    function styleInactive(btn) {
      btn.style.setProperty('background-color', '#fff', 'important');
      btn.style.setProperty('color', menuColor, 'important');
      btn.style.fontWeight = '500';
      btn.style.setProperty('border', '1px solid ' + menuColor, 'important');
    }

    companyButtons.forEach((btn) => {
      const isActive = btn.getAttribute('data-id') === activeId;
      isActive ? styleActive(btn) : styleInactive(btn);
    });

    if (homeButton) {
      const isHomeActive = !activeId; // aucun onglet société actif -> la maison l'est
      isHomeActive ? styleActive(homeButton) : styleInactive(homeButton);
    }
  }


  // --- Bouton flottant "remonter en haut" (2026-07-30) ------------------
  // Remonte en haut aussi bien le scroll de la fenêtre (window) que celui
  // d'un éventuel conteneur interne scrollé (.pageContent, [role="main"],
  // ou tout ancêtre scrollable trouvé sous la souris) — certaines pages font
  // défiler un <div> interne plutôt que la fenêtre elle-même.
  const SCROLL_TOP_BTN_ID = 'tmbc-scroll-top-btn';


  function findScrolledContainers() {
    const candidates = document.querySelectorAll('.pageContent, main, [role="main"], .MuiContainer-root');
    return Array.from(candidates).filter((el) => el.scrollTop > 0);
  }


  function scrollEverythingToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    findScrolledContainers().forEach((el) => el.scrollTo({ top: 0, behavior: 'smooth' }));
    document.querySelectorAll('*').forEach((el) => {
      if (el.scrollTop > 200) el.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }


  function isAnyScrolled() {
    if (window.scrollY > 200) return true;
    return findScrolledContainers().some((el) => el.scrollTop > 200);
  }


  function mountScrollTopButton() {
    let btn = document.getElementById(SCROLL_TOP_BTN_ID);
    if (!btn) {
      if (!document.body) return;
      btn = document.createElement('button');
      btn.id = SCROLL_TOP_BTN_ID;
      btn.type = 'button';
      btn.title = 'Remonter en haut';
      btn.textContent = '↑';
      btn.style.cssText = [
        'position:fixed',
        'right:20px',
        'bottom:20px',
        'width:40px',
        'height:40px',
        'border-radius:50%',
        'border:none',
        'font-size:18px',
        'font-weight:700',
        'cursor:pointer',
        'z-index:99998',
        'box-shadow:0 2px 8px rgba(0,0,0,.3)',
        'display:none',
      ].join(';');
      const menuColor = detectMenuColor();
      btn.style.background = menuColor;
      btn.style.color = readableTextOn(menuColor);
      btn.addEventListener('click', scrollEverythingToTop);
      document.body.appendChild(btn);
      window.addEventListener('scroll', () => updateScrollTopButtonVisibility(), true);
      window.addEventListener('resize', () => updateScrollTopButtonPosition());
    }
    updateScrollTopButtonPosition();
    updateScrollTopButtonVisibility();
  }


  // (2026-07-31) Sur écran ultra-large, Premium centre .pageContent
  // (max-width:60vw, cf. ULTRAWIDE_STYLE) — un simple right/bottom:20px
  // fixé au VIEWPORT plaçait le bouton dans la marge grise à droite du
  // cadre blanc au lieu de rester à l'intérieur (capture jointe par
  // Nicolas : "elle doit rester dans le cadre"). On ancre donc le bouton au
  // coin bas-droit de .pageContent (le vrai cadre visible), pas du
  // viewport — en écran normal .pageContent occupe déjà toute la largeur/
  // hauteur, donc le résultat est identique à avant (right/bottom ~20px).
  function updateScrollTopButtonPosition() {
    const btn = document.getElementById(SCROLL_TOP_BTN_ID);
    if (!btn) return;
    const content = document.querySelector('.pageContent') || document.body;
    const rect = content.getBoundingClientRect();
    const MARGIN = 20;
    const right = Math.round(window.innerWidth - rect.right + MARGIN);
    const bottom = Math.round(window.innerHeight - rect.bottom + MARGIN);
    btn.style.right = Math.max(MARGIN, right) + 'px';
    btn.style.bottom = Math.max(MARGIN, bottom) + 'px';
  }


  function updateScrollTopButtonVisibility() {
    const btn = document.getElementById(SCROLL_TOP_BTN_ID);
    if (!btn) return;
    btn.style.display = isAnyScrolled() ? 'flex' : 'none';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
  }


  // --- Ctrl+molette = zoom Electron (2026-07-30) -------------------------
  // webFrame (module Electron accessible cote renderer car contextIsolation
  // est desactive pour ce preload) plutot que les raccourcis clavier
  // Zoom avant/arriere deja presents dans le menu "Affichage" de main.js —
  // ici on cible explicitement Ctrl+molette, sans toucher au zoom clavier.
  let wheelZoomWired = false;

  function wireCtrlWheelZoom() {
    // (2026-11-12, extension Chrome) Chrome gère nativement Ctrl+molette : rien à faire
    // (webFrame n'existe qu'en Electron).
    wheelZoomWired = true;
  }

  // --- Zoom par défaut 90% en Affichage Premium (2026-08-01, demande
  // explicite de Nicolas : "un cran zoom -") -----------------------------
  // Ne s'applique qu'une seule fois par chargement de page (defaultZoomApplied),
  // sinon on écraserait en boucle (scan() tourne toutes les ~1s) un zoom que
  // l'utilisateur aurait ensuite ajusté lui-même via Ctrl+molette
  // (wireCtrlWheelZoom ci-dessus) — ce serait un "défaut" qui ne lâche jamais
  // prise, pas un simple point de départ. Appelée uniquement quand
  // l'Affichage Premium est actif (scan(), branche !isDisabled()) : en
  // Affichage MyUnisoft natif, le zoom natif à 100% reste inchangé.
  let defaultZoomApplied = false;

  function applyDefaultPremiumZoom() {
    if (defaultZoomApplied || !isElectron) return;
    defaultZoomApplied = true;
    try {
      // (2026-11-12, extension Chrome) zoom de l'onglet via l'extension (chrome.tabs.setZoom).
      window.ATM.setZoom(0.9).catch(() => {});
    } catch (e) {}
  }


  // Capture en mémoire (jamais sur disque) des en-têtes d'authentification
  // (Authorization + society-id) déjà utilisés par un VRAI appel natif vers
  // l'API — on ne les devine ni ne les saisit jamais nous-mêmes, on se
  // contente de les relire au vol sur une requête que l'appli fait de toute
  // façon, pour rejouer un appel équivalent (même origine, même session,
  // depuis le même script déjà chargé dans la page).
  let lastApiHeaders = null;

  let apiHeaderSnifferInstalled = false;


  // (2026-07-30) Réécrit après une remarque de Nicolas : la version
  // précédente remplaçait ENTIÈREMENT window.XMLHttpRequest par une nouvelle
  // classe, et redéfinissait open/send/setRequestHeader sur CHAQUE INSTANCE
  // plutôt que sur le prototype. Or balance.js patche déjà lui aussi
  // window.fetch et XMLHttpRequest.prototype (open/send/setRequestHeader),
  // de façon transparente (capture des méthodes d'origine, toujours
  // rappelées ensuite) — remplacer toute la classe globale masquait ses
  // patches à lui pour toute requête faite après l'installation du nôtre, et
  // pouvait perturber tout code de l'appli qui teste
  // "xhr instanceof XMLHttpRequest" (une instance créée via l'ancien OrigXHR
  // capturé n'est PAS une instance de la nouvelle classe qui a remplacé le
  // nom global) — cause plausible du rejet "Authentification absente" malgré
  // un jeton par ailleurs valide et non expiré (confirmé via
  // window.__tmbcDebug.decodeToken()). Corrigé pour suivre EXACTEMENT le même
  // style que balance.js : on patche le PROTOTYPE partagé, jamais la classe
  // elle-même, et on rappelle toujours la méthode d'origine — les deux
  // scripts peuvent ainsi patcher XMLHttpRequest.prototype l'un après
  // l'autre sans jamais se marcher dessus, quel que soit l'ordre de
  // chargement.
  function installApiHeaderSniffer() {
    if (apiHeaderSnifferInstalled) return;
    apiHeaderSnifferInstalled = true;
    const origOpen = XMLHttpRequest.prototype.open;
    const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__tmbcUrl = url;
      this.__tmbcHeaders = {};
      // addEventListener posé ici (pas dans send, qu'on ne patche pas —
      // inutile, tout ce qu'il nous faut est déjà capturé via
      // setRequestHeader avant l'envoi) : "this" pointe déjà vers la vraie
      // instance à ce stade, donc "loadend" se déclenchera normalement,
      // sans jamais toucher/rappeler send().
      this.addEventListener('loadend', () => {
        if (
          this.__tmbcUrl &&
          String(this.__tmbcUrl).indexOf('prod-ws.myunisoft.fr') !== -1 &&
          this.__tmbcHeaders &&
          this.__tmbcHeaders['Authorization']
        ) {
          lastApiHeaders = {
            Authorization: this.__tmbcHeaders['Authorization'],
            'society-id': this.__tmbcHeaders['society-id'] || '-2',
          };
        }
      });
      return origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      if (this.__tmbcHeaders) this.__tmbcHeaders[name] = value;
      return origSetHeader.call(this, name, value);
    };

    // v4.4 (2026-08-05) : le sniffer ci-dessus ne captait QUE les appels faits
    // via XMLHttpRequest — or plusieurs modules (saisie-premium.js : résolution
    // de la période de cut-off CCA/PCA, cf. son changelog v2.57/v2.58) utilisent
    // fetch() pour leurs propres appels à prod-ws.myunisoft.fr. Si l'appli
    // native elle-même utilise aussi fetch() (au moins en partie) pour ses
    // appels authentifiés, ce sniffer XHR-only ne voit jamais ces requêtes et
    // lastApiHeaders reste bloqué sur le dernier jeton XHR capté — confirmé en
    // direct via window.__tmbcDebug.decodeToken() : jeton "expired: true"
    // pendant plusieurs minutes malgré une utilisation active de l'appli
    // (changement de journal/période). Fix : on patche AUSSI window.fetch,
    // même principe que balance.js (capture de la référence d'origine,
    // toujours rappelée ensuite — jamais de remplacement complet), pour capter
    // l'Authorization de N'IMPORTE QUEL fetch() vers prod-ws.myunisoft.fr, y
    // compris les propres appels de ce script ou d'un autre module. Effet de
    // bord recherché : dès qu'UN SEUL appel (n'importe lequel, natif ou pas)
    // réussit avec un jeton frais, tous les modules qui lisent getApiHeaders()
    // en bénéficient immédiatement.
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.indexOf('prod-ws.myunisoft.fr') !== -1) {
          const hdrs = {};
          const initHeaders = (init && init.headers) || (input && input.headers);
          if (initHeaders) {
            if (typeof initHeaders.forEach === 'function') {
              initHeaders.forEach((v, k) => (hdrs[k] = v));
            } else {
              Object.assign(hdrs, initHeaders);
            }
          }
          const auth = hdrs['Authorization'] || hdrs['authorization'];
          // appels propres de nos modules (marqueur __tmbcOwn) : jamais relevés, ils peuvent porter un jeton périmé
          if (auth && !(init && init.__tmbcOwn)) {
            lastApiHeaders = {
              Authorization: auth,
              'society-id': hdrs['society-id'] || hdrs['Society-Id'] || (lastApiHeaders && lastApiHeaders['society-id']) || '-2',
            };
          }
        }
      } catch (e) {
        /* échec silencieux : ne doit jamais empêcher le fetch réel de partir */
      }
      return origFetch.apply(this, arguments);
    };
  }

  // --- "Saisie" (nouvelle écriture) : demandé par Nicolas le 2026-07-31 --
  // Police à chasse fixe sur les champs identifiants/montants + affichage
  // du mois en chiffres. Grille native "vtHeader"/"[data-column-key]",
  // même composant que balance.js (Consultation de compte). Deux grilles
  // co-existent sur cette page (sniffé en direct via Claude in Chrome) :
  // - la grille de SAISIE (nouvelle écriture, clés "day"/"account_id"/
  //   "payment_type"), scopée via son ancêtre [class*="GridColumn"] ;
  // - la grille HISTORIQUE en dessous (clés "date"/"account_number"/
  //   "lettrage"/"paramIb"/"entry_date"), scopée pareil, PAS le même
  //   GridColumn (vérifié en direct : sameNode === false). Certaines clés
  //   (piece/piece2/debit/credit/counterpart/deadline) existent dans LES
  //   DEUX grilles avec le même data-column-key — donc toujours scoper au
  //   bon GridColumn, jamais un sélecteur global "[data-column-key=...]"
  //   seul, sous peine de styler aussi l'historique par erreur.
  const MONO_FONT_STACK = "Consolas, 'Courier New', monospace";

  // Retrouve le [class*="GridColumn"] (conteneur d'UNE grille : header +
  // corps + footer) qui contient la colonne "key" donnée — utilisé pour
  // distinguer la grille de saisie de la grille historique qui partagent
  // pourtant plusieurs data-column-key identiques.
  // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "si j'ouvre 2 sociétés
  // avec la partie saisie, les champs Période ne doivent pas se mélanger,
  // j'ai l'impression que c'est le cas") : l'app garde plusieurs onglets de
  // société montés en même temps dans le même document (un seul visible à
  // la fois, les autres cachés plutôt que démontés) — cette fonction
  // prenait le PREMIER ".vtHeader" trouvé dans le DOM correspondant à la
  // clé demandée, sans se soucier de sa visibilité, risquant de cibler la
  // grille d'un onglet société INACTIF plutôt que celle réellement affichée.
  // Fix : on ignore tout ".vtHeader" caché (offsetParent null — display:none
  // ou ancêtre caché, ce qui couvre un onglet société inactif).
  function findGridColumnByColumnKey(key) {
    const headers = document.querySelectorAll('.vtHeader');
    for (const h of headers) {
      if (h.offsetParent === null) continue;
      if (h.querySelector('[data-column-key="' + key + '"]')) {
        return h.closest('[class*="GridColumn"]');
      }
    }
    return null;
  }


  // --- Hook de debug (2026-07-30) -----------------------------------------
  // Toutes les variables utiles au tableau maison (lastApiHeaders,
  // customTableState, fetchCustomTableData…) vivent dans la fermeture de ce
  // script, invisibles depuis la Console des Outils de développement.
  // Exposé une seule fois sur window.__tmbcDebug pour permettre à Nicolas
  // d'inspecter/rejouer directement l'appel API sans repasser par le bouton
  // "Affichage MyU" à chaque tentative (utile pour diagnostiquer le rejet
  // "Authentification absente" malgré un en-tête Authorization présent —
  // jeton déjà expiré au moment de l'appel ? à usage unique côté serveur ?).
  // Purement diagnostique, aucun effet sur le comportement normal du script.
  let debugHookExposed = false;

  function exposeDebugHook() {
    if (debugHookExposed) return;
    debugHookExposed = true;
    window.__tmbcDebug = {
      // Ex. : window.__tmbcDebug.headers()
      headers: () => lastApiHeaders,
      // Ex. : window.__tmbcDebug.decodeToken() -> {exp, iat, secondsLeft, ...}
      decodeToken: () => {
        if (!lastApiHeaders || !lastApiHeaders.Authorization) return null;
        const raw = lastApiHeaders.Authorization.replace(/^Bearer\s+/i, '');
        const parts = raw.split('.');
        if (parts.length < 2) return { error: 'format inattendu' };
        try {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          const nowSec = Math.floor(Date.now() / 1000);
          return {
            exp: payload.exp,
            iat: payload.iat,
            nowSec,
            secondsUntilExpiry: payload.exp ? payload.exp - nowSec : null,
            expired: payload.exp ? payload.exp < nowSec : null,
          };
        } catch (e) {
          return { error: e.message };
        }
      },
    };
  }


  // --- Accesseur partagé pour le jeton API sniffé (installApiHeaderSniffer
  // ci-dessus) --- lastApiHeaders reste une variable privée à ce fichier ;
  // les modules qui ont besoin du jeton (ex. suivi-semaine.js) passent par
  // cet accesseur plutôt que par la variable elle-même, qui n'est jamais
  // exportée telle quelle (elle change de valeur au fil du temps, une
  // simple déstructuration au chargement du module figerait sa valeur
  // initiale — toujours null).
  function getApiHeaders() {
    return lastApiHeaders;
  }

  // --- Registre partagé de fonctions "scan" ------------------------------
  // Chaque module métier (menus.js, revision.js, consultation.js,
  // suivi-semaine.js, saisie.js, balance.js à terme) s'enregistre ici au
  // chargement via window.TMBC.registerScan(fn) au lieu de poser son propre
  // MutationObserver/setInterval. Ce fichier reste l'unique scheduler,
  // conformément à la règle du projet ("ne pas recréer plusieurs scripts
  // qui scannent la même page en parallèle"). fn() est appelée à CHAQUE
  // scan, que le bouton Premium soit activé ou non — c'est à chaque module
  // de vérifier lui-même TMBC.isDisabled() et de ne rien faire (ou de
  // nettoyer son DOM) si désactivé, exactement comme le faisait ce fichier
  // avant la scission (aucun changement de comportement visé).
  const scanRegistry = [];
  function registerScan(fn) {
    scanRegistry.push(fn);
  }

  // --- Extension partagée du hook de debug window.__tmbcDebug ------------
  // exposeDebugHook() (ci-dessus) pose la base (headers/decodeToken). Les
  // modules qui veulent y ajouter leurs propres entrées (ex. suivi-semaine.js
  // ajoute retry()/state()) passent par extendDebugHook() plutôt que de
  // réassigner window.__tmbcDebug directement (qui écraserait la base).
  function extendDebugHook(extra) {
    exposeDebugHook();
    Object.assign(window.__tmbcDebug, extra);
  }

  Object.assign(window.TMBC, {
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
    getHeaderLabelText,
    MONO_FONT_STACK,
    getApiHeaders,
    registerScan,
    extendDebugHook,
    feature,
    ensurePremiumMenuItem,
  });

  function scan() {
    // --- Toujours actif, indépendamment du bouton Premium (comportement
    // préexistant conservé à l'identique depuis premium.js 3.31) ---------
    // (2026-11-12) plus de bouton PREMIUM (scanPremiumButton retiré) ; le
    // statut MyUnisoft (météo) n'est affiché que si activé dans l'extension.
    exposeDebugHook();
    if (feature('showStatus', false)) {
      injectMeteoButton();
      createMeteoModal();
    }
    positionDrawerNextToContent();
    installDiagKey();
    mountScrollTopButton();
    wireCtrlWheelZoom();
    wireSaisieContextMenu();
    installApiHeaderSniffer();

    if (isDisabled()) {
      removePremiumStyle();
    } else {
      injectPremiumStyle();
      tagNumericCells(document.body);
      frenchifyMonthHeaders();
      styleDataColumns();
      capDossierColumnWidth();
      highlightActiveDossierTab();
      ensureWideModeButton();
      applyDefaultPremiumZoom();
    }

    // --- Modules métier enregistrés (menus.js, revision.js,
    // consultation.js, suivi-semaine.js, saisie.js, ...) : toujours
    // appelés, à charge pour chacun de vérifier TMBC.isDisabled() lui-même
    // (cf. TMBC_TOOLKIT_CONTRACT.md). Un try/catch par module pour qu'une
    // erreur dans l'un n'empêche jamais les autres de tourner.
    scanRegistry.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('[tmbc-core] erreur dans un module scan()', e);
      }
    });
  }

  // --- Menu contextuel de la SAISIE (/accounting/newEntry) : "Insérer une ligne" ---
  // (v4.19, demandé par Nicolas) Le clic droit sur une ligne de saisie ouvre un menu
  // MUI natif qui ne propose que "Supprimer la ligne". On y ajoute "Insérer une ligne",
  // qui déclenche la même action que Ctrl + + (ajout d'une ligne). IMPORTANT : on
  // n'ajoute QUE notre propre <li> (clone du natif pour hériter du style MUI) en fin de
  // menu — aucun nœud natif n'est déplacé ni retiré (cf. règle anti-crash React).
  function findDeleteLineItem() {
    const items = document.querySelectorAll('li[role="menuitem"]');
    for (const it of items) if (it.textContent.trim() === 'Supprimer la ligne') return it;
    return null;
  }
  function closeOpenMuiMenu() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
  }
  function addSaisieLine() {
    // Reproduit Ctrl + + (la combinaison native d'ajout de ligne). On couvre les deux
    // "+" possibles (pavé numérique NumpadAdd, et touche principale Equal avec Maj) et on
    // cible plusieurs éléments car le gestionnaire natif peut écouter globalement ou sur la grille.
    const targets = [document.activeElement, document.body, document].filter(Boolean);
    const variants = [
      { key: '+', code: 'NumpadAdd', shiftKey: false },
      { key: '+', code: 'Equal', shiftKey: true },
    ];
    targets.forEach((t) => variants.forEach((v) => {
      ['keydown', 'keypress', 'keyup'].forEach((type) => {
        t.dispatchEvent(new KeyboardEvent(type, { key: v.key, code: v.code, ctrlKey: true, shiftKey: v.shiftKey, bubbles: true, cancelable: true }));
      });
    }));
  }
  function injectInsertLineItem(del) {
    const ul = del.parentElement;
    if (!ul || ul.querySelector('[data-tmbc-insert-line]')) return;
    const ins = del.cloneNode(true); // hérite des classes MUI (style identique)
    ins.textContent = 'Insérer une ligne';
    ins.setAttribute('data-tmbc-insert-line', '1');
    ins.classList.remove('Mui-focusVisible', 'Mui-selected');
    ins.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
    ins.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      closeOpenMuiMenu();
      setTimeout(addSaisieLine, 60);
    }, true);
    ul.appendChild(ins); // ajouté EN FIN de menu, sans toucher aux items natifs
  }
  function wireSaisieContextMenu() {
    if (window.__tmbcSaisieCtx) return;
    window.__tmbcSaisieCtx = true;
    document.addEventListener('contextmenu', () => {
      let tries = 0;
      const timer = setInterval(() => {
        if (++tries > 20) { clearInterval(timer); return; } // ~1 s max
        const del = findDeleteLineItem();
        if (del) { clearInterval(timer); injectInsertLineItem(del); }
      }, 50);
    }, true);
  }

  window.addEventListener('DOMContentLoaded', () => {
    scan();
    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(scan, 1000);
  });
})();
