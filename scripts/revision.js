// ==UserScript==
// @name         MyUnisoft - Dossier de Révision
// @namespace    https://nicolas.chassard/myunisoft
// @version      1.5-ext
// @description  v1.5 (2026-11-12, retour de Nicolas : « l'affichage arrondi des cycles ne fonctionne pas tout de suite ») : nouvel onglet
//               natif "Tableau de bord" (vue par défaut du dossier) — sur cette vue le sélecteur Section n'existe pas, la barre de
//               pilules n'était donc construite qu'après un passage par un cycle. Elle est maintenant construite dès que la rangée de
//               cycles est présente (insérée avant le bloc qui la contient) ; boutons Synthese/Contrôles affichés seulement si le
//               sélecteur Section existe. Sélecteurs dadpContainer/filters rendus tolérants (suffixe stable, sans préfixe css-xxxx).
//               v1.4 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — aucun changement fonctionnel, le module tourne désormais dans l'extension (même contexte de page que le preload).
//               v1.3 (2026-08-01) : BUG TROUVÉ EN DIRECT — impossible de passer de Synthese à
//               Contrôles (le bouton ne faisait rien). Cause : chooseSection() ouvrait le menu
//               MUI natif via un simple combo.click(), qui ne déclenche pas fiablement l'ouverture
//               (constaté en direct pendant le développement : un .click() synthétique ne faisait
//               rien, un vrai clic souris fonctionnait). Repris le même correctif déjà en place
//               dans balance.js pour piloter le sélecteur natif "Exercice(s)" : clickLikeUser()
//               (séquence pointerdown/mousedown/mouseup/click, MUI écoute ces événements natifs)
//               + attente par sondage (waitFor, jusqu'à 2s) au lieu d'un délai fixe de 150ms, le
//               temps que le menu (rendu dans un portail document.body) apparaisse réellement.
//               v1.2 (2026-08-01) : BUG TROUVÉ EN DIRECT — au tick suivant l'installation, la
//               toolbar Section perdait les lettres et les sous-onglets, ne gardant que
//               Synthese/Contrôles. Cause : findCycleTabsRoot()/findSubTabsRoot() filtraient sur
//               offsetParent !== null (pour éviter de confondre 2 sociétés ouvertes en même
//               temps), mais ensureRevisionToolbar() masque ENSUITE ces rangées natives
//               (display:none) — au tick suivant leur offsetParent devient donc null À CAUSE de
//               ce masquage, et elles n'étaient plus retrouvées. Fix : la référence DOM trouvée
//               est mise en cache et réutilisée tant qu'elle reste connectée au DOM (isConnected),
//               une re-recherche ne se déclenche que si la rangée a été réellement démontée par
//               React (ex. rangée de cycles qui disparaît en passant en Synthèse), jamais juste
//               parce qu'on l'a nous-mêmes masquée. v1.1 (2026-08-01) : le champ natif "Section"
//               (Synthèse / AC - Contrôles) est
//               remplacé par 2 boutons ("Synthese"/"Contrôles"), regroupés sur UNE ligne avec la
//               rangée de cycles (Régularité...Annexe, réduits à des lettres A à X avec le nom
//               complet en tooltip au survol — Ja/Jb pour Capitaux propres / Groupe et associés,
//               "Liste des comptes" gardé tel quel, absent de la demande) et la rangée de
//               sous-onglets (Note de synthèse/Programme de travail/Feuille maitresse/Révision
//               interne en Contrôles, Note de synthèse/Attestation/Annexe/Dossier de
//               gestion/ESMS/Plaquette en Synthèse — lue dynamiquement depuis l'appli native,
//               jamais une liste figée en dur, pour ne rien perdre si l'appli en ajoute/retire).
//               Implémentation : le <select> natif et les 2 rangées d'onglets natives sont
//               masqués (display:none, jamais supprimés) ; une toute nouvelle barre d'outils
//               (nœuds 100% custom, jamais de déplacement de nœud natif) est insérée à la place,
//               chaque bouton personnalisé se contentant de déclencher un .click() sur l'élément
//               natif caché correspondant pour piloter la vraie logique applicative. v1.0
//               (2026-07-31) : Module extrait de premium.js 3.31 lors de la scission en modules
//               demandée par Nicolas (cf. premium.js core pour le détail de la scission et
//               TMBC_TOOLKIT_CONTRACT.md pour le contrat commun entre modules). Contient :
//               renommage des onglets de cycle du Dossier de Révision, stylisation en pilule du
//               stepper "Editions courantes" (Bilan actif/passif, Compte de résultat...), libellé
//               "Elements" sur la colonne "titre" sans en-tête natif. Copie verbatim du code
//               correspondant dans premium.js 3.31 (cf. CHANGELOG-premium-legacy.txt pour
//               l'historique complet des versions antérieures de ces fonctionnalités) — aucun
//               changement de comportement visé par cette extraction, seule son organisation en
//               fichier séparé change.
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


  // (2026-08-01) Les 7 abréviations de cycles (Achats/Charges/Ventes/Immob/
  // Capitaux/Groupe/Autres comptes) sont retirées d'ici : la rangée native de
  // cycles est désormais masquée et remplacée par des boutons-lettres
  // personnalisés (cf. buildRevisionToolbar plus bas), qui portent leur
  // propre libellé complet en tooltip. Seules 'Liste des comptes' et 'Revue
  // analytique' restent ici — la 1ère reste affichée telle quelle (pas dans
  // le mapping de lettres demandé par Nicolas), la 2e appartient à l'autre
  // rangée (sous-onglets Note de synthèse/Programme de travail/...), jamais
  // masquée intégralement (son contenu change mais elle reste une vraie
  // rangée d'onglets natifs sous Contrôles, cf. plus bas).
  const CYCLE_TAB_RENAMES = new Map(
    [
      ['Liste des comptes', 'Liste Comptes.'],
      ['Revue analytique', 'Feuille maitresse'],
    ].map(([from, to]) => [normalizeColumnName(from), to])
  );

  function renamedLabel(raw) {
    return CYCLE_TAB_RENAMES.get(normalizeColumnName(raw)) || raw;
  }

  // Rangée de cycles (Régularité...Annexe, 13 items) -> lettre + tooltip
  // complet, demandé par Nicolas le 2026-08-01. L'ordre ci-dessous suit
  // exactement l'ordre natif des onglets (vérifié en direct), Ja/Jb pour les
  // 2 items du "J" (Capitaux propres / Groupe et associés), pas de lettre
  // pour "Liste des comptes" (absent de la demande, garde son libellé).
  const CYCLE_TAB_LETTERS = new Map(
    [
      ['Régularité', ['A', 'Régularité formelle']],
      ['Trésorerie', ['B', 'Trésorerie']],
      ['Achats + Fournisseurs', ['C', 'Achats/Fourn']],
      ['Charges Externes', ['D', 'Chg externes']],
      ['Ventes + Clients', ['E', 'Ventes clients']],
      ['Stocks', ['F', 'Stocks']],
      ['Immobilisations', ['G', 'Immobilisations']],
      ['Personnel', ['H', 'Personnel']],
      ['Etat', ['I', 'Etat']],
      ['Capitaux + Provisions', ['Ja', 'Capitaux propres']],
      ['Groupe et Associés', ['Jb', 'Groupe et associes']],
      ['Autres comptes', ['K', 'Autres comptes']],
      ['Annexe', ['X', 'Annexe']],
    ].map(([from, v]) => [normalizeColumnName(from), v])
  );

  const REVISION_TOOLBAR_ID = 'tmbc-revision-toolbar';
  let lastRevisionToolbarSignature = null;


  function isDossierRevisionPage() {
    return /\/dadp\/da_balanceSheet/.test(location.pathname);
  }


  function renameCycleTabLabels() {
    if (!isDossierRevisionPage()) return;
    document.querySelectorAll('.MuiTab-root, [role="tab"]').forEach((tab) => {
      const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const raw = node.textContent.trim();
        if (!raw) continue;
        const replacement = CYCLE_TAB_RENAMES.get(normalizeColumnName(raw));
        if (replacement && node.textContent.trim() !== replacement) {
          node.textContent = replacement;
        }
      }
    });
  }


  // Page "Editions courantes" (Bilan actif / Bilan passif / Compte de
  // résultat, etc.) : ces "onglets" sont en réalité un MuiStepper
  // (composant natif d'assistant pas-à-pas détourné ici), donc notre règle
  // CSS pour les vrais onglets (.MuiTab-root) ne les touche pas. On les
  // stylise en pilule colorée/blanche comme les onglets du Dossier de
  // Révision — l'état actif est repéré via la classe interne se terminant
  // par "selectedLabel-selected" (préfixe css-XXXXX généré par Emotion,
  // suffixe stable posé par l'appli).
  function styleEditionsStepper() {
    const menuColor = detectMenuColor();
    const menuText = readableTextOn(menuColor);
    document.querySelectorAll('.MuiStepLabel-labelContainer').forEach((container) => {
      const isActive = !!container.querySelector('[class*="selectedLabel-selected"]');
      // Le <p> interne (MuiTypography) a sa propre couleur explicite posée
      // par l'appli — il n'hérite PAS de la couleur du conteneur, il faut
      // donc la forcer directement dessus aussi, sinon le texte reste dans
      // sa couleur d'origine (sombre) même sur fond bleu foncé.
      const label = container.querySelector('p');
      const textColor = isActive ? menuText : menuColor;
      container.style.setProperty('border-radius', '17px', 'important');
      container.style.setProperty('padding', '4px 12px', 'important');
      container.style.setProperty('display', 'inline-flex', 'important');
      container.style.setProperty('align-items', 'center', 'important');
      container.style.setProperty('justify-content', 'center', 'important');
      container.style.setProperty('color', textColor, 'important');
      if (label) {
        label.style.setProperty('color', textColor, 'important');
        // Le <p> natif porte son propre border-bottom (~1.5px, indicateur
        // de "label" natif de l'appli) — indépendant du style qu'on pose
        // sur le conteneur, jamais nettoyé jusqu'ici : c'est ça le
        // "soulignement" resté visible sous "Bilan actif". On le neutralise
        // dans tous les cas (actif ou non).
        label.style.setProperty('border-bottom', 'none', 'important');
        label.style.setProperty('text-decoration', 'none', 'important');
      }
      if (isActive) {
        container.style.setProperty('background', menuColor, 'important');
        container.style.setProperty('font-weight', '700', 'important');
        container.style.removeProperty('border');
      } else {
        container.style.setProperty('background', '#fff', 'important');
        container.style.setProperty('border', '1px solid ' + menuColor, 'important');
        container.style.setProperty('font-weight', '500', 'important');
      }
    });
  }


  // Colonne "titre" (Bilan actif/passif, Compte de résultat) : l'en-tête
  // n'a nativement AUCUN libellé visible (juste une colonne vide) — on y
  // met "Elements" pour que la colonne soit identifiable d'un coup d'œil,
  // dans les 3 vues (même data-column-key="titre" partout).
  function labelTitreColumnHeader() {
    document.querySelectorAll('.vtHeader [data-column-key="titre"]').forEach((headerCell) => {
      const contentSpan = headerCell.querySelector('[class*="headerCellContent"]');
      const innerDiv = headerCell.querySelector('[class*="headerCell"]');
      if (contentSpan && !contentSpan.textContent.trim()) {
        contentSpan.textContent = 'Elements';
        contentSpan.classList.add('tmbc-month-done'); // évite que frenchifyMonthHeaders() y retouche
      }
      if (innerDiv && !innerDiv.getAttribute('title')) {
        innerDiv.setAttribute('title', 'Elements');
      }
    });
  }


  // ===================================================================
  // Barre d'outils "Section" (2026-08-01, demande Nicolas) : remplace le
  // <select> natif "Section" (Synthèse / AC - Contrôles) par 2 boutons, et
  // regroupe sur UNE seule ligne : ces 2 boutons + la rangée de cycles
  // (Régularité...Annexe, réduite à des lettres A..X avec tooltip complet,
  // uniquement montée en mode Contrôles) + la rangée de sous-onglets
  // (Note de synthèse/Programme de travail/Feuille maitresse/Révision
  // interne en mode Contrôles, ou Note de synthèse/Attestation/Annexe/
  // Dossier de gestion/ESMS/Plaquette en mode Synthèse — cette 2e rangée
  // existe TOUJOURS, contrairement à la 1ère qui est carrément démontée par
  // React en mode Synthèse, vérifié en direct).
  //
  // Implémentation : jamais de déplacement de nœud natif hors de son parent
  // (règle du projet, cf. TMBC_TOOLKIT_CONTRACT.md et l'historique du bug
  // insertBefore). On masque les 3 blocs natifs concernés (Section, rangée
  // de cycles, rangée de sous-onglets) en display:none, et on construit une
  // toute nouvelle barre d'outils (nœuds 100% custom) insérée comme unique
  // nouvel enfant du conteneur de filtres — chaque bouton custom se contente
  // de faire .click() sur l'élément natif caché correspondant pour piloter
  // la vraie logique de l'appli (même principe que le pilotage du sélecteur
  // "Exercice(s)" en coulisses, déjà en place ailleurs dans le projet).
  function findSectionFormControl() {
    const label = document.getElementById('section-label');
    return label ? label.closest('.MuiFormControl-root') : null;
  }

  function findVisibleTabByText(text) {
    return Array.from(document.querySelectorAll('[role="tab"]')).find(
      (t) => t.offsetParent !== null && normalizeColumnName(t.textContent.trim()) === normalizeColumnName(text)
    );
  }

  // (Bug vécu en direct le 2026-08-01) : findVisibleTabByText filtre sur
  // offsetParent !== null pour éviter de confondre 2 sociétés ouvertes en
  // même temps (cf. le bug multi-société déjà corrigé ailleurs dans le
  // projet) — mais ensureRevisionToolbar() masque ENSUITE ces 2 rangées
  // (display:none) une fois trouvées. Au tick suivant, offsetParent de leurs
  // onglets devient donc null À CAUSE de notre propre masquage, et
  // findVisibleTabByText ne les retrouve plus : la toolbar se reconstruisait
  // alors sans les lettres ni les sous-onglets (repli silencieux sur
  // Synthese/Contrôles seuls). Fix : on met en cache la référence DOM une
  // fois trouvée, et on ne la re-cherche que si elle a été RÉELLEMENT démontée
  // (isConnected === false, ex. rangée de cycles qui disparaît du DOM en
  // passant en Synthèse) — jamais juste parce qu'on l'a nous-mêmes masquée.
  let cachedCycleTabsRoot = null;
  let cachedSubTabsRoot = null;

  function findCycleTabsRoot() {
    if (cachedCycleTabsRoot && cachedCycleTabsRoot.isConnected) return cachedCycleTabsRoot;
    // Repérée via l'onglet "Régularité" (jamais juste "Annexe" seul : la
    // rangée Synthèse contient elle aussi un onglet "Annexe", un document,
    // pas le cycle X — confusion vérifiée en direct, à ne jamais reproduire).
    const regTab = findVisibleTabByText('Régularité');
    cachedCycleTabsRoot = regTab ? regTab.closest('.MuiTabs-root') : null;
    return cachedCycleTabsRoot;
  }

  function findSubTabsRoot() {
    if (cachedSubTabsRoot && cachedSubTabsRoot.isConnected) return cachedSubTabsRoot;
    // Toujours montée (Contrôles ET Synthèse), repérée via "Note de
    // synthèse", présent dans les deux cas.
    const noteTab = findVisibleTabByText('Note de synthèse');
    cachedSubTabsRoot = noteTab ? noteTab.closest('.MuiTabs-root') : null;
    return cachedSubTabsRoot;
  }

  function buildPillButton(label, title, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    if (title) btn.title = title;
    btn.addEventListener('click', onClick);
    btn.style.cssText = [
      'font:inherit',
      'border-radius:17px',
      'padding:4px 12px',
      'font-size:13px',
      'line-height:1.4',
      'cursor:pointer',
      'white-space:nowrap',
      'outline:none',
    ].join(';');
    return btn;
  }

  function styleToolbarButton(btn, isActive, menuColor, menuText) {
    if (isActive) {
      btn.style.setProperty('background', menuColor, 'important');
      btn.style.setProperty('color', menuText, 'important');
      btn.style.setProperty('font-weight', '700', 'important');
      btn.style.setProperty('border', '1px solid ' + menuColor, 'important');
    } else {
      btn.style.setProperty('background', '#fff', 'important');
      btn.style.setProperty('color', menuColor, 'important');
      btn.style.setProperty('font-weight', '500', 'important');
      btn.style.setProperty('border', '1px solid ' + menuColor, 'important');
    }
  }

  function buildSeparator() {
    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px;align-self:stretch;background:#ccc;margin:0 4px;';
    return sep;
  }

  function removeRevisionToolbar() {
    const toolbar = document.getElementById(REVISION_TOOLBAR_ID);
    if (toolbar) toolbar.remove();
    const sectionFormControl = findSectionFormControl();
    if (sectionFormControl) sectionFormControl.style.removeProperty('display');
    const cycleTabsRoot = findCycleTabsRoot();
    if (cycleTabsRoot) cycleTabsRoot.style.removeProperty('display');
    const subTabsRoot = findSubTabsRoot();
    if (subTabsRoot) subTabsRoot.style.removeProperty('display');
    lastRevisionToolbarSignature = null;
    cachedCycleTabsRoot = null;
    cachedSubTabsRoot = null;
  }

  function ensureRevisionToolbar() {
    if (!isDossierRevisionPage()) {
      removeRevisionToolbar();
      return;
    }

    // (2026-11-12) Nouvel onglet natif "Tableau de bord" (vue par défaut à
    // l'ouverture du dossier) : sur cette vue, le sélecteur "Section" n'existe
    // PAS (seule la rangée Tableau de bord / Régularité... / Annexe est montée).
    // Avant, on sortait ici faute de Section : la barre n'était donc jamais
    // construite à l'arrivée (onglets carrés natifs), et ne l'était qu'après
    // un passage par un cycle (barre restée en place au retour). On construit
    // maintenant la barre dès que la rangée de cycles OU le sélecteur Section
    // est présent ; les boutons Synthese/Contrôles ne sont affichés que si le
    // sélecteur Section existe (ils le pilotent).
    const sectionFormControl = findSectionFormControl();
    const cycleTabsRoot = findCycleTabsRoot();
    if (!sectionFormControl && !cycleTabsRoot) return; // page pas encore montée

    const anchor = sectionFormControl || cycleTabsRoot;
    const dadpContainer =
      anchor.closest('[class*="dadpContainer"]') || document.querySelector('[class*="dadpContainer"]');
    if (!dadpContainer) return;

    const sectionValueEl = document.getElementById('mui-component-select-section');
    const currentSection = sectionValueEl ? sectionValueEl.textContent.trim() : '';
    const isSynthese = normalizeColumnName(currentSection) === normalizeColumnName('Synthèse');

    const subTabsRoot = findSubTabsRoot();

    // Signature = tout ce qui doit déclencher une reconstruction visuelle
    // (évite de reconstruire à chaque tick, ~1x/s, si rien n'a changé —
    // sinon léger clignotement des boutons).
    const signature = JSON.stringify({
      section: currentSection,
      cycle: cycleTabsRoot
        ? Array.from(cycleTabsRoot.querySelectorAll('[role="tab"]')).map(
            (t) => t.textContent.trim() + ':' + t.getAttribute('aria-selected')
          )
        : null,
      sub: subTabsRoot
        ? Array.from(subTabsRoot.querySelectorAll('[role="tab"]')).map(
            (t) => t.textContent.trim() + ':' + t.getAttribute('aria-selected')
          )
        : null,
    });

    let toolbar = document.getElementById(REVISION_TOOLBAR_ID);
    const needsRebuild = !toolbar || signature !== lastRevisionToolbarSignature;

    // Masquage des blocs natifs remplacés — jamais supprimés, cf. règle du
    // projet (uniquement display:none sur les blocs remplacés).
    if (sectionFormControl) sectionFormControl.style.setProperty('display', 'none', 'important');
    if (cycleTabsRoot) cycleTabsRoot.style.setProperty('display', 'none', 'important');
    if (subTabsRoot) subTabsRoot.style.setProperty('display', 'none', 'important');

    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = REVISION_TOOLBAR_ID;
      toolbar.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 0;';
      const filtersRow = dadpContainer.querySelector('[class*="-filters"]');
      // Bloc enfant direct de dadpContainer qui contient la rangée de cycles
      // (vue Tableau de bord, sans ligne de filtres) : la barre est insérée
      // juste avant lui (nouveau nœud, aucun nœud natif déplacé).
      let cycleBlock = cycleTabsRoot;
      while (cycleBlock && cycleBlock.parentElement !== dadpContainer) cycleBlock = cycleBlock.parentElement;
      if (filtersRow && filtersRow.parentElement === dadpContainer && filtersRow.nextSibling) {
        dadpContainer.insertBefore(toolbar, filtersRow.nextSibling);
      } else if (cycleBlock) {
        dadpContainer.insertBefore(toolbar, cycleBlock);
      } else {
        dadpContainer.appendChild(toolbar);
      }
    }

    if (!needsRebuild) return;
    lastRevisionToolbarSignature = signature;
    toolbar.innerHTML = '';

    const menuColor = detectMenuColor();
    const menuText = readableTextOn(menuColor);

    // (2026-08-01, bug vécu en direct : "je ne peux pas passer de Synthese à
    // Contrôles, ça ne fonctionne pas") — un simple .click() JS n'ouvre PAS
    // fiablement le menu MUI ici (vérifié en direct pendant le développement,
    // via Claude in Chrome : un .click() synthétique sur le combobox ne
    // déclenchait rien, alors qu'un clic souris réel fonctionnait). balance.js
    // a déjà résolu exactement ce problème pour piloter le sélecteur natif
    // "Exercice(s)" (clickLikeUser : séquence pointerdown/mousedown/mouseup/
    // click, MUI écoute ces événements natifs, pas juste un simple click) —
    // même technique reprise ici à l'identique, plus une attente par sondage (au lieu
    // d'un délai fixe de 150ms) le temps que le menu (rendu dans un portail,
    // document.body) apparaisse réellement.
    function clickLikeUser(el) {
      ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((type) => {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      });
    }

    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function waitFor(predicate, timeoutMs, stepMs) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const v = predicate();
        if (v) return v;
        await sleep(stepMs || 50);
      }
      return null;
    }

    async function chooseSection(targetLabel) {
      const combo = document.getElementById('mui-component-select-section');
      if (!combo) return;
      clickLikeUser(combo);
      const opt = await waitFor(() => {
        return (
          Array.from(document.querySelectorAll('[role="option"]')).find(
            (o) => o.textContent.trim() === targetLabel
          ) || null
        );
      }, 2000, 50);
      if (opt) clickLikeUser(opt);
    }

    const synthBtn = buildPillButton('Synthese', 'Synthèse', () => chooseSection('Synthèse'));
    const controlesBtn = buildPillButton('Contrôles', 'AC - Contrôles', () => chooseSection('AC - Contrôles'));
    styleToolbarButton(synthBtn, isSynthese, menuColor, menuText);
    styleToolbarButton(controlesBtn, !isSynthese, menuColor, menuText);
    if (sectionFormControl) {
      toolbar.appendChild(synthBtn);
      toolbar.appendChild(controlesBtn);
    }

    if (cycleTabsRoot) {
      if (sectionFormControl) toolbar.appendChild(buildSeparator());
      Array.from(cycleTabsRoot.querySelectorAll('[role="tab"]')).forEach((tab) => {
        const raw = tab.textContent.trim();
        const mapped = CYCLE_TAB_LETTERS.get(normalizeColumnName(raw));
        const label = mapped ? mapped[0] : renamedLabel(raw);
        const title = mapped ? mapped[1] : raw;
        const isActive = tab.getAttribute('aria-selected') === 'true';
        const btn = buildPillButton(label, title, () => tab.click());
        if (mapped) {
          btn.style.setProperty('min-width', '26px', 'important');
          btn.style.setProperty('text-align', 'center', 'important');
          btn.style.setProperty('padding', '4px 8px', 'important');
        }
        styleToolbarButton(btn, isActive, menuColor, menuText);
        toolbar.appendChild(btn);
      });
    }

    if (subTabsRoot) {
      toolbar.appendChild(buildSeparator());
      Array.from(subTabsRoot.querySelectorAll('[role="tab"]')).forEach((tab) => {
        const raw = tab.textContent.trim();
        const isActive = tab.getAttribute('aria-selected') === 'true';
        const btn = buildPillButton(renamedLabel(raw), null, () => tab.click());
        styleToolbarButton(btn, isActive, menuColor, menuText);
        toolbar.appendChild(btn);
      });
    }
  }

  function scanRevision() {
    if (isDisabled()) return;
    styleEditionsStepper();
    labelTitreColumnHeader();
    ensureRevisionToolbar();
    renameCycleTabLabels();
  }

  registerScan(scanRevision);
})();
