// ==UserScript==
// @name         MyUnisoft - Menus (modifications du menu latéral)
// @namespace    https://nicolas.chassard/myunisoft
// @version      1.1-ext
// @description  v1.1 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — CORRECTIF : wireMenuTooltips utilisait isElectron, jamais défini dans ce module (ReferenceError au survol du menu réduit depuis la scission) ; le côté de l'infobulle dépend maintenant de la position réelle du menu (décalé vers la droite = infobulle à gauche).
//               v1.0 (2026-07-31) : Module extrait de premium.js 3.31 lors de la scission
//               en modules demandée par Nicolas (cf. premium.js core pour le détail de la
//               scission et TMBC_TOOLKIT_CONTRACT.md pour le contrat commun entre modules).
//               Contient : icône active du menu (bordure retirée / barre d'accent élargie-blanchie en
//               thème bleu), bouton replier/déplier (chevron) recoloré en thème bleu, masquage
//               des sections "Qonto"/"Boîte à outils" dans Écosystème, libellé "Accueil" sur le
//               bouton d'onglet maison, tooltips du menu réduit (icônes seules).
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


  // Ajoute le texte "Accueil" a droite de l'icone maison (data-id="tab--2"),
  // sans toucher a l'icone native elle-meme — un simple <span> ajoute comme
  // nouvel enfant du bouton (jamais de deplacement/suppression d'un noeud
  // natif existant).
  function labelHomeButton() {
    const homeButton = document.querySelector('.navBar .YpwYqA button[data-id="tab--2"]');
    if (!homeButton || homeButton.querySelector('.tmbc-home-label')) return;
    const label = document.createElement('span');
    label.className = 'tmbc-home-label';
    label.textContent = 'Accueil';
    label.style.marginLeft = '6px';
    label.style.fontSize = '13px';
    homeButton.appendChild(label);
  }


  // Menu latéral gauche (Vue d'ensemble, Tenue, Déclarations, ...) : React
  // assombrit nativement l'icône de l'item actif (passe de blanc à une
  // couleur sombre en style inline dès que l'item reçoit la classe
  // "Mui-selected") — on force l'icône à rester blanche. Fonctionne
  // identiquement en menu réduit (icônes seules) et en menu ouvert (icônes
  // + texte), le sélecteur ne dépend pas de la largeur du menu.
  // (2026-07-31, retour de Nicolas) La bordure carrée blanche posée
  // jusqu'ici autour de l'icône active (border:2px solid #fff sur
  // iconWrapper) est retirée — Nicolas ne voulait pas de bordure autour de
  // l'icône. À la place, on élargit/recolore en blanc la barre d'accent
  // native (border-left, déjà présente sur l'item ".Mui-selected" mais
  // transparente/peu visible en thème bleu par défaut) — SEULEMENT en
  // thème bleu : Nicolas veut garder la barre verte/bleue déjà correcte en
  // thème noir, donc on ne touche à rien dans ce cas (cf.
  // isMenuColorDarkNeutral).
  function highlightActiveSidebarMenuIcon() {
    const menuColor = detectMenuColor();
    const isDarkTheme = isMenuColorDarkNeutral(menuColor);
    document.querySelectorAll('.MuiDrawer-root .MuiListItemButton-root').forEach((item) => {
      const iconWrapper = item.querySelector('.MuiListItemIcon-root');
      const icon = item.querySelector('span[class*="icon-"]');
      if (!iconWrapper || !icon) return;

      icon.style.setProperty('color', '#fff', 'important');
      iconWrapper.style.removeProperty('border');
      iconWrapper.style.removeProperty('border-radius');
      iconWrapper.style.removeProperty('box-sizing');

      if (isDarkTheme) {
        item.style.removeProperty('border-left');
        return;
      }
      if (item.classList.contains('Mui-selected')) {
        item.style.setProperty('border-left', '5px solid #fff', 'important');
      } else {
        item.style.removeProperty('border-left');
      }
    });
  }


  // (2026-07-31, demandé par Nicolas) Bouton replier/déplier le menu
  // (chevron "<", css-XXXXX-chevronButton — suffixe stable) : nativement
  // noir avec flèche blanche dans TOUS les thèmes. Nicolas veut, en thème
  // bleu uniquement, un fond blanc avec flèche bleue (couleur du menu) ; en
  // thème noir il veut garder l'apparence actuelle (noir/blanc) inchangée.
  function styleSidebarChevronButton() {
    const btn = document.querySelector('.MuiDrawer-root [class*="chevronButton"]');
    if (!btn) return;
    const menuColor = detectMenuColor();
    const icon = btn.querySelector('span[class*="icon-"], svg');
    if (isMenuColorDarkNeutral(menuColor)) {
      btn.style.removeProperty('background-color');
      if (icon) icon.style.removeProperty('color');
      return;
    }
    btn.style.setProperty('background-color', '#fff', 'important');
    if (icon) icon.style.setProperty('color', menuColor, 'important');
  }


  // Page "Écosystème" : masque les sections "Qonto" et "Boîte à outils"
  // (non utilisées) — display:none sur le bloc <ul> section entier
  // (titre + items), jamais de suppression/déplacement du nœud natif.
  const HIDDEN_ECOSYSTEM_SECTIONS = new Set(['qonto', 'boite a outils'].map(normalizeColumnName));


  function hideEcosystemSections() {
    document.querySelectorAll('.css-wykmkh-title').forEach((title) => {
      const text = normalizeColumnName(title.textContent);
      if (!HIDDEN_ECOSYSTEM_SECTIONS.has(text)) return;
      const section = title.closest('.MuiList-root');
      if (section && section.style.display !== 'none') {
        section.style.setProperty('display', 'none', 'important');
      }
    });
  }


  let menuTooltipEl = null;


  function ensureMenuTooltip() {
    if (menuTooltipEl) return menuTooltipEl;
    menuTooltipEl = document.createElement('div');
    menuTooltipEl.className = 'tmbc-menu-tooltip';
    menuTooltipEl.style.display = 'none';
    document.body.appendChild(menuTooltipEl);
    return menuTooltipEl;
  }


  function isMenuCollapsed(drawer) {
    return drawer.getBoundingClientRect().width < 88;
  }


  function wireMenuTooltips() {
    const drawer = document.querySelector('.MuiDrawer-root .MuiPaper-root');
    if (!drawer || drawer.dataset.tmbcTooltipsWired) return;
    drawer.dataset.tmbcTooltipsWired = '1';

    drawer.addEventListener('mouseover', (e) => {
      if (!isMenuCollapsed(drawer)) return;
      const item = e.target.closest('a, button, [role="button"], .MuiListItem-root, .MuiListItemButton-root');
      if (!item || !drawer.contains(item)) return;

      const label =
        item.getAttribute('aria-label') ||
        item.getAttribute('title') ||
        item.querySelector('.MuiListItemText-root')?.textContent?.trim() ||
        item.textContent.trim();
      if (!label) return;

      const tooltip = ensureMenuTooltip();
      tooltip.textContent = label;
      const rect = item.getBoundingClientRect();
      // En Electron, le menu est décalé du bord gauche réel de la fenêtre
      // (cf. positionDrawerNextToContent) — il y a donc de l'espace libre à
      // GAUCHE de l'icône plutôt qu'à droite (où le tooltip chevaucherait
      // le contenu désormais collé juste après le menu). En navigateur
      // classique, le menu reste au vrai bord gauche de l'écran : on garde
      // le positionnement à droite d'origine.
      // (2026-11-12) menu décalé du bord gauche (contenu centré) -> place libre à gauche.
      if (drawer.getBoundingClientRect().left > 40) {
        tooltip.style.left = 'auto';
        tooltip.style.right = `${window.innerWidth - rect.left + 8}px`;
      } else {
        tooltip.style.right = 'auto';
        tooltip.style.left = `${rect.right + 8}px`;
      }
      tooltip.style.top = `${rect.top + rect.height / 2 - 10}px`;
      tooltip.style.display = 'block';
    });

    drawer.addEventListener('mouseout', (e) => {
      const item = e.target.closest('a, button, [role="button"], .MuiListItem-root, .MuiListItemButton-root');
      if (item && menuTooltipEl) menuTooltipEl.style.display = 'none';
    });
  }


  // --- Orchestrateur du module, enregistré auprès du core -------------
  // Gating identique à premium.js 3.31 : ces fonctions ne tournaient
  // qu'avec le bouton Premium activé (cf. scan() de premium.js avant la
  // scission) — même comportement reproduit ici via TMBC.isDisabled().
  function scanMenus() {
    if (isDisabled()) return;
    highlightActiveSidebarMenuIcon();
    styleSidebarChevronButton();
    labelHomeButton();
    hideEcosystemSections();
    wireMenuTooltips();
  }

  registerScan(scanMenus);
})();
