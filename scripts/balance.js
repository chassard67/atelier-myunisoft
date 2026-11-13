// ==UserScript==
// @name         MyUnisoft – Balance : vue 100% personnalisée (v2, API directe)
// @namespace    https://nicolas.chassard/myunisoft
// @version      4.2-ext
// @description  v4.2 (2026-11-13, retours de Nicolas) : (1) Imprimer / Export Excel / ✕ ne sont plus collés au bord droit
//               de l'écran : l'en-tête et la zone de droite (curseur, bandeau, tableau) s'arrêtent au bord droit du
//               tableau (recalculé à chaque affichage et après un redimensionnement de colonne) ; (2) « Affichage
//               trimestriel » (T1…T4 = somme de 3 mois de month_values + Total) et « Affichage trimestriel cumulé »
//               (cumul depuis le début de l'exercice), mutuellement exclusifs avec les vues mensuelles ; (3) vues
//               mensuelles / trimestrielles grisées en Clients / Fournisseurs (et en balance âgée) : Balance générale
//               uniquement.
//               v4.1 (2026-11-13, demandé par Nicolas) : (1) « Montants affichés » remplace la case « Soldes débiteurs /
//               créditeurs » : Solde | Solde débiteur / Solde créditeur | Total débits / Total crédits / Solde | Total
//               débits / Total crédits / Solde débiteur / Solde créditeur (totaux = exercice_mvt de la réponse native,
//               relevé en direct ; soldes D/C d'un regroupement = somme de ceux de ses comptes) ; colonnes nommées
//               « Solde débiteur N », « Total débits N-1 »… ; ancien réglage mémorisé repris. (2) « Comparatif N-1 et
//               N-2 » remplace « Comparer avec N-1 » : N-1 (même réponse) + N-2 (même balance demandée sur la période
//               décalée de 2 ans, en période personnalisée, seulement quand la case est cochée, fusionnée par n° de
//               compte), même présentation que N, séparateur vertical entre exercices. (3) Curseur « Arrêté au » :
//               mois de l'exercice N uniquement, deux fois moins large, étiquette « 12/2026 ». (4) Validation : « AF »
//               (à faire) et « AV » (à valider) = non validé (codes relevés en direct), infobulle avec le code.
//               v4.0 (2026-11-13, maquette validée par Nicolas) : REFONTE — Balance Premium s'ouvre EN SURIMPRESSION
//               (comme Consultation Premium) au lieu de remplacer la balance native, qui reste intacte dessous (plus
//               aucun bloc natif masqué, plus de bouton dans la barre native, plus de synchronisation forcée avec le
//               sélecteur natif Générale/Client/Fournisseur). Charte Consultation Premium : en-tête (titre, PREMIUM,
//               contexte, Imprimer / Export Excel / ✕), options à gauche (+ sélecteur Générale / Clients / Fourn.,
//               + « Comparer avec N-1 »), curseur « Arrêté au » (ligne de temps : exercice N-1 + N (+ N+1), un mois
//               par cran, fin d'exercice par défaut ; au relâcher : période = début de l'exercice concerné → fin du
//               mois choisi, rechargement automatique ; fin d'exercice exacte = identifiant d'exercice piloté par le
//               sélecteur natif), bandeau des totaux (comptes affichés, Débit, Crédit, Résultat) + bandeau de la
//               sélection, tableau (lignes 30 px, en-têtes et filtres figés, Consolas, négatifs en rouge, sous-totaux
//               et totaux colorés). Colonnes : Var % retirée (au survol de Var €), Valid collab + Valid RM fusionnées
//               en « Valid. » (pastilles C / RM), PJ seulement si au moins un compte en a, colonnes N-1 masquables.
//               Options d'affichage mémorisées par dossier (localStorage tmbBalOpts|<onglet>), lien « Réinitialiser
//               les options ». Échap ou ✕ ferme la surimpression ; Imprimer n'imprime que le tableau.
//               v3.38 (2026-11-12, demandé par Nicolas) : nouvelle entrée « Balance Premium » dans le menu Tenue, juste
//               sous « Balance ». « Balance » = affichage natif strict (plus de clic automatique sur « Charger le tableau »,
//               aucune vue maison) ; « Balance Premium » = notre vue. Mode mémorisé par onglet (sessionStorage
//               tmbcBalanceMode) ; le bouton de bascule de la barre de titre reste disponible et met à jour ce mode.
//               v3.37 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — isElectron forcé à false : fenêtre de consultation en pleine page (branche navigateur), comme ce que produisait main.js.
//               v3.36 (2026-10-21) : corrige le changement de période (dates personnalisées) qui ne rafraîchissait pas les montants — pour une période ne correspondant à aucun exercice, dossier_revision_id n'est plus envoyé (comme l'affichage natif), sinon le serveur renvoyait la révision entière en ignorant la date de fin (ex. Mano, compte 44571100 : 16 426,26 au lieu de 0 au 31/05/2026). Les dates exactes d'un exercice gardent l'identifiant. Appliqué aux balances normale et âgée.
//               v3.35 (2026-08-01) : "Non soldés uniquement" désactivée automatiquement à
//               l'activation d'Affichage mensuel ou Affichage mensuel cumulé — demande explicite
//               de Nicolas ("ça fausse l'affichage et les additions") : un compte peut être soldé
//               sur l'exercice entier (exercice_values à 0, donc masqué par ce filtre) tout en
//               ayant eu des mouvements sur certains mois (month_values non nul), qui
//               disparaissaient alors silencieusement des colonnes mois ET des totaux (Total,
//               Total bilan/résultat/général de la v3.34). disableUnbalancedOnlyForMonthly()
//               appelée dans les handlers des 2 cases mensuelles, met state.unbalancedOnly à
//               false et relance le chargement (paramètre API, cf. buildNormalApiUrl) uniquement
//               si la case était cochée. La case "Non soldés uniquement" est en plus grisée
//               (disabled + classe tmb-opt-disabled déjà utilisée ailleurs dans le panneau) tant
//               qu'un des deux modes mensuels reste actif, pour qu'on ne puisse pas la
//               re-cocher par erreur sans d'abord quitter l'affichage mensuel. v3.34
//               (2026-08-01) : en Balance Générale (subtype 0), la ligne "Total" unique en
//               bas de tableau est remplacée par 3 lignes — "Total bilan" (classes de compte 1 à
//               5 + 8, comptes hors-bilan/engagements), "Total comptes de résultat" (classes 6
//               charges et 7 produits, PCG standard) et "Total général" (toutes classes) —
//               demande explicite de Nicolas, confirmée sur les classes 6/7 (pas 5/6 comme
//               d'abord énoncé, qui aurait fait chevaucher la classe 5 trésorerie entre les deux
//               groupes). En Client/Fournisseur (subtype 1/2), comportement inchangé : une seule
//               ligne "Total" (tous les comptes sont de toute façon dans la même classe 4). Nouvelle
//               fonction computeGeneralSplitRows (classe = 1er caractère de account_number du
//               nœud de tête data.data[i], cf. accountClassDigit) + buildLeafGroupTotal (reprend
//               la logique "gross" déjà existante de computeResultRow, paramétrée par un
//               sous-ensemble de feuilles). computeBottomRowNode renommée computeBottomRows et
//               retourne désormais un TABLEAU (0 à 3 lignes) plutôt qu'un nœud unique — les deux
//               appelants (rendu écran renderTablePanel, export Excel exportTableToExcel) itèrent
//               dessus ; sélection manuelle (case cochée) et mode âgé restent prioritaires et à
//               une seule ligne, comme avant. Une classe absente du jeu de données courant (ex.
//               filtre actif ne laissant aucun compte de classe 6/7 visible) ne produit
//               simplement pas de ligne pour ce groupe, plutôt qu'une ligne à 0. v3.33
//               (2026-08-01) : bug corrigé sur l'export Excel — les colonnes mois de
//               l'Affichage mensuel (et par le même oubli les colonnes du mode "Balance âgée" et
//               le nouveau "Total" mensuel) n'étaient jamais dans EXPORT_NUMERIC_COLUMN_IDS, donc
//               exportCellSpec retombait sur le texte formaté de cellDisplay ("1 234,56" avec
//               espace insécable de regroupement des milliers) au lieu d'un vrai nombre Excel —
//               inexploitable en formule/somme côté utilisateur. Colonnes mois ajoutées via
//               isMonthColumnId (nombre variable selon l'exercice, testé en OR séparé plutôt que
//               listé dans le Set) ; solde_aged/age_*/monthly_total ajoutés directement au Set.
//               Le nombre stocké est désormais la valeur brute (cellValue, sans mise en forme),
//               donc plus aucun espace de milliers dans la cellule — Excel applique son propre
//               format d'affichage (numFmtId=2, 2 décimales) sur la valeur numérique réelle.
//               v3.32 (2026-08-01) : deux correctifs/ajouts suite retour de Nicolas sur
//               l'Affichage mensuel (v3.31). 1) Bug corrigé : la ligne "Total" (ou "Total
//               sélection") en bas de tableau restait vide sur toutes les colonnes mensuelles —
//               computeResultRow/computeSelectionResultNode (et buildClassSubtotalNode, même
//               défaut) ne calculaient que exercice_values/débit-crédit sur leur nœud de
//               synthèse, jamais month_values ; cellValue('month_N', ...) échouait donc
//               silencieusement (Array.isArray(node.month_values) === false) sur ces lignes.
//               Nouvelle fonction sumMonthValues (même principe que sumGrossDebitCredit :
//               addition mois par mois sur les feuilles réellement affichées) appelée dans les 3
//               fonctions concernées. 2) Nouvelle case "Affichage mensuel cumulé", mutuellement
//               exclusive avec "Affichage mensuel" (même mécanique que Sous-totaux avec/sans
//               regroupements) : chaque colonne mois affiche le cumul depuis le premier mois de
//               l'exercice jusqu'à ce mois inclus plutôt que le seul mouvement du mois (cellValue,
//               boucle de sommation 0..idx sur le même month_values), sans colonne "Total" finale
//               (buildMonthColumns, sans le push de monthly_total qu'ajoute monthColumns) —
//               puisque le dernier mois cumulé est déjà le total. Contrairement au mode mensuel
//               simple (0 affiché vide), un cumul à 0 s'affiche "0,00" : c'est un vrai solde à
//               cette date, pas une absence de mouvement. v3.31 (2026-08-01) : "Affichage
//               mensuel" revu suite retour de Nicolas — la
//               v3.30 insérait les colonnes mois au milieu du tableau normal ; cette version les
//               affiche plutôt dans une vue dédiée entièrement séparée (allColumns : branche
//               `if (state.showMonthly)`) qui ne garde QUE N° Compte / Intitulé / une colonne par
//               mois / Total, quel que soit l'état des autres cases du panneau (Solde N/N-1,
//               Var %/€, Débit/Crédit, PJ/Com/Valid disparaissent entièrement en mode mensuel).
//               Libellés de colonne mois passés du format textuel "janv. 2026" à un format
//               numérique "MM/AA" (ex. "07/25" pour juillet 2025, "06/26" pour juin 2026 sur un
//               exercice décalé 01/07/2025-30/06/2026) — construit directement depuis
//               getMonth()/getFullYear() sur chaque mois calculé à partir de state.startDate,
//               donc suit naturellement n'importe quel calendrier d'exercice (civil ou décalé)
//               sans logique spécifique. Nouvelle colonne "Total" (monthly_total) en dernière
//               position : somme de tous les mois du tableau `month_values` du nœud
//               (cellValue/cellDisplay dédiés) — contrairement aux colonnes mois individuelles
//               (0 affiché vide), le Total s'affiche toujours, y compris à 0, car c'est un vrai
//               agrégat et non une absence de mouvement. monthly_total ajouté aux deux Sets
//               génériques (NEGATIVE_HIGHLIGHT_COLUMN_IDS, AMOUNT_FILTER_COLUMN_IDS) pour hériter
//               gratuitement du rouge sur négatif et du filtre par montant, comme toute autre
//               colonne de montant. v3.30 (2026-08-01) : première version de l'"Affichage
//               mensuel" (insertion au milieu du tableau normal, libellés textuels via
//               toLocaleDateString) — remplacée par la présente v3.31, cf. ci-dessus ; le champ
//               `month_values` par nœud (compte ET groupe/classe) découvert par inspection de la
//               fibre React de la page native reste la source de données, inchangé. v3.29
//               (2026-08-01) : "Balance âgée" (case native "Âgée", Client/Fournisseur
//               uniquement) portée dans l'architecture modulaire, à partir de l'ancien script
//               Tampermonkey v3.33 fourni par Nicolas — endpoint et forme de réponse différents
//               du mode normal (buildAgedApiUrl : pas de suffixe /v2, params réduits type=aged +
//               compared_to, réponse à plat {totals, details:[...]} au lieu de la hiérarchie
//               {data:[...]}). 2 nouvelles cases dans le groupe "Tiers" du panneau : "Balance
//               âgée - date de facture" et "Balance âgée - date de règlement" (mutuellement
//               exclusives, aucune des deux obligatoire), actives uniquement en Client/Fournisseur
//               — état interne state.aged/agedCompareTo, remis à false en repassant en Balance
//               Générale. Colonnes propres au mode âgé (AGED_COLUMNS) : N° Compte, Intitulé,
//               Solde, < 30j, < 45j, < 60j, < 90j, < 120j, > 120j, PJ, Com., Valid collab, Valid
//               RM — PJ/Com./Valid collab/Valid RM restent masquées tant que "Colonnes de
//               révision" n'est pas cochée, comme en mode normal, et délèguent au tableau natif
//               de la même façon (aucune logique nouvelle nécessaire, le mécanisme existant est
//               générique sur node.id_l_dossier_revision_compte/id_account/validation). Tri,
//               filtre par colonne (y compris filtres de montant), ligne "Total" et "Total
//               sélection" fonctionnent comme en mode normal, recalculés sur cette nouvelle forme
//               de données (buildAgedResultNode/sumAgedNodes). La case native "Âgée" elle-même
//               est masquée (display:none, jamais supprimée) uniquement en "Affichage Premium" —
//               en "Affichage MyUnisoft" natif elle reste visible et fonctionne normalement,
//               bascule immédiate au clic sur le bouton Affichage sans attendre le prochain tick.
//               v3.28 (2026-08-01) : option "Cumul" retirée du panneau (inutile en pratique,
//               demande de Nicolas) — reste envoyée à l'API avec sa valeur par défaut (false),
//               simplement plus modifiable depuis l'UI. Les cases du panneau sont regroupées par
//               catégorie avec un petit titre : "Affichage" (Non soldés uniquement, Soldes
//               débiteurs/créditeurs, Sous-totaux avec/sans regroupements), "Tiers" (Comptes de
//               tiers centralisés — la "Balance âgée" date facture/règlement n'existe pas encore
//               dans ce module, à récupérer depuis l'ancien script Tampermonkey si besoin) et
//               "Révision" (Colonnes de révision, Comptes non validés uniquement). Colonne
//               Intitulé : au-delà de 40 caractères, le texte est tronqué (…) et le libellé
//               complet reste consultable via l'attribut title natif du <td> (infobulle du
//               navigateur, délai natif ~1s) ; l'export Excel garde toujours le texte complet,
//               non tronqué (chemin de code indépendant). v3.27 (2026-08-01) : migration dans
//               l'architecture modulaire TMBC (cf.
//               TMBC_TOOLKIT_CONTRACT.md). Le fichier importe désormais le kit partagé de
//               premium.js (destructuration standard en tête d'IIFE) au lieu de dupliquer
//               localement detectMenuColor/readableTextOn/isColorUsable — ces trois fonctions
//               étaient identiques à celles du core, supprimées ici. isDisabled() (via
//               window.TMBC) remplace la lecture directe de
//               localStorage.getItem('tmbc-scripts-disabled'), même comportement. Le sondage
//               continu du sous-type natif (checkNativeSubtype/repositionToggleButton),
//               auparavant son propre setInterval(500ms) local (subtypePollTimer), est
//               remplacé par scanBalance(), enregistrée sur le tick partagé du core
//               (registerScan, ~1s, cf. premium.js) — respecte la règle "un seul scheduler" du
//               contrat modulaire. L'appel immédiat au moment de l'installation de l'UI custom
//               est conservé (effet instantané sans attendre le premier tick). Les deux autres
//               timers du fichier (bootstrapTimer, 400ms auto-terminant pendant le reniflage
//               initial du dossier_revision_id ; reapplyHidden, 100ms transitoire pendant
//               switchFiscalYear) restent des setInterval locaux dédiés, volontairement NON
//               convertis au tick partagé — sensibles au timing (attente d'un appel réseau
//               réel / d'un re-rendu React précis), un cadencement à 1s les rendrait beaucoup
//               plus lents ou peu fiables. Aucun changement de comportement visible attendu
//               pour l'utilisateur. Historique complet des versions 2.0 à 3.26 (avant cette
//               migration) déplacé dans CHANGELOG-balance-legacy.txt à la racine du projet.
// @author       Nicolas
// @match        https://connect.lgassocies.com/*
// @match        https://*.myunisoft.fr/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // (2026-07-31, migration dans l'architecture modulaire, cf.
  // TMBC_TOOLKIT_CONTRACT.md) : déstructuration standard du kit partagé —
  // même bloc, dans le même ordre, que menus.js/revision.js/consultation.js/
  // suivi-semaine.js/saisie.js, pour rester comparable d'un module à
  // l'autre même si balance.js n'utilise pas chaque entrée.
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

  // Interrupteur general partage avec "MyUnisoft - Premium interface globale" :
  // desactive, ce script entier reste inerte (comme un script Tampermonkey
  // eteint), y compris le reniflage fetch/XHR ci-dessous. Change au prochain
  // rechargement de page, pas retroactivement sur la page deja ouverte (cf.
  // le bouton PREMIUM) — comportement d'origine preserve a l'identique,
  // seule la source de verite change (window.TMBC.isDisabled() au lieu de
  // relire localStorage directement).
  if (isDisabled()) return;

  const BALANCE_PATH_RE = /\/current-editions\/balance(\/|\?|$)/;
  function isBalancePage() {
    return BALANCE_PATH_RE.test(location.pathname);
  }
  // Identifiant de société/onglet dans l'URL (.../tab/182/...) : sert à
  // détecter un changement de société tout en restant sur la page Balance
  // (l'utilisateur passe d'un onglet société à un autre) — un cas que
  // isBalancePage() seul ne peut pas voir, puisque le chemin reste
  // ".../current-editions/balance" des deux côtés.
  function extractTabId(path) {
    const m = /^\/tab\/(\d+)\//.exec(path);
    return m ? m[1] : null;
  }

  // -----------------------------------------------------------------------
  // 1. Reniflage des appels réseau natifs vers balance_dynamique/v2.
  //    Objectif unique : apprendre dossier_revision_id (jamais visible dans
  //    l'URL de la page ni dans le HTML) + fiscal_year_list/month_list, en
  //    observant UNE fois la requête que l'app fait elle-même. Après ce
  //    bootstrap, on n'a plus besoin d'observer quoi que ce soit : on appelle
  //    l'API nous-mêmes avec nos propres paramètres.
  // -----------------------------------------------------------------------
  const sniff = { params: null, data: null, headers: null };

  // En-têtes qu'on ne doit/peut pas rejouer nous-mêmes (soit interdits par le
  // navigateur sur un fetch manuel, soit gérés automatiquement).
  const HEADER_BLOCKLIST = new Set([
    'content-length',
    'host',
    'connection',
    'cookie',
    'origin',
    'referer',
    'user-agent',
    'accept-encoding',
  ]);

  function parseUrlParams(url) {
    try {
      const u = new URL(url, location.origin);
      const o = {};
      u.searchParams.forEach((v, k) => {
        o[k] = v;
      });
      return o;
    } catch (e) {
      return null;
    }
  }

  function mergeSniffedHeaders(h) {
    if (!h) return;
    const clean = {};
    Object.keys(h).forEach((k) => {
      if (!HEADER_BLOCKLIST.has(k.toLowerCase()) && h[k] != null) clean[k] = h[k];
    });
    sniff.headers = Object.assign({}, sniff.headers, clean);
  }

  function onSniffed(url, data, headers) {
    sniff.data = data;
    sniff.params = parseUrlParams(url);
    if (headers) mergeSniffedHeaders(headers);
    window.dispatchEvent(new CustomEvent('tmb-sniffed'));
  }

  const _fetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('balance_dynamique') !== -1) {
      const hdrs = {};
      try {
        const initHeaders = (init && init.headers) || (input && input.headers);
        if (initHeaders) {
          if (typeof initHeaders.forEach === 'function') {
            initHeaders.forEach((v, k) => (hdrs[k] = v));
          } else {
            Object.assign(hdrs, initHeaders);
          }
        }
      } catch (e) {}
      mergeSniffedHeaders(hdrs);
    }
    const result = _fetch.apply(this, arguments);
    if (url.indexOf('balance_dynamique') !== -1) {
      result
        .then((res) => {
          try {
            res
              .clone()
              .json()
              .then((data) => onSniffed(url, data))
              .catch(() => {});
          } catch (e) {}
        })
        .catch(() => {});
    }
    return result;
  };

  // De nombreuses apps (Angular/Axios...) utilisent XMLHttpRequest plutôt que
  // fetch sous le capot : on intercepte donc aussi XHR, sinon le reniflage ne
  // se déclenche jamais et le script boucle indéfiniment sur le clic natif
  // (c'est très probablement ce qui a causé le rechargement en boucle).
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;
  const _xhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__tmbUrl = url;
    return _xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this.__tmbUrl && String(this.__tmbUrl).indexOf('balance_dynamique') !== -1) {
      if (!this.__tmbHeaders) this.__tmbHeaders = {};
      this.__tmbHeaders[name] = value;
    }
    return _xhrSetHeader.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const url = this.__tmbUrl;
    if (url && String(url).indexOf('balance_dynamique') !== -1) {
      if (this.__tmbHeaders) mergeSniffedHeaders(this.__tmbHeaders);
      this.addEventListener('load', function () {
        try {
          const data = JSON.parse(this.responseText);
          onSniffed(url, data);
        } catch (e) {}
      });
    }
    return _xhrSend.apply(this, arguments);
  };

  // -----------------------------------------------------------------------
  // 2. Utilitaires de format de date : l'API veut "YYYYMMDD", les <input
  //    type=date> et le texte "01/07/2025 au 30/06/2026" (fiscal_year_list)
  //    utilisent d'autres formats.
  // -----------------------------------------------------------------------
  function toApiDate(yyyyMmDd) {
    // "2025-07-01" -> "20250701"
    return (yyyyMmDd || '').replace(/-/g, '');
  }
  function toInputDate(apiDate) {
    // "20250701" -> "2025-07-01"
    if (!apiDate || apiDate.length !== 8) return '';
    return apiDate.slice(0, 4) + '-' + apiDate.slice(4, 6) + '-' + apiDate.slice(6, 8);
  }
  function frToInputDate(fr) {
    // "01/07/2025" -> "2025-07-01"
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fr.trim());
    if (!m) return '';
    return m[3] + '-' + m[2] + '-' + m[1];
  }
  function parseFiscalYearEntry(entry) {
    // "01/07/2025 au 30/06/2026" -> { start: '2025-07-01', end: '2026-06-30', label: entry }
    const m = /^(\d{2}\/\d{2}\/\d{4})\s+au\s+(\d{2}\/\d{2}\/\d{4})$/.exec(entry.trim());
    if (!m) return null;
    return { start: frToInputDate(m[1]), end: frToInputDate(m[2]), label: entry };
  }
  function fmtAmount(n) {
    if (n === null || n === undefined) return '';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPercent(n) {
    if (n === null || n === undefined) return '';
    return Math.round(n) + '%';
  }

  // -----------------------------------------------------------------------
  // 3. État de l'UI custom.
  // -----------------------------------------------------------------------
  const state = {
    dossierRevisionId: null,
    subtype: 0, // 0 Générale, 1 Client, 2 Fournisseur
    filterRange: '', // "41-419999" etc. (compte pour Client/Fournisseur)
    startDate: '', // "2025-07-01"
    endDate: '', // "2026-06-30"
    unbalancedOnly: true,
    centralizeAccount: false,
    unvalidatedOnly: false,
    showRevisionCols: false, // -> extended
    // (v4.1) Présentation des montants : 'solde' | 'sdc' (solde débiteur / créditeur) |
    // 'tdc' (total débits / total crédits / solde) | 'tdcsdc' (totaux + soldes D/C).
    amountMode: 'solde',
    showClassSubtotals: false, // vue à plat + une ligne de total par classe (1, 2, 3...), sans hiérarchie dépliable
    selectedKeys: new Set(), // comptes cochés (clic / maj+clic) — remplace la ligne "Résultat" par leur total
    lastClickedSelKey: null, // dernier compte coché, pour l'étendue maj+clic
    cumul: false,
    anSimulation: false,
    compare: false,
    showSubtotals: false, // 100% côté client, pas de paramètre API — décoché par défaut
    showMonthly: false, // "Affichage mensuel" — 100% côté client (voir monthColumns), la réponse
    // balance_dynamique/v2 contient déjà month_values sur chaque nœud quel que soit l'état de
    // cette case (confirmé par reniflage réseau : mêmes params envoyés en Mois qu'en Cumul côté
    // natif) — inutile de recharger, comme showDebitCredit/showSubtotals.
    showQuarterly: false, // (v4.2) "Affichage trimestriel" — trimestres de l'exercice (3 mois de month_values)
    showQuarterlyCumulative: false, // (v4.2) "Affichage trimestriel cumulé" — cumul depuis le début de l'exercice
    showMonthlyCumulative: false, // "Affichage mensuel cumulé" (2026-08-01) — variante mutuellement
    // exclusive de showMonthly : chaque colonne mois affiche le cumul depuis le début de
    // l'exercice plutôt que le seul mouvement du mois (voir cellValue), et il n'y a pas de
    // colonne "Total" finale (le dernier mois cumulé EST déjà le total).
    filterRangeUserEdited: false, // dès que l'utilisateur touche la plage, on arrête d'y appliquer le défaut auto
    sortCol: null,
    sortDir: 'none', // 'asc' | 'desc' | 'none'
    filterText: {}, // { colId: 'texte' }
    expanded: new Set(),
    data: null, // dernière réponse de l'API
    fiscalYears: [], // [{start,end,label}]
    loading: false,
    error: null,
    columnWidths: {}, // { colId: '123px' } — largeurs ajustées manuellement
    commentCounts: {}, // { id_account: nombre de commentaires } — rempli à la demande (voir refreshCommentCounts)
    aged: false, // "Balance âgée" (uniquement Client/Fournisseur) — voir buildAgedApiUrl
    agedCompareTo: 1, // 1 = Date de facture, 2 = Date d'échéance (reniflé en direct sur le panneau natif)
    compareN1: true, // (v4.1) « Comparatif N-1 et N-2 » : colonnes N-1 (même réponse) + N-2 (appel complémentaire)
    n2: null, // (v4.1) { url, loading, error, count } — balance de l'exercice N-2 fusionnée par n° de compte
    n2Gen: 0,
    revisionFyKey: '', // (v4.0) exercice "début|fin" auquel correspond dossierRevisionId
  };

  // (v4.0, demande de Nicolas) Options d'affichage mémorisées PAR DOSSIER
  // (identifiant d'onglet société de l'URL /tab/<id>/) : on retrouve ses
  // réglages en revenant sur la balance d'un dossier ; un autre dossier
  // repart des réglages par défaut. Les dates ne sont pas mémorisées (la
  // balance s'ouvre toujours sur l'exercice proposé par MyUnisoft).
  const OPTS_KEYS = [
    'subtype', 'filterRange', 'filterRangeUserEdited', 'unbalancedOnly', 'centralizeAccount',
    'unvalidatedOnly', 'showRevisionCols', 'amountMode', 'showSubtotals', 'showClassSubtotals',
    'showMonthly', 'showMonthlyCumulative', 'showQuarterly', 'showQuarterlyCumulative', 'compareN1', 'aged', 'agedCompareTo', 'columnWidths',
  ];
  // Options qui changent la requête serveur : un écart avec ce qui a été
  // reniflé impose un rechargement.
  const OPTS_API_KEYS = ['subtype', 'filterRange', 'unbalancedOnly', 'centralizeAccount', 'unvalidatedOnly', 'showRevisionCols', 'aged', 'agedCompareTo'];
  function optsStorageKey() {
    const t = extractTabId(location.pathname);
    return t ? 'tmbBalOpts|' + t : null;
  }
  function saveOpts() {
    const k = optsStorageKey();
    if (!k) return;
    const o = {};
    OPTS_KEYS.forEach((key) => {
      o[key] = state[key];
    });
    try {
      localStorage.setItem(k, JSON.stringify(o));
    } catch (e) {
      /* stockage plein ou indisponible */
    }
  }
  // Applique les options mémorisées du dossier courant ; renvoie true si une
  // option qui change la requête serveur diffère de l'état reniflé.
  function restoreOpts() {
    const k = optsStorageKey();
    let o = null;
    try {
      o = k ? JSON.parse(localStorage.getItem(k) || 'null') : null;
    } catch (e) {
      o = null;
    }
    if (!o || typeof o !== 'object') return false;
    // (v4.1) ancienne case « Soldes débiteurs / créditeurs » -> mode d'affichage
    if (!('amountMode' in o) && o.showDebitCredit) o.amountMode = 'sdc';
    let apiChanged = false;
    OPTS_KEYS.forEach((key) => {
      if (!(key in o)) return;
      if (OPTS_API_KEYS.includes(key) && JSON.stringify(o[key]) !== JSON.stringify(state[key])) apiChanged = true;
      state[key] = o[key];
    });
    if (state.subtype === 0) state.aged = false;
    return apiChanged;
  }

  const DEFAULT_RANGE_BY_SUBTYPE = { 1: '41-419999', 2: '40-409999' };

  // -----------------------------------------------------------------------
  // 4. Appel direct de l'API (notre propre fetch, patché ci-dessus mais ça
  //    ne change rien pour nous : on lit directement la réponse retournée).
  // -----------------------------------------------------------------------
  // Période personnalisée (dates ne correspondant à aucun exercice) : l'affichage
  // natif n'envoie PAS dossier_revision_id dans ce cas (vérifié en direct sur Mano).
  // Avec l'identifiant d'exercice, le serveur renvoie la révision entière et
  // ignore la date de fin (ex. compte 44571100 à 16 426,26 au lieu de 0 au 31/05).
  // Les dates exactes d'un exercice gardent l'identifiant (changement d'exercice).
  function isCustomPeriod() {
    return (
      state.fiscalYears.length > 0 &&
      !state.fiscalYears.some((f) => f.start === state.startDate && f.end === state.endDate)
    );
  }

  function buildApiUrl() {
    return state.aged ? buildAgedApiUrl() : buildNormalApiUrl();
  }

  function buildNormalApiUrl() {
    const params = {
      start_date: toApiDate(state.startDate),
      end_date: toApiDate(state.endDate),
      dossier_revision_id: state.dossierRevisionId,
      compare: String(state.compare),
      unbalanced_only: String(state.unbalancedOnly),
      cumul: String(state.cumul),
      an_simulation: String(state.anSimulation),
      centralize_account: String(state.centralizeAccount),
      extended: String(state.showRevisionCols),
      subtype: String(state.subtype),
      unvalidated_accounts_only: String(state.unvalidatedOnly),
    };
    // Le champ plage reste visible même en Générale (demande explicite) : on
    // envoie le filtre dès qu'il est renseigné, peu importe le type.
    if (state.filterRange) {
      params.filter = state.filterRange;
    }
    if (isCustomPeriod()) {
      delete params.dossier_revision_id;
    }
    const qs = Object.keys(params)
      .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
      .join('&');
    return 'https://prod-ws.myunisoft.fr/balance_dynamique/v2?' + qs;
  }

  // "Balance âgée" (case native "Âgée", Client/Fournisseur uniquement) :
  // endpoint et forme de réponse complètement différents, reniflés en direct
  // par Nicolas (script Tampermonkey v3.29-3.33 fourni le 2026-08-01) — même
  // chemin de base SANS suffixe /v2, params réduits (type=aged, compared_to
  // = 1 pour "Date de facture" ou 2 pour "Date d'échéance", cumul toujours
  // envoyé à "0" — aucune case "Cumul" dans le panneau natif en mode âgé).
  // Réponse : { totals: {total_values, column_values}, details: [...] }, une
  // LISTE PLATE de comptes (pas de hiérarchie account_List), chaque compte
  // ayant total_values (tableau à 1 valeur = le solde) et column_values (6
  // tranches d'ancienneté, dans l'ordre des en-têtes natifs "< 30j / < 45j /
  // < 60j / < 90j / < 120j / > 120j").
  function buildAgedApiUrl() {
    const params = {
      start_date: toApiDate(state.startDate),
      end_date: toApiDate(state.endDate),
      dossier_revision_id: state.dossierRevisionId,
      type: 'aged',
      compared_to: String(state.agedCompareTo),
      cumul: '0',
    };
    if (state.filterRange) {
      params.filter = state.filterRange;
    }
    if (isCustomPeriod()) {
      delete params.dossier_revision_id;
    }
    const qs = Object.keys(params)
      .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
      .join('&');
    return 'https://prod-ws.myunisoft.fr/balance_dynamique?' + qs;
  }

  // Calcule où placer la fenêtre popup de consultation pour qu'elle se
  // "docke" toute seule à droite du tableau, sans jamais le recouvrir :
  // occupe tout l'écran disponible (demande explicite : consultation en
  // pleine page). On repart de window.screen.availLeft/availTop/availWidth/
  // availHeight (repère de l'écran COURANT, celui où se trouve la fenêtre du
  // navigateur) plutôt que de supposer un repère absolu à 0 : sur un écran
  // secondaire (bureau à distance, multi-écran), l'origine n'est pas
  // forcément (0,0) — c'est cette hypothèse fausse qui avait causé en
  // v3.10/v3.11 des popups placées hors écran (donc "vides" en pratique).
  // Même seuil que premium.js/main.js, pour rester cohérent avec la fenêtre
  // principale Electron (qui s'ouvre elle-même à 3/5 de l'écran sur
  // ultra-wide, cf. main.js). Détection du contexte Electron via
  // process.versions.electron (absent d'un vrai navigateur/Tampermonkey).
  const ULTRAWIDE_BREAKPOINT = 1920;
  // (2026-11-12, extension Chrome) pas d'Electron : branche navigateur (pleine page).
  const isElectron = false;

  function computeConsultWindowGeometry() {
    const screenLeft = window.screen.availLeft || 0;
    const screenTop = window.screen.availTop || 0;
    const screenW = window.screen.availWidth;
    const screenH = window.screen.availHeight;

    if (isElectron && screenW >= ULTRAWIDE_BREAKPOINT) {
      // Sous Electron sur écran ultra-wide, la fenêtre principale occupe
      // déjà 3/5 de l'écran (cf. main.js) : la fenêtre de consultation suit
      // la même règle plutôt que de s'étaler sur toute la largeur, pour
      // rester cohérente visuellement.
      return {
        left: screenLeft,
        top: screenTop,
        width: Math.round((screenW * 3) / 5),
        height: screenH,
      };
    }

    return { left: screenLeft, top: screenTop, width: screenW, height: screenH };
  }

  // Ouvre une URL dans une vraie fenêtre popup (et non un nouvel onglet),
  // en pleine page sur l'écran courant (voir computeConsultWindowGeometry) :
  // en passant des "window features", la plupart des navigateurs détachent
  // la fenêtre au lieu de créer un onglet.
  // ⚠ "noopener" coupe la relation avec la fenêtre parente ; certaines pages
  // de l'appli (ou le navigateur lui-même selon la config) s'en servent et
  // n'affichent rien sans elle (constaté en direct) — on NE le met PAS.
  // Nom de fenêtre fixe (au lieu de "_blank") : si une fenêtre de
  // consultation est déjà ouverte, le navigateur réutilise CETTE fenêtre (il
  // la navigue vers la nouvelle URL et lui redonne le focus) au lieu d'en
  // ouvrir une nouvelle à chaque clic ; si elle a été fermée entre-temps, il
  // en réouvre une neuve normalement, sans code supplémentaire nécessaire.
  // Ctrl+clic (Cmd+clic sur Mac) force une fenêtre séparée : on lui donne un
  // nom unique à chaque fois (au lieu du nom fixe réutilisé sinon), pour que
  // le navigateur en ouvre bien une NOUVELLE au lieu de recycler celle déjà
  // ouverte — pratique pour comparer deux comptes côte à côte.
  let consultWindowCounter = 0;
  const CONSULT_WINDOW_NAME = 'tmb-consult-window';
  function openInNewWindow(url, forceNew) {
    const g = computeConsultWindowGeometry();
    const features = `left=${g.left},top=${g.top},width=${g.width},height=${g.height},resizable=yes,scrollbars=yes`;
    const name = forceNew ? CONSULT_WINDOW_NAME + '-' + ++consultWindowCounter : CONSULT_WINDOW_NAME;
    // Repère additionnel pour le wrapper Electron : le nom passé à
    // window.open() n'est pas fidèlement transmis à setWindowOpenHandler
    // côté process principal (constaté en direct : frameName renvoie
    // toujours "popup" dès que des window features sont fournis) — un
    // fragment d'URL, jamais envoyé au serveur, permet de distinguer une
    // ouverture forcée de façon fiable malgré ça. Sans effet en usage
    // navigateur/Tampermonkey classique (fragment simplement ignoré).
    const finalUrl = forceNew ? url + '#tmb-force-new-' + consultWindowCounter : url;
    window.open(finalUrl, name, features);
  }

  // Le clic sur un numéro de compte / montant en affichage natif ouvre une
  // nouvelle fenêtre vers .../child/consulting?... (observé en direct : ex.
  // https://connect.lgassocies.com/tab/281/child/consulting?isAllLines=true
  // &accountId=373947&dateStart=20260101&dateEnd=20261231&lettered=all
  // &isSituation=false). On reconstruit la même URL nous-mêmes : uniquement
  // visible/actif en vue à plat (sous-totaux masqués), comme dans l'appli
  // native, car seuls les comptes feuilles ont un id_account exploitable.
  function buildConsultingUrl(idAccount) {
    const m = location.pathname.match(/^(\/tab\/\d+)\//);
    const prefix = m ? m[1] : '';
    const qs = new URLSearchParams({
      isAllLines: 'true',
      accountId: String(idAccount),
      dateStart: toApiDate(state.startDate),
      dateEnd: toApiDate(state.endDate),
      lettered: 'all',
      isSituation: 'false',
    });
    return location.origin + prefix + '/child/consulting?' + qs.toString();
  }

  const LINKABLE_COLUMN_IDS = new Set(['account_number', 'solde_n', 'solde_n1', 'debit_n', 'credit_n', 'debit_n1', 'credit_n1', 'var_pct', 'var_eur']);
  // Colonnes de montants/pourcentages où une valeur négative doit s'afficher en
  // rouge (Débit/Crédit sont toujours affichés en valeur positive, inutile ici).
  const NEGATIVE_HIGHLIGHT_COLUMN_IDS = new Set([
    'solde_n', 'solde_n1', 'var_eur', 'var_pct',
    'solde_aged', 'age_30', 'age_45', 'age_60', 'age_90', 'age_120', 'age_over120',
    'monthly_total',
  ]);
  // Intitulé tronqué au-delà de 40 caractères (demande du 2026-08-01) : le
  // texte complet reste consultable via l'attribut title natif du <td>, dont
  // le survol déclenche l'infobulle du navigateur au bout d'~1s (comportement
  // natif, pas besoin de JS supplémentaire pour le délai).
  const LABEL_TRUNCATE_LENGTH = 40;
  function isLinkableCell(node, colId) {
    // PJ/Com. ont leur propre popover (voir loadDocuments/loadComments) —
    // seules les colonnes numéro de compte / montants ouvrent la fiche de
    // consultation native.
    return !state.showSubtotals && (LINKABLE_COLUMN_IDS.has(colId) || isAmountColId(colId)) && node && node.id_account;
  }

  // -----------------------------------------------------------------------
  // PJ / Commentaires : reproduction en lecture seule de ce que l'affichage
  // natif MyU montre au clic sur les icônes correspondantes. Deux endpoints
  // distincts, observés en direct sur l'appli native :
  //  - documents : GET /document/all_types?location=da_acc&objectId=
  //    {id_l_dossier_revision_compte} (⚠ pas le même id que id_account)
  //  - commentaires : GET /comments?account_id={id_account}
  //    &dossier_revision_id={dossierRevisionId}
  // On réutilise les en-têtes d'authentification déjà interceptés par le
  // "sniffing" de fetch/XHR (sniff.headers) : aucune requête de connexion
  // supplémentaire n'est nécessaire. Ces popovers n'offrent pas l'ajout de
  // PJ/commentaire (uniquement la consultation) : l'appli native gère ça via
  // des modales complexes (upload, éditeur riche) qu'on ne cherche pas à
  // reproduire ici, seulement à donner une vue rapide sans quitter le tableau.
  async function loadDocuments(objectId) {
    const qs = new URLSearchParams({ location: 'da_acc', objectId: String(objectId) });
    const res = await fetch('https://prod-ws.myunisoft.fr/document/all_types?' + qs.toString(), {
      credentials: 'include',
      headers: sniff.headers || {},
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const docs = await res.json();
    if (!Array.isArray(docs) || docs.length === 0) {
      return '<div class="tmb-popover-empty">Aucune pièce jointe.</div>';
    }
    return (
      '<ul class="tmb-popover-list">' +
      docs
        .map((d) => {
          const name = xmlEscape((d.name || 'Document') + (d.extension ? '.' + d.extension : ''));
          const date = xmlEscape(d.date_time || '');
          const url = d.link || d.download || '';
          const label = url ? `<a href="#" class="tmb-popover-open" data-url="${xmlEscape(url)}">${name}</a>` : name;
          return `<li>${label}${date ? `<span class="tmb-popover-meta">${date}</span>` : ''}</li>`;
        })
        .join('') +
      '</ul>'
    );
  }

  // Formate une date de commentaire ("2026-07-22T16:52:47" ou similaire) en
  // "22/07/2026 16:52" ; retombe sur la valeur brute si le format est
  // inattendu, plutôt que d'afficher une chaîne vide.
  function fmtCommentDate(raw) {
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function loadComments(accountId) {
    const qs = new URLSearchParams({
      account_id: String(accountId),
      dossier_revision_id: String(state.dossierRevisionId || ''),
    });
    const res = await fetch('https://prod-ws.myunisoft.fr/comments?' + qs.toString(), {
      credentials: 'include',
      headers: sniff.headers || {},
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const comments = await res.json();
    if (!Array.isArray(comments) || comments.length === 0) {
      return '<div class="tmb-popover-empty">Aucun commentaire.</div>';
    }
    return (
      '<ul class="tmb-popover-list">' +
      comments
        .map((c) => {
          const author = xmlEscape(c.name || c.trigram || '');
          const date = xmlEscape(fmtCommentDate(c.date));
          // c.body est du HTML (l'appli native l'édite avec un éditeur riche,
          // ex. "<p>...</p>") : on l'affiche tel quel (comme le ferait
          // l'affichage natif) plutôt que de l'échapper en texte brut, sinon
          // les balises apparaissent littéralement au lieu d'être rendues.
          const body = c.body || '';
          return `<li><div class="tmb-popover-comment-head">${author}${date ? `<span class="tmb-popover-meta">${date}</span>` : ''}</div><div class="tmb-popover-comment-body">${body}</div></li>`;
        })
        .join('') +
      '</ul>'
    );
  }

  // Nombre réel de commentaires d'un compte, en réutilisant le même endpoint
  // que loadComments — l'API balance_dynamique elle-même n'expose qu'un
  // booléen hasComment, jamais un compte (vérifié en direct par reniflage
  // réseau), donc le seul moyen d'avoir le vrai nombre est cet appel
  // supplémentaire par compte. On ne l'appelle que pour les comptes
  // effectivement marqués hasComment (voir refreshCommentCounts), jamais en
  // arrière-plan sur tous les comptes.
  async function fetchCommentCount(accountId) {
    const qs = new URLSearchParams({
      account_id: String(accountId),
      dossier_revision_id: String(state.dossierRevisionId || ''),
    });
    const res = await fetch('https://prod-ws.myunisoft.fr/comments?' + qs.toString(), {
      credentials: 'include',
      headers: sniff.headers || {},
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const comments = await res.json();
    return Array.isArray(comments) ? comments.length : 0;
  }

  // Va chercher le nombre de commentaires pour tous les comptes marqués
  // hasComment dont on n'a pas encore le compte réel — seulement quand les
  // "Colonnes de révision" sont affichées (colonne Com. visible), et jamais
  // en dupliquant un appel déjà en cours. Chaque compte résolu déclenche un
  // re-rendu (affichage progressif au fur et à mesure des réponses, plutôt
  // que d'attendre que tout soit chargé).
  let commentCountsInFlight = false;
  function refreshCommentCounts() {
    if (!state.showRevisionCols || !state.data) return;
    if (commentCountsInFlight) return;
    const root = state.data && state.data.data && state.data.data[0];
    if (!root || !root.account_List) return;
    const leaves = flattenLeaves(root.account_List, []).map((r) => r.node);
    const toFetch = leaves.filter(
      (n) => n.hasComment && n.id_account != null && state.commentCounts[n.id_account] === undefined
    );
    if (!toFetch.length) return;
    commentCountsInFlight = true;
    Promise.all(
      toFetch.map((n) =>
        fetchCommentCount(n.id_account)
          .then((count) => {
            state.commentCounts[n.id_account] = count;
          })
          .catch(() => {
            state.commentCounts[n.id_account] = null; // échec : on n'insiste pas, l'icône reste sans chiffre
          })
      )
    ).then(() => {
      commentCountsInFlight = false;
      renderApp();
    });
  }

  // Affiche un petit popover (chargement -> contenu) ancré sous l'icône
  // cliquée. `contentPromise` est une Promise<string HTML> (voir
  // loadDocuments/loadComments) ; se ferme au clic en dehors ou sur Échap.
  function showInfoPopover(anchorEl, title, contentPromise) {
    closeInfoPopover();
    const pop = document.createElement('div');
    pop.id = 'tmb-info-popover';
    pop.className = 'tmb-popover';
    pop.innerHTML = `<div class="tmb-popover-title">${xmlEscape(title)}</div><div class="tmb-popover-body">Chargement…</div>`;
    document.body.appendChild(pop);
    const rect = anchorEl.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 4;
    let left = rect.left + window.scrollX;
    document.body.style.position = document.body.style.position || '';
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
    // Reclamp après rendu pour ne pas déborder à droite de l'écran.
    requestAnimationFrame(() => {
      const pr = pop.getBoundingClientRect();
      if (pr.right > window.innerWidth - 8) {
        pop.style.left = Math.max(8, window.innerWidth - pr.width - 8) + 'px';
      }
    });
    contentPromise
      .then((html) => {
        const body = pop.querySelector('.tmb-popover-body');
        if (body) body.innerHTML = html;
      })
      .catch((err) => {
        const body = pop.querySelector('.tmb-popover-body');
        if (body) body.textContent = 'Erreur de chargement (' + (err && err.message ? err.message : err) + ')';
      });
    pop.querySelectorAll && pop.addEventListener('click', (e) => {
      const openLink = e.target.closest && e.target.closest('.tmb-popover-open');
      if (openLink) {
        e.preventDefault();
        openInNewWindow(openLink.dataset.url);
      }
    });
    setTimeout(() => {
      document.addEventListener('mousedown', onOutsideClick, true);
      document.addEventListener('keydown', onEscKey, true);
    }, 0);
    function onOutsideClick(e) {
      if (!pop.contains(e.target)) closeInfoPopover();
    }
    function onEscKey(e) {
      if (e.key === 'Escape') closeInfoPopover();
    }
    pop._cleanup = () => {
      document.removeEventListener('mousedown', onOutsideClick, true);
      document.removeEventListener('keydown', onEscKey, true);
    };
  }

  function closeInfoPopover() {
    const existing = document.getElementById('tmb-info-popover');
    if (existing) {
      if (typeof existing._cleanup === 'function') existing._cleanup();
      existing.remove();
    }
  }

  // Identifiant stable pour la sélection par coche : id_account si connu
  // (le plus fiable), sinon le numéro de compte.
  function selectionKeyFor(node) {
    if (!node) return null;
    if (node.id_account != null) return 'id:' + node.id_account;
    if (node.account_number) return 'acct:' + node.account_number;
    return null;
  }

  function loadBalance() {
    if (!state.dossierRevisionId) return;

    // Garde-fou : mieux vaut un message clair que de tirer une requête qu'on
    // sait déjà invalide (dates vides, etc.).
    const missing = [];
    if (!state.startDate) missing.push('date de début');
    if (!state.endDate) missing.push('date de fin');
    if (missing.length) {
      state.error = 'Champs manquants avant de charger : ' + missing.join(', ') + '.';
      renderApp();
      return;
    }

    const url = buildApiUrl();
    state.loading = true;
    state.error = null;
    state.lastUrl = url;
    renderApp();
    // On rejoue les en-têtes reniflés sur un vrai appel natif (ex: Authorization),
    // sinon l'API répond "TOKENERROR / Token vide" : notre fetch n'a par défaut
    // aucun moyen de reconstituer un header que le client HTTP natif ajoute lui-même.
    fetch(url, { credentials: 'include', headers: sniff.headers || {} })
      .then((r) => {
        if (!r.ok) {
          return r
            .text()
            .catch(() => '')
            .then((body) => {
              throw new Error('HTTP ' + r.status + (body ? ' — ' + body.slice(0, 300) : ''));
            });
        }
        return r.json();
      })
      .then((data) => {
        state.data = data;
        state.loading = false;
        state.expanded = new Set();
        state.commentCounts = {}; // nouvelles données = anciens comptes potentiellement invalides
        state.n2 = null;
        renderApp();
        refreshCommentCounts();
        if (state.compareN1) loadN2();
      })
      .catch((e) => {
        state.loading = false;
        state.error = String((e && e.message) || e) + '\nURL appelée : ' + url;
        renderApp();
      });
  }

  // (v4.1) Comparatif N-2 : la réponse native ne porte que N et N-1
  // (exercice_values / exercice_mvt sur 2 positions). On demande donc la même
  // balance (mêmes options) sur la période décalée de 2 ans, en période
  // personnalisée (sans dossier_revision_id, comme une date intermédiaire
  // native), uniquement quand le comparatif est coché, puis on fusionne par
  // numéro de compte (N-2 = position 0 de cette réponse).
  function shiftIsoYears(iso, dy) {
    const y = Number(iso.slice(0, 4)) + dy;
    const m = Number(iso.slice(5, 7)) - 1;
    const d = Number(iso.slice(8, 10));
    const last = new Date(y, m + 1, 0).getDate();
    const wasLast = d === new Date(Number(iso.slice(0, 4)), m + 1, 0).getDate();
    return y + '-' + pad2(m + 1) + '-' + pad2(wasLast ? last : Math.min(d, last));
  }
  function buildN2ApiUrl() {
    const keep = { s: state.startDate, e: state.endDate, id: state.dossierRevisionId };
    state.startDate = shiftIsoYears(keep.s, -2);
    state.endDate = shiftIsoYears(keep.e, -2);
    const fys = state.fiscalYears;
    state.fiscalYears = [{ start: '0000-00-00', end: '0000-00-00' }]; // force la période personnalisée
    let url;
    try {
      url = buildNormalApiUrl();
    } finally {
      state.startDate = keep.s;
      state.endDate = keep.e;
      state.fiscalYears = fys;
      state.dossierRevisionId = keep.id;
    }
    return url;
  }
  function loadN2() {
    if (state.aged || !state.data || !Array.isArray(state.data.data) || !state.startDate || !state.endDate) return;
    const url = buildN2ApiUrl();
    if (state.n2 && state.n2.url === url && (state.n2.loading || !state.n2.error)) return;
    const target = state.data;
    state.n2 = { url, loading: true, error: null, count: 0 };
    fetch(url, { credentials: 'include', headers: sniff.headers || {} })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((d2) => {
        if (state.data !== target) return;
        const map = new Map();
        flattenLeaves((d2 && d2.data) || [], []).forEach(({ node }) => {
          if (!node.account_number) return;
          const mv = Array.isArray(node.exercice_mvt) ? node.exercice_mvt[0] : null;
          map.set(String(node.account_number), {
            solde: numOrNull(node.exercice_values && node.exercice_values[0]),
            td: mv ? numOrNull(mv.debit) : null,
            tc: mv ? numOrNull(mv.credit) : null,
          });
        });
        let count = 0;
        flattenLeaves(target.data, []).forEach(({ node }) => {
          const x = node.account_number ? map.get(String(node.account_number)) : null;
          node._n2 = x || null;
          if (x) count++;
        });
        state.n2 = { url, loading: false, error: null, count, missing: Math.max(0, map.size - count) };
        state.n2Gen++;
        renderApp();
      })
      .catch((e) => {
        if (state.data !== target) return;
        state.n2 = { url, loading: false, error: String((e && e.message) || e), count: 0 };
        renderApp();
      });
  }

  // -----------------------------------------------------------------------
  // 5. Bootstrap : on laisse l'app native faire UN chargement (elle le fait
  //    déjà automatiquement / sur clic), on intercepte cette réponse pour
  //    récupérer dossier_revision_id + fiscal_year_list/month_list, puis on
  //    masque tout le contenu natif et on installe notre propre UI.
  // -----------------------------------------------------------------------
  function findButtonByText(text) {
    return Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent && b.textContent.trim() === text
    );
  }

  let bootstrapped = false;
  let bootstrapClicked = false; // le clic natif ne doit partir qu'UNE seule fois
  let bootstrapTimer = null;
  let bootstrapGaveUp = false;

  function stopBootstrapPolling() {
    if (bootstrapTimer) {
      clearInterval(bootstrapTimer);
      bootstrapTimer = null;
    }
  }

  function tryBootstrap() {
    if (bootstrapped || bootstrapGaveUp || !isBalancePage()) return;
    // (v3.38) Rien en mode natif (menu « Balance ») : pas de clic automatique
    // sur « Charger le tableau », la page native reste strictement native.
    if (!readBalanceMode()) return;
    if (sniff.data && sniff.params) {
      bootstrapped = true;
      stopBootstrapPolling();
      applySniffedData();
      const reload = restoreOpts();
      installCustomUI();
      if (reload) loadBalance();
      else if (state.compareN1) loadN2();
      return;
    }
    if (bootstrapTimer) return; // sondage déjà en cours, on ne relance rien de plus

    const deadline = Date.now() + 20000; // 20s max avant abandon
    bootstrapTimer = setInterval(() => {
      if (bootstrapped) {
        stopBootstrapPolling();
        return;
      }
      if (sniff.data && sniff.params) {
        bootstrapped = true;
        stopBootstrapPolling();
        applySniffedData();
        const reload = restoreOpts();
        installCustomUI();
        if (reload) loadBalance();
        else if (state.compareN1) loadN2();
        return;
      }
      // On ne clique le bouton natif qu'une seule fois : le rechargement en
      // boucle observé venait d'ici (clic répété à chaque tentative, chacun
      // déclenchant potentiellement un history.replaceState interne à l'app,
      // qui relançait tout le bootstrap depuis zéro).
      if (!bootstrapClicked) {
        const loadBtn = findButtonByText('Charger le tableau');
        if (loadBtn) {
          bootstrapClicked = true;
          loadBtn.click();
        }
      }
      if (Date.now() > deadline) {
        stopBootstrapPolling();
        bootstrapGaveUp = true;
        console.warn(
          '[MyUnisoft v2] Impossible de récupérer automatiquement les paramètres natifs (dossier_revision_id). ' +
            'La vue personnalisée ne démarre pas ; l\'affichage natif reste utilisable normalement.'
        );
      }
    }, 400);
  }

  function applySniffedData() {
    state.dossierRevisionId = sniff.params.dossier_revision_id;
    state.startDate = toInputDate(sniff.params.start_date) || state.startDate;
    state.endDate = toInputDate(sniff.params.end_date) || state.endDate;
    state.subtype = Number(sniff.params.subtype || 0);
    if (sniff.params.filter) {
      state.filterRange = sniff.params.filter;
    } else if (state.subtype !== 0) {
      state.filterRange = DEFAULT_RANGE_BY_SUBTYPE[state.subtype] || '';
    }
    state.unbalancedOnly = sniff.params.unbalanced_only === 'true';
    state.centralizeAccount = sniff.params.centralize_account === 'true';
    state.unvalidatedOnly = sniff.params.unvalidated_accounts_only === 'true';
    state.showRevisionCols = sniff.params.extended === 'true';
    state.cumul = sniff.params.cumul === 'true';
    state.anSimulation = sniff.params.an_simulation === 'true';
    state.compare = sniff.params.compare === 'true';
    state.data = sniff.data;
    if (sniff.data && Array.isArray(sniff.data.fiscal_year_list)) {
      state.fiscalYears = sniff.data.fiscal_year_list
        .map(parseFiscalYearEntry)
        .filter(Boolean);
    }
    if (sniff.params.dossier_revision_id) state.revisionFyKey = state.startDate + '|' + state.endDate;
  }

  window.addEventListener('tmb-sniffed', () => {
    if (!bootstrapped) {
      tryBootstrap();
      return;
    }
    // Après le bootstrap initial, on reste à l'écoute de tout appel
    // balance_dynamique sniffé (le nôtre comme un appel natif déclenché en
    // coulisses, voir switchFiscalYear) pour garder state.dossierRevisionId
    // synchronisé : c'est ce qui permet de changer d'exercice correctement
    // (voir le commentaire détaillé sur switchFiscalYear plus bas).
    if (sniff.params && sniff.params.dossier_revision_id) {
      state.dossierRevisionId = sniff.params.dossier_revision_id;
      state.revisionFyKey = toInputDate(sniff.params.start_date) + '|' + toInputDate(sniff.params.end_date);
    }
  });

  // -----------------------------------------------------------------------
  // Changement d'exercice (liste "Exercice(s)") : chaque exercice a son
  // PROPRE dossier_revision_id côté serveur — constaté en direct en
  // comparant deux appels balance_dynamique avec les MÊMES dates mais des
  // dossier_revision_id différents (4965 vs 773 sur le dossier de test) :
  // avec le même dossier_revision_id, changer start_date/end_date ne change
  // RIEN aux données renvoyées (elles semblent bornées à la période propre
  // à la révision, pas librement filtrables par dates). Impossible de
  // recalculer ce dossier_revision_id nous-mêmes : rien dans la réponse
  // balance_dynamique (fiscal_year_list ne contient que des libellés, sans
  // identifiant) ni dans les endpoints testés ne l'expose directement — il
  // est résolu par l'appli native depuis un état interne (store applicatif)
  // qu'on n'a pas depuis un userscript.
  //
  // Plutôt que de laisser les données afficher silencieusement le mauvais
  // exercice (bug initial signalé), on pilote le sélecteur NATIF "Exercice"
  // (resté présent, juste masqué visuellement par endroits — voir
  // installCustomUI) au même index que celui choisi dans notre propre liste
  // (les deux listes sont construites dans le même ordre par le serveur :
  // N, N-1, N-2...), on déclenche son "Charger le tableau", et on récupère
  // le dossier_revision_id que ÇA renvoie via le reniflage déjà branché sur
  // balance_dynamique (voir le listener 'tmb-sniffed' juste au-dessus) —
  // sans avoir besoin de comprendre COMMENT l'appli le calcule.
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitFor(predicate, timeoutMs, stepMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const v = predicate();
      if (v) return v;
      await sleep(stepMs || 100);
    }
    return null;
  }

  // Repère l'input combobox natif du bloc "Exercice(s)" : comme les autres
  // sélecteurs MUI de cette barre (Balance, Générale/Client...), c'est un
  // <input role="combobox"> dont le libellé associé est un texte voisin —
  // on ne peut pas se fier à un id (généré aléatoirement par React à chaque
  // montage, ex. "_r_1p_").
  function findFiscalYearCombobox(container) {
    const combos = Array.from(container.querySelectorAll('input[role="combobox"]'));
    return combos.find((el) => {
      const wrap = el.closest('div');
      const label = wrap && wrap.parentElement ? wrap.parentElement.textContent : '';
      return /exercice/i.test(label || '');
    }) || null;
  }

  // Ouvre le menu MUI en simulant un clic réel (mousedown+mouseup+click) :
  // MUI Autocomplete écoute ces événements natifs, pas juste `.value =`.
  function clickLikeUser(el) {
    ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((type) => {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
  }

  async function switchFiscalYear(idx) {
    if (!titleBlockRef) return false;
    const combo = findFiscalYearCombobox(titleBlockRef.parentElement || titleBlockRef);
    if (!combo) return false;
    const previousRevisionId = state.dossierRevisionId;

    clickLikeUser(combo);
    // Le menu se rend dans un portail (document.body), pas comme enfant du
    // combobox : on le cherche globalement.
    const options = await waitFor(() => {
      const opts = document.querySelectorAll('[role="listbox"] [role="option"]');
      return opts.length ? opts : null;
    }, 2000);
    if (!options || !options[idx]) {
      if (options) document.body.click(); // referme le menu si ouvert sans bonne option
      return false;
    }
    clickLikeUser(options[idx]);

    await sleep(250); // laisse React appliquer la sélection avant de chercher le bouton
    const loadBtn = findButtonByText('Charger le tableau');
    if (!loadBtn) return false;
    loadBtn.click();

    // Pendant ce court aller-retour natif, la réponse peut reconstruire le
    // tableau natif cependant masqué (hiddenNativeBlocks) : on réapplique
    // display:none en continu au cas où React aurait recréé les nœuds.
    const changed = await waitFor(() => state.dossierRevisionId !== previousRevisionId, 6000, 150);
    return !!changed;
  }

  // -----------------------------------------------------------------------
  // 6. Installation de l'UI : on masque le conteneur natif (jamais démonté,
  //    juste display:none — aucun risque de réconciliation) et on insère
  //    notre propre racine juste après.
  // -----------------------------------------------------------------------
  // On garde une référence aux blocs natifs qu'on masque, pour pouvoir tout
  // restaurer proprement si l'utilisateur change de type d'édition (SIG,
  // Bilan, Grand livre...) via le sélecteur natif.
  let hiddenNativeBlocks = [];

  function restoreNativeBlocks() {
    hiddenNativeBlocks.forEach((el) => {
      try {
        el.style.display = '';
      } catch (e) {}
    });
    hiddenNativeBlocks = [];
  }

  // (v3.38, 2026-11-12) Deux entrées de menu : « Balance » (native) et
  // « Balance Premium » (notre vue), juste en dessous dans le menu Tenue. Le
  // mode choisi est mémorisé pour l'onglet (sessionStorage) et lu à chaque
  // installation de la vue.
  const BALANCE_MODE_KEY = 'tmbcBalanceMode';
  function readBalanceMode() {
    try {
      return sessionStorage.getItem(BALANCE_MODE_KEY) === 'premium';
    } catch (e) {
      return false;
    }
  }
  function writeBalanceMode(premium) {
    try {
      sessionStorage.setItem(BALANCE_MODE_KEY, premium ? 'premium' : 'native');
    } catch (e) {
      /* ignore */
    }
  }
  let customActive = readBalanceMode();
  let titleBlockRef = null;

  // (v4.0) Balance Premium s'affiche désormais EN SURIMPRESSION (comme
  // Consultation Premium) : la balance native reste en place, intacte et
  // visible dessous — plus aucun bloc natif masqué. On garde seulement une
  // référence à la barre de titre native « Editions courantes » pour piloter
  // le sélecteur « Exercice(s) » natif (switchFiscalYear).
  function findNativeTitleBlock() {
    const h1 = Array.from(document.querySelectorAll('*')).find(
      (n) => n.children.length === 0 && n.textContent.trim() === 'Editions courantes'
    );
    return h1 ? h1.parentElement : null;
  }

  function installCustomUI() {
    if (document.getElementById('tmb-root')) {
      applyDisplayMode();
      return;
    }
    lastTabId = extractTabId(location.pathname);
    titleBlockRef = findNativeTitleBlock();
    const root = document.createElement('div');
    root.id = 'tmb-root';
    document.body.appendChild(root);
    injectCss();
    customActive = readBalanceMode();
    renderApp();
    applyDisplayMode();
  }

  // Zone de contenu MyUnisoft : à droite du menu bleu, sous la barre
  // d'onglets — même calcul que Consultation Premium.
  function placeOverlay(root) {
    if (!root) return;
    const sb = window.TMBC.getSidebar && window.TMBC.getSidebar();
    const sr = sb && sb.getBoundingClientRect();
    const left = sr && sr.width > 0 ? Math.round(sr.right) : 160;
    const home = Array.from(document.querySelectorAll('button,a,[role=tab]')).find((e) => {
      if (!/^Accueil$/.test(e.textContent.trim()) && e.getAttribute('data-id') !== 'tab--2') return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.top < 90;
    });
    const top = home ? Math.round(home.getBoundingClientRect().bottom + 8) : 58;
    if (root.style.left !== left + 'px') root.style.left = left + 'px';
    if (root.style.top !== top + 'px') root.style.top = top + 'px';
  }

  function closeOverlay() {
    writeBalanceMode(false);
    customActive = false;
    applyDisplayMode();
  }

  // Échap : ferme la surimpression (sauf si une info-bulle PJ/commentaires
  // est ouverte, qu'Échap ferme en priorité, ou si on tape dans un champ).
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      const root = document.getElementById('tmb-root');
      if (!root || root.style.display === 'none') return;
      if (document.querySelector('.tmb-popover')) return;
      // menu / fenêtre MyUnisoft ouverts par-dessus : Échap leur revient
      if (document.querySelector('.MuiDialog-root, .MuiPopover-root, .MuiMenu-root, .MuiModal-root')) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT') && root.contains(t) && t.type !== 'range' && t.type !== 'checkbox') {
        t.blur();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      closeOverlay();
    },
    true
  );

  // La case native "Âgée" est remplacée par nos 2 propres cases ("Balance
  // âgée - date de facture" / "- date de règlement") dans le panneau de
  // gauche, pour rester cohérent avec le reste du panneau et permettre de
  // choisir directement la base de calcul sans étape intermédiaire. On ne
  // supprime/déplace jamais ce nœud natif (règle du projet) : uniquement
  // display:none, revérifié à chaque sondage puisque React peut le
  // reconstruire (ex. à chaque bascule Générale <-> Client/Fournisseur, la
  // case apparaît/disparaît et est donc recréée, pas juste masquée par lui).
  // Masquée uniquement en "Affichage Premium" (customActive, nos 2 cases
  // dédiées la remplacent) ; en "Affichage MyUnisoft" (natif, customActive
  // === false) elle doit rester visible et fonctionner normalement, comme
  // tout le reste du tableau natif.
  function maskNativeAgedCheckbox(titleBlock) {
    if (!titleBlock) return;
    const children = Array.prototype.filter.call(titleBlock.children, (el) => el.id !== 'tmb-toggle-btn');
    for (const el of children) {
      if ((el.textContent || '').trim() === 'Âgée') {
        const wanted = customActive ? 'none' : '';
        if (el.style.display !== wanted) el.style.display = wanted;
        return;
      }
    }
  }

  // Place notre bouton juste après la case "Âgée" quand elle est visible
  // (Client/Fournisseur), sinon juste après le dernier champ natif avant le
  // ⋮ (ex. le sélecteur "Type" en Balance Générale). On ne touche JAMAIS au
  // ⋮ natif lui-même (ni sa position, ni son margin) : il a son propre
  // margin-left natif qui le pousse tout à droite (~1093px observé en
  // direct, effectivement un auto) — l'ancien code récupérait ce
  // margin-left pour notre bouton, ce qui le collait au ⋮ loin d'"Âgée" ;
  // on se contente maintenant d'un petit espacement fixe après l'ancre.
  //
  // ⚠ Historique : une v3.10 regroupait notre bouton et le ⋮ dans un wrapper
  // <div> commun (en y déplaçant le ⋮ via appendChild). Ça donnait le bon
  // rendu visuel, mais ça cassait React : l'appli reconstruit périodiquement
  // la barre de titre (ex. en changeant Générale -> Client, qui fait
  // apparaître/disparaître la case "Âgée"), et React s'attend à ce que le ⋮
  // soit toujours un enfant DIRECT de la barre de titre. En le déplaçant
  // dans notre wrapper, la reconciliation React plantait avec "Failed to
  // execute 'insertBefore': the node before which the new node is to be
  // inserted is not a child of this node", ce qui blanchissait toute la
  // page. Cette version-ci ne déplace jamais aucun nœud natif : elle insère
  // seulement notre bouton comme nouveau sibling juste après l'ancre trouvée
  // (le ⋮ reste enfant direct de la barre de titre, React ne voit aucune
  // différence).
  function findToggleAnchor(titleBlock, btn) {
    const children = Array.prototype.filter.call(titleBlock.children, (el) => el !== btn);
    if (!children.length) return null;
    const menuIcon = children[children.length - 1]; // le ⋮ natif, toujours en dernier
    // Cherche un enfant dont le texte est exactement "Âgée" (case à cocher,
    // visible seulement en Client/Fournisseur).
    for (const el of children) {
      if (el === menuIcon) continue;
      if ((el.textContent || '').trim() === 'Âgée') return el;
    }
    // Sinon, le dernier champ natif avant le ⋮ (ex. le sélecteur "Type").
    const before = children.filter((el) => el !== menuIcon);
    return before.length ? before[before.length - 1] : null;
  }
  function positionToggleButton(titleBlock, btn) {
    const anchor = findToggleAnchor(titleBlock, btn);
    if (!anchor) {
      if (btn.parentElement !== titleBlock) titleBlock.appendChild(btn);
      return;
    }
    if (btn.previousElementSibling !== anchor) {
      anchor.insertAdjacentElement('afterend', btn);
    }
    btn.style.marginLeft = '12px';
  }

  // La barre de titre peut faire apparaître/disparaître des champs natifs
  // (ex: la case "Âgée" pour Client/Fournisseur) : on vérifie à chaque
  // sondage que notre bouton est toujours bien accolé au ⋮.
  function repositionToggleButton(titleBlock) {
    const btn = document.getElementById('tmb-toggle-btn');
    if (!btn || !titleBlock) return;
    positionToggleButton(titleBlock, btn);
    applyToggleButtonColors(btn);
  }
  function checkNativeSubtype(titleBlock) {
    if (!titleBlock) return;
    // Le libellé sélectionné (Générale/Client/Fournisseur) n'est PAS un nœud
    // texte dans le DOM : c'est la valeur (.value) d'un <input type="text">
    // caché utilisé par le composant MUI. Un simple textContent ne le voit
    // donc jamais — c'est ce qui empêchait la synchronisation de fonctionner.
    let newSubtype = null;
    const inputs = titleBlock.querySelectorAll('input[type="text"]');
    for (let i = 0; i < inputs.length; i++) {
      const v = (inputs[i].value || '').trim().toLowerCase();
      if (v === 'générale') {
        newSubtype = 0;
        break;
      }
      if (v === 'client') {
        newSubtype = 1;
        break;
      }
      if (v === 'fournisseur') {
        newSubtype = 2;
        break;
      }
    }
    if (newSubtype === null || newSubtype === state.subtype) return;
    state.subtype = newSubtype;
    if (newSubtype !== 0) {
      if (!state.filterRangeUserEdited) {
        state.filterRange = DEFAULT_RANGE_BY_SUBTYPE[newSubtype] || '';
      }
    } else {
      // Retour en Générale : on vide le champ Comptes (plage) — la plage
      // 41-4xx/40-4xx de Client/Fournisseur n'a pas de sens ici, et on
      // réarme le pré-remplissage automatique pour la prochaine fois qu'on
      // rebascule sur Client/Fournisseur.
      state.filterRange = '';
      state.filterRangeUserEdited = false;
      // La case "Âgée" n'existe qu'en Client/Fournisseur côté natif : en
      // revenant en Générale, on repasse aussi notre propre état en mode
      // normal (sinon on resterait bloqué sur des colonnes qui n'ont plus de
      // case pour les désactiver).
      state.aged = false;
    }
    // En Client/Fournisseur, "Centraliser les comptes de tiers" doit être
    // décoché par défaut (demande explicite) — l'utilisateur peut toujours
    // la recocher à la main ensuite.
    if (newSubtype !== 0) {
      state.centralizeAccount = false;
    }
    renderApp();
    if (state.dossierRevisionId && state.startDate && state.endDate) loadBalance();
  }

  // -----------------------------------------------------------------------
  // Bouton de bascule "Affichage MyU" / "Affichage Nch" : permet de repasser
  // instantanément à l'affichage natif (comme si le script n'était pas actif)
  // sans le désinstaller, et de revenir à notre vue personnalisée.
  // -----------------------------------------------------------------------
  // (2026-07-31, migration dans l'architecture modulaire) : detectMenuColor/
  // readableTextOn/isColorUsable étaient dupliquées ici depuis toujours avec
  // le commentaire "les scripts Tampermonkey ne partagent pas leur scope JS"
  // — ce n'est plus le cas : ce fichier est maintenant chargé via require()
  // dans le même contexte que premium.js (cf. preload.js), qui expose déjà
  // ces mêmes fonctions (vérifiées identiques) sur window.TMBC. Utilise
  // désormais les versions partagées (déstructurées en tête de fichier),
  // suppression des doublons.
  function applyToggleButtonColors(btn) {
    if (!btn) return;
    const menuColor = detectMenuColor();
    const textColor = readableTextOn(menuColor);
    btn.style.backgroundColor = menuColor;
    btn.style.borderColor = menuColor;
    btn.style.color = textColor;
  }

  function installToggleButton(titleBlock) {
    let btn = document.getElementById('tmb-toggle-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'tmb-toggle-btn';
      btn.type = 'button';
      btn.className = 'tmb-toggle-btn';
      btn.textContent = customActive ? 'Affichage MyUnisoft' : 'Affichage Premium';
      btn.addEventListener('click', toggleDisplayMode);
    }
    positionToggleButton(titleBlock, btn);
    applyToggleButtonColors(btn);
  }

  function toggleDisplayMode() {
    customActive = !customActive;
    writeBalanceMode(customActive);
    applyDisplayMode();
  }

  // Entrées de menu Balance / Balance Premium (cf. readBalanceMode).
  let programmaticNativeClick = false;
  function switchToPremium(nativeLi) {
    writeBalanceMode(true);
    if (isBalancePage()) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const dlg = document.querySelector('.MuiDialog-root:has(.dialogContainer__menu)');
      if (dlg) dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
      if (document.getElementById('tmb-root')) {
        customActive = true;
        renderApp();
        applyDisplayMode();
      } else {
        bootstrapGaveUp = false;
        bootstrapClicked = false;
        stopBootstrapPolling();
        tryBootstrap();
      }
      return;
    }
    programmaticNativeClick = true;
    try {
      nativeLi.click();
    } finally {
      programmaticNativeClick = false;
    }
  }
  function onNativeBalanceClick() {
    if (programmaticNativeClick) return;
    writeBalanceMode(false);
    if (document.getElementById('tmb-root')) {
      customActive = false;
      applyDisplayMode();
    }
  }

  function applyDisplayMode() {
    const root = document.getElementById('tmb-root');
    if (!root) return;
    root.style.display = customActive ? 'flex' : 'none';
    if (customActive) placeOverlay(root);
  }

  // -----------------------------------------------------------------------
  // 7. Colonnes du tableau + extraction de valeur par colonne.
  // -----------------------------------------------------------------------
  // Colonnes fixes, toujours présentes.
  // Largeurs resserrées au plus près du contenu réel (numéro de compte à
  // 8-10 chiffres en police à chasse fixe, montants "-293 431,76" en chasse
  // fixe, libellés d'en-tête) — sur un écran large, ces valeurs ne comptent
  // de toute façon que comme point de départ : sans width:100% sur la table
  // (voir table.tmb-table plus bas), l'espace en trop reste vide à droite du
  // tableau au lieu d'être réparti dans les colonnes. L'utilisateur peut
  // toujours ajuster chaque colonne à la main (glisser la poignée / double-clic
  // pour ajuster à la largeur du contenu) ; ces valeurs sont juste le défaut.
  const BASE_COLUMNS_START = [
    { id: 'expand', label: '', sortable: false, align: 'center', width: '26px' },
    { id: 'account_number', label: 'N° Compte', sortable: true, width: '100px' },
    { id: 'label', label: 'Intitulé', sortable: true, width: '260px' },
  ];
  // (v4.1) Colonnes de montants générées selon le mode d'affichage choisi
  // (state.amountMode) et le comparatif (N seul, ou N + N-1 + N-2). Identifiant
  // de colonne = <nature>_<exercice> : solde / sd (solde débiteur) / sc
  // (solde créditeur) / td (total débits) / tc (total crédits), et n / n1 / n2.
  const AMOUNT_MODES = {
    solde: { kinds: ['solde'], label: 'Solde' },
    sdc: { kinds: ['sd', 'sc'], label: 'Solde débiteur / Solde créditeur' },
    tdc: { kinds: ['td', 'tc', 'solde'], label: 'Total débits / Total crédits / Solde' },
    tdcsdc: { kinds: ['td', 'tc', 'sd', 'sc'], label: 'Total débits / Total crédits / Solde débiteur / Solde créditeur' },
  };
  const AMOUNT_KIND_LABEL = { solde: 'Solde', sd: 'Solde débiteur', sc: 'Solde créditeur', td: 'Total débits', tc: 'Total crédits' };
  const AMOUNT_YEAR_LABEL = { n: 'N', n1: 'N-1', n2: 'N-2' };
  const AMOUNT_YEAR_INDEX = { n: 0, n1: 1, n2: 2 };
  const AMOUNT_COL_RE = /^(solde|sd|sc|td|tc)_(n|n1|n2)$/;
  const isAmountColId = (id) => AMOUNT_COL_RE.test(String(id || ''));
  const isSoldeColId = (id) => /^solde_(n|n1|n2)$/.test(String(id || ''));
  function amountColumns() {
    const mode = AMOUNT_MODES[state.amountMode] || AMOUNT_MODES.solde;
    const years = state.compareN1 ? ['n', 'n1', 'n2'] : ['n'];
    const out = [];
    years.forEach((y) =>
      mode.kinds.forEach((k) =>
        out.push({
          id: k + '_' + y,
          label: AMOUNT_KIND_LABEL[k] + ' ' + AMOUNT_YEAR_LABEL[y],
          sortable: true,
          align: 'right',
          width: k === 'solde' ? '118px' : '116px',
          n1: y !== 'n',
          yearStart: y !== 'n' && k === mode.kinds[0],
        })
      )
    );
    return out;
  }

  // (v4.0) Var % retirée (affichée au survol de Var €) ; Valid collab et
  // Valid RM fusionnées en une colonne « Valid. » (pastilles C / RM) ; PJ
  // affichée seulement si au moins un compte en a (cf. visibleColumns).
  const BASE_COLUMNS_END = [
    { id: 'var_eur', label: 'Var. €', sortable: true, align: 'right', width: '108px', n1: true },
    { id: 'pj', label: 'PJ', sortable: true, align: 'center', width: '44px' },
    { id: 'com', label: 'Com.', sortable: true, align: 'center', width: '52px' },
    { id: 'valid', label: 'Valid.', sortable: true, align: 'center', width: '84px' },
  ];

  // "Affichage mensuel" (2026-08-01) : reproduit la case native "Mois" du
  // panneau Balance, mais en vue simplifiée demandée par Nicolas — pas une
  // simple insertion des colonnes mois au milieu du tableau normal (v3.30) :
  // en mode mensuel, on n'affiche QUE N° Compte / Intitulé / une colonne par
  // mois / Total (Solde N, Solde N-1, Var %, Var €, PJ, Com., Valid
  // collab/RM disparaissent entièrement, quel que soit l'état des autres
  // cases du panneau — cf. allColumns). Reniflage réseau en direct confirmé
  // que basculer Mois/Cumul côté natif n'envoie STRICTEMENT AUCUN paramètre
  // différent à balance_dynamique/v2 (même URL exacte capturée dans les deux
  // cas) — pas un mode serveur, un simple choix d'affichage côté client sur
  // des données déjà présentes dans la réponse. Confirmé par inspection
  // directe de l'état React de la page native (parcours de la fibre React
  // depuis une cellule de compte affichée, faute d'accès direct au corps
  // JSON) : chaque nœud (compte ET groupe/classe, pas seulement les
  // feuilles) porte déjà un tableau `month_values` à côté
  // d'`exercice_values`/`exercice_mvt`, un nombre par mois de l'exercice en
  // cours (N), dans l'ordre chronologique (index 0 = premier mois de
  // l'exercice — donc premier mois de state.startDate, quel que soit le
  // calendrier : un exercice décalé 01/07/2025 au 30/06/2026 donne bien
  // 07/25 en index 0 et 06/26 en index 11, la formule ci-dessous suit
  // naturellement state.startDate). Nombre de colonnes déduit de la longueur
  // réelle de month_values sur les données reçues (pas fixé à 12 en dur, cf.
  // monthColumnCount), au cas où un exercice ferait moins de 12 mois.
  // Libellés sous forme numérique "MM/AA" (demande explicite du 2026-08-01,
  // remplace le format textuel "janv. 2026" de la v3.30) — construits
  // directement depuis le mois/l'année calculés (getMonth()/getFullYear()),
  // pas de dépendance à toLocaleDateString ici. Valeur 0 affichée vide (pas
  // "0,00"), comme le fait le tableau natif (aucun mouvement ce mois-là) ;
  // la colonne "Total" (monthly_total, somme de tous les mois) s'affiche
  // toujours, y compris à 0, puisque c'est un vrai agrégat et pas un
  // "absence de mouvement".
  function isMonthColumnId(colId) {
    return typeof colId === 'string' && (colId.indexOf('month_') === 0 || colId.indexOf('qtr_') === 0);
  }
  // (v4.2) Vue périodique active : 'M' mensuel, 'MC' mensuel cumulé, 'Q'
  // trimestriel, 'QC' trimestriel cumulé, '' aucune. Balance générale
  // uniquement (options grisées en Clients / Fournisseurs et en balance âgée).
  function periodicMode() {
    if (state.subtype !== 0 || state.aged) return '';
    if (state.showMonthly) return 'M';
    if (state.showMonthlyCumulative) return 'MC';
    if (state.showQuarterly) return 'Q';
    if (state.showQuarterlyCumulative) return 'QC';
    return '';
  }
  const periodicCumulative = () => /C$/.test(periodicMode());
  // Mois couverts par une colonne : month_i -> [i, i] ; qtr_k -> [3k, 3k+2].
  function monthRangeFromColId(colId) {
    if (colId.indexOf('qtr_') === 0) {
      const k = parseInt(colId.slice(4), 10);
      return [k * 3, k * 3 + 2];
    }
    const i = parseInt(colId.slice(6), 10);
    return [i, i];
  }
  function buildQuarterColumns() {
    const months = buildMonthColumns();
    const cols = [];
    for (let k = 0; k * 3 < months.length; k++) {
      const a = months[k * 3].label;
      const b = months[Math.min(months.length - 1, k * 3 + 2)].label;
      cols.push({ id: 'qtr_' + k, label: 'T' + (k + 1) + ' (' + a + '-' + b + ')', sortable: true, align: 'right', width: '118px' });
    }
    return cols;
  }
  function monthIndexFromColId(colId) {
    return parseInt(colId.slice(6), 10);
  }
  function monthColumnCount() {
    const root = state.data && state.data.data;
    if (Array.isArray(root)) {
      const leaves = flattenLeaves(root, []);
      const withMonths = leaves.find((r) => Array.isArray(r.node.month_values));
      if (withMonths) return withMonths.node.month_values.length;
      // Les nœuds de tête (classes/groupes) portent aussi month_values,
      // avant même de descendre aux feuilles — filet de sécurité si
      // flattenLeaves ne trouve rien (ex. arbre vide).
      const topWithMonths = root.find((n) => Array.isArray(n.month_values));
      if (topWithMonths) return topWithMonths.month_values.length;
    }
    return 12; // repli : exercice standard de 12 mois
  }
  // Colonnes "un par mois" seules (MM/AA), sans la colonne Total finale —
  // utilisées telles quelles par le mode cumulé (le dernier mois cumulé EST
  // déjà le total, une colonne Total serait redondante) et complétées d'une
  // colonne Total par monthColumns() pour le mode mensuel simple.
  function buildMonthColumns() {
    if (!state.startDate) return [];
    const start = new Date(state.startDate + 'T00:00:00');
    if (isNaN(start.getTime())) return [];
    const count = monthColumnCount();
    const cols = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      cols.push({ id: 'month_' + i, label: mm + '/' + yy, sortable: true, align: 'right', width: '70px' });
    }
    return cols;
  }
  function monthColumns() {
    const cols = buildMonthColumns();
    if (!cols.length) return cols;
    cols.push({ id: 'monthly_total', label: 'Total', sortable: true, align: 'right', width: '95px' });
    return cols;
  }
  // Colonnes du mode "Balance âgée" (case native "Âgée") : structure
  // entièrement différente, reniflée en direct sur le panneau natif (script
  // Tampermonkey fourni par Nicolas). PJ/Com. positionnées juste avant Valid
  // collab/Valid RM, même ordre que BASE_COLUMNS_END — même délégation au
  // natif que le mode normal pour ces 4 colonnes (cf. isLinkableCell plus
  // haut, inchangé, et le rendu PJ/Com./Valid dans renderRow).
  const AGED_COLUMNS = [
    { id: 'expand', label: '', sortable: false, align: 'center', width: '26px' },
    { id: 'account_number', label: 'N° Compte', sortable: true, width: '100px' },
    { id: 'label', label: 'Intitulé', sortable: true, width: '220px' },
    { id: 'solde_aged', label: 'Solde', sortable: true, align: 'right', width: '90px' },
    { id: 'age_30', label: '< 30j', sortable: true, align: 'right', width: '85px' },
    { id: 'age_45', label: '< 45j', sortable: true, align: 'right', width: '85px' },
    { id: 'age_60', label: '< 60j', sortable: true, align: 'right', width: '85px' },
    { id: 'age_90', label: '< 90j', sortable: true, align: 'right', width: '85px' },
    { id: 'age_120', label: '< 120j', sortable: true, align: 'right', width: '85px' },
    { id: 'age_over120', label: '> 120j', sortable: true, align: 'right', width: '85px' },
    { id: 'pj', label: 'PJ', sortable: true, align: 'center', width: '44px' },
    { id: 'com', label: 'Com.', sortable: true, align: 'center', width: '52px' },
    { id: 'valid', label: 'Valid.', sortable: true, align: 'center', width: '84px' },
  ];

  function allColumns() {
    if (state.aged) return AGED_COLUMNS;
    // Vue mensuelle (2 variantes, mutuellement exclusives — voir wiring des
    // cases) : liste de colonnes entièrement séparée (N° Compte, Intitulé,
    // un par mois, + Total en mode simple uniquement) — pas une insertion au
    // milieu de la vue normale, sur demande explicite (Solde N/N-1, Var %/€,
    // PJ/Com/Valid ne doivent PAS apparaître ici, quel que soit l'état des
    // autres cases).
    const pm = periodicMode();
    if (pm === 'M') {
      return [...BASE_COLUMNS_START, ...monthColumns()];
    }
    if (pm === 'MC') {
      return [...BASE_COLUMNS_START, ...buildMonthColumns()];
    }
    if (pm === 'Q') {
      const q = buildQuarterColumns();
      if (q.length) q.push({ id: 'monthly_total', label: 'Total', sortable: true, align: 'right', width: '110px' });
      return [...BASE_COLUMNS_START, ...q];
    }
    if (pm === 'QC') {
      return [...BASE_COLUMNS_START, ...buildQuarterColumns()];
    }
    return [...BASE_COLUMNS_START, ...amountColumns(), ...BASE_COLUMNS_END];
  }

  // Total "brut" Débit/Crédit d'un nœud groupe (a des enfants) : somme
  // séparément le débit et le crédit de TOUTES ses feuilles descendantes,
  // au lieu de re-découper son solde net (qui masquerait les compensations,
  // ex: un groupe avec +100 et -100 de solde net 0 doit afficher Débit 100 /
  // Crédit 100, pas 0 dans les deux colonnes). Mémorisé sur le nœud dans une
  // propriété _-préfixée, sans toucher à aucune donnée métier existante.
  // Additionne débit/crédit sur une liste de feuilles (utilisé aussi bien
  // pour un groupe natif que pour nos propres nœuds agrégats synthétiques :
  // Résultat, sous-total de classe, total de sélection).
  function sumGrossDebitCredit(leafNodes) {
    let debitN = 0;
    let creditN = 0;
    let debitN1 = 0;
    let creditN1 = 0;
    leafNodes.forEach((node) => {
      const v0 = node.exercice_values && node.exercice_values[0];
      const v1 = node.exercice_values && node.exercice_values[1];
      if (typeof v0 === 'number') {
        if (v0 >= 0) debitN += v0;
        else creditN += -v0;
      }
      if (typeof v1 === 'number') {
        if (v1 >= 0) debitN1 += v1;
        else creditN1 += -v1;
      }
    });
    return { debitN, creditN, debitN1, creditN1 };
  }

  // Équivalent mensuel de sumGrossDebitCredit : additionne mois par mois le
  // month_values de toutes les feuilles fournies, pour donner aux lignes de
  // synthèse propres à ce script (Total, Total sélection, sous-total de
  // classe) un month_values cohérent — sans ça, cellValue('month_N', ...)
  // renvoie null sur ces lignes (Array.isArray(node.month_values) échoue) et
  // la ligne "Total" en bas de tableau reste vide en Affichage mensuel (bug
  // remonté par Nicolas le 2026-08-01). Retourne null si aucune feuille
  // fournie n'a de month_values exploitable (ex. mode âgé, ou API n'ayant
  // pas renvoyé le champ) plutôt qu'un tableau de zéros trompeur.
  function sumMonthValues(leafNodes) {
    let out = null;
    leafNodes.forEach((node) => {
      const arr = node.month_values;
      if (!Array.isArray(arr)) return;
      if (!out) out = arr.map(() => 0);
      arr.forEach((v, i) => {
        if (typeof v === 'number') out[i] = (out[i] || 0) + v;
      });
    });
    return out;
  }

  // (v4.1) Montants d'un nœud pour un exercice (0 = N, 1 = N-1, 2 = N-2) :
  // solde, total débits / crédits (exercice_mvt de la réponse native ; N-2 :
  // balance complémentaire fusionnée dans node._n2), solde débiteur /
  // créditeur. Pour un regroupement (classe, total, sélection…), les soldes
  // débiteurs et créditeurs sont la somme de ceux des comptes (pas le
  // découpage du solde net), les totaux sont ceux de l'API s'ils existent.
  const numOrNull = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : null);
  function leafYearData(node, yi) {
    let solde = null;
    let td = null;
    let tc = null;
    if (yi < 2) {
      solde = numOrNull(node.exercice_values && node.exercice_values[yi]);
      const mv = Array.isArray(node.exercice_mvt) ? node.exercice_mvt[yi] : null;
      if (mv) {
        td = numOrNull(mv.debit);
        tc = numOrNull(mv.credit);
      }
    } else if (node._n2) {
      solde = node._n2.solde;
      td = node._n2.td;
      tc = node._n2.tc;
    }
    return {
      solde,
      td,
      tc,
      sd: solde === null ? null : solde >= 0 ? solde : null,
      sc: solde === null ? null : solde < 0 ? -solde : null,
    };
  }
  function yearData(node, yi) {
    const leaves = node._leaves || (node.account_List && node.account_List.length ? flattenLeaves(node.account_List, []).map((r) => r.node) : null);
    if (!leaves) return leafYearData(node, yi);
    if (!node._yd || node._yd.gen !== state.n2Gen) node._yd = { gen: state.n2Gen };
    if (node._yd[yi]) return node._yd[yi];
    const acc = { solde: null, td: null, tc: null, sd: null, sc: null };
    const add = (k, v) => {
      if (v === null) return;
      acc[k] = (acc[k] || 0) + v;
    };
    leaves.forEach((l) => {
      const d = leafYearData(l, yi);
      add('solde', d.solde);
      add('td', d.td);
      add('tc', d.tc);
      add('sd', d.sd);
      add('sc', d.sc);
    });
    if (acc.solde !== null || acc.td !== null) {
      if (acc.sd === null) acc.sd = 0;
      if (acc.sc === null) acc.sc = 0;
    }
    if (yi < 2) {
      const own = numOrNull(node.exercice_values && node.exercice_values[yi]);
      if (own !== null) acc.solde = own;
      const mv = Array.isArray(node.exercice_mvt) ? node.exercice_mvt[yi] : null;
      if (mv && numOrNull(mv.debit) !== null) {
        acc.td = numOrNull(mv.debit);
        acc.tc = numOrNull(mv.credit);
      }
    }
    node._yd[yi] = acc;
    return acc;
  }

  function getGrossDebitCredit(node) {
    if (node._grossDebitCredit) return node._grossDebitCredit;
    if (node.account_List && node.account_List.length) {
      const leaves = flattenLeaves(node.account_List, []).map((r) => r.node);
      const result = sumGrossDebitCredit(leaves);
      node._grossDebitCredit = result;
      return result;
    }
    return null;
  }

  // evIdx: 0 = N, 1 = N-1. side: 'debit' | 'credit'.
  function debitCreditValue(node, evIdx, side) {
    const gross = getGrossDebitCredit(node);
    if (gross) {
      if (evIdx === 0) return side === 'debit' ? gross.debitN : gross.creditN;
      return side === 'debit' ? gross.debitN1 : gross.creditN1;
    }
    const ev = node.exercice_values || [];
    const v = ev[evIdx];
    if (typeof v !== 'number') return null;
    if (side === 'debit') return v >= 0 ? v : null;
    return v < 0 ? -v : null;
  }

  function cellValue(node, colId) {
    if (colId === 'monthly_total') {
      const arr = node.month_values;
      if (!Array.isArray(arr)) return null;
      return arr.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
    }
    if (isMonthColumnId(colId)) {
      const arr = node.month_values;
      const [from, idx] = monthRangeFromColId(colId);
      if (!Array.isArray(arr)) return null;
      if (periodicCumulative()) {
        // Cumul depuis le premier mois de l'exercice (index 0) jusqu'à ce
        // mois inclus — pas juste le mouvement du mois (voir description
        // v3.32 en tête de fichier).
        let sum = 0;
        let any = false;
        for (let i = 0; i <= idx; i++) {
          if (typeof arr[i] === 'number') {
            sum += arr[i];
            any = true;
          }
        }
        return any ? sum : null;
      }
      let sum = 0;
      let any = false;
      for (let i = from; i <= idx && i < arr.length; i++) {
        if (typeof arr[i] === 'number') {
          sum += arr[i];
          any = true;
        }
      }
      return any ? sum : null;
    }
    const amc = AMOUNT_COL_RE.exec(colId);
    if (amc) return yearData(node, AMOUNT_YEAR_INDEX[amc[2]])[amc[1]];
    const ev = node.exercice_values || [];
    switch (colId) {
      case 'account_number':
        return node.account_number || '';
      case 'label':
        return node.label || '';
      case 'solde_n':
        return ev[0];
      case 'solde_n1':
        return ev[1];
      // Solde débiteur/créditeur : un solde positif est "débiteur" (colonne
      // Débit), un solde négatif est "créditeur" (colonne Crédit, en valeur
      // absolue) — une seule des deux colonnes est renseignée par ligne
      // (comptes feuilles). Pour un nœud "groupe"/agrégat (une classe, la
      // ligne Résultat, un sous-total...), voir debitCreditValue : on somme
      // séparément tous les débits et tous les crédits des feuilles (total
      // "brut"), on ne se contente pas de re-découper le solde net du groupe.
      case 'debit_n':
        return debitCreditValue(node, 0, 'debit');
      case 'credit_n':
        return debitCreditValue(node, 0, 'credit');
      case 'debit_n1':
        return debitCreditValue(node, 1, 'debit');
      case 'credit_n1':
        return debitCreditValue(node, 1, 'credit');
      case 'var_pct':
        return node.varPercent;
      case 'var_eur':
        return node.varValue;
      case 'pj':
        return node.nb_da_acc_docs || 0;
      case 'com':
        return node.hasComment ? 1 : 0;
      case 'valid_collab':
        return (node.validation && node.validation.VCOL) || '';
      case 'valid_rm':
        return (node.validation && node.validation.VRM) || '';
      case 'valid':
        // tri : nombre de validations (C puis RM)
        return (isValidated(node, 'VCOL') ? 2 : 0) + (isValidated(node, 'VRM') ? 1 : 0);
      // Mode "Balance âgée" : total_values est un tableau à 1 valeur (le
      // solde) sur les lignes de compte réelles ; column_values porte les 6
      // tranches d'ancienneté (< 30j ... > 120j), dans cet ordre (reniflé en
      // direct sur l'API, cf. buildAgedApiUrl).
      case 'solde_aged':
        return Array.isArray(node.total_values)
          ? node.total_values[0]
          : typeof node.total_values === 'number'
          ? node.total_values
          : null;
      case 'age_30':
        return agedBucket(node, 0);
      case 'age_45':
        return agedBucket(node, 1);
      case 'age_60':
        return agedBucket(node, 2);
      case 'age_90':
        return agedBucket(node, 3);
      case 'age_120':
        return agedBucket(node, 4);
      case 'age_over120':
        return agedBucket(node, 5);
      default:
        return '';
    }
  }

  function agedBucket(node, idx) {
    const arr = node.column_values;
    if (!Array.isArray(arr)) return null;
    const v = arr[idx];
    return typeof v === 'number' ? v : null;
  }

  function cellDisplay(node, colId) {
    const v = cellValue(node, colId);
    if (colId === 'monthly_total') {
      // Contrairement aux colonnes mois individuelles, le Total s'affiche
      // même à 0 : c'est un vrai agrégat, pas une "absence de mouvement".
      return typeof v === 'number' ? fmtAmount(v) : '';
    }
    if (isMonthColumnId(colId)) {
      if (periodicCumulative()) {
        // Un cumul est un vrai solde à ce mois donné, pas une "absence de
        // mouvement" : contrairement au mode mensuel simple, on l'affiche
        // même à 0 (comme monthly_total).
        return typeof v === 'number' ? fmtAmount(v) : '';
      }
      // Comme l'affichage natif : un mois sans mouvement (0) reste vide,
      // pas "0,00" — sinon le tableau serait noyé de zéros peu lisibles.
      return typeof v === 'number' && v !== 0 ? fmtAmount(v) : '';
    }
    if (isAmountColId(colId)) return typeof v === 'number' ? fmtAmount(v) : '';
    switch (colId) {
      case 'solde_n':
      case 'solde_n1':
      case 'debit_n':
      case 'credit_n':
      case 'debit_n1':
      case 'credit_n1':
      case 'var_eur':
      case 'solde_aged':
      case 'age_30':
      case 'age_45':
      case 'age_60':
      case 'age_90':
      case 'age_120':
      case 'age_over120':
        return typeof v === 'number' ? fmtAmount(v) : '';
      case 'var_pct':
        return typeof v === 'number' ? fmtPercent(v) : '';
      case 'pj':
        return v ? String(v) : '';
      case 'valid':
        return (isValidated(node, 'VCOL') ? 'C' : '') + (isValidated(node, 'VRM') ? (isValidated(node, 'VCOL') ? ' ' : '') + 'RM' : '');
      case 'com': {
        if (!v) return '';
        const count = node.id_account != null ? state.commentCounts[node.id_account] : undefined;
        return typeof count === 'number' ? `💬 ${count}` : '💬';
      }
      default:
        return v === null || v === undefined ? '' : String(v);
    }
  }

  function isSummaryLabel(label) {
    return /^résultat$/i.test((label || '').trim());
  }

  // Petite icône "tableur" (vert, façon Excel) en SVG inline — pas de fichier
  // externe à charger, juste assez lisible en 15x15px dans l'en-tête.
  const EXCEL_ICON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="22" height="22" rx="3" fill="#1D6F42"/><rect x="4" y="4" width="16" height="16" fill="#ffffff" opacity="0.15"/><path d="M6 6h5.2v3.6H6zM12.4 6h5.6v3.6h-5.6zM6 10.8h5.2v3.6H6zM12.4 10.8h5.6v3.6h-5.6zM6 15.6h5.2V19H6zM12.4 15.6h5.6V19h-5.6z" fill="none" stroke="#ffffff" stroke-width="0.6"/><text x="12" y="16.5" font-size="9" font-weight="700" fill="#ffffff" text-anchor="middle" font-family="Arial, sans-serif">X</text></svg>`;

  const PJ_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:-2px"><path d="M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8"/></svg>';
  const REVISION_COLUMN_IDS = new Set(['pj', 'com', 'valid', 'valid_collab', 'valid_rm']);
  // (v4.1) Validation : node.validation {VCOL collaborateur, VRM responsable
  // de mission, VSUP superviseur}. Valeurs relevées en direct : « AF » (à
  // faire) et « AV » (à valider) = non validé ; toute autre valeur non vide
  // (ne commençant pas par A) est considérée comme validée.
  const VALIDATION_LABELS = { AF: 'à faire', AV: 'à valider' };
  function validationCode(node, key) {
    const v = node && node.validation ? node.validation[key] : null;
    return v === null || v === undefined || v === false ? '' : String(v).trim().toUpperCase();
  }
  function isValidated(node, key) {
    const t = validationCode(node, key);
    return !!t && !t.startsWith('A') && !['0', 'FALSE', 'NON', 'N', 'NO'].includes(t);
  }
  function validationText(node, key) {
    const t = validationCode(node, key);
    if (!t) return 'non renseigné';
    if (isValidated(node, key)) return 'validé (' + t + ')';
    return (VALIDATION_LABELS[t] || 'non validé') + ' (' + t + ')';
  }
  // PJ du dossier de révision : colonne affichée seulement si au moins un
  // compte en a (mémorisé par jeu de données).
  function anyPj() {
    const d = state.data;
    if (!d) return false;
    if (d._tmbAnyPj === undefined) {
      const root = Array.isArray(d.data) ? d.data : Array.isArray(d.details) ? d.details : [];
      d._tmbAnyPj = flattenLeaves(root, []).some((r) => (r.node.nb_da_acc_docs || 0) > 0);
    }
    return d._tmbAnyPj;
  }
  function visibleColumns() {
    let cols = allColumns();
    if (!state.compareN1) cols = cols.filter((c) => !c.n1);
    if (!state.showRevisionCols) return cols.filter((c) => !REVISION_COLUMN_IDS.has(c.id));
    return cols.filter((c) => c.id !== 'pj' || anyPj());
  }

  // -----------------------------------------------------------------------
  // 8. Construction de la liste de lignes visibles (hiérarchie, tri, filtre,
  //    "sous-totaux" ON/OFF). Tout est recalculé côté client à chaque
  //    interaction : aucun appel réseau n'est nécessaire pour trier, filtrer,
  //    déplier/replier ou masquer les sous-totaux.
  // -----------------------------------------------------------------------
  function flattenLeaves(nodes, out) {
    nodes.forEach((n) => {
      if (!n.account_List || n.account_List.length === 0) {
        out.push({ node: n, depth: 0, hasChildren: false, key: n.account_number });
      } else {
        flattenLeaves(n.account_List, out);
      }
    });
    return out;
  }

  function sortNodes(nodes) {
    if (!state.sortCol || state.sortDir === 'none') return nodes;
    const col = state.sortCol;
    const copy = nodes.slice();
    copy.sort((a, b) => {
      const va = cellValue(a, col);
      const vb = cellValue(b, col);
      let cmp;
      if (typeof va === 'number' || typeof vb === 'number') {
        const na = typeof va === 'number' ? va : -Infinity;
        const nb = typeof vb === 'number' ? vb : -Infinity;
        cmp = na - nb;
      } else {
        cmp = String(va || '').localeCompare(String(vb || ''), 'fr');
      }
      return state.sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }

  // Filtre "N° Compte" : par défaut préfixe ("101" -> commence par 101).
  // ">2" -> commence par une classe >= 2 (2, 3, 4...) : on compare le préfixe
  // du numéro de compte, de même longueur que le nombre tapé après ">", en
  // tant qu'entier. "101+201" -> union de plusieurs préfixes séparés par "+".
  function matchesAccountNumberFilter(accountNumber, filterRaw) {
    const acct = String(accountNumber || '');
    const parts = filterRaw
      .split('+')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return true;
    return parts.some((part) => {
      if (part[0] === '>') {
        const digits = part.slice(1).trim();
        if (!/^\d+$/.test(digits)) return false;
        const prefix = acct.slice(0, digits.length);
        if (!/^\d+$/.test(prefix)) return false;
        return parseInt(prefix, 10) >= parseInt(digits, 10);
      }
      return acct.toLowerCase().startsWith(part.toLowerCase());
    });
  }

  // Filtre sur une colonne de montant (Solde N/N-1, Débit/Crédit, Var €) :
  //   ">100"  -> valeurs strictement supérieures à 100
  //   "<100"  -> valeurs strictement inférieures à 100
  //   "+100"  -> valeur exactement égale à +100 (positif uniquement)
  //   "-100"  -> valeur exactement égale à -100 (négatif uniquement)
  //   "100"   -> valeur égale à 100 en valeur absolue (avec ou sans signe -)
  function matchesAmountFilter(value, filterRaw) {
    if (typeof value !== 'number') return false;
    const raw = filterRaw.trim();
    const EPS = 0.005;
    if (raw[0] === '>') {
      const n = parseFloat(raw.slice(1));
      return isNaN(n) ? true : value > n;
    }
    if (raw[0] === '<') {
      const n = parseFloat(raw.slice(1));
      return isNaN(n) ? true : value < n;
    }
    if (raw[0] === '+' || raw[0] === '-') {
      const n = parseFloat(raw);
      return isNaN(n) ? true : Math.abs(value - n) < EPS;
    }
    const n = parseFloat(raw);
    return isNaN(n) ? true : Math.abs(Math.abs(value) - Math.abs(n)) < EPS;
  }

  const AMOUNT_FILTER_COLUMN_IDS = new Set([
    'solde_n', 'solde_n1', 'var_eur', 'debit_n', 'credit_n', 'debit_n1', 'credit_n1',
    'solde_aged', 'age_30', 'age_45', 'age_60', 'age_90', 'age_120', 'age_over120',
    'monthly_total',
  ]);

  function matchesFilters(node) {
    return Object.keys(state.filterText).every((colId) => {
      const needle = (state.filterText[colId] || '').trim();
      if (!needle) return true;
      if (colId === 'account_number') {
        return matchesAccountNumberFilter(node.account_number, needle);
      }
      if (AMOUNT_FILTER_COLUMN_IDS.has(colId) || isAmountColId(colId) || isMonthColumnId(colId)) {
        return matchesAmountFilter(cellValue(node, colId), needle);
      }
      const v = cellDisplay(node, colId);
      return String(v).toLowerCase().indexOf(needle.toLowerCase()) !== -1;
    });
  }

  function hasActiveFilters() {
    return Object.values(state.filterText).some((v) => (v || '').trim());
  }

  // Ligne de total pour une classe (1, 2, 3...) — recalculée en sommant les
  // feuilles réellement obtenues (mêmes options API en place : centralisé,
  // non soldés uniquement, etc.), plutôt que de dépendre d'un éventuel champ
  // d'agrégat déjà présent sur le nœud de tête, pour rester cohérent avec la
  // ligne "Résultat" (même logique de recalcul).
  function buildClassSubtotalNode(classNode, leaves) {
    let n = 0;
    let n1 = 0;
    leaves.forEach((node) => {
      const v0 = node.exercice_values && node.exercice_values[0];
      const v1 = node.exercice_values && node.exercice_values[1];
      if (typeof v0 === 'number') n += v0;
      if (typeof v1 === 'number') n1 += v1;
    });
    const label = 'Total ' + (classNode.label || classNode.account_number || '');
    const result = { account_number: '', label, exercice_values: [n, n1], varValue: null, varPercent: null, validation: null, nb_da_acc_docs: 0, hasComment: false };
    result._grossDebitCredit = sumGrossDebitCredit(leaves);
    result._leaves = leaves;
    result.month_values = sumMonthValues(leaves);
    return result;
  }

  // Mode âgé : liste plate directement fournie par l'API (data.details),
  // sans hiérarchie account_List — pas d'arbre à déplier/replier, pas de
  // sous-totaux de classe, on filtre/trie exactement comme la vue à plat du
  // mode normal (mêmes fonctions matchesFilters/sortNodes, génériques sur
  // cellValue).
  function buildAgedVisibleRows() {
    let leaves = ((state.data && state.data.details) || []).slice();
    leaves = leaves.filter(matchesFilters);
    leaves = sortNodes(leaves);
    return leaves.map((node) => ({ node, depth: 0, hasChildren: false }));
  }

  function buildVisibleRows() {
    if (state.aged) return buildAgedVisibleRows();
    const hasFilters = hasActiveFilters();
    const data = (state.data && state.data.data) || [];

    if (hasFilters) {
      // Vue à plat : uniquement les comptes feuilles, triés/filtrés.
      let leaves = flattenLeaves(data, []).map((r) => r.node);
      leaves = leaves.filter(matchesFilters);
      leaves = sortNodes(leaves);
      return leaves.map((node) => ({ node, depth: 0, hasChildren: false }));
    }

    if (state.showClassSubtotals) {
      // Vue à plat (pas de hiérarchie dépliable), mais avec une ligne de
      // total après chaque classe (1, 2, 3...) — un niveau de "tête" de
      // `data` par classe.
      const out = [];
      data.forEach((classNode, idx) => {
        const leaves = sortNodes(flattenLeaves([classNode], []).map((r) => r.node));
        leaves.forEach((node) => out.push({ node, depth: 0, hasChildren: false }));
        out.push({
          node: buildClassSubtotalNode(classNode, leaves),
          depth: 0,
          hasChildren: false,
          key: '__classtotal_' + idx,
          isSubtotal: true,
        });
      });
      return out;
    }

    if (!state.showSubtotals) {
      // Vue à plat : uniquement les comptes feuilles, triés.
      let leaves = flattenLeaves(data, []).map((r) => r.node);
      leaves = sortNodes(leaves);
      return leaves.map((node) => ({ node, depth: 0, hasChildren: false }));
    }

    // Vue hiérarchique normale : dépliable/repliable, tri à chaque niveau.
    const out = [];
    function walk(nodes, depth, pathPrefix) {
      const sorted = sortNodes(nodes);
      sorted.forEach((node, i) => {
        const key = pathPrefix + '/' + i + '_' + (node.account_number || node.label);
        const hasChildren = !!(node.account_List && node.account_List.length);
        out.push({ node, depth, hasChildren, key });
        if (hasChildren && state.expanded.has(key)) {
          walk(node.account_List, depth + 1, key);
        }
      });
    }
    walk(data, 0, 'root');
    return out;
  }

  // -----------------------------------------------------------------------
  // 9. Rendu HTML.
  // -----------------------------------------------------------------------
  function renderOptionsPanel() {
    const fy = state.fiscalYears
      .map(
        (f, i) =>
          `<option value="${i}" ${f.start === state.startDate && f.end === state.endDate ? 'selected' : ''}>${f.label}</option>`
      )
      .join('');
    const seg = (v, lab) =>
      `<button type="button" class="tmb-seg-btn${state.subtype === v ? ' tmb-seg-on' : ''}" data-subtype="${v}">${lab}</button>`;
    return `
      <div class="tmb-opt-group">
        <label>Balance</label>
        <div class="tmb-seg">${seg(0, 'Générale')}${seg(1, 'Clients')}${seg(2, 'Fourn.')}</div>
      </div>
      <div class="tmb-opt-group">
        <label>Comptes (plage)</label>
        <input type="text" id="tmb-range" value="${state.filterRange}" placeholder="ex. 41-419999" title="Laisser vide pour tous les comptes" />
      </div>
      <div class="tmb-opt-row2">
        <div class="tmb-opt-group">
          <label>Du</label>
          <input type="date" id="tmb-start" value="${state.startDate}" />
        </div>
        <div class="tmb-opt-group">
          <label>Au</label>
          <input type="date" id="tmb-end" value="${state.endDate}" />
        </div>
      </div>
      ${
        fy
          ? `<div class="tmb-opt-group">
               <label>Exercice(s)</label>
               <select id="tmb-fiscal-year"><option value="-1">— personnalisé —</option>${fy}</select>
             </div>`
          : ''
      }
      <div class="tmb-opt-check-group">
        <div class="tmb-opt-check-group-title">Affichage</div>
        <div class="tmb-opt-checks">
          <label class="${periodicMode() ? 'tmb-opt-disabled' : ''}"><input type="checkbox" id="tmb-unbalanced" ${state.unbalancedOnly ? 'checked' : ''} ${periodicMode() ? 'disabled' : ''}/> Non soldés uniquement</label>
          <label><input type="checkbox" id="tmb-compare-n1" ${state.compareN1 ? 'checked' : ''}/> Comparatif N-1 et N-2</label>
          <div class="tmb-opt-amount">
            <span>Montants affichés</span>
            <select id="tmb-amount-mode" title="Présentation des montants (même présentation pour N-1 et N-2)">${Object.keys(AMOUNT_MODES)
              .map((k) => `<option value="${k}" ${state.amountMode === k ? 'selected' : ''}>${AMOUNT_MODES[k].label}</option>`)
              .join('')}</select>
          </div>
          <label><input type="checkbox" id="tmb-subtotals" ${state.showSubtotals ? 'checked' : ''}/> Sous-totaux (avec regroupements)</label>
          <label><input type="checkbox" id="tmb-class-subtotals" ${state.showClassSubtotals ? 'checked' : ''}/> Sous-totaux (sans regroupements)</label>
          ${[
            ['tmb-monthly', 'showMonthly', 'Affichage mensuel'],
            ['tmb-monthly-cumul', 'showMonthlyCumulative', 'Affichage mensuel cumulé'],
            ['tmb-quarterly', 'showQuarterly', 'Affichage trimestriel'],
            ['tmb-quarterly-cumul', 'showQuarterlyCumulative', 'Affichage trimestriel cumulé'],
          ]
            .map(([id, key, lab]) => {
              const off = state.subtype !== 0 || state.aged;
              return `<label class="${off ? 'tmb-opt-disabled' : ''}" ${off ? 'title="Balance générale uniquement"' : ''}><input type="checkbox" id="${id}" data-periodic="${key}" ${state[key] && !off ? 'checked' : ''} ${off ? 'disabled' : ''}/> ${lab}</label>`;
            })
            .join('')}
        </div>
      </div>
      <div class="tmb-opt-check-group">
        <div class="tmb-opt-check-group-title">Tiers</div>
        <div class="tmb-opt-checks">
          <label><input type="checkbox" id="tmb-centralize" ${state.centralizeAccount ? 'checked' : ''}/> Comptes de tiers centralisés</label>
          <label class="${state.subtype === 1 || state.subtype === 2 ? '' : 'tmb-opt-disabled'}"><input type="checkbox" id="tmb-aged-invoice" ${state.subtype === 1 || state.subtype === 2 ? '' : 'disabled'} ${state.aged && state.agedCompareTo === 1 ? 'checked' : ''}/> Balance âgée - date de facture</label>
          <label class="${state.subtype === 1 || state.subtype === 2 ? '' : 'tmb-opt-disabled'}"><input type="checkbox" id="tmb-aged-due" ${state.subtype === 1 || state.subtype === 2 ? '' : 'disabled'} ${state.aged && state.agedCompareTo === 2 ? 'checked' : ''}/> Balance âgée - date de règlement</label>
        </div>
      </div>
      <div class="tmb-opt-check-group">
        <div class="tmb-opt-check-group-title">Révision</div>
        <div class="tmb-opt-checks">
          <label><input type="checkbox" id="tmb-revisions" ${state.showRevisionCols ? 'checked' : ''}/> Colonnes de révision (Com. / Valid. ; PJ si présentes)</label>
          <label><input type="checkbox" id="tmb-unvalidated" ${state.unvalidatedOnly ? 'checked' : ''}/> Comptes non validés uniquement</label>
        </div>
      </div>
      <button id="tmb-load" class="tmb-load-btn" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Chargement…' : 'Charger le tableau'}</button>
      <button type="button" id="tmb-reset-opts" class="tmb-link-btn">Réinitialiser les options</button>
      ${
        state.error
          ? `<div class="tmb-error">Erreur : ${state.error.replace(/\n/g, '<br>')}${
              /TOKENERROR/.test(state.error)
                ? '<br><button type="button" id="tmb-refresh-btn" class="tmb-refresh-btn">Rafraîchir la page</button>'
                : ''
            }</div>`
          : ''
      }
    `;
  }

  function renderHeaderRow() {
    return visibleColumns().map((c) => {
      const sortCls =
        state.sortCol === c.id ? (state.sortDir === 'asc' ? 'tmb-sort-asc' : state.sortDir === 'desc' ? 'tmb-sort-desc' : '') : '';
      const width = state.columnWidths[c.id] || c.width;
      const resizer = c.id !== 'expand' ? `<span class="tmb-col-resizer" data-col="${c.id}"></span>` : '';
      // La cellule d'en-tête de la colonne "expand" (tout à gauche, au-dessus
      // des flèches déplier/replier) n'affiche jamais de libellé : c'est là
      // qu'on loge le bouton d'export Excel du tableau tel qu'affiché.
      const label = c.id === 'expand' ? '' : c.label;
      return `<th data-col="${c.id}" class="${c.sortable ? 'tmb-sortable ' + sortCls : ''}${c.yearStart ? ' tmb-year-start' : ''}" style="${width ? 'width:' + width + ';' : ''}text-align:${c.align || 'left'} !important"><span class="tmb-th-label">${label}</span>${resizer}</th>`;
    }).join('');
  }

  function renderFilterRow() {
    return visibleColumns().map((c) => {
      if (c.id === 'expand') return '<th data-col="expand"></th>';
      return `<th data-col="${c.id}"><input type="text" class="tmb-filter-input" data-col="${c.id}" value="${state.filterText[c.id] || ''}"/></th>`;
    }).join('');
  }

  function renderRow(row) {
    const { node, depth, hasChildren, key, isSubtotal } = row;
    const indent = depth * 18;
    const expandIcon = hasChildren ? (state.expanded.has(key) ? '▼' : '▶') : '';
    const rowCls = isSubtotal ? ' class="tmb-subtotal-row"' : '';
    return `<tr data-key="${key || ''}"${rowCls}>
      ${visibleColumns().map((c) => {
        if (c.id === 'expand') {
          if (hasChildren) {
            return `<td class="tmb-expand-cell" data-col="expand" style="padding-left:${indent}px;text-align:center"><span class="tmb-expand-toggle" data-key="${key}">${expandIcon}</span></td>`;
          }
          // Ligne de compte "feuille" (pas de groupe à déplier) et pas une
          // ligne de total : case à cocher pour sélectionner ce compte —
          // clic simple = bascule, maj+clic = étend la sélection jusqu'ici.
          if (!isSubtotal) {
            const selKey = selectionKeyFor(node);
            if (selKey) {
              const checked = state.selectedKeys.has(selKey) ? 'checked' : '';
              return `<td class="tmb-expand-cell" data-col="expand" style="padding-left:${indent}px;text-align:center"><input type="checkbox" class="tmb-select-checkbox" data-sel-key="${xmlEscape(selKey)}" ${checked}/></td>`;
            }
          }
          return `<td class="tmb-expand-cell" data-col="expand" style="padding-left:${indent}px;text-align:center"></td>`;
        }
        const numericVal = cellValue(node, c.id);
        const isNegative = (NEGATIVE_HIGHLIGHT_COLUMN_IDS.has(c.id) || isSoldeColId(c.id) || isMonthColumnId(c.id)) && typeof numericVal === 'number' && numericVal < 0;
        const cls = (c.mono ? 'tmb-mono ' : '') + (isNegative ? 'tmb-negative' : '');
        // Petit espace entre le séparateur de colonne et le texte (avant : 0px
        // dans les deux cas, le texte touchait la bordure de la colonne).
        const style = c.id === 'label' ? 'padding-left:8px' : '';
        let display = cellDisplay(node, c.id);
        let inner = display;
        let cellTitle = '';
        if (c.id === 'label' && display) cellTitle = display;
        if (isLinkableCell(node, c.id)) {
          inner = `<span class="tmb-acct-link" data-account-id="${node.id_account}">${display}</span>`;
        } else if (c.id === 'pj' && !isSubtotal && node.id_l_dossier_revision_compte) {
          const hasDocs = (node.nb_da_acc_docs || 0) > 0;
          inner = hasDocs
            ? `<span class="tmb-pj-link" data-docs-object-id="${xmlEscape(String(node.id_l_dossier_revision_compte))}" title="Pièces jointes">${PJ_ICON_SVG} ${display}</span>`
            : '';
        } else if (c.id === 'valid' && !isSubtotal && node.validation) {
          const pill = (key, lab, full) =>
            `<span class="tmb-valid${isValidated(node, key) ? ' tmb-valid-ok' : ''}" title="${full} : ${validationText(node, key)}">${lab}</span>`;
          inner = pill('VCOL', 'C', 'Collaborateur') + ' ' + pill('VRM', 'RM', 'Responsable de mission');
        } else if (c.id === 'com' && !isSubtotal && node.id_account) {
          const hasCom = !!node.hasComment;
          const count = hasCom ? state.commentCounts[node.id_account] : undefined;
          const label = hasCom ? (typeof count === 'number' ? String(count) : '•') : '';
          inner = hasCom
            ? `<span class="tmb-com-link" data-account-id="${xmlEscape(String(node.id_account))}" title="Commentaires du compte">${label}</span>`
            : '';
        }
        if (c.id === 'var_eur' && typeof node.varPercent === 'number') {
          cellTitle = 'Variation : ' + fmtPercent(node.varPercent);
        }
        const titleAttr = cellTitle ? ` title="${xmlEscape(cellTitle)}"` : '';
        return `<td class="${cls}${c.yearStart ? ' tmb-year-start' : ''}" data-col="${c.id}" style="text-align:${c.align || 'left'} !important${style ? ';' + style : ''}"${titleAttr}>${inner}</td>`;
      }).join('')}
    </tr>`;
  }

  // Additionne varValue (Var €) sur une liste de feuilles — une somme de
  // montants de variation a un sens agrégé correct (contrairement à une
  // somme de Var % , qui elle reste exclue de la totalisation ci-dessous).
  function sumVarValue(leafNodes) {
    let total = 0;
    let any = false;
    leafNodes.forEach((node) => {
      if (typeof node.varValue === 'number') {
        total += node.varValue;
        any = true;
      }
    });
    return any ? total : null;
  }

  // Si un filtre de colonne est actif, la ligne "Total" doit refléter
  // uniquement les comptes actuellement affichés (somme des lignes filtrées)
  // plutôt que le total global renvoyé par l'API pour tout le périmètre —
  // sinon le montant affiché ne correspond plus à ce qui est réellement
  // affiché à l'écran. Sans filtre, on garde le total officiel de l'API pour
  // Solde N/N-1 (source la plus fiable), mais Débit/Crédit/Var € sont dans
  // tous les cas recalculés nous-mêmes en sommant les feuilles, l'API ne
  // renvoyant qu'un solde net. Var % reste exclu (une somme de pourcentages
  // n'a pas de sens agrégé). Le libellé indique le nombre de comptes
  // effectivement inclus dans le total, dans la colonne Intitulé.
  function computeResultRow(visibleRows, hasFilters) {
    let n, n1;
    let grossLeaves;
    if (hasFilters) {
      n = 0;
      n1 = 0;
      grossLeaves = visibleRows.map((r) => r.node);
      visibleRows.forEach(({ node }) => {
        const v0 = node.exercice_values && node.exercice_values[0];
        const v1 = node.exercice_values && node.exercice_values[1];
        if (typeof v0 === 'number') n += v0;
        if (typeof v1 === 'number') n1 += v1;
      });
    } else {
      const r = state.data && state.data.results;
      if (!r || !r.exercice_values) return null;
      n = r.exercice_values[0];
      n1 = r.exercice_values[1];
      // Débit/Crédit/Var € ne peuvent pas être déduits du seul total net de
      // l'API : on les recalcule nous-mêmes en sommant TOUTES les feuilles
      // du jeu de données courant (même logique que pour un sous-total de
      // classe), pour avoir les vrais totaux bruts, pas une compensation.
      const allData = (state.data && state.data.data) || [];
      grossLeaves = flattenLeaves(allData, []).map((r2) => r2.node);
    }
    const label = `Total (${grossLeaves.length} ligne${grossLeaves.length > 1 ? 's' : ''})`;
    const result = {
      account_number: '',
      label,
      exercice_values: [n, n1],
      varValue: sumVarValue(grossLeaves),
      varPercent: null,
      validation: null,
      nb_da_acc_docs: 0,
      hasComment: false,
    };
    result._grossDebitCredit = sumGrossDebitCredit(grossLeaves);
    result._leaves = grossLeaves;
    result.month_values = sumMonthValues(grossLeaves);
    return result;
  }

  // Balance Générale (2026-08-01, demande explicite de Nicolas) : au lieu
  // d'une seule ligne "Total" en bas de tableau, 3 lignes distinctes — Total
  // bilan (classes 1 à 5 + 8, comptes hors-bilan/engagements), Total comptes
  // de résultat (classes 6 charges et 7 produits, PCG standard), Total
  // général (toutes classes confondues). Uniquement en Balance Générale
  // (subtype 0) : en Client/Fournisseur (subtype 1/2) tous les comptes
  // appartiennent de toute façon à la même classe 4, une seule ligne "Total"
  // comme avant reste utilisée (voir computeBottomRows). Le chiffre de
  // classe est le premier caractère du numéro de compte du nœud de tête
  // (data.data[i].account_number, ex. "1", "2"... voir la hiérarchie
  // renvoyée par balance_dynamique/v2) : suffisant pour classer une feuille,
  // un compte héritant toujours de la classe de son nœud racine (jamais
  // mélangé entre classes dans account_List).
  const BILAN_CLASS_DIGITS = new Set(['1', '2', '3', '4', '5', '8']);
  const RESULT_CLASS_DIGITS = new Set(['6', '7']);

  function accountClassDigit(node) {
    const s = String((node && node.account_number) || '');
    return s.charAt(0);
  }

  // Reprend exactement la logique "gross" de computeResultRow (fiable avec
  // ou sans filtre actif, contrairement au total net renvoyé par l'API qui
  // ne distingue de toute façon pas les classes) mais paramétrée par un
  // libellé et une liste de feuilles déjà filtrées par classe — évite de
  // dupliquer 3 fois le même calcul pour Bilan/Résultat/Général.
  function buildLeafGroupTotal(label, leaves) {
    if (!leaves.length) return null;
    let n = 0;
    let n1 = 0;
    leaves.forEach((node) => {
      const v0 = node.exercice_values && node.exercice_values[0];
      const v1 = node.exercice_values && node.exercice_values[1];
      if (typeof v0 === 'number') n += v0;
      if (typeof v1 === 'number') n1 += v1;
    });
    const result = {
      account_number: '',
      label: `${label} (${leaves.length} ligne${leaves.length > 1 ? 's' : ''})`,
      exercice_values: [n, n1],
      varValue: sumVarValue(leaves),
      varPercent: null,
      validation: null,
      nb_da_acc_docs: 0,
      hasComment: false,
    };
    result._grossDebitCredit = sumGrossDebitCredit(leaves);
    result._leaves = leaves;
    result.month_values = sumMonthValues(leaves);
    return result;
  }

  // Une classe absente du jeu de données courant (ex. balance filtrée sur la
  // classe 4 uniquement) donne simplement une ligne null pour ce groupe,
  // filtrée par le .filter(Boolean) ci-dessous — jamais de ligne "Total
  // bilan (0 ligne)" vide affichée inutilement.
  function computeGeneralSplitRows(visibleRows, hasFilters) {
    const leaves = hasFilters
      ? visibleRows.filter((r) => !r.isSubtotal).map((r) => r.node)
      : flattenLeaves((state.data && state.data.data) || [], []).map((r) => r.node);
    const bilanLeaves = leaves.filter((n) => BILAN_CLASS_DIGITS.has(accountClassDigit(n)));
    const resultLeaves = leaves.filter((n) => RESULT_CLASS_DIGITS.has(accountClassDigit(n)));
    return [
      buildLeafGroupTotal('Total bilan', bilanLeaves),
      buildLeafGroupTotal('Total comptes de résultat', resultLeaves),
      buildLeafGroupTotal('Total général', leaves),
    ].filter(Boolean);
  }

  // Quand au moins un compte est coché (case à cocher), la ligne "Total" est
  // remplacée par le total des seuls comptes cochés actuellement visibles
  // (l'intersection avec la sélection gère naturellement le cas où un compte
  // coché disparaît suite à un filtre : il n'est simplement plus compté tant
  // qu'il n'est pas de nouveau visible).
  function computeSelectionResultNode(visibleRows) {
    if (!state.selectedKeys.size) return null;
    const selected = visibleRows.filter(
      ({ node, isSubtotal }) => !isSubtotal && state.selectedKeys.has(selectionKeyFor(node))
    );
    if (!selected.length) return null;
    let n = 0;
    let n1 = 0;
    selected.forEach(({ node }) => {
      const v0 = node.exercice_values && node.exercice_values[0];
      const v1 = node.exercice_values && node.exercice_values[1];
      if (typeof v0 === 'number') n += v0;
      if (typeof v1 === 'number') n1 += v1;
    });
    const leaves = selected.map((r) => r.node);
    const label = `Total sélection (${selected.length} compte${selected.length > 1 ? 's' : ''})`;
    const result = {
      account_number: '',
      label,
      exercice_values: [n, n1],
      varValue: sumVarValue(leaves),
      varPercent: null,
      validation: null,
      nb_da_acc_docs: 0,
      hasComment: false,
    };
    result._grossDebitCredit = sumGrossDebitCredit(leaves);
    result._leaves = leaves;
    result.month_values = sumMonthValues(leaves);
    return result;
  }

  // Mode âgé : même principe que computeResultRow/computeSelectionResultNode
  // mais sur la forme de données plate (total_values/column_values) plutôt
  // que exercice_values — voir buildAgedApiUrl pour la forme de la réponse.
  function buildAgedResultNode(label, solde, buckets) {
    return {
      account_number: '',
      label,
      total_values: [solde],
      column_values: buckets,
      validation: null,
      hasComment: false,
    };
  }

  function sumAgedNodes(nodes) {
    let solde = 0;
    const buckets = [0, 0, 0, 0, 0, 0];
    nodes.forEach((node) => {
      const s = Array.isArray(node.total_values) ? node.total_values[0] : null;
      if (typeof s === 'number') solde += s;
      (node.column_values || []).forEach((v, i) => {
        if (typeof v === 'number') buckets[i] += v;
      });
    });
    return { solde, buckets };
  }

  function computeAgedResultRow(visibleRows, hasFilters) {
    if (hasFilters) {
      const { solde, buckets } = sumAgedNodes(visibleRows.map((r) => r.node));
      const label = `Total (${visibleRows.length} ligne${visibleRows.length > 1 ? 's' : ''})`;
      return buildAgedResultNode(label, solde, buckets);
    }
    const t = state.data && state.data.totals;
    if (!t) return null;
    const allLeaves = (state.data && state.data.details) || [];
    const label = `Total (${allLeaves.length} ligne${allLeaves.length > 1 ? 's' : ''})`;
    return buildAgedResultNode(label, t.total_values, t.column_values || []);
  }

  function computeAgedSelectionResultNode(visibleRows) {
    if (!state.selectedKeys.size) return null;
    const selected = visibleRows.filter(
      ({ node, isSubtotal }) => !isSubtotal && state.selectedKeys.has(selectionKeyFor(node))
    );
    if (!selected.length) return null;
    const { solde, buckets } = sumAgedNodes(selected.map((r) => r.node));
    const label = `Total sélection (${selected.length} compte${selected.length > 1 ? 's' : ''})`;
    return buildAgedResultNode(label, solde, buckets);
  }

  // Retourne toujours un TABLEAU de lignes de synthèse (0 à 3), jamais un
  // nœud unique : la Balance Générale peut afficher 3 lignes (Total bilan /
  // Total comptes de résultat / Total général, cf. computeGeneralSplitRows),
  // tous les autres cas (âgé, Client/Fournisseur, sélection active) restant
  // à une seule ligne comme avant. Les deux appelants (rendu écran, export
  // Excel) itèrent simplement sur le tableau.
  function computeBottomRows(rows) {
    if (state.aged) {
      const node = computeAgedSelectionResultNode(rows) || computeAgedResultRow(rows, hasActiveFilters());
      return node ? [node] : [];
    }
    const selectionNode = computeSelectionResultNode(rows);
    if (selectionNode) return [selectionNode];
    // Balance Générale (subtype 0) uniquement : en Client/Fournisseur
    // (subtype 1/2) tous les comptes sont de toute façon dans la même
    // classe 4, une seule ligne "Total" reste plus lisible.
    if (state.subtype === 0) {
      return computeGeneralSplitRows(rows, hasActiveFilters());
    }
    const node = computeResultRow(rows, hasActiveFilters());
    return node ? [node] : [];
  }

  function renderTablePanel() {
    if (!state.data) {
      return `<div class="tmb-empty">${state.loading ? 'Chargement…' : 'Cliquez sur "Charger le tableau".'}</div>`;
    }
    const rows = buildVisibleRows();
    const resultRows = computeBottomRows(rows);
    return `
      <table class="tmb-table">
        <thead>
          <tr class="tmb-head-row">${renderHeaderRow()}</tr>
          <tr class="tmb-filter-row">${renderFilterRow()}</tr>
        </thead>
        <tbody>
          ${rows.map(renderRow).join('')}
          ${resultRows
            .map((node, i) =>
              renderRow({ node, depth: 0, hasChildren: false, key: '__result__' + i, isSubtotal: true })
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  // -----------------------------------------------------------------------
  // Export Excel (.xlsx) du tableau tel qu'affiché à l'écran (mêmes
  // lignes/colonnes visibles : filtre, tri, sous-totaux, colonnes de
  // révision ou non, Débit/Crédit ou Solde...). Pas de librairie externe
  // (SheetJS etc.) chargée depuis un CDN — risque de blocage par la CSP de
  // la page — on construit nous-mêmes un fichier .xlsx minimal mais valide :
  // un .xlsx est un simple ZIP contenant quelques XML (OOXML). On écrit le
  // ZIP en mode STORE (non compressé) pour éviter d'avoir à réimplémenter
  // deflate ; testé et validé (LibreOffice + openpyxl) pendant le développement.
  // -----------------------------------------------------------------------
  const ZIP_CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function zipCrc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = ZIP_CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipU16(n) {
    return [n & 0xff, (n >> 8) & 0xff];
  }
  function zipU32(n) {
    return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  }

  // ZIP writer minimal (méthode STORE) — suffisant pour produire un .xlsx
  // valide, sans dépendance de compression externe.
  function buildZip(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const encoder = new TextEncoder();

    files.forEach(({ name, data }) => {
      const nameBytes = encoder.encode(name);
      const crc = zipCrc32(data);
      const size = data.length;

      const local = new Uint8Array(30 + nameBytes.length);
      let p = 0;
      local.set(zipU32(0x04034b50), p); p += 4;
      local.set(zipU16(20), p); p += 2;
      local.set(zipU16(0), p); p += 2;
      local.set(zipU16(0), p); p += 2;
      local.set(zipU16(0), p); p += 2;
      local.set(zipU16(0x21), p); p += 2;
      local.set(zipU32(crc), p); p += 4;
      local.set(zipU32(size), p); p += 4;
      local.set(zipU32(size), p); p += 4;
      local.set(zipU16(nameBytes.length), p); p += 2;
      local.set(zipU16(0), p); p += 2;
      local.set(nameBytes, p); p += nameBytes.length;
      localParts.push(local, data);

      const central = new Uint8Array(46 + nameBytes.length);
      p = 0;
      central.set(zipU32(0x02014b50), p); p += 4;
      central.set(zipU16(20), p); p += 2;
      central.set(zipU16(20), p); p += 2;
      central.set(zipU16(0), p); p += 2;
      central.set(zipU16(0), p); p += 2;
      central.set(zipU16(0), p); p += 2;
      central.set(zipU16(0x21), p); p += 2;
      central.set(zipU32(crc), p); p += 4;
      central.set(zipU32(size), p); p += 4;
      central.set(zipU32(size), p); p += 4;
      central.set(zipU16(nameBytes.length), p); p += 2;
      central.set(zipU16(0), p); p += 2;
      central.set(zipU16(0), p); p += 2;
      central.set(zipU16(0), p); p += 2;
      central.set(zipU16(0), p); p += 2;
      central.set(zipU32(0), p); p += 4;
      central.set(zipU32(offset), p); p += 4;
      central.set(nameBytes, p); p += nameBytes.length;
      centralParts.push(central);

      offset += local.length + data.length;
    });

    const centralSize = centralParts.reduce((a, b) => a + b.length, 0);
    const centralOffset = offset;
    const end = new Uint8Array(22);
    let p = 0;
    end.set(zipU32(0x06054b50), p); p += 4;
    end.set(zipU16(0), p); p += 2;
    end.set(zipU16(0), p); p += 2;
    end.set(zipU16(files.length), p); p += 2;
    end.set(zipU16(files.length), p); p += 2;
    end.set(zipU32(centralSize), p); p += 4;
    end.set(zipU32(centralOffset), p); p += 4;
    end.set(zipU16(0), p);

    const out = new Uint8Array(offset + centralSize + end.length);
    let pos = 0;
    localParts.forEach((part) => { out.set(part, pos); pos += part.length; });
    centralParts.forEach((part) => { out.set(part, pos); pos += part.length; });
    out.set(end, pos);
    return out;
  }

  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function xlsxColLetter(idx) {
    let n = idx + 1;
    let s = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // Styles (cellXfs) : 0=texte normal, 1=nombre 2 décimales, 2=pourcentage,
  // 3=texte gras, 4=nombre gras (ligne "Résultat"/sous-totaux de classe).
  const XLSX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="2" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const XLSX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const XLSX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const XLSX_WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Balance" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const XLSX_WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // cellRows: tableau de lignes, chaque ligne un tableau de cellules
  // { type: 'text'|'number'|'percent'|'bold-text'|'bold-number', value }
  function buildXlsxSheetXml(cellRows) {
    let rowsXml = '';
    cellRows.forEach((rowCells, rIdx) => {
      const r = rIdx + 1;
      let cellsXml = '';
      rowCells.forEach((cell, cIdx) => {
        const ref = xlsxColLetter(cIdx) + r;
        if (cell.type === 'number') {
          cellsXml += `<c r="${ref}" s="1"><v>${cell.value}</v></c>`;
        } else if (cell.type === 'percent') {
          cellsXml += `<c r="${ref}" s="2"><v>${cell.value}</v></c>`;
        } else if (cell.type === 'bold-text') {
          cellsXml += `<c r="${ref}" s="3" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.value)}</t></is></c>`;
        } else if (cell.type === 'bold-number') {
          cellsXml += `<c r="${ref}" s="4"><v>${cell.value}</v></c>`;
        } else if (cell.type === 'text') {
          cellsXml += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.value)}</t></is></c>`;
        } else {
          cellsXml += `<c r="${ref}"></c>`;
        }
      });
      rowsXml += `<row r="${r}">${cellsXml}</row>`;
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
  }

  function buildXlsxBytes(cellRows) {
    const encoder = new TextEncoder();
    const files = [
      { name: '[Content_Types].xml', data: encoder.encode(XLSX_CONTENT_TYPES) },
      { name: '_rels/.rels', data: encoder.encode(XLSX_RELS) },
      { name: 'xl/workbook.xml', data: encoder.encode(XLSX_WORKBOOK) },
      { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(XLSX_WORKBOOK_RELS) },
      { name: 'xl/styles.xml', data: encoder.encode(XLSX_STYLES) },
      { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(buildXlsxSheetXml(cellRows)) },
    ];
    return buildZip(files);
  }

  // Colonnes de montants exportées comme véritables nombres Excel (<c><v>123.45</v></c>,
  // sans t="inlineStr") plutôt que comme texte formaté ("1 234,56" avec espace insécable de
  // regroupement des milliers, ce que faisait cellDisplay) — demande explicite de Nicolas le
  // 2026-08-01 après un export de la balance mensuelle où les colonnes mois arrivaient en texte
  // dans Excel (non exploitables en formule/somme). Étendu à toutes les colonnes de montant du
  // fichier, y compris celles ajoutées depuis (mode âgé, mensuel) qui manquaient ici par le même
  // oubli. isMonthColumnId(colId) couvre month_0..month_N (nombre variable selon l'exercice, cf.
  // monthColumnCount) — impossible à lister en dur dans le Set, d'où le OR séparé plus bas.
  const EXPORT_NUMERIC_COLUMN_IDS = new Set([
    'solde_n', 'solde_n1', 'debit_n', 'credit_n', 'debit_n1', 'credit_n1', 'var_eur',
    'solde_aged', 'age_30', 'age_45', 'age_60', 'age_90', 'age_120', 'age_over120',
    'monthly_total',
  ]);
  const EXPORT_PERCENT_COLUMN_IDS = new Set(['var_pct']);

  // colId === null pour les cellules de texte "libres" (en-têtes) ; sinon on
  // regarde le type de colonne pour choisir texte/nombre/pourcentage, avec ou
  // sans gras (bold utilisé pour la ligne "Résultat" et les sous-totaux de classe).
  function exportCellSpec(node, colId, indentPrefix, bold) {
    const raw = cellValue(node, colId);
    if (EXPORT_PERCENT_COLUMN_IDS.has(colId)) {
      if (typeof raw !== 'number') return { type: bold ? 'bold-text' : 'text', value: '' };
      // Var % est déjà exprimé en points de pourcentage (ex: 6 pour "6%") ;
      // le format Excel "%" multiplie par 100 à l'affichage, donc on stocke
      // la fraction (0.06) pour obtenir le même "6%" affiché dans Excel.
      return { type: 'percent', value: raw / 100 };
    }
    if (EXPORT_NUMERIC_COLUMN_IDS.has(colId) || isAmountColId(colId) || isMonthColumnId(colId)) {
      if (typeof raw !== 'number') return { type: bold ? 'bold-text' : 'text', value: '' };
      return { type: bold ? 'bold-number' : 'number', value: raw };
    }
    let text = cellDisplay(node, colId);
    if (indentPrefix) text = indentPrefix + text;
    return { type: bold ? 'bold-text' : 'text', value: text };
  }

  function exportTableToExcel() {
    const cols = visibleColumns().filter((c) => c.id !== 'expand');
    const rows = buildVisibleRows();
    const resultRows = computeBottomRows(rows);

    const cellRows = [];
    cellRows.push(cols.map((c) => ({ type: 'bold-text', value: c.label })));

    rows.forEach(({ node, depth, isSubtotal }) => {
      cellRows.push(
        cols.map((c) => {
          const indentPrefix = c.id === 'label' && depth > 0 ? '    '.repeat(depth) : '';
          return exportCellSpec(node, c.id, indentPrefix, !!isSubtotal);
        })
      );
    });

    resultRows.forEach((node) => {
      cellRows.push(cols.map((c) => exportCellSpec(node, c.id, '', true)));
    });

    const bytes = buildXlsxBytes(cellRows);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const datePart = [state.startDate, state.endDate].filter(Boolean).join('_au_') || 'export';
    a.href = url;
    a.download = `balance_${datePart}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---- Curseur « Arrêté au » (fin de mois) ------------------------------
  const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const pad2 = (n) => String(n).padStart(2, '0');
  function isoToFrDate(iso) {
    return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
  }
  function monthEndIso(y, m) {
    return y + '-' + pad2(m + 1) + '-' + pad2(new Date(y, m + 1, 0).getDate());
  }
  function fyContaining(iso) {
    return state.fiscalYears.find((f) => f.start <= iso && iso <= f.end) || null;
  }
  // (v4.1) Mois proposés : uniquement ceux de l'exercice affiché (N) ; les
  // autres exercices passent par le sélecteur « Exercice(s) ».
  function timelineModel() {
    const fys = state.fiscalYears.slice().sort((a, b) => (a.start < b.start ? -1 : 1));
    if (!fys.length || !state.endDate) return null;
    const cur = fyContaining(state.endDate) || fyContaining(state.startDate) || fys[fys.length - 1];
    const from = cur;
    const to = cur;
    const months = [];
    let y = Number(from.start.slice(0, 4));
    let m = Number(from.start.slice(5, 7)) - 1;
    for (let guard = 0; guard < 48; guard++) {
      const end = monthEndIso(y, m);
      if (end > to.end) break;
      months.push({ y, m, end });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    if (!months.length) return null;
    let idx = months.findIndex((x) => x.end >= state.endDate);
    if (idx < 0) idx = months.length - 1;
    return { months, idx, cur, fys };
  }
  function timelineLabel(model, i) {
    const mo = model.months[i];
    const fy = fyContaining(mo.end);
    const status = fy && mo.end === fy.end ? "fin d'exercice" : 'situation intermédiaire';
    return {
      date: isoToFrDate(mo.end),
      thumb: pad2(mo.m + 1) + '/' + mo.y,
      status: status + (fy ? ' · exercice du ' + isoToFrDate(fy.start) + ' au ' + isoToFrDate(fy.end) : ''),
    };
  }
  function renderTimeline() {
    const model = timelineModel();
    if (!model) return '';
    const n = model.months.length;
    const pos = (i) => ((i + 0.5) / n) * 100;
    const lab = timelineLabel(model, model.idx);
    const curStart = model.months.findIndex((x) => x.end >= model.cur.start);
    const curEnd = model.months.findIndex((x) => x.end >= model.cur.end);
    const exL = curStart < 0 ? 0 : (curStart / n) * 100;
    const exW = curEnd < 0 ? 100 - exL : ((curEnd + 1) / n) * 100 - exL;
    const ticks = model.months
      .map((x, i) => {
        const edge = i === 0 || i === n - 1;
        return `<div class="tmb-tl-tick" style="left:${pos(i)}%"><i style="height:${edge ? 11 : 6}px"></i><span>${pad2(x.m + 1)}</span></div>`;
      })
      .join('');
    return `
      <div class="tmb-tl">
        <div class="tmb-tl-head">
          <b>Arrêté au</b><b class="tmb-tl-date">${lab.date}</b><span class="tmb-tl-status">${lab.status}</span>
          <div style="flex:1"></div>
          <span class="tmb-tl-hint">Glisser le curseur · <b>← →</b> mois par mois</span>
        </div>
        <div class="tmb-tl-zone">
          <div class="tmb-tl-track"></div>
          <div class="tmb-tl-ex" style="left:${exL}%;width:${exW}%" title="Exercice en cours"></div>
          <div class="tmb-tl-fill" style="width:${pos(model.idx)}%"></div>
          ${ticks}
          <span class="tmb-tl-label" style="left:${pos(model.idx)}%">${lab.thumb}</span>
          <span class="tmb-tl-thumb" style="left:${pos(model.idx)}%"></span>
          <input type="range" id="tmb-tl-range" min="0" max="${n - 1}" step="1" value="${model.idx}" aria-label="Fin de période (fin de mois)" ${state.loading ? 'disabled' : ''}/>
        </div>
      </div>`;
  }
  // Applique le mois choisi : période = début de l'exercice qui contient la
  // fin de mois → fin de mois. Une fin d'exercice exacte garde l'identifiant
  // d'exercice (dossier_revision_id), au besoin en pilotant le sélecteur
  // natif « Exercice(s) » ; une date intermédiaire est une période
  // personnalisée, envoyée sans identifiant (comme l'affichage natif).
  async function applyTimelineMonth(i) {
    const model = timelineModel();
    if (!model || !model.months[i]) return;
    const end = model.months[i].end;
    const fy = fyContaining(end);
    if (!fy) return;
    state.startDate = fy.start;
    state.endDate = end;
    const key = fy.start + '|' + fy.end;
    if (end === fy.end && key !== state.revisionFyKey) {
      await selectFiscalYear(state.fiscalYears.indexOf(fy));
      return;
    }
    loadBalance();
  }

  // ---- Bandeaux de totaux ------------------------------------------------
  function leafRowsOf(rows) {
    return rows.filter((r) => !r.hasChildren && !r.isSubtotal && r.node && r.node.account_number && !isSummaryLabel(r.node.label));
  }
  function renderBars() {
    if (!state.data || state.aged || !Array.isArray(state.data.data)) return '';
    // tous les comptes retenus par les filtres, y compris dans les groupes repliés
    const leaves = flattenLeaves(state.data.data, [])
      .map((r) => r.node)
      .filter((n) => n.account_number && !isSummaryLabel(n.label) && matchesFilters(n));
    const g = sumGrossDebitCredit(leaves);
    let res = 0;
    leaves.forEach((n) => {
      if (/^[67]/.test(String(n.account_number))) res -= (n.exercice_values && n.exercice_values[0]) || 0;
    });
    const f = (v) => `<b class="${v < 0 ? 'tmb-bar-neg' : ''}">${fmtAmount(v)}</b>`;
    let sel = '';
    if (state.selectedKeys.size) {
      const chosen = leaves.filter((n) => state.selectedKeys.has(selectionKeyFor(n)));
      const solde = chosen.reduce((a, n) => a + ((n.exercice_values && n.exercice_values[0]) || 0), 0);
      sel = `<div class="tmb-bar tmb-bar-sel"><span>Sélection : <b>${chosen.length} compte${chosen.length > 1 ? 's' : ''}</b></span><span>Solde ${f(solde)}</span></div>`;
    }
    return `
      <div class="tmb-bars">
        <div class="tmb-bar"><span class="tmb-bar-count">Affichage : <b>${leaves.length} compte${leaves.length > 1 ? 's' : ''}</b></span>
          <span>Débit ${f(g.debitN)}</span><span>Crédit ${f(g.creditN)}</span><span>Résultat ${f(res)}</span></div>
        ${sel}
      </div>`;
  }

  function overlayInfo() {
    const tabId = extractTabId(location.pathname);
    const tab = tabId ? document.querySelector('.navBar button[data-id="tab-' + tabId + '"]') : null;
    const soc = tab ? tab.textContent.trim() : '';
    const type = state.aged ? 'Balance âgée' : ['Balance générale', 'Balance clients', 'Balance fournisseurs'][state.subtype] || 'Balance';
    const per = state.startDate && state.endDate ? 'du ' + isoToFrDate(state.startDate) + ' au ' + isoToFrDate(state.endDate) : '';
    let cmp = '';
    if (state.compareN1 && !state.aged) {
      cmp = 'comparée à N-1 et N-2';
      if (state.n2 && state.n2.loading) cmp += ' (N-2 en cours de chargement…)';
      else if (state.n2 && state.n2.error) cmp += ' (N-2 indisponible : ' + state.n2.error + ')';
    }
    return [soc, type, per, cmp].filter(Boolean).join(' · ');
  }

  function renderApp() {
    const root = document.getElementById('tmb-root');
    if (!root) return;
    closeInfoPopover();
    saveOpts();
    // le tableau est redessiné à chaque changement : on garde sa position de défilement
    const oldWrap = root.querySelector('.tmb-table-wrap');
    const scroll = oldWrap ? [oldWrap.scrollTop, oldWrap.scrollLeft] : null;
    root.innerHTML = `
      <div class="tmb-head">
        <b class="tmb-title">Balance Premium</b><span class="tmb-pill">PREMIUM</span>
        <span class="tmb-info">${xmlEscape(overlayInfo())}</span>
        <div style="flex:1"></div>
        <button type="button" id="tmb-print" class="tmb-btn">Imprimer</button>
        <button type="button" id="tmb-export-btn" class="tmb-btn tmb-btn-primary" title="Exporter le tableau affiché vers Excel">Export Excel</button>
        <button type="button" id="tmb-close" class="tmb-btn tmb-btn-x" aria-label="Fermer (retour à la balance MyUnisoft)" title="Fermer (Échap)">✕</button>
      </div>
      <div class="tmb-shell">
        <div class="tmb-options">${renderOptionsPanel()}</div>
        <div class="tmb-main">
          ${state.aged ? '' : renderTimeline()}
          ${renderBars()}
          <div class="tmb-table-wrap">${renderTablePanel()}</div>
          <div class="tmb-hints"><span><b>Clic</b> n° de compte ou montant : consultation du compte</span><span><b>Maj+clic</b> nouvelle fenêtre</span><span><b>▼ / ▶</b> replier / déplier</span><span><b>Échap</b> ou <b>✕</b> retour à la balance MyUnisoft</span></div>
        </div>
      </div>
    `;
    attachEvents(root);
    attachOverlayEvents(root);
    fitOverlayWidth(root);
    if (scroll) {
      const w = root.querySelector('.tmb-table-wrap');
      if (w) {
        w.scrollTop = scroll[0];
        w.scrollLeft = scroll[1];
      }
    }
  }

  // (v4.2) Sur grand écran, la zone de droite (curseur, bandeau, tableau) et
  // l'en-tête (Imprimer / Export Excel / ✕) s'arrêtent au bord droit du
  // tableau au lieu de s'étirer jusqu'au bord de l'écran.
  let lastFitW = 0;
  function fitOverlayWidth(root) {
    root = root || document.getElementById('tmb-root');
    if (!root) return;
    const main = root.querySelector('.tmb-main');
    const head = root.querySelector('.tmb-head');
    const table = root.querySelector('table.tmb-table');
    if (!main || !head) return;
    let w = table ? table.offsetWidth + 2 : lastFitW;
    if (!w) return;
    lastFitW = w;
    w = Math.max(w, 760);
    main.style.maxWidth = w + 'px';
    head.style.maxWidth = 20 + 250 + 12 + w + 20 + 'px';
  }

  function attachOverlayEvents(root) {
    const $ = (sel) => root.querySelector(sel);
    const close = $('#tmb-close');
    if (close) close.addEventListener('click', closeOverlay);
    const print = $('#tmb-print');
    if (print) print.addEventListener('click', () => window.print());
    root.querySelectorAll('.tmb-seg-btn').forEach((b) =>
      b.addEventListener('click', () => setSubtype(Number(b.dataset.subtype)))
    );
    const cmp = $('#tmb-compare-n1');
    if (cmp)
      cmp.addEventListener('change', () => {
        state.compareN1 = cmp.checked;
        if (state.compareN1) loadN2();
        renderApp();
      });
    const reset = $('#tmb-reset-opts');
    if (reset)
      reset.addEventListener('click', () => {
        const k = optsStorageKey();
        try {
          if (k) localStorage.removeItem(k);
        } catch (e) {
          /* ignore */
        }
        Object.assign(state, {
          unbalancedOnly: true, centralizeAccount: false, unvalidatedOnly: false, showRevisionCols: false,
          amountMode: 'solde', showSubtotals: false, showClassSubtotals: false, showMonthly: false,
          showMonthlyCumulative: false, showQuarterly: false, showQuarterlyCumulative: false, compareN1: true, aged: false, columnWidths: {},
        });
        loadBalance();
      });
    // curseur : déplacement en direct (étiquette), application au relâcher
    const range = $('#tmb-tl-range');
    if (range) {
      const model = timelineModel();
      const n = model ? model.months.length : 1;
      const pos = (i) => ((i + 0.5) / n) * 100 + '%';
      const live = () => {
        const i = Number(range.value);
        const lab = timelineLabel(model, i);
        const zone = range.parentElement;
        zone.querySelector('.tmb-tl-label').style.left = pos(i);
        zone.querySelector('.tmb-tl-label').textContent = lab.thumb;
        zone.querySelector('.tmb-tl-thumb').style.left = pos(i);
        zone.querySelector('.tmb-tl-fill').style.width = pos(i);
        const tl = range.closest('.tmb-tl');
        tl.querySelector('.tmb-tl-date').textContent = lab.date;
        tl.querySelector('.tmb-tl-status').textContent = lab.status;
        placeTimelineLabel(zone);
      };
      range.addEventListener('input', live);
      range.addEventListener('change', () => applyTimelineMonth(Number(range.value)));
      placeTimelineLabel(range.parentElement);
    }
  }
  // L'étiquette du curseur reste dans le cadre près des bords.
  function placeTimelineLabel(zone) {
    const lab = zone.querySelector('.tmb-tl-label');
    if (!lab) return;
    lab.style.transform = 'translateX(-50%)';
    const z = zone.getBoundingClientRect();
    const r = lab.getBoundingClientRect();
    if (r.right > z.right) lab.style.transform = 'translateX(calc(-100% + 10px))';
    else if (r.left < z.left) lab.style.transform = 'translateX(-10px)';
  }

  function setSubtype(v) {
    if (v === state.subtype) return;
    state.subtype = v;
    if (v !== 0) {
      if (!state.filterRangeUserEdited) state.filterRange = DEFAULT_RANGE_BY_SUBTYPE[v] || '';
      state.centralizeAccount = false;
    } else {
      state.filterRange = '';
      state.filterRangeUserEdited = false;
      state.aged = false;
    }
    state.selectedKeys = new Set();
    loadBalance();
  }

  // Changement d'exercice : pilote le sélecteur natif « Exercice(s) » pour
  // obtenir le dossier_revision_id de cet exercice (jamais recalculé).
  async function selectFiscalYear(idx) {
    if (idx < 0 || !state.fiscalYears[idx]) return;
    state.startDate = state.fiscalYears[idx].start;
    state.endDate = state.fiscalYears[idx].end;
    state.loading = true;
    state.error = null;
    renderApp();
    if (!titleBlockRef || !titleBlockRef.isConnected) titleBlockRef = findNativeTitleBlock();
    const ok = await switchFiscalYear(idx);
    if (!ok) {
      state.loading = false;
      state.error =
        "Impossible de changer d'exercice automatiquement (le sélecteur natif « Exercice(s) » n'a pas répondu). " +
        'Choisissez l\'exercice dans la balance MyUnisoft (sous cette fenêtre), puis rouvrez Balance Premium.';
      renderApp();
      return;
    }
    loadBalance();
  }

  // -----------------------------------------------------------------------
  // 10. Écouteurs d'événements (délégation simple, on redessine tout à
  //     chaque changement — largement assez rapide pour ce volume de données).
  // -----------------------------------------------------------------------
  function attachEvents(root) {
    const $ = (sel) => root.querySelector(sel);

    // Toute option qui influe sur l'appel API relance automatiquement le
    // chargement (l'utilisateur n'a plus besoin de cliquer "Charger le
    // tableau" après chaque coche) — seules les options 100% côté client
    // (sous-totaux, tri, filtre texte, déplier/replier) ne rechargent rien.
    const maybeAutoReload = () => {
      if (state.dossierRevisionId && state.startDate && state.endDate) loadBalance();
    };

    const rangeEl = $('#tmb-range');
    if (rangeEl) {
      rangeEl.addEventListener('input', () => {
        state.filterRange = rangeEl.value;
        state.filterRangeUserEdited = true;
      });
      rangeEl.addEventListener('change', maybeAutoReload);
    }

    // Les champs date ne relancent PAS le chargement automatiquement : un
    // re-rendu pendant la saisie ferait perdre le focus/curseur du champ
    // natif <input type="date"> et empêcherait de taper la date. On se
    // contente de mémoriser la valeur ; il faut cliquer "Charger le tableau".
    const startEl = $('#tmb-start');
    if (startEl)
      startEl.addEventListener('change', () => {
        state.startDate = startEl.value;
      });

    const endEl = $('#tmb-end');
    if (endEl)
      endEl.addEventListener('change', () => {
        state.endDate = endEl.value;
      });

    const fyEl = $('#tmb-fiscal-year');
    if (fyEl) fyEl.addEventListener('change', () => selectFiscalYear(Number(fyEl.value)));

    const bind = (id, key) => {
      const el = $(id);
      if (el)
        el.addEventListener('change', () => {
          state[key] = el.checked;
          maybeAutoReload();
        });
    };
    bind('#tmb-unbalanced', 'unbalancedOnly');
    bind('#tmb-centralize', 'centralizeAccount');
    bind('#tmb-unvalidated', 'unvalidatedOnly');
    bind('#tmb-revisions', 'showRevisionCols');

    // Case "Âgée" (Balance âgée) : colonnes complètement différentes (voir
    // AGED_COLUMNS), on repart d'un filtre/tri propre pour éviter qu'un
    // filtre ou un tri posé sur une colonne du mode normal (ex. "var_pct")
    // reste actif sur des colonnes qui n'existent plus. Les 2 cases sont
    // mutuellement exclusives (une seule base de calcul possible à la fois)
    // mais aucune des deux n'est obligatoire : cocher l'une décoche l'autre
    // et active le mode Âgée (state.aged=true, avec le compared_to
    // correspondant) ; décocher celle qui est active désactive le mode Âgée
    // (state.aged=false) et on retombe sur la balance normale.
    function setAged(active, compareTo) {
      state.aged = active;
      if (active) state.agedCompareTo = compareTo;
      state.filterText = {};
      state.sortCol = null;
      state.sortDir = 'none';
      maybeAutoReload();
    }
    const agedInvoiceEl = $('#tmb-aged-invoice');
    if (agedInvoiceEl) {
      agedInvoiceEl.addEventListener('change', () => {
        setAged(agedInvoiceEl.checked, 1);
      });
    }
    const agedDueEl = $('#tmb-aged-due');
    if (agedDueEl) {
      agedDueEl.addEventListener('change', () => {
        setAged(agedDueEl.checked, 2);
      });
    }

    // Solde débiteur/créditeur : simple recalcul d'affichage à partir des
    // mêmes données déjà chargées (exercice_values), pas un paramètre API —
    // pas besoin de recharger, comme "Afficher les sous-totaux".
    const debitCreditEl = $('#tmb-amount-mode');
    if (debitCreditEl)
      debitCreditEl.addEventListener('change', () => {
        state.amountMode = AMOUNT_MODES[debitCreditEl.value] ? debitCreditEl.value : 'solde';
        // Le tri en cours peut porter sur une colonne qui disparaît (solde_n
        // <-> debit_n/credit_n) : on le réinitialise pour éviter un tri sur
        // une colonne devenue invisible.
        state.sortCol = null;
        state.sortDir = 'none';
        renderApp();
      });

    // "Sous-totaux (regroupements)" et "Sous-totaux (sans regroupements)"
    // sont deux modes d'affichage alternatifs — mutuellement exclusifs.
    const subtotalsEl = $('#tmb-subtotals');
    if (subtotalsEl)
      subtotalsEl.addEventListener('change', () => {
        state.showSubtotals = subtotalsEl.checked;
        if (state.showSubtotals) state.showClassSubtotals = false;
        renderApp();
      });

    const classSubtotalsEl = $('#tmb-class-subtotals');
    if (classSubtotalsEl)
      classSubtotalsEl.addEventListener('change', () => {
        state.showClassSubtotals = classSubtotalsEl.checked;
        if (state.showClassSubtotals) state.showSubtotals = false;
        renderApp();
      });

    // "Affichage mensuel" / "Affichage mensuel cumulé" : purement côté
    // client (voir allColumns/cellValue), aucun rechargement nécessaire —
    // remplacent entièrement le jeu de colonnes normal tant que l'une des
    // deux est cochée. Mutuellement exclusives, comme la paire Sous-totaux
    // avec/sans regroupements juste au-dessus. Réinitialise systématiquement
    // le tri au changement : la colonne triée peut disparaître (normale <->
    // mensuelle) ou changer de sens (mensuel simple <-> cumulé partagent les
    // mêmes id "month_N" mais pas la même valeur).
    function resetMonthSort() {
      state.sortCol = null;
      state.sortDir = 'none';
    }
    // "Non soldés uniquement" fausse l'affichage ET les additions en
    // Affichage mensuel (simple ou cumulé) : un compte peut être soldé sur
    // l'exercice entier (exercice_values) tout en ayant eu des mouvements
    // sur certains mois (month_values non nul) — le masquer ferait
    // disparaître ces mouvements des colonnes mois ET des totaux (Total,
    // Total bilan/résultat/général), sans que rien ne l'indique à l'écran.
    // On le désactive donc automatiquement à l'activation d'un des deux
    // modes mensuels (et on relance le chargement, "Non soldés" étant un
    // paramètre API — cf. buildNormalApiUrl) ; la case reste aussi grisée
    // dans le panneau tant qu'un mode mensuel est actif (voir
    // renderOptionsPanel) pour qu'on ne puisse pas la re-cocher par erreur.
    function disableUnbalancedOnlyForMonthly() {
      if (!state.unbalancedOnly) return;
      state.unbalancedOnly = false;
      maybeAutoReload();
    }
    // (v4.2) 4 vues périodiques mutuellement exclusives (mensuel, mensuel
    // cumulé, trimestriel, trimestriel cumulé).
    const PERIODIC_KEYS = ['showMonthly', 'showMonthlyCumulative', 'showQuarterly', 'showQuarterlyCumulative'];
    root.querySelectorAll('input[data-periodic]').forEach((el) =>
      el.addEventListener('change', () => {
        const key = el.dataset.periodic;
        PERIODIC_KEYS.forEach((k) => {
          state[k] = k === key ? el.checked : false;
        });
        if (el.checked) disableUnbalancedOnlyForMonthly();
        resetMonthSort();
        renderApp();
      })
    );

    const loadBtn = $('#tmb-load');
    if (loadBtn) loadBtn.addEventListener('click', loadBalance);

    // Erreur "HTTP 400 TOKENERROR" (jeton d'authentification reniflé devenu
    // invalide, ex. après une longue période d'inactivité) : le seul remède
    // fiable est de recharger la page pour reniflier un nouveau jeton natif.
    const refreshBtn = $('#tmb-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => location.reload());

    // Tri par colonne (ignore les clics venant de la poignée de redimensionnement)
    root.querySelectorAll('.tmb-sortable').forEach((th) => {
      th.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('tmb-col-resizer')) return;
        const col = th.dataset.col;
        if (state.sortCol !== col) {
          state.sortCol = col;
          state.sortDir = 'asc';
        } else {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : state.sortDir === 'desc' ? 'none' : 'asc';
          if (state.sortDir === 'none') state.sortCol = null;
        }
        renderApp();
      });
    });

    // Filtres par colonne
    root.querySelectorAll('.tmb-filter-input').forEach((input) => {
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('input', () => {
        state.filterText[input.dataset.col] = input.value;
        renderApp();
        // Redonne le focus + curseur à la fin après le re-rendu.
        const again = root.querySelector(`.tmb-filter-input[data-col="${input.dataset.col}"]`);
        if (again) {
          again.focus();
          const v = again.value;
          again.value = '';
          again.value = v;
        }
      });
    });

    // Déplier / replier
    root.querySelectorAll('.tmb-expand-toggle').forEach((span) => {
      span.addEventListener('click', () => {
        const key = span.dataset.key;
        if (state.expanded.has(key)) state.expanded.delete(key);
        else state.expanded.add(key);
        renderApp();
      });
    });

    // Cases à cocher de sélection : clic simple = bascule ce compte, maj+clic
    // = étend la sélection depuis le dernier compte coché jusqu'à celui-ci
    // (dans l'ordre actuellement affiché — tri/filtre en cours compris).
    root.querySelectorAll('.tmb-select-checkbox').forEach((cb) => {
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        const selKey = cb.dataset.selKey;
        if (!selKey) return;
        // Au moment où ce handler s'exécute, le navigateur a déjà basculé
        // cb.checked : on s'en sert comme état cible pour toute l'étendue.
        const shouldSelect = cb.checked;
        if (e.shiftKey && state.lastClickedSelKey) {
          const allKeys = Array.from(root.querySelectorAll('.tmb-select-checkbox')).map((el) => el.dataset.selKey);
          const i1 = allKeys.indexOf(state.lastClickedSelKey);
          const i2 = allKeys.indexOf(selKey);
          if (i1 !== -1 && i2 !== -1) {
            const start = Math.min(i1, i2);
            const end = Math.max(i1, i2);
            for (let i = start; i <= end; i++) {
              if (shouldSelect) state.selectedKeys.add(allKeys[i]);
              else state.selectedKeys.delete(allKeys[i]);
            }
          }
        } else if (shouldSelect) {
          state.selectedKeys.add(selKey);
        } else {
          state.selectedKeys.delete(selKey);
        }
        state.lastClickedSelKey = selKey;
        renderApp();
      });
    });

    // Liens compte / montant / PJ / Com. — ouvrent la fiche de consultation
    // native dans une nouvelle fenêtre, comme dans l'affichage MyU (uniquement
    // disponible en vue à plat, sous-totaux masqués).
    root.querySelectorAll('.tmb-acct-link').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.accountId;
        if (!id) return;
        // Maj+clic (Shift+clic) force une NOUVELLE fenêtre plutôt que de
        // réutiliser la fenêtre de consultation déjà ouverte — pratique pour
        // comparer deux comptes côte à côte.
        // ⚠ Ctrl/Cmd+clic n'est PAS utilisable ici : Chrome intercepte cette
        // combinaison au niveau du navigateur pour forcer l'ouverture en
        // ONGLET, quels que soient les paramètres passés à window.open()
        // (constaté en direct) — impossible à contourner depuis un script.
        // Maj+clic est d'ailleurs déjà la convention standard des
        // navigateurs pour "ouvrir dans une nouvelle fenêtre" sur un lien
        // classique (Ctrl+clic = nouvel onglet, Maj+clic = nouvelle fenêtre).
        openInNewWindow(buildConsultingUrl(id), e.shiftKey);
      });
    });

    // Icônes PJ : ouvre un popover listant les documents attachés à la ligne
    // (lecture seule — voir loadDocuments/showInfoPopover).
    root.querySelectorAll('.tmb-pj-link').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const objectId = el.dataset.docsObjectId;
        if (!objectId) return;
        showInfoPopover(el, 'Pièces jointes', loadDocuments(objectId));
      });
    });

    // Icônes Commentaires : ouvre un popover listant les commentaires de la
    // ligne (lecture seule — voir loadComments/showInfoPopover).
    root.querySelectorAll('.tmb-com-link').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const accountId = el.dataset.accountId;
        if (!accountId) return;
        showInfoPopover(el, 'Commentaires', loadComments(accountId));
      });
    });

    attachColumnResize(root);

    const exportBtn = $('#tmb-export-btn');
    if (exportBtn)
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportTableToExcel();
      });
  }

  // -----------------------------------------------------------------------
  // Redimensionnement des colonnes : glisser la poignée pour ajuster,
  // double-cliquer pour ajuster automatiquement à la largeur du contenu.
  // -----------------------------------------------------------------------
  function measureTextWidth(text, font) {
    if (!measureTextWidth._ctx) {
      measureTextWidth._ctx = document.createElement('canvas').getContext('2d');
    }
    measureTextWidth._ctx.font = font;
    return measureTextWidth._ctx.measureText(text || '').width;
  }

  function autoFitColumn(root, colId) {
    const th = root.querySelector(`th[data-col="${colId}"]`);
    if (!th) return;
    const label = th.querySelector('.tmb-th-label');
    const headerFont = getComputedStyle(label || th).font;
    const sampleTd = root.querySelector(`td[data-col="${colId}"]`);
    const bodyFont = getComputedStyle(sampleTd || th).font;
    let max = measureTextWidth((label ? label.textContent : th.textContent).trim(), headerFont);
    root.querySelectorAll(`td[data-col="${colId}"]`).forEach((td) => {
      const w = measureTextWidth(td.textContent.trim(), bodyFont);
      if (w > max) max = w;
    });
    const newWidth = Math.ceil(max) + 28; // marge pour le padding des cellules
    th.style.width = newWidth + 'px';
    state.columnWidths[colId] = newWidth + 'px';
  }

  function attachColumnResize(root) {
    root.querySelectorAll('.tmb-col-resizer').forEach((handle) => {
      handle.addEventListener('click', (e) => e.stopPropagation());
      handle.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        autoFitColumn(root, handle.dataset.col);
      });
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const colId = handle.dataset.col;
        const th = handle.closest('th');
        if (!th) return;
        const startX = e.clientX;
        const startWidth = th.getBoundingClientRect().width;
        function onMove(ev) {
          const newWidth = Math.max(30, Math.round(startWidth + (ev.clientX - startX)));
          th.style.width = newWidth + 'px';
          state.columnWidths[colId] = newWidth + 'px';
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          fitOverlayWidth();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  // -----------------------------------------------------------------------
  // 11. CSS : tout est à nous, aucune classe MUI à combattre.
  // -----------------------------------------------------------------------
  function injectCss() {
    if (document.getElementById('tmb-css')) return;
    const style = document.createElement('style');
    style.id = 'tmb-css';
    const MONO = MONO_FONT_STACK || 'Consolas, "Courier New", monospace';
    // (v4.0) Charte Consultation Premium : bleu nuit #0f2a52, fond #eef2f8,
    // cartes blanches, chiffres en Consolas, négatifs en rouge.
    style.textContent = `
      #tmb-root {
        position: fixed; left: 160px; top: 58px; right: 0; bottom: 0; z-index: 1190;
        display: flex; flex-direction: column; background: #eef2f8; color: #1c2b44;
        font-family: "Segoe UI", system-ui, Roboto, Arial, sans-serif; font-size: 13px; text-align: left;
        box-shadow: -6px 0 18px rgba(15, 42, 82, .18); min-width: 0;
      }
      #tmb-root, #tmb-root * { box-sizing: border-box; }
      #tmb-root .tmb-head { flex: 0 0 auto; display: flex; align-items: center; gap: 14px; padding: 12px 20px 8px; flex-wrap: wrap; }
      #tmb-root .tmb-title { font-size: 20px; color: #0f2a52; font-weight: 600; white-space: nowrap; }
      #tmb-root .tmb-pill { background: #0f2a52; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .08em; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
      #tmb-root .tmb-info { color: #5b6b85; min-width: 0; }
      #tmb-root .tmb-btn { border: 1px solid #b8c2cf; background: #fff; color: #0f2a52; border-radius: 6px; padding: 8px 14px; font: inherit; cursor: pointer; white-space: nowrap; }
      #tmb-root .tmb-btn:hover { background: #f3f6fb; }
      #tmb-root .tmb-btn-primary { background: #0f2a52; color: #fff; border-color: #0f2a52; font-weight: 600; }
      #tmb-root .tmb-btn-primary:hover { background: #1b3a6b; }
      #tmb-root .tmb-btn-x { width: 36px; padding: 8px 0; text-align: center; }
      #tmb-root .tmb-shell { flex: 1 1 auto; min-height: 0; display: flex; gap: 12px; padding: 0 20px 12px; align-items: stretch; }
      #tmb-root .tmb-options {
        flex: 0 0 250px; overflow-y: auto; background: #fff; border: 1px solid #d5dce8; border-radius: 8px;
        padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;
      }
      #tmb-root .tmb-main { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
      #tmb-root .tmb-opt-group { display: flex; flex-direction: column; gap: 3px; }
      #tmb-root .tmb-opt-group > label { font-size: 11px; color: #5b6b85; font-weight: 400; }
      /* Du / Au l'un sous l'autre : un champ date tient mal en demi-largeur (250 px) */
      #tmb-root .tmb-opt-row2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
      #tmb-root .tmb-opt-group select, #tmb-root .tmb-opt-group input[type=text], #tmb-root .tmb-opt-group input[type=date] {
        border: 1px solid #b8c2cf; border-radius: 6px; padding: 7px 9px; font: inherit; font-size: 13px; background: #fff; width: 100%; color: #1c2b44;
      }
      #tmb-root #tmb-range, #tmb-root #tmb-start, #tmb-root #tmb-end { font-family: ${MONO}; }
      #tmb-root .tmb-seg { display: flex; border: 1px solid #b8c2cf; border-radius: 6px; overflow: hidden; }
      #tmb-root .tmb-seg-btn { flex: 1; border: 0; background: #fff; color: #0f2a52; padding: 7px 4px; font: inherit; font-size: 12px; cursor: pointer; }
      #tmb-root .tmb-seg-btn + .tmb-seg-btn { border-left: 1px solid #b8c2cf; }
      #tmb-root .tmb-seg-btn.tmb-seg-on { background: #0f2a52; color: #fff; font-weight: 600; }
      #tmb-root .tmb-opt-check-group { display: flex; flex-direction: column; gap: 6px; }
      #tmb-root .tmb-opt-check-group-title { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #0f2a52; margin: 4px 0 2px; padding-bottom: 4px; border-bottom: 1px solid #e3e8f0; }
      #tmb-root .tmb-opt-checks { display: flex; flex-direction: column; gap: 7px; }
      #tmb-root .tmb-opt-checks label { display: flex; align-items: flex-start; gap: 7px; font-size: 13px; line-height: 1.3; cursor: pointer; margin: 0; }
      #tmb-root .tmb-opt-checks input[type=checkbox] { margin: 2px 0 0; flex: 0 0 auto; accent-color: #0f2a52; }
      #tmb-root .tmb-opt-checks label.tmb-opt-disabled { opacity: .5; cursor: not-allowed; }
      #tmb-root .tmb-opt-amount { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: inherit; margin: 1px 0 2px; }
      #tmb-root .tmb-opt-amount select { width: 100%; max-width: 100%; font-size: 12px; padding: 4px 4px; border: 1px solid #c7d0de; border-radius: 4px; background: #fff; }
      #tmb-root th.tmb-year-start, #tmb-root td.tmb-year-start { border-left: 2px solid #9db4d8 !important; }
      #tmb-root .tmb-load-btn { margin-top: 4px; width: 100%; background: #0f2a52; color: #fff; border: 0; border-radius: 6px; padding: 9px; font: inherit; font-weight: 600; cursor: pointer; }
      #tmb-root .tmb-load-btn:disabled { opacity: .6; cursor: progress; }
      #tmb-root .tmb-link-btn { border: 0; background: transparent; color: #1b4f9c; text-decoration: underline; font: inherit; font-size: 12px; cursor: pointer; padding: 2px; }
      #tmb-root .tmb-error { color: #b91c1c; font-size: 12px; word-break: break-word; }
      #tmb-root .tmb-refresh-btn { margin-top: 6px; background: #b91c1c; color: #fff; border: 0; border-radius: 5px; padding: 5px 10px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }

      /* Curseur « Arrêté au » */
      #tmb-root .tmb-tl { flex: 0 0 auto; background: #fff; border: 1px solid #d5dce8; border-radius: 8px; padding: 10px 18px 8px; }
      #tmb-root .tmb-tl-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; color: #0f2a52; }
      #tmb-root .tmb-tl-date { font-family: ${MONO}; font-size: 15px; }
      #tmb-root .tmb-tl-status { color: #5b6b85; font-size: 12px; }
      #tmb-root .tmb-tl-hint { color: #5b6b85; font-size: 11px; }
      #tmb-root .tmb-tl-hint b { font-family: ${MONO}; color: #1b4f9c; }
      #tmb-root .tmb-tl-zone { position: relative; height: 58px; margin: 4px 4px 0; width: 50%; min-width: 360px; max-width: calc(100% - 8px); }
      #tmb-root .tmb-tl-track, #tmb-root .tmb-tl-ex, #tmb-root .tmb-tl-fill { position: absolute; top: 27px; height: 4px; border-radius: 2px; }
      #tmb-root .tmb-tl-track { left: 0; right: 0; background: #d5dce8; }
      #tmb-root .tmb-tl-ex { background: #9db4d8; }
      #tmb-root .tmb-tl-fill { left: 0; background: #0f2a52; }
      #tmb-root .tmb-tl-tick { position: absolute; top: 32px; width: 0; }
      #tmb-root .tmb-tl-tick i { display: block; width: 1px; background: #8a9bb8; margin: 0 auto; }
      #tmb-root .tmb-tl-tick span { display: block; margin-top: 2px; font-size: 10px; color: #5b6b85; white-space: nowrap; transform: translateX(-50%); }
      #tmb-root .tmb-tl-label { position: absolute; top: 0; transform: translateX(-50%); background: #0f2a52; color: #fff; font-size: 11px; font-weight: 700; border-radius: 4px; padding: 2px 7px; white-space: nowrap; pointer-events: none; }
      #tmb-root .tmb-tl-thumb { position: absolute; top: 21px; transform: translateX(-50%); width: 16px; height: 16px; border-radius: 50%; background: #f0b400; border: 3px solid #fff; box-shadow: 0 0 0 1px #0f2a52; pointer-events: none; }
      #tmb-root #tmb-tl-range { position: absolute; left: -8px; width: calc(100% + 16px); top: 18px; height: 24px; margin: 0; opacity: 0; cursor: ew-resize; }
      #tmb-root #tmb-tl-range:focus-visible ~ .tmb-tl-thumb, #tmb-root #tmb-tl-range:focus ~ .tmb-tl-thumb { box-shadow: 0 0 0 1px #0f2a52, 0 0 0 4px #6a9be0; }

      /* Bandeaux */
      #tmb-root .tmb-bars { flex: 0 0 auto; display: flex; gap: 12px; flex-wrap: wrap; align-items: stretch; }
      #tmb-root .tmb-bar { background: #0f2a52; color: #fff; border-radius: 8px; padding: 11px 16px; min-height: 46px; line-height: 22px; display: flex; gap: 26px; align-items: center; flex-wrap: wrap; font-size: 12px; }
      #tmb-root .tmb-bar span { white-space: nowrap; }
      #tmb-root .tmb-bar b { font-family: ${MONO}; font-size: 15px; margin-left: 4px; }
      #tmb-root .tmb-bar .tmb-bar-count b { font-family: inherit; font-size: 12px; margin-left: 0; }
      #tmb-root .tmb-bar .tmb-bar-neg { color: #ffb4b4; }
      #tmb-root .tmb-bar-sel { background: #fff4cc; color: #0f2a52; border: 1px solid #f0d78a; }
      #tmb-root .tmb-bar-sel .tmb-bar-neg { color: #c62828; }
      #tmb-root .tmb-bar-sel span:first-child b { font-family: inherit; font-size: 12px; margin-left: 0; }

      /* Tableau */
      #tmb-root .tmb-table-wrap { flex: 1 1 auto; min-height: 0; overflow: auto; background: #fff; border: 1px solid #d5dce8; border-radius: 8px; }
      #tmb-root .tmb-empty { padding: 30px; text-align: center; color: #5b6b85; }
      /* separate + border-spacing:0 : collapse casse le sticky des en-têtes ;
         pas de width:100% (colonnes étirées sur grand écran). */
      #tmb-root table.tmb-table { border-collapse: separate; border-spacing: 0; table-layout: fixed; font-size: 13px; }
      #tmb-root .tmb-table th, #tmb-root .tmb-table td {
        border-right: 1px solid #c3cddd; border-bottom: 1px solid #c3cddd; padding: 6px 8px; height: 30px; line-height: 18px;
        vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #tmb-root .tmb-head-row th { position: sticky; top: 0; z-index: 4; height: 34px; background: #f3f6fb; color: #0f2a52; font-weight: 600; font-size: 12px; border-bottom: 1px solid #aebbd0; }
      #tmb-root .tmb-filter-row th { position: sticky; top: 34px; z-index: 3; height: 32px; padding: 3px; background: #fbfcfe; border-bottom: 1px solid #aebbd0; }
      #tmb-root .tmb-th-label { pointer-events: none; }
      #tmb-root .tmb-col-resizer { position: absolute; top: 0; right: -3px; width: 7px; height: 100%; cursor: col-resize; z-index: 5; user-select: none; }
      #tmb-root .tmb-col-resizer:hover { background: #6a9be0; }
      #tmb-root .tmb-sortable { cursor: pointer; user-select: none; }
      #tmb-root .tmb-sortable:hover { background: #e4ecfa; }
      /* pas d'indicateur de tri (retiré à la demande de Nicolas le 2026-07-30) */
      #tmb-root .tmb-filter-input { width: 100%; min-width: 0; border: 1px solid #b8c2cf; border-radius: 4px; padding: 4px 6px; font: inherit; font-size: 12px; background: #fff; }
      #tmb-root .tmb-mono, #tmb-root .tmb-table td[style*="right"] { font-family: ${MONO}; font-variant-numeric: tabular-nums; }
      #tmb-root .tmb-table td[data-col="account_number"] { font-family: ${MONO}; }
      #tmb-root .tmb-negative { color: #c62828; }
      #tmb-root .tmb-expand-toggle { cursor: pointer; display: inline-block; width: 14px; color: #1b4f9c; }
      #tmb-root .tmb-select-checkbox { cursor: pointer; margin: 0; vertical-align: middle; accent-color: #0f2a52; }
      #tmb-root .tmb-acct-link { color: #1b4f9c; cursor: pointer; text-decoration: underline; }
      #tmb-root td:not([data-col="account_number"]) .tmb-acct-link { color: inherit; text-decoration: none; }
      #tmb-root td .tmb-acct-link:hover { text-decoration: underline; }
      #tmb-root .tmb-pj-link { cursor: pointer; color: #1b4f9c; }
      #tmb-root .tmb-com-link { cursor: pointer; display: inline-block; min-width: 18px; padding: 0 5px; border-radius: 9px; background: #e4ecfa; color: #1b4f9c; font-size: 11px; font-weight: 700; line-height: 16px; }
      #tmb-root .tmb-valid { display: inline-block; min-width: 22px; padding: 0 3px; border-radius: 4px; font-size: 10px; font-weight: 700; line-height: 16px; background: #f1f4f8; color: #8792a6; }
      #tmb-root .tmb-valid-ok { background: #dcfce7; color: #166534; }
      #tmb-root .tmb-table tbody tr { background: #fff; }
      #tmb-root .tmb-table tbody tr:nth-child(even) { background: #f8fafd; }
      #tmb-root .tmb-table tbody tr:hover { background: #eef4ff; }
      #tmb-root .tmb-table tbody tr:has(.tmb-select-checkbox:checked) { background: #dbe8fb; }
      #tmb-root .tmb-table tbody tr.tmb-subtotal-row { background: #e8eef8 !important; color: #0f2a52; font-weight: 700; }
      #tmb-root .tmb-table tbody tr.tmb-subtotal-row td { border-top: 1px solid #8aa0c4; }
      #tmb-root .tmb-table tbody tr[data-key^="__result__"] { background: #dbe5f5 !important; color: #0f2a52; font-weight: 700; }
      #tmb-root .tmb-table tbody tr[data-key^="__result__"]:last-child { background: #b4c6e7 !important; }
      #tmb-root .tmb-table tbody tr[data-key^="__result__"] td { border-top: 2px solid #0f2a52; }
      #tmb-root .tmb-hints { flex: 0 0 auto; font-size: 12px; color: #5b6b85; display: flex; gap: 18px; flex-wrap: wrap; }
      #tmb-root .tmb-hints b { font-family: ${MONO}; color: #1b4f9c; }

      /* Info-bulles PJ / commentaires */
      .tmb-popover {
        position: absolute; z-index: 100000; background: #fff; border: 1px solid #aebbd0;
        border-radius: 8px; box-shadow: 0 8px 24px rgba(15,42,82,.25); min-width: 220px; max-width: 360px;
        max-height: 320px; overflow-y: auto; font-size: 12px; font-family: "Segoe UI", system-ui, Arial, sans-serif; color: #1c2b44;
      }
      .tmb-popover-title { font-weight: 700; font-size: 12px; padding: 8px 10px; border-bottom: 1px solid #e3e8f0; background: #f3f6fb; color: #0f2a52; border-radius: 8px 8px 0 0; position: sticky; top: 0; }
      .tmb-popover-body { padding: 8px 10px; }
      .tmb-popover-empty { color: #5b6b85; font-style: italic; }
      .tmb-popover-list { list-style: none; margin: 0; padding: 0; }
      .tmb-popover-list li { padding: 6px 0; border-bottom: 1px solid #eef1f6; }
      .tmb-popover-list li:last-child { border-bottom: none; }
      .tmb-popover-meta { color: #8792a6; font-size: 10px; margin-left: 6px; }
      .tmb-popover-open { color: #1b4f9c; text-decoration: none; }
      .tmb-popover-open:hover { text-decoration: underline; }
      .tmb-popover-comment-head { font-weight: 600; color: #0f2a52; }
      .tmb-popover-comment-body { color: #3b4a63; margin-top: 2px; }
      .tmb-popover-comment-body p { margin: 0 0 4px 0; }
      .tmb-popover-comment-body ul, .tmb-popover-comment-body ol { margin: 0 0 4px 18px; padding: 0; }

      /* Impression : seulement le tableau de Balance Premium */
      @media print {
        body > *:not(#tmb-root) { display: none !important; }
        #tmb-root { position: static !important; box-shadow: none; background: #fff; }
        #tmb-root .tmb-options, #tmb-root .tmb-tl, #tmb-root .tmb-hints, #tmb-root .tmb-btn, #tmb-root .tmb-filter-row { display: none !important; }
        #tmb-root .tmb-shell { display: block; padding: 0; }
        #tmb-root .tmb-table-wrap { overflow: visible; border: 0; }
        #tmb-root .tmb-head-row th { position: static; }
      }
    `;
    document.head.appendChild(style);
  }

  // -----------------------------------------------------------------------
  // 12. Détection de navigation SPA + démarrage.
  // -----------------------------------------------------------------------
  let lastNavPath = null;
  let lastTabId = null; // société/onglet actuellement installé (voir extractTabId)
  function onNavigation() {
    const path = location.pathname;
    const currentTabId = extractTabId(path);
    const wasInstalled = bootstrapped || !!document.getElementById('tmb-root');
    // Changement de société tout en restant sur "Balance" (isBalancePage()
    // reste vrai des deux côtés, seul l'id d'onglet dans l'URL change) :
    // notre UI reste montée avec les données de l'ANCIENNE société tant
    // qu'on ne détecte pas explicitement ce cas.
    const tabChanged = wasInstalled && currentTabId !== null && lastTabId !== null && currentTabId !== lastTabId;

    if (wasInstalled && (!isBalancePage() || tabChanged)) {
      // Soit l'utilisateur a changé de catégorie d'édition (SIG, Bilan,
      // Grand livre...) via le sélecteur natif resté visible dans la barre
      // de titre, soit il a changé de société/onglet en restant sur
      // Balance : dans les deux cas on démonte notre UI et on restaure les
      // blocs natifs pour repartir sur une base propre.
      const root = document.getElementById('tmb-root');
      if (root) root.remove();
      restoreNativeBlocks();
      titleBlockRef = null;
      customActive = readBalanceMode();
      bootstrapped = false;
      bootstrapClicked = false;
      bootstrapGaveUp = false;
      stopBootstrapPolling();
      lastNavPath = path;
      if (tabChanged && isBalancePage()) {
        // On reste sur Balance mais pour une autre société : les données
        // reniflées précédemment (ancien dossier_revision_id) sont
        // obsolètes, on les oublie pour forcer un vrai nouveau reniflage
        // (l'app native refait normalement son propre appel en changeant
        // de société, qu'on interceptera comme au tout premier chargement).
        sniff.data = null;
        sniff.params = null;
        bootstrapGaveUp = false;
        bootstrapClicked = false;
        stopBootstrapPolling();
        setTimeout(() => tryBootstrap(), 500);
      }
      return;
    }

    // Ne relance JAMAIS le bootstrap une fois qu'il a réussi tant qu'on reste
    // sur la page Balance de la MÊME société (notre UI pilote elle-même
    // tous ses appels API par la suite) : le réinitialiser à chaque
    // history.pushState/replaceState était la cause du rechargement en
    // boucle, car cliquer "Charger le tableau" pouvait lui-même déclencher
    // un replaceState interne à l'appli, qui relançait aussitôt un nouveau
    // bootstrap, qui re-cliquait.
    if (wasInstalled) return;

    if (path === lastNavPath) return; // même page, rien de neuf à faire
    lastNavPath = path;

    if (isBalancePage()) {
      // Une VRAIE navigation vers la page Balance : on peut retenter un
      // bootstrap propre (nouvelle instance de page, nouveau dossier...).
      bootstrapGaveUp = false;
      bootstrapClicked = false;
      stopBootstrapPolling();
      setTimeout(() => tryBootstrap(), 500);
    }
  }

  const _pushState = history.pushState;
  const _replaceState = history.replaceState;
  history.pushState = function (...args) {
    _pushState.apply(history, args);
    onNavigation();
  };
  history.replaceState = function (...args) {
    _replaceState.apply(history, args);
    onNavigation();
  };
  window.addEventListener('popstate', onNavigation);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onNavigation);
  } else {
    onNavigation();
  }

  // (2026-08-01, migration dans l'architecture modulaire) : remplace
  // l'ancien sondage continu subtypePollTimer (setInterval 500ms) — lit
  // titleBlockRef à chaque tick partagé du core (~1s, cf. registerScan dans
  // premium.js). Se no-op tant que l'UI custom n'est pas installée
  // (titleBlockRef === null, y compris juste après un démontage/teardown
  // dans onNavigation ci-dessus).
  function scanBalance() {
    window.TMBC.ensurePremiumMenuItem({
      nativeId: 'menu-item-balance',
      id: 'menu-item-balancePremium',
      label: 'Balance Premium',
      enabled: !isDisabled(),
      onClick: switchToPremium,
      onNativeClick: onNativeBalanceClick,
    });
    if (isDisabled()) return;
    // (v4.0) Plus de synchronisation avec les contrôles natifs ni de bouton
    // dans la barre native : la surimpression a ses propres réglages. On la
    // garde simplement calée sur la zone de contenu (menu replié/déplié).
    const root = document.getElementById('tmb-root');
    if (root && root.style.display !== 'none') placeOverlay(root);
  }

  registerScan(scanBalance);
})();