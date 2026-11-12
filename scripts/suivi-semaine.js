// ==UserScript==
// @name         MyUnisoft - Suivi de vos sociétés (Semaine)
// @namespace    https://nicolas.chassard/myunisoft
// @version      1.1-ext
// @description  v1.1 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — aucun changement fonctionnel, le module tourne désormais dans l'extension (même contexte de page que le preload).
//               v1.0 (2026-07-31) : Module extrait de premium.js 3.31 lors de la scission en
//               modules demandée par Nicolas (cf. premium.js core pour le détail de la scission
//               et TMBC_TOOLKIT_CONTRACT.md pour le contrat commun entre modules). Contient le
//               tableau maison ("Affichage Premium"/"Affichage MyUnisoft") de la vue Semaine de
//               "Suivi de vos sociétés" : catalogue de colonnes, construction/rendu du tableau,
//               filtres (texte + multiselect), tri, redimensionnement/glisser-déposer de
//               colonnes, clic-pour-filtrer et clic-pour-naviguer, badge de comptage, appel
//               direct à l'API (sniffing du jeton d'auth). Prévu pour être rejoint par d'autres
//               vues Suivi (suivi societe-declaratif, etc.) à terme, cf. CUSTOM_TABLE_VIEWS/
//               CUSTOM_TABLE_ENDPOINTS déjà prévus en Map extensible.
//               Copie verbatim du code correspondant dans premium.js 3.31 (cf.
//               CHANGELOG-premium-legacy.txt pour l'historique complet des versions
//               antérieures) — aucun changement de comportement visé par cette extraction,
//               seule son organisation en fichier séparé change.
// @author       Nicolas
// @match        https://connect.lgassocies.com/*
// @match        https://*.myunisoft.fr/*
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // Utilitaires partagés (cf. premium.js core + TMBC_TOOLKIT_CONTRACT.md).
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
    getHeaderLabelText,
    MONO_FONT_STACK,
    getApiHeaders,
    registerScan,
    extendDebugHook,
  } = window.TMBC;


  // --- "Suivi de vos sociétés" : nettoyage 2026-07-30 --------------------
  // Nicolas a demandé de retirer TOUTES les modifications d'affichage
  // ajoutées aujourd'hui sur "Suivi de vos sociétés" (titre H1 masqué,
  // champ période repositionné, loupe remplacée par une barre de filtres par
  // colonne avec menus déroulants) : la page redevient donc 100% native par
  // défaut. Seul le tableau maison (bascule "Affichage Premium" / "Affichage
  // MyUnisoft", même principe que balance.js) est conservé, cf. plus bas.
  // Conservé de tout ce bloc : findSuiviViewSelectValue (détecte la vue
  // active, sert au tableau maison), canonicalColumnName/COLUMN_LABEL_ALIASES
  // (utilisés par le catalogue de colonnes du tableau maison), et
  // findSuiviGridParts (localise la grille native pour la masquer/afficher).
  function findSuiviViewSelectValue() {
    // Le sélecteur de vue est un MuiSelect dont la valeur affichée est un
    // <div> sans enfant (texte pur) — on le repère via son rôle natif MUI
    // plutôt qu'un nom de classe généré (css-XXXXX, fragile).
    const el = document.querySelector('.MuiSelect-select');
    return el ? el.textContent.trim() : null;
  }


  // Un même champ logique porte un intitulé d'en-tête différent selon la vue
  // (ex. "Collaborateur" en Déclaratif, "Collab." en abrégé sur Semaine/DA/
  // Administration dossiers) — ramené à un nom canonique unique, utilisé par
  // le catalogue de colonnes du tableau maison (SEMAINE_COLUMN_CATALOG).
  const COLUMN_LABEL_ALIASES = new Map(
    [
      ['collab', 'collaborateur'],
      ['expert', 'expert comptable'],
    ].map(([from, to]) => [normalizeColumnName(from), normalizeColumnName(to)])
  );


  function canonicalColumnName(name) {
    const n = normalizeColumnName(name).replace(/\.+$/, ''); // "Collab." -> "collab"
    return COLUMN_LABEL_ALIASES.get(n) || n;
  }


  function findSuiviGridParts() {
    const vtHeader = document.querySelector('.vtHeader');
    if (!vtHeader) return null;
    const headerContainer = vtHeader.closest('[class*="gridContainer"]') || vtHeader.parentElement;
    const body = headerContainer && headerContainer.nextElementSibling;
    const outerBox = headerContainer && headerContainer.parentElement;
    if (!headerContainer || !body || !outerBox) return null;
    return { vtHeader, headerContainer, body, outerBox };
  }


  // --- "Suivi de vos sociétés" : tableau 100% maison, alimenté par l'API
  // (POC sur la vue Semaine, 2026-07-30) ----------------------------------
  // Après plusieurs correctifs successifs sur le tableau NATIF (menus
  // multi-sélection impossibles avec un <select> simple, bug "TOUTES"+"NCH"
  // qui ne se cumulaient pas, pagination limitée aux lignes déjà chargées
  // dans le DOM, trigrammes manquants/mal devinés), Nicolas a demandé de
  // court-circuiter entièrement le tableau natif pour cette vue : récupérer
  // les données brutes directement depuis l'API (comme Balance/Dossier de
  // Révision le font déjà), puis reconstruire un tableau maison avec nos
  // propres filtres (multi-sélection réelle, valeurs strictement issues des
  // données reçues). Un bouton "Affichage MyU" (même principe que celui de
  // balance.js) bascule entre ce tableau maison et le tableau natif
  // d'origine, jamais supprimé — seulement masqué (display:none).
  //
  // Repérage de l'appel réseau réel (reniflage fetch+XHR patchés, jamais de
  // paramètre deviné) : POST vers l'URL ci-dessous avec un corps
  // {filters:{wallets:"",experts:"",managers:"",accountants:""}} (chaînes
  // vides = aucun filtre natif actif, on demande donc TOUJOURS le jeu complet
  // de dossiers nous-mêmes, indépendamment de l'état des champs natifs
  // au-dessus du tableau). Réponse : tableau JSON, un objet par dossier, ex.
  // vérifié en direct : "wallet":"TOUTES,NCH" (confirme qu'un dossier peut
  // appartenir à plusieurs portefeuilles à la fois, cause du bug "TOUTES/NCH"
  // sur le tableau natif) et "expert":{"trigram":"E.GE"} /
  // "manager":{"trigram":"K.MI"} (le trigramme est fourni directement par
  // l'API — plus besoin de deviner une abréviation à partir du nom complet).
  const CUSTOM_TABLE_VIEWS = new Set(['semaine'].map(normalizeColumnName));

  const CUSTOM_TABLE_ENDPOINTS = new Map([
    [
      normalizeColumnName('semaine'),
      {
        // NOTE (2026-07-30) : l'appel natif observé contient un ":" superflu
        // juste après le nom d'hôte (bug de construction d'URL propre à
        // l'appli, probablement une baseURL mal concaténée côté MyUnisoft).
        // Corrigé ici pour notre propre appel — au cas où ce ":" perturberait
        // le routage réseau (proxy/CDN) différemment selon fetch() vs XHR.
        url: 'https://prod-ws.myunisoft.fr/dashboard/collab/week',
        body: { filters: { wallets: '', experts: '', managers: '', accountants: '' } },
      },
    ],
  ]);


  // (2026-07-30) Diagnostics ajoutés suite à un blocage sur "Chargement des
  // données…" chez Nicolas (jamais de succès NI d'erreur affichée) :
  // (1) un délai maximum de 10s (AbortController) pour ne plus jamais rester
  // bloqué indéfiniment si l'appel ne répond pas ; (2) chaque cas d'échec lève
  // une vraie Error avec un message précis (au lieu de renvoyer null en
  // silence) pour que le message affiché à l'écran dise CE QUI a échoué ;
  // (3) console.error à chaque étape pour pouvoir diagnostiquer via les
  // Outils de développement (menu Affichage > Outils de développement).
  async function fetchCustomTableData(viewKey) {
    const cfg = CUSTOM_TABLE_ENDPOINTS.get(viewKey);
    if (!cfg) throw new Error('Vue "' + viewKey + '" non configurée pour le tableau maison.');
    const apiHeaders = getApiHeaders();
    if (!apiHeaders) {
      console.error('[tmbc-custom-table] aucun en-tête Authorization capturé — aucun appel natif vers prod-ws.myunisoft.fr observé pour le moment.');
      throw new Error("Jeton d'authentification non détecté pour l'instant. Attendez que le tableau natif ait fini de charger une première fois, puis réessayez.");
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let res;
    try {
      res = await fetch(cfg.url, {
        method: 'POST',
        // credentials:'include' (2026-07-30) — probablement la vraie cause
        // du rejet "Authentification absente" malgré un Authorization
        // valide (confirmé non expiré via window.__tmbcDebug.decodeToken()) :
        // la réponse de l'API porte "Access-Control-Allow-Credentials: true"
        // ET un "Set-Cookie: BACKENDID=windev-23|..." (repérage d'instance
        // serveur pour la session), visible dans l'onglet Réseau de Nicolas.
        // Sans "credentials:'include'", fetch() n'envoie PAS ce cookie sur un
        // appel cross-origin (connect.lgassocies.com -> prod-ws.myunisoft.fr)
        // même avec un Authorization valide — le backend routé sans ce
        // cookie ne retrouve peut-être pas le contexte de session associé au
        // jeton. Le tableau natif (XHR) l'envoie très probablement via
        // withCredentials=true, d'où le succès de son côté.
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiHeaders.Authorization,
          'society-id': apiHeaders['society-id'],
        },
        body: JSON.stringify(cfg.body),
        signal: controller.signal,
      });
    } catch (e) {
      console.error('[tmbc-custom-table] échec réseau lors de l\'appel API :', e);
      if (e && e.name === 'AbortError') throw new Error("L'API n'a pas répondu dans le délai (10s).");
      throw new Error('Échec réseau : ' + (e && e.message ? e.message : String(e)));
    } finally {
      clearTimeout(timeoutId);
    }
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      console.error('[tmbc-custom-table] réponse API non OK :', res.status, bodyText);
      throw new Error('Réponse API ' + res.status + ' : ' + bodyText.slice(0, 200));
    }
    return res.json();
  }


  // (2026-07-30, demandé par Nicolas) "pour les champs avec 9 chiffres,
  // mettre sous la forme 000 000 000, si valeur sur 15 chiffres, mettre sous
  // la forme 000 000 000 00000" — groupe les 9 premiers chiffres par 3, puis
  // laisse le reste (SIRET normal = 5 chiffres de NIC, mais peu importe le
  // nombre exact au-delà de 9) en un seul bloc. Ne touche pas aux valeurs qui
  // ne sont pas purement numériques.
  function formatSirenSiret(v) {
    const digits = String(v ?? '').trim();
    if (!/^\d+$/.test(digits)) return digits;
    if (digits.length <= 9) return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
    return digits.slice(0, 9).replace(/(\d{3})(?=\d)/g, '$1 ') + ' ' + digits.slice(9);
  }


  function formatAutoValue(v) {
    if (v === null || v === undefined || v === '') return '';
    if (Array.isArray(v)) return v.length ? String(v.length) : '';
    if (typeof v === 'boolean') return v ? 'Oui' : '';
    if (typeof v === 'object') return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) {
      const d = new Date(v);
      if (!isNaN(d)) return d.toLocaleDateString('fr-FR');
    }
    return String(v);
  }


  // Libellé FR pour le statut TVA — (2026-07-30) Champs "declared_vat"/
  // "deposit_vat" reniflés en direct (Claude in Chrome, filtre Manager=KAHN
  // pour forcer un vrai rechargement) : ce sont des OBJETS
  // ({date_echeance, date_declare, status, key, ...}), pas des valeurs
  // simples — formatAutoValue les renvoyait donc vides (typeof === 'object'),
  // d'où les colonnes "Echéance TVA"/"TVA" vides signalées par Nicolas.
  // Vérifié par recoupement avec la grille native : dossier "AUSTERLITZ",
  // declared_vat.status="time-out" + date_echeance="2026-07-21" correspond
  // exactement à la puce rouge "Retard" / date "21/07/2026" affichées
  // nativement pour ce même dossier. declared_vat.key === "TVA" (alors que
  // deposit_vat.key === "ACOMPTETVA", un champ différent) confirme que les
  // colonnes "TVA"/"Echéance TVA" natives utilisent declared_vat, pas
  // deposit_vat. Seuls "time-out" et "ok" ont été vus en direct — tout autre
  // code retombe sur lui-même (capitalisé) plutôt que d'être deviné.
  const VAT_STATUS_LABELS = new Map([
    ['ok', 'Validé'],
    ['time-out', 'Retard'],
    // (2026-07-30, demandé par Nicolas, vu en direct dans ses propres
    // données) : "in-progress"/"error" sont d'autres codes de statut réels
    // renvoyés par declared_vat.status, jusque-là non traduits (affichés tels
    // quels, juste capitalisés, via le repli de vatStatusLabel).
    ['in-progress', 'En-cours'],
    ['error', 'Erreur'],
  ]);

  function vatStatusLabel(status) {
    if (!status) return '';
    return VAT_STATUS_LABELS.get(status) || status.charAt(0).toUpperCase() + status.slice(1);
  }


  // (2026-07-30, demandé par Nicolas) "laisse aussi la possibilité de
  // sélectionner les champs vides" — sans ça, un dossier sans Expert
  // comptable/Manager/Collaborateur/Portefeuille/statut TVA renvoyait un
  // tableau de jetons vide ([]), et ne matchait donc JAMAIS aucune case
  // cochée (impossible de isoler "les dossiers sans Manager", par exemple).
  // EMPTY_TOKEN est ajouté comme jeton de repli quand le champ est vide —
  // il apparaît alors comme une option cochable normale dans le panneau
  // flottant (cf. distinctTokensFor), au même titre que les vraies valeurs.
  const EMPTY_TOKEN = '(Vide)';

  function tokensOrEmpty(tokens) {
    return tokens.length ? tokens : [EMPTY_TOKEN];
  }


  // Catalogue complet des colonnes que l'on SAIT construire à partir des
  // champs API — clé = libellé natif normalisé (cf. canonicalColumnName,
  // pour profiter des mêmes alias que le reste du fichier, ex. "Collab." ->
  // "Collaborateur"). Un type "text"/"date" = valeur brute, "multiselect" =
  // filtre à cases à cocher (Portefeuille/Expert/Manager/Collaborateur/TVA),
  // "auto" = valeur simple formatée, "combo" = deux champs API combinés
  // (dépôt/liquidation) affichés dans une seule colonne, comme le fait la
  // grille native pour IS/CVAE/TS. "numeric:true" (2026-07-30, demandé par
  // Nicolas) marque les colonnes ne contenant QUE des valeurs numériques :
  // largeur réduite + alignement à droite + police à chasse fixe (même
  // traitement que .tmbc-numeric ailleurs dans ce fichier), et active les
  // opérateurs de comparaison (>, >=, <, <=) dans leur filtre texte.
  // (2026-07-30) Demande de Nicolas : ne plus générer automatiquement une
  // colonne par clé JSON restante — n'afficher QUE les colonnes que
  // MyUnisoft lui-même affiche déjà, dans l'ordre qu'il a configuré via la
  // roue crantée "Paramétrage des colonnes" (cf. getVisibleNativeColumnLabels
  // ci-dessous, qui lit ça directement sur la grille native — même masquée,
  // display:none n'efface pas le DOM). Un libellé natif visible mais absent
  // de ce catalogue est ignoré (avec un avertissement en Console) plutôt que
  // de planter ou de deviner un mapping.
  // (2026-07-30, demandé par Nicolas) Largeur plafond par défaut pour toute
  // colonne du tableau maison qui n'a pas de widthCh explicite ci-dessous.
  const DEFAULT_MAX_COLUMN_WIDTH_CH = 30;


  const SEMAINE_COLUMN_CATALOG = new Map(
    [
      // (2026-07-30, demandé par Nicolas) : "j'ai rajouté manuellement toutes
      // les colonnes disponibles [...] elle s'affiche bien dans le tableau
      // classique myunisoft, mais pas dans ma version premium" — reniflage en
      // direct (Claude in Chrome, patch fetch+XHR sur /dashboard/collab/week)
      // du même appel déjà utilisé par le tableau maison, pour obtenir les
      // vrais noms de champs de ces nouvelles colonnes (jamais devinés) :
      // Forme_juridique, SIRET, Cabinet, APE_NAF, Type_compta, Type_dossier,
      // Regime_impot, Regime_TVA, Code_postal, Ville,
      // Contact_Principal_Prenom_Nom, Contact_Principal_mail.
      ['contact principal (@mail)', { type: 'text', get: (r) => r.Contact_Principal_mail }],
      ['contact principal (prenom nom)', { type: 'text', get: (r) => r.Contact_Principal_Prenom_Nom }],
      // filterStyle 'inputPlusDropdown' (2026-07-30, demandé par Nicolas) :
      // "rajoute le filtre normal + bouton flèche" sur Ville/Régime TVA/Régime
      // d'imposition/Type de dossier/Type de comptabilité/Cabinet/Forme
      // juridique/TVA — même mécanique que Portefeuille/Expert comptable/
      // Manager/Collab. (champ texte "contient" + bouton flèche ouvrant le
      // panneau à cases à cocher) ; passées en type "multiselect" avec un
      // "tokens" à une seule valeur (pas de valeurs multiples comme
      // Portefeuille) pour alimenter ce panneau.
      [
        'ville',
        {
          type: 'multiselect',
          widthCh: 30,
          filterStyle: 'inputPlusDropdown',
          tokens: (r) => tokensOrEmpty(r.Ville ? [r.Ville] : []),
          get: (r) => r.Ville,
        },
      ],
      ['code postal', { type: 'text', widthCh: 10, get: (r) => r.Code_postal }],
      [
        'regime tva',
        {
          type: 'multiselect',
          widthCh: 30,
          filterStyle: 'inputPlusDropdown',
          tokens: (r) => tokensOrEmpty(r.Regime_TVA ? [r.Regime_TVA] : []),
          get: (r) => r.Regime_TVA,
        },
      ],
      [
        "regime d'imposition",
        {
          type: 'multiselect',
          widthCh: 20,
          filterStyle: 'inputPlusDropdown',
          tokens: (r) => tokensOrEmpty(r.Regime_impot ? [r.Regime_impot] : []),
          get: (r) => r.Regime_impot,
        },
      ],
      [
        'type de dossier',
        {
          type: 'multiselect',
          widthCh: 15,
          filterStyle: 'inputPlusDropdown',
          tokens: (r) => tokensOrEmpty(r.Type_dossier ? [r.Type_dossier] : []),
          get: (r) => r.Type_dossier,
        },
      ],
      [
        'type de comptabilite',
        {
          type: 'multiselect',
          widthCh: 20,
          filterStyle: 'inputPlusDropdown',
          tokens: (r) => tokensOrEmpty(r.Type_compta ? [r.Type_compta] : []),
          get: (r) => r.Type_compta,
        },
      ],
      ['ape/naf', { type: 'text', widthCh: 10, mono: true, get: (r) => r.APE_NAF }],
      [
        'cabinet',
        {
          type: 'multiselect',
          filterStyle: 'inputPlusDropdown',
          tokens: (r) => tokensOrEmpty(r.Cabinet ? [r.Cabinet] : []),
          get: (r) => r.Cabinet,
        },
      ],
      // (2026-07-30, demandé par Nicolas) SIREN (9 chiffres) -> "000 000 000"
      // ; SIRET (14 chiffres, appelé "15 chiffres" par Nicolas mais un SIRET
      // fait 14 chiffres en France — même principe de groupement appliqué
      // quel que soit le nombre exact de chiffres au-delà de 9) ->
      // "000 000 000 00000" (les 9 premiers groupés par 3, le reste en un
      // seul bloc) ; cf. formatSirenSiret.
      ['siren/siret', { type: 'text', widthCh: 20, mono: true, get: (r) => formatSirenSiret(r.SIRET) }],
      ['forme juridique', { type: 'text', widthCh: 30, get: (r) => r.Forme_juridique }],
      ['id dossier', { type: 'text', widthCh: 10, get: (r) => r.society_id }],
      // clickToNavigate (2026-07-30, demandé par Nicolas) : "si clique sur un
      // dossier ou numéro de dossier, ca ouvre l'onglet de la société, sur la
      // vue d'ensemble" — cf. goToSocietyOverview.
      ['dossier', { type: 'text', widthCh: 40, clickToNavigate: true, get: (r) => r.society_name }],
      // sortAsText (2026-07-30, demandé par Nicolas) : "quand je fais un tri
      // sur la référence dossier, il me met un séparateur de milliers, il
      // doit pas" — une référence dossier est un identifiant, pas une
      // quantité ; sortAsText force un tri alphabétique (localeCompare) et
      // empêche toute comparaison numérique (parseFloat/soustraction) dans
      // laquelle un séparateur de milliers pourrait s'introduire. Nicolas a
      // ensuite renvoyé une capture montrant des valeurs "001 009", "001 018"
      // etc. — vérification faite : AUCUN code de ce fichier n'appelle
      // toLocaleString/Intl sur cette colonne (grep sur tout le fichier, 0
      // résultat) ; society_reference est affiché tel quel, sans passer par
      // formatAutoValue (type "text"). Cet espace fait donc partie de la
      // valeur brute renvoyée par l'API pour ces dossiers-là (pas un
      // séparateur ajouté par le tableau maison). Nicolas le veut quand même
      // supprimé à l'affichage : stripSpaces le retire uniquement pour
      // CETTE colonne (jamais touché ailleurs, ex. Portefeuille).
      [
        'reference dossier',
        {
          type: 'text',
          widthCh: 10,
          sortAsText: true,
          clickToNavigate: true,
          get: (r) => String(r.society_reference ?? '').replace(/[\s  ]/g, ''),
        },
      ],
      [
        'portefeuille',
        {
          type: 'multiselect',
          // (2026-07-30, demandé par Nicolas, tableau Excel corrigé) : 15.
          widthCh: 15,
          filterStyle: 'inputPlusDropdown',
          clickToFilter: true,
          tokens: (r) => tokensOrEmpty((r.wallet || '').split(',').map((s) => s.trim()).filter(Boolean)),
          get: (r) => (r.wallet || '').split(',').map((s) => s.trim()).filter(Boolean).join(', '),
        },
      ],
      [
        'expert comptable',
        {
          type: 'multiselect',
          widthCh: 10,
          centered: true,
          filterStyle: 'inputPlusDropdown',
          clickToFilter: true,
          trigramFilter: true,
          tokens: (r) => tokensOrEmpty(r.expert ? [r.expert.trigram] : []),
          get: (r) => (r.expert ? r.expert.trigram : ''),
        },
      ],
      [
        'manager',
        {
          type: 'multiselect',
          widthCh: 10,
          centered: true,
          filterStyle: 'inputPlusDropdown',
          clickToFilter: true,
          trigramFilter: true,
          tokens: (r) => tokensOrEmpty(r.manager ? [r.manager.trigram] : []),
          get: (r) => (r.manager ? r.manager.trigram : ''),
        },
      ],
      [
        'collaborateur',
        {
          type: 'multiselect',
          widthCh: 10,
          centered: true,
          filterStyle: 'inputPlusDropdown',
          clickToFilter: true,
          trigramFilter: true,
          tokens: (r) => tokensOrEmpty(r.accountant ? [r.accountant.trigram] : []),
          get: (r) => (r.accountant ? r.accountant.trigram : ''),
        },
      ],
      ['cloture n', { type: 'auto', widthCh: 15, centered: true, get: (r) => formatAutoValue(r.close_date) }],
      [
        'echeance tva',
        { type: 'auto', widthCh: 15, centered: true, get: (r) => formatAutoValue(r.declared_vat && r.declared_vat.date_echeance) },
      ],
      [
        'tva',
        {
          // (2026-07-30) Demande de Nicolas : "le filtre prendra les diverses
          // données existantes" — traité comme les autres filtres à cases à
          // cocher, valeurs = libellés de statut réellement rencontrés.
          type: 'multiselect',
          widthCh: 20,
          centered: true,
          filterStyle: 'inputPlusDropdown',
          tokens: (r) => tokensOrEmpty(r.declared_vat && r.declared_vat.status ? [vatStatusLabel(r.declared_vat.status)] : []),
          get: (r) => (r.declared_vat && r.declared_vat.status ? vatStatusLabel(r.declared_vat.status) : ''),
        },
      ],
      // (2026-07-30, demandé par Nicolas) "flux bancaire, ocr, etc... tu
      // réduis la largeur à 10 caract max" — appliqué à toute la série de
      // colonnes 100% numériques de cette vue.
      // entryType (2026-07-30, demandé par Nicolas) : "regarde à quoi renvoie
      // le clic sur une valeur entourée d'un cercle en classique [...]
      // reproduit le même fonctionnement" — reniflage en direct (Claude in
      // Chrome, clic réel sur les bulles jaunes) : Flux bancaire/OCR/manuel
      // ouvrent (même onglet, dans un nouvel onglet interne à l'appli) une
      // liste d'écritures filtrée par type, /tab/{society_id}/accounting/
      // newEntry?entryType=XX — codes confirmés en direct : "ib" (Flux
      // bancaire), "o" (Flux OCR), "m" (Flux manuel). "Flux autres" a été
      // testé aussi et ouvre une route COMPLÈTEMENT différente
      // (/tab/{id}/document-management?activeTabId=...&expanded=...&dates=...)
      // — pas encore assez compris pour être reproduit, donc pas de clickable
      // sur "Flux autres"/Réponses Info-PJ/OD de paie/Extournes/Comptes
      // attente/Lettrage tant que leurs routes réelles n'ont pas été
      // reniflées une par une (jamais deviné).
      ['flux bancaire', { type: 'auto', numeric: true, widthCh: 10, entryType: 'ib', get: (r) => formatAutoValue(r.bank_flow) }],
      ['flux ocr', { type: 'auto', numeric: true, widthCh: 10, entryType: 'o', get: (r) => formatAutoValue(r.ocr_flow) }],
      ['flux manuel', { type: 'auto', numeric: true, widthCh: 10, entryType: 'm', get: (r) => formatAutoValue(r.manual_flow) }],
      ['lettrage', { type: 'auto', numeric: true, widthCh: 10, get: (r) => formatAutoValue(r.lettering) }],
      ['flux autres', { type: 'auto', numeric: true, widthCh: 10, get: (r) => formatAutoValue(r.other_flow) }],
      ['reponses info/pj', { type: 'auto', numeric: true, widthCh: 10, get: (r) => formatAutoValue(r.pj) }],
      ['od de paie', { type: 'auto', numeric: true, widthCh: 10, get: (r) => formatAutoValue(r.payroll_od) }],
      ['extournes', { type: 'auto', numeric: true, widthCh: 10, get: (r) => formatAutoValue(r.accounting_reversal) }],
      [
        'compte attente responsabilite client',
        { type: 'auto', numeric: true, widthCh: 10, labelOverride: '471 Client', get: (r) => formatAutoValue(r.client_waiting_account) },
      ],
      [
        'compte attente responsabilite cabinet',
        { type: 'auto', numeric: true, widthCh: 10, labelOverride: '471 Cabinet', get: (r) => formatAutoValue(r.accounting_firm_waiting_account) },
      ],
      [
        'is',
        {
          type: 'combo',
          get: (r) => [formatAutoValue(r.deposit_is), formatAutoValue(r.liquidation_is)].filter(Boolean).join(' / '),
        },
      ],
      [
        'cvae',
        {
          type: 'combo',
          get: (r) => [formatAutoValue(r.deposit_cvae), formatAutoValue(r.liquidation_cvae)].filter(Boolean).join(' / '),
        },
      ],
      [
        'ts',
        {
          type: 'combo',
          get: (r) => [formatAutoValue(r.deposit_ts), formatAutoValue(r.liquidation_ts)].filter(Boolean).join(' / '),
        },
      ],
      ['liasse', { type: 'auto', numeric: true, widthCh: 10, get: (r) => formatAutoValue(r.liasse) }],
    ].map(([label, def]) => [normalizeColumnName(label), def])
  );


  // Lit l'ordre + la liste des colonnes ACTUELLEMENT affichées par la grille
  // native (donc telles que configurées via la roue crantée "Paramétrage des
  // colonnes" — coché = affiché, décoché ou absent = pas affiché) — même
  // masquée (display:none n'efface jamais le DOM, seulement son rendu
  // visuel), directement depuis .vtHeader, sans jamais ouvrir la moindre
  // boîte de dialogue.
  function getVisibleNativeColumnLabels(parts) {
    if (!parts || !parts.vtHeader) return [];
    return Array.from(parts.vtHeader.querySelectorAll('[class*="headerCell"]:not([class*="Content"])'))
      .map((h) => getHeaderLabelText(h))
      .filter(Boolean);
  }


  function buildCustomTableColumns() {
    const parts = findSuiviGridParts();
    const visibleLabels = getVisibleNativeColumnLabels(parts);
    const cols = [];
    const seenKeys = new Set();
    visibleLabels.forEach((label) => {
      const canon = canonicalColumnName(label);
      const def = SEMAINE_COLUMN_CATALOG.get(canon);
      if (!def) {
        console.warn('[tmbc-custom-table] colonne native "' + label + '" non reconnue dans le catalogue — ignorée.');
        return;
      }
      // Une colonne déjà vue avec le même libellé canonique (rare, mais
      // "Expert"/"Expert comptable" pourraient coexister sur une même vue) —
      // on ne l'ajoute qu'une fois.
      if (seenKeys.has(canon)) return;
      seenKeys.add(canon);
      cols.push({
        key: canon.replace(/[^a-z0-9]+/g, '_'),
        // (2026-07-30) "Renomme Compte attente responsabilité client par 471
        // Client..." — labelOverride remplace l'intitulé natif affiché, mais
        // canonicalColumnName()/le catalogue continuent de matcher sur le
        // libellé natif d'origine (label), jamais sur labelOverride.
        label: def.labelOverride || label,
        type: def.type === 'multiselect' ? 'multiselect' : 'text',
        rawType: def.type,
        numeric: !!def.numeric,
        tokens: def.tokens,
        get: def.get,
        // (2026-07-30, demandé par Nicolas) "met une regle pour éviter d'avoir
        // des colonnes trop grandes [...] si pas de largeur spécifique, limite
        // la largeur à 30 caracteres" — DEFAULT_MAX_COLUMN_WIDTH_CH s'applique
        // dès qu'une colonne n'a pas de widthCh explicite dans le catalogue
        // (ex. SIREN/SIRET, Contact Principal) ; garde donc TOUJOURS une
        // largeur (plus jamais null), donc toujours "cappée" avec ellipse.
        widthCh: def.widthCh || DEFAULT_MAX_COLUMN_WIDTH_CH,
        centered: !!def.centered,
        clickToFilter: !!def.clickToFilter,
        clickToNavigate: !!def.clickToNavigate,
        sortAsText: !!def.sortAsText,
        filterStyle: def.filterStyle || null,
        entryType: def.entryType || null,
        mono: !!def.mono,
        trigramFilter: !!def.trigramFilter,
      });
    });
    // (2026-07-30, demandé par Nicolas) "je veux pouvoir deplacer librement
    // les colonnes en clic + maintien de l'entete" — l'ordre "naturel" ci-
    // dessus vient du paramétrage natif (getVisibleNativeColumnLabels) ; si
    // Nicolas a glissé-déposé une colonne dans le tableau maison, son ordre
    // choisi (customTableState.columnOrder, persistant tant que la vue Semaine
    // n'est pas rechargée) prend le dessus. Toute colonne absente de cet ordre
    // (nouvelle colonne native jamais encore glissée) garde sa position
    // relative naturelle, ajoutée à la fin — Array.prototype.sort est stable
    // en JS moderne, donc les égalités (Infinity ci-dessous) préservent cet
    // ordre naturel entre elles.
    if (customTableState.columnOrder && customTableState.columnOrder.length) {
      const orderIndex = new Map(customTableState.columnOrder.map((k, i) => [k, i]));
      cols.sort((a, b) => {
        const ai = orderIndex.has(a.key) ? orderIndex.get(a.key) : Infinity;
        const bi = orderIndex.has(b.key) ? orderIndex.get(b.key) : Infinity;
        return ai - bi;
      });
    }
    return cols;
  }


  // Reconnaît ">100", ">= 100", "<50", "<=50", "=50" (espace optionnel après
  // l'opérateur, virgule ou point comme séparateur décimal) et renvoie une
  // fonction de comparaison — null si le texte ne correspond pas à ce
  // format (dans ce cas, renderCustomTable retombe sur le filtre "contient"
  // classique).
  function parseNumericFilter(raw) {
    const m = raw.match(/^(>=|<=|>|<|=)\s*(-?\d+(?:[.,]\d+)?)$/);
    if (!m) return null;
    const op = m[1];
    const value = parseFloat(m[2].replace(',', '.'));
    if (isNaN(value)) return null;
    switch (op) {
      case '>':
        return (n) => n > value;
      case '>=':
        return (n) => n >= value;
      case '<':
        return (n) => n < value;
      case '<=':
        return (n) => n <= value;
      case '=':
        return (n) => n === value;
      default:
        return null;
    }
  }


  function distinctTokensFor(col, data) {
    const set = new Set();
    data.forEach((r) => col.tokens(r).forEach((t) => t && set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }


  function escapeHtmlAttr(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }


  // (2026-07-30, demandé par Nicolas) Double-clic sur une poignée de
  // redimensionnement -> ajuste la colonne à la longueur totale de la donnée
  // la plus grande qui y figure, mesurée sur le CORPS du tableau uniquement
  // (jamais l'en-tête : "selon les valeurs de la colonne, pas selon l'entete,
  // qui peut se mettre sur 2 lignes"), SANS dépasser la limite fixée
  // précédemment pour cette colonne (widthCh du catalogue, ex. 8/20/etc., ou
  // DEFAULT_MAX_COLUMN_WIDTH_CH si aucune n'a été précisée) — le premier
  // essai ignorait cette limite et laissait la colonne s'élargir librement.
  function autoFitColumnWidth(wrap, columns, key) {
    const col = wrap.querySelector('col[data-key="' + key + '"]');
    const colIndex = columns.findIndex((c) => c.key === key);
    if (!col || colIndex < 0) return;
    const column = columns[colIndex];
    const cells = Array.from(wrap.querySelectorAll('tbody tr'))
      .map((tr) => tr.children[colIndex])
      .filter(Boolean);
    if (!cells.length) return;
    const prevWidth = col.style.width;

    // 1) largeur naturelle du contenu, sans aucune contrainte.
    col.style.width = 'auto';
    let maxWidth = 0;
    cells.forEach((td) => {
      maxWidth = Math.max(maxWidth, td.scrollWidth);
    });
    if (!maxWidth) {
      col.style.width = prevWidth;
      return;
    }
    let finalWidth = maxWidth + 4;

    // 2) jamais au-delà du plafond déjà fixé pour cette colonne — reconverti
    // en px dans le MÊME contexte de police en lisant la largeur réellement
    // rendue par le navigateur pour "Nch" (plus fiable qu'une conversion
    // ch->px approximative faite à la main).
    const capCh = column.widthCh || DEFAULT_MAX_COLUMN_WIDTH_CH;
    col.style.width = capCh + 'ch';
    const capPx = col.getBoundingClientRect().width;
    if (capPx) finalWidth = Math.min(finalWidth, capPx);

    finalWidth = Math.max(30, finalWidth) + 'px';
    col.style.width = finalWidth;
    customTableState.columnWidths[key] = finalWidth;
  }


  const customTableState = {
    viewKey: null,
    data: null,
    loading: false,
    failed: false,
    filters: {},
    textFilters: {},
    sort: null,
    columnWidths: {},
    countText: '',
    columnOrder: [],
  };


  function currentSuiviViewKey() {
    return normalizeColumnName(findSuiviViewSelectValue() || '');
  }


  // (2026-07-30, demandé par Nicolas) "si clique sur un dossier ou numéro de
  // dossier, ca ouvre l'onglet de la société, sur la vue d'ensemble." —
  // reniflage en direct (Claude in Chrome) : cliquer sur une valeur "entourée
  // d'un cercle" en affichage classique navigue, dans le MÊME onglet
  // (navigateur), vers /tab/{id}/accounting/newEntry?entryType=XX (confirmé
  // entryType=ib pour Flux bancaire) — donc le motif d'URL de cette appli est
  // /tab/{id}/<route>. Le motif exact de la route "Vue d'ensemble" elle-même
  // n'a pas encore été sniffé au clic direct sur une ligne Dossier (à
  // confirmer avec Nicolas), mais /tab/{id}/home a été observé à deux
  // reprises comme route par défaut d'un onglet société pendant cette
  // session — utilisé ici par déduction, PAS deviné à partir de rien. history
  // .pushState + un événement popstate synthétique évite un rechargement
  // complet de page (équivalent à ce qu'un clic natif sur un lien interne
  // provoque dans une appli React Router) — aucune manipulation de nœud natif
  // ici, uniquement l'historique du navigateur.
  function goToSocietyOverview(societyId) {
    if (!societyId) return;
    const url = '/tab/' + societyId + '/home';
    try {
      history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {
      console.warn('[tmbc-custom-table] navigation vers "Vue d\'ensemble" échouée, fallback en rechargement complet.', e);
      window.location.assign(url);
    }
  }


  // (2026-07-30, demandé par Nicolas) Reproduit le clic natif sur une bulle
  // "Flux bancaire/OCR/manuel" -> liste d'écritures filtrée par type, même
  // technique de navigation que goToSocietyOverview (pushState + popstate
  // synthétique, pas de rechargement complet).
  function goToAccountingEntries(societyId, entryType) {
    if (!societyId || !entryType) return;
    const url = '/tab/' + societyId + '/accounting/newEntry?entryType=' + entryType;
    try {
      history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {
      console.warn('[tmbc-custom-table] navigation vers les écritures échouée, fallback en rechargement complet.', e);
      window.location.assign(url);
    }
  }


  const CUSTOM_TABLE_WRAP_ID = 'tmbc-custom-table-wrap';


  function removeCustomTableContainer() {
    const el = document.getElementById(CUSTOM_TABLE_WRAP_ID);
    if (el) el.remove();
    hideFloatingMsPanel();
  }


  // Ré-affiche le tableau natif (retire nos display:none) — jamais de
  // suppression du nœud natif, seulement l'annulation du masquage posé par
  // mountCustomTableContainer.
  function restoreNativeGrid(parts) {
    if (!parts) return;
    parts.headerContainer.style.removeProperty('display');
    parts.body.style.removeProperty('display');
  }


  // --- Panneau flottant partagé pour les filtres multi-sélection ----------
  // (2026-07-30, corrige un bug signalé par Nicolas : "si je filtre et que
  // je veux modifier le filtre, une partie est masqué" — le panneau de
  // cases à cocher était un enfant absolu de .tmbc-ct-ms, lui-même dans
  // .tmbc-ct-wrap qui a overflow:auto — dès que le panneau dépassait la
  // zone visible (peu de lignes après filtrage = wrap plus bas que le
  // panneau), il était rogné. Un seul panneau partagé, ajouté à
  // document.body en position:fixed et positionné via getBoundingClientRect
  // du bouton cliqué, échappe entièrement à cet overflow — même principe que
  // positionDrawerNextToContent plus haut dans ce fichier (même approche
  // position:fixed calculée depuis getBoundingClientRect).
  let openMsPanelKey = null;

  let floatingMsPanelOutsideClickWired = false;


  function ensureFloatingMsPanel() {
    let panel = document.getElementById('tmbc-ct-floating-ms-panel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'tmbc-ct-floating-ms-panel';
    panel.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(panel);
    if (!floatingMsPanelOutsideClickWired) {
      floatingMsPanelOutsideClickWired = true;
      document.addEventListener('click', () => hideFloatingMsPanel());
    }
    return panel;
  }


  function hideFloatingMsPanel() {
    const panel = document.getElementById('tmbc-ct-floating-ms-panel');
    if (panel) panel.style.display = 'none';
    openMsPanelKey = null;
  }


  function showFloatingMsPanel(wrap, col, data, btn) {
    const panel = ensureFloatingMsPanel();
    const options = distinctTokensFor(col, data);
    const selected = customTableState.filters[col.key];
    panel.innerHTML = options
      .map(
        (o) =>
          '<label><input type="checkbox" value="' +
          escapeHtmlAttr(o) +
          '"' +
          (selected.has(o) ? ' checked' : '') +
          '/> ' +
          escapeHtmlAttr(o) +
          '</label>'
      )
      .join('');
    panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const set = customTableState.filters[col.key];
        if (cb.checked) set.add(cb.value);
        else set.delete(cb.value);
        renderCustomTable(wrap);
      });
    });
    const rect = btn.getBoundingClientRect();
    panel.style.display = 'block';
    panel.style.top = rect.bottom + 4 + 'px';
    panel.style.left = rect.left + 'px';
    // Si le panneau dépasserait le bord droit de la fenêtre, on l'aligne sur
    // le bord droit du bouton plutôt que le gauche.
    const panelRect = panel.getBoundingClientRect();
    if (rect.left + panelRect.width > window.innerWidth) {
      panel.style.left = Math.max(4, rect.right - panelRect.width) + 'px';
    }
    openMsPanelKey = col.key;
  }


  function renderCustomTable(wrap) {
    const data = customTableState.data;
    const columns = buildCustomTableColumns();
    columns.forEach((c) => {
      if (customTableState.filters[c.key] === undefined) {
        customTableState.filters[c.key] = c.type === 'multiselect' ? new Set() : '';
      }
      // (2026-07-30, demandé par Nicolas) Portefeuille/Expert comptable/
      // Manager/Collab. : "met un champ filtre classique, et rajoute un
      // bouton avec une flèche qui permet d'ouvrir la liste déroulante" — un
      // champ texte "contient" cohabite avec la sélection à cases à cocher
      // existante (customTableState.filters[key], toujours un Set), stocké à
      // part dans textFilters pour ne pas toucher au fonctionnement déjà en
      // place de la liste déroulante.
      if (c.filterStyle === 'inputPlusDropdown' && customTableState.textFilters[c.key] === undefined) {
        customTableState.textFilters[c.key] = '';
      }
    });

    let rows = data.slice();
    columns.forEach((c) => {
      if (c.type === 'multiselect') {
        const selected = customTableState.filters[c.key];
        if (selected && selected.size) {
          rows = rows.filter((r) => c.tokens(r).some((t) => selected.has(t)));
        }
        if (c.filterStyle === 'inputPlusDropdown') {
          const textRaw = (customTableState.textFilters[c.key] || '').trim().toLowerCase();
          if (textRaw) {
            rows = rows.filter((r) => c.tokens(r).some((t) => t.toLowerCase().includes(textRaw)));
          }
        }
      } else {
        const raw = (customTableState.filters[c.key] || '').trim();
        if (!raw) return;
        // (2026-07-30) Demandé par Nicolas : sur les colonnes numériques,
        // accepter des opérateurs de comparaison (>, >=, <, <=, =) en plus du
        // texte libre. parseNumericFilter renvoie null si la colonne n'est
        // pas numérique ou si le texte ne correspond pas à ce format — dans
        // ce cas on retombe sur l'ancien filtre "contient" (sous-chaîne).
        const numericFilter = c.numeric ? parseNumericFilter(raw) : null;
        if (numericFilter) {
          rows = rows.filter((r) => {
            const n = parseFloat(String(c.get(r) || '').replace(/[\s ]/g, '').replace(',', '.'));
            if (isNaN(n)) return false;
            return numericFilter(n);
          });
        } else {
          const q = raw.toLowerCase();
          rows = rows.filter((r) => String(c.get(r) || '').toLowerCase().includes(q));
        }
      }
    });

    if (customTableState.sort) {
      const { key, dir } = customTableState.sort;
      const col = columns.find((c) => c.key === key);
      if (col) {
        rows = rows.slice().sort((a, b) => {
          const va = col.get(a);
          const vb = col.get(b);
          let cmp;
          // sortAsText (2026-07-30, demandé par Nicolas) : Référence dossier
          // est un identifiant, pas une quantité — jamais de comparaison
          // numérique pour cette colonne (même si son contenu ressemble à un
          // nombre), toujours alphabétique.
          if (!col.sortAsText) {
            const na = parseFloat(va);
            const nb = parseFloat(vb);
            if (!isNaN(na) && !isNaN(nb) && String(va).trim() !== '' && String(vb).trim() !== '') cmp = na - nb;
          }
          if (cmp === undefined) cmp = String(va || '').localeCompare(String(vb || ''), 'fr');
          return dir === 'desc' ? -cmp : cmp;
        });
      }
    }

    const activeEl = document.activeElement;
    const activeIsFilterInput =
      activeEl && activeEl.classList && (activeEl.classList.contains('tmbc-ct-filter') || activeEl.classList.contains('tmbc-ct-text-filter'));
    const activeFilterKey = activeIsFilterInput ? activeEl.dataset.key : null;
    const activeFilterIsTextFilter = activeIsFilterInput && activeEl.classList.contains('tmbc-ct-text-filter');
    const activeSelStart = activeFilterKey ? activeEl.selectionStart : null;

    // (2026-07-30, demandé par Nicolas) Largeur effective d'une colonne :
    // priorité à une largeur redimensionnée manuellement par l'utilisateur
    // (customTableState.columnWidths, persistée tant que la vue ne change
    // pas), sinon la préconisation du catalogue (widthCh), sinon aucune
    // largeur forcée (le navigateur ajuste au contenu, comportement
    // d'origine). Le <colgroup> ci-dessous est ce qui garantit qu'un
    // redimensionnement (ou une largeur préconisée) s'applique identiquement
    // à l'en-tête, à la ligne de filtres ET au corps du tableau — les trois
    // étant des lignes du même <table>.
    // customTableState.columnWidths[key] stocke soit une chaîne CSS complète
    // (ex. "245px", posée par un redimensionnement manuel), soit rien — dans
    // ce cas on retombe sur la préconisation du catalogue (widthCh, en "ch").
    function colWidthCh(c) {
      return customTableState.columnWidths[c.key] || (c.widthCh ? c.widthCh + 'ch' : null);
    }
    const colgroupCols = columns
      .map((c) => {
        const w = colWidthCh(c);
        return '<col' + (w ? ' style="width:' + w + '"' : '') + ' data-key="' + c.key + '"/>';
      })
      .join('');

    const theadCells = columns
      .map((c) => {
        const sortDir = customTableState.sort && customTableState.sort.key === c.key ? customTableState.sort.dir : null;
        const arrow = sortDir === 'asc' ? ' ▲' : sortDir === 'desc' ? ' ▼' : '';
        // (2026-07-30, demandé par Nicolas) "les entetes gardent toujours la
        // police de base, pas de police à chasse fixe" — .tmbc-numeric (police
        // Consolas) ne s'applique donc plus qu'au CORPS du tableau
        // (cf. bodyRows), pas à l'en-tête ; .tmbc-ct-col-numeric (largeur/
        // alignement, sans police) reste appliqué aux deux.
        const cls =
          'tmbc-ct-th' +
          (c.numeric ? ' tmbc-ct-col-numeric' : '') +
          (c.centered ? ' tmbc-ct-centered' : '') +
          (colWidthCh(c) ? ' tmbc-ct-col-capped' : '');
        // draggable (2026-07-30, demandé par Nicolas) : "je veux pouvoir
        // deplacer librement les colonnes en clic + maintien de l'entete" —
        // glisser-déposer HTML5 natif sur le <th> lui-même (jamais sur la
        // poignée de redimensionnement, exclue explicitement dans le
        // gestionnaire dragstart pour ne pas interférer avec le
        // redimensionnement à la souris).
        return (
          '<th class="' +
          cls +
          '" draggable="true" data-key="' +
          c.key +
          '"><span class="tmbc-ct-th-label">' +
          escapeHtmlAttr(c.label) +
          arrow +
          '</span><span class="tmbc-ct-resizer" data-key="' +
          c.key +
          '"></span></th>'
        );
      })
      .join('');

    const filterCells = columns
      .map((c) => {
        if (c.type === 'multiselect' && c.filterStyle === 'inputPlusDropdown') {
          // (2026-07-30, demandé par Nicolas) Portefeuille/Expert comptable/
          // Manager/Collab. : "met un champ filtre classique, et rajoute un
          // bouton avec une flèche qui permet d'ouvrir la liste déroulante du
          // filtre (si on veut cocher plusieurs)" — champ texte "contient"
          // (customTableState.textFilters) + bouton flèche qui ouvre le même
          // panneau flottant à cases à cocher qu'avant (customTableState.
          // filters, un Set — les deux se cumulent, cf. renderCustomTable).
          const selected = customTableState.filters[c.key];
          const count = selected.size;
          const textVal = customTableState.textFilters[c.key] || '';
          const hasAny = !!textVal.trim() || count > 0;
          return (
            '<th' +
            (c.centered ? ' class="tmbc-ct-centered"' : '') +
            '><div class="tmbc-ct-filter-wrap">' +
            '<input type="text" class="tmbc-ct-text-filter" data-key="' +
            c.key +
            '" value="' +
            escapeHtmlAttr(textVal) +
            '"' +
            (count ? ' placeholder="' + count + ' sélectionné(s)"' : '') +
            '/>' +
            '<button type="button" class="tmbc-ct-ms-arrow" data-key="' +
            c.key +
            '" title="Sélection multiple">▾</button>' +
            (hasAny ? '<button type="button" class="tmbc-ct-clear" data-key="' + c.key + '" title="Effacer ce filtre">×</button>' : '') +
            '</div></th>'
          );
        }
        if (c.type === 'multiselect') {
          const selected = customTableState.filters[c.key];
          const count = selected.size;
          // Le panneau de cases à cocher n'est PAS généré ici : un seul
          // panneau flottant partagé (cf. ensureFloatingMsPanel) est
          // positionné/rempli dynamiquement au clic, pour ne jamais être
          // rogné par l'overflow:auto de .tmbc-ct-wrap (bug signalé par
          // Nicolas).
          // Croix rouge de remise à zéro (2026-07-30, demandée par Nicolas) —
          // affichée seulement quand au moins une valeur est sélectionnée.
          return (
            '<th' +
            (c.centered ? ' class="tmbc-ct-centered"' : '') +
            '><div class="tmbc-ct-ms" data-key="' +
            c.key +
            '"><button type="button" class="tmbc-ct-ms-btn">' +
            (count ? count + ' sélectionné(s)' : 'Tous') +
            '</button>' +
            (count ? '<button type="button" class="tmbc-ct-clear" data-key="' + c.key + '" title="Effacer ce filtre">×</button>' : '') +
            '</div></th>'
          );
        }
        const hasValue = !!(customTableState.filters[c.key] || '').trim();
        // (2026-07-30, demandé par Nicolas) : plus de texte "Filtrer…"/"Filtre…
        // (ex: ...)" dans les champs — laissés vides tant qu'aucune valeur
        // n'est saisie.
        return (
          '<th' +
          (c.numeric || c.centered ? ' class="' + (c.numeric ? 'tmbc-ct-col-numeric' : '') + (c.centered ? ' tmbc-ct-centered' : '') + '"' : '') +
          '><div class="tmbc-ct-filter-wrap">' +
          '<input type="text" class="tmbc-ct-filter" data-key="' +
          c.key +
          '" value="' +
          escapeHtmlAttr(customTableState.filters[c.key] || '') +
          '"/>' +
          (hasValue ? '<button type="button" class="tmbc-ct-clear" data-key="' + c.key + '" title="Effacer ce filtre">×</button>' : '') +
          '</div></th>'
        );
      })
      .join('');

    const bodyRows = rows
      .map(
        (r) =>
          '<tr>' +
          columns
            .map((c) => {
              const cls =
                (c.numeric ? 'tmbc-numeric tmbc-ct-col-numeric' : c.mono ? 'tmbc-numeric' : '') +
                (c.centered ? ' tmbc-ct-centered' : '') +
                (colWidthCh(c) ? ' tmbc-ct-col-capped' : '');
              const val = String(c.get(r) ?? '');
              if (c.clickToFilter && c.type === 'multiselect') {
                // (2026-07-30, demandé par Nicolas) : cliquer sur une valeur de
                // Portefeuille/Expert comptable/Manager/Collab. filtre
                // directement la colonne sur cette valeur (remplace la
                // sélection en cours plutôt que de l'ajouter, pour un clic =
                // un filtre net). EMPTY_TOKEN ("(Vide)") reste une option du
                // filtre (utile pour isoler les dossiers sans expert/manager/
                // collab.), mais NE DOIT PAS s'afficher dans la cellule
                // elle-même quand le champ est vide — "si vide, tu mets
                // rien !" (demandé par Nicolas) : cellule vide, pas de texte
                // placeholder cliquable.
                const tokens = c.tokens(r).filter((t) => t && t !== EMPTY_TOKEN);
                const html = tokens
                  .map(
                    (t) =>
                      '<span class="tmbc-ct-token" data-key="' + c.key + '" data-token="' + escapeHtmlAttr(t) + '">' + escapeHtmlAttr(t) + '</span>'
                  )
                  .join('<span class="tmbc-ct-token-sep">, </span>');
                return '<td class="' + cls.trim() + '">' + html + '</td>';
              }
              if (c.clickToNavigate) {
                // (2026-07-30, demandé par Nicolas) : clic sur le nom du
                // dossier ou son numéro de référence -> ouvre l'onglet de la
                // société sur "Vue d'ensemble" (cf. goToSocietyOverview).
                return (
                  '<td class="' +
                  cls.trim() +
                  '"><span class="tmbc-ct-society-link" data-society-id="' +
                  escapeHtmlAttr(r.society_id != null ? r.society_id : '') +
                  '">' +
                  escapeHtmlAttr(val) +
                  '</span></td>'
                );
              }
              if (c.entryType && val && val !== '0') {
                // (2026-07-30, demandé par Nicolas) : reproduit le clic natif
                // sur une bulle Flux bancaire/OCR/manuel -> liste d'écritures
                // filtrée par type (cf. goToAccountingEntries). Seulement
                // cliquable si la valeur n'est pas vide/zéro, comme la bulle
                // native (pas de bulle affichée du tout à 0 en classique).
                return (
                  '<td class="' +
                  cls.trim() +
                  '"><span class="tmbc-ct-token" data-key="' +
                  c.key +
                  '" data-entry-type="' +
                  escapeHtmlAttr(c.entryType) +
                  '" data-society-id="' +
                  escapeHtmlAttr(r.society_id != null ? r.society_id : '') +
                  '">' +
                  escapeHtmlAttr(val) +
                  '</span></td>'
                );
              }
              return '<td class="' + cls.trim() + '">' + escapeHtmlAttr(val) + '</td>';
            })
            .join('') +
          '</tr>'
      )
      .join('');

    // (2026-07-30, demandé par Nicolas) "les numeros de dossiers [...]
    // doivent etre sur la meme ligne que les boutons Affichage MyUnisoft" —
    // le compteur "X / Y dossiers" n'a PLUS SA PLACE dans la table (ni comme
    // <div> avant elle en v3.26, ni comme ligne de <thead> en v3.27, les deux
    // rejetés) : il doit vivre dans la barre d'outils native, sur la même
    // ligne que "Charger le tableau"/notre bouton Affichage Premium — cf.
    // ensureCustomTableCountBadge, appelé depuis scan() comme les autres
    // éléments flottants de cette barre. On mémorise juste le texte ici.
    customTableState.countText = rows.length + ' / ' + data.length + ' dossiers';

    wrap.innerHTML =
      '<table class="tmbc-ct-table"><colgroup>' +
      colgroupCols +
      '</colgroup><thead><tr>' +
      theadCells +
      '</tr><tr>' +
      filterCells +
      '</tr></thead><tbody>' +
      bodyRows +
      '</tbody></table>';

    // (2026-07-30, demandé par Nicolas) "on fige les entete quand on utilise
    // l'ascenseur" + en-tête pouvant maintenant tenir sur 2 lignes : on mesure
    // la hauteur RÉELLE de la 1ère ligne (libellés) pour ancrer la 2e ligne
    // (filtres) juste en dessous en position:sticky — une valeur fixe
    // décollerait la ligne de filtres dès qu'un libellé passe sur 2 lignes.
    const headRow1 = wrap.querySelector('thead tr:nth-child(1)');
    const headRow2 = wrap.querySelector('thead tr:nth-child(2)');
    if (headRow1 && headRow2) {
      const row1Height = headRow1.getBoundingClientRect().height;
      headRow2.querySelectorAll('th').forEach((th) => {
        th.style.top = row1Height + 'px';
      });
    }

    // (2026-07-30, demandé par Nicolas) Redimensionnement manuel des
    // colonnes, y compris la ligne de filtres : puisque le <colgroup>
    // gouverne la largeur de toute la colonne (en-tête + filtre + corps,
    // trois lignes du même <table>), ajuster un seul <col> suffit à
    // redimensionner les trois d'un coup — pas de synchronisation séparée à
    // faire. Même principe que le drag de colonnes de balance.js
    // (.tmb-col-resizer), adapté au <colgroup> plutôt qu'à des largeurs de
    // <th> individuelles.
    wrap.querySelectorAll('.tmbc-ct-resizer').forEach((handle) => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = handle.dataset.key;
        const col = wrap.querySelector('col[data-key="' + key + '"]');
        const th = handle.closest('th');
        if (!col || !th) return;
        const startX = e.clientX;
        const startWidth = th.getBoundingClientRect().width;
        const onMove = (ev) => {
          const next = Math.max(30, startWidth + (ev.clientX - startX));
          col.style.width = next + 'px';
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          // Persiste la largeur finale (en px) — reste appliquée tant que la
          // vue Semaine n'est pas rechargée (réinitialisée avec le reste de
          // customTableState au changement de vue, cf. mountCustomTableContainer).
          customTableState.columnWidths[key] = col.style.width;
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      // (2026-07-30, demandé par Nicolas) "si je double clique sur la double
      // flèche [...] ca ajuste automatiquement les colonnes (selon les
      // valeurs de la colonne, pas selon l'entete, qui peut se mettre sur 2
      // lignes)" — ajuste au contenu le plus large du CORPS uniquement
      // (jamais l'en-tête, qui peut être plus long mais revient à la ligne).
      handle.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        autoFitColumnWidth(wrap, columns, handle.dataset.key);
      });
    });
    // (2026-07-30, demandé par Nicolas) Clic sur une valeur de
    // Portefeuille/Expert comptable/Manager/Collab. -> filtre la colonne sur
    // cette seule valeur ; clic sur une bulle Flux bancaire/OCR/manuel ->
    // ouvre les écritures correspondantes (goToAccountingEntries) — même
    // classe .tmbc-ct-token pour les deux, distingués via data-entry-type.
    wrap.querySelectorAll('.tmbc-ct-token').forEach((tok) => {
      tok.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tok.dataset.entryType) {
          goToAccountingEntries(tok.dataset.societyId, tok.dataset.entryType);
          return;
        }
        const key = tok.dataset.key;
        const value = tok.dataset.token;
        const set = customTableState.filters[key];
        if (set instanceof Set) {
          set.clear();
          set.add(value);
        }
        renderCustomTable(wrap);
      });
    });
    // (2026-07-30, demandé par Nicolas) Clic sur Dossier/Référence dossier ->
    // ouvre l'onglet de la société sur "Vue d'ensemble".
    wrap.querySelectorAll('.tmbc-ct-society-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSocietyOverview(link.dataset.societyId);
      });
    });

    wrap.querySelectorAll('.tmbc-ct-th').forEach((th) => {
      th.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('tmbc-ct-resizer')) return;
        const key = th.dataset.key;
        const cur = customTableState.sort;
        let dir = 'asc';
        if (cur && cur.key === key) dir = cur.dir === 'asc' ? 'desc' : cur.dir === 'desc' ? null : 'asc';
        customTableState.sort = dir ? { key, dir } : null;
        renderCustomTable(wrap);
      });
      // (2026-07-30, demandé par Nicolas) "je veux pouvoir deplacer librement
      // les colonnes en clic + maintien de l'entete et la déplacer ou je
      // veux" — glisser-déposer HTML5 natif ; l'ordre choisi est persisté
      // dans customTableState.columnOrder (lu par buildCustomTableColumns)
      // tant que la vue Semaine n'est pas rechargée. NE MODIFIE PAS le
      // paramétrage natif des colonnes (roue crantée) : la synchronisation
      // dans l'autre sens demanderait de manipuler cette boîte de dialogue
      // native, jamais sniffée — risque trop élevé de casser la
      // réconciliation React du tableau natif (règle du projet : jamais
      // déplacer un nœud natif) sans l'avoir d'abord observée en direct.
      th.addEventListener('dragstart', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('tmbc-ct-resizer')) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', th.dataset.key);
      });
      th.addEventListener('dragover', (e) => {
        e.preventDefault();
        th.classList.add('tmbc-ct-th-dragover');
      });
      th.addEventListener('dragleave', () => {
        th.classList.remove('tmbc-ct-th-dragover');
      });
      th.addEventListener('drop', (e) => {
        e.preventDefault();
        th.classList.remove('tmbc-ct-th-dragover');
        const draggedKey = e.dataTransfer.getData('text/plain');
        const targetKey = th.dataset.key;
        if (!draggedKey || draggedKey === targetKey) return;
        const order = columns.map((c) => c.key);
        const fromIdx = order.indexOf(draggedKey);
        if (fromIdx < 0 || order.indexOf(targetKey) < 0) return;
        order.splice(fromIdx, 1);
        order.splice(order.indexOf(targetKey), 0, draggedKey);
        customTableState.columnOrder = order;
        renderCustomTable(wrap);
      });
    });
    wrap.querySelectorAll('.tmbc-ct-filter').forEach((input) => {
      input.addEventListener('input', () => {
        customTableState.filters[input.dataset.key] = input.value;
        renderCustomTable(wrap);
      });
    });
    // (2026-07-30, demandé par Nicolas) Champ texte "classique" de
    // Portefeuille/Expert comptable/Manager/Collab. — filtre "contient" sur
    // les jetons de la colonne, cumulable avec la sélection à cases à cocher
    // (cf. renderCustomTable, filtrage des lignes).
    wrap.querySelectorAll('.tmbc-ct-text-filter').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.key;
        const col = columns.find((c) => c.key === key);
        let val = input.value;
        // (2026-07-30, demandé par Nicolas) Expert comptable/Manager/Collab. :
        // "rajoute automatiquement un . après la première lettre [...] si je
        // saisi NCH, il affiche N.CH" — les trigrammes réels sont au format
        // "X.YZ" ; on retire tout point déjà tapé puis on le réinsère après le
        // 1er caractère, pour que la saisie corresponde toujours au format
        // stocké côté API (cf. tokens ci-dessus). Curseur replacé en fin de
        // champ (repris automatiquement par renderCustomTable via
        // activeSelStart, capturé APRÈS ce recalage).
        if (col && col.trigramFilter) {
          const clean = val.replace(/\./g, '');
          val = clean.length >= 2 ? clean[0] + '.' + clean.slice(1) : clean;
          input.value = val;
          input.setSelectionRange(val.length, val.length);
        }
        customTableState.textFilters[key] = val;
        renderCustomTable(wrap);
      });
    });
    // Croix rouge de remise à zéro (2026-07-30, demandée par Nicolas) :
    // remet le filtre texte à vide ET vide l'ensemble de sélection
    // multi-sélection (les deux peuvent être actifs en même temps sur
    // Portefeuille/Expert comptable/Manager/Collab.), puis ré-affiche.
    wrap.querySelectorAll('.tmbc-ct-clear').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.key;
        const current = customTableState.filters[key];
        if (current instanceof Set) current.clear();
        else customTableState.filters[key] = '';
        if (customTableState.textFilters[key] !== undefined) customTableState.textFilters[key] = '';
        renderCustomTable(wrap);
      });
    });
    wrap.querySelectorAll('.tmbc-ct-ms').forEach((msWrap) => {
      const key = msWrap.dataset.key;
      const col = columns.find((c) => c.key === key);
      const btn = msWrap.querySelector('.tmbc-ct-ms-btn');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (openMsPanelKey === key) {
          hideFloatingMsPanel();
        } else {
          showFloatingMsPanel(wrap, col, data, btn);
        }
      });
    });
    // (2026-07-30, demandé par Nicolas) Bouton flèche (Portefeuille/Expert
    // comptable/Manager/Collab.) : ouvre le même panneau flottant à cases à
    // cocher que l'ancien bouton "Tous"/n sélectionné(s).
    wrap.querySelectorAll('.tmbc-ct-ms-arrow').forEach((arrowBtn) => {
      const key = arrowBtn.dataset.key;
      const col = columns.find((c) => c.key === key);
      arrowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (openMsPanelKey === key) {
          hideFloatingMsPanel();
        } else {
          showFloatingMsPanel(wrap, col, data, arrowBtn);
        }
      });
    });
    // Le tableau vient d'être reconstruit (innerHTML) : si un panneau était
    // ouvert, son bouton d'origine n'existe plus — on le retrouve et on
    // repositionne/republie le panneau flottant sur le nouveau bouton
    // (le panneau lui-même vit hors de "wrap", donc il n'a pas disparu).
    // Existe sous deux formes selon la colonne : ".tmbc-ct-ms .tmbc-ct-ms-btn"
    // (TVA, resté à l'ancien style) ou ".tmbc-ct-ms-arrow" (Portefeuille/
    // Expert comptable/Manager/Collab., nouveau style champ + flèche).
    if (openMsPanelKey) {
      const stillOpenCol = columns.find((c) => c.key === openMsPanelKey);
      const stillOpenMsWrap = wrap.querySelector('.tmbc-ct-ms[data-key="' + openMsPanelKey + '"]');
      const stillOpenArrow = wrap.querySelector('.tmbc-ct-ms-arrow[data-key="' + openMsPanelKey + '"]');
      const reopenBtn = stillOpenMsWrap ? stillOpenMsWrap.querySelector('.tmbc-ct-ms-btn') : stillOpenArrow;
      if (reopenBtn && stillOpenCol) {
        showFloatingMsPanel(wrap, stillOpenCol, data, reopenBtn);
      } else {
        hideFloatingMsPanel();
      }
    }

    if (activeFilterKey) {
      const selector = activeFilterIsTextFilter
        ? '.tmbc-ct-text-filter[data-key="' + activeFilterKey + '"]'
        : '.tmbc-ct-filter[data-key="' + activeFilterKey + '"]';
      const el = wrap.querySelector(selector);
      if (el) {
        el.focus();
        if (activeSelStart != null) el.setSelectionRange(activeSelStart, activeSelStart);
      }
    }
  }


  function mountCustomTableContainer(parts, viewKey) {
    let wrap = document.getElementById(CUSTOM_TABLE_WRAP_ID);
    // isNewWrap distingue "vient d'être créé/recréé" de "déjà présent et déjà
    // rendu" — IMPORTANT (bug corrigé 2026-07-30, a fait planter/geler
    // Electron chez Nicolas) : scan() est rappelé à chaque mutation du DOM
    // (MutationObserver sur document.body) ET toutes les secondes. Réécrire
    // innerHTML à CHAQUE passage de scan() (même quand rien n'a changé) est
    // lui-même une mutation du DOM -> redéclenche l'observer -> rappelle
    // scan() -> réécrit innerHTML -> ... boucle infinie qui bloque le thread
    // unique du renderer Electron. On ne (re)construit donc le tableau que
    // lors d'un VRAI changement (nouvelle vue, nouveau wrap, données qui
    // viennent d'arriver) — un tri/filtre déclenché par l'utilisateur
    // continue de ré-appeler renderCustomTable directement depuis son propre
    // gestionnaire d'événement (pas depuis scan()), donc pas concerné par
    // cette protection.
    const isNewWrap = !wrap;
    if (isNewWrap) {
      wrap = document.createElement('div');
      wrap.id = CUSTOM_TABLE_WRAP_ID;
      wrap.className = 'tmbc-ct-wrap';
      parts.outerBox.appendChild(wrap);
    }
    if (customTableState.viewKey !== viewKey) {
      customTableState.viewKey = viewKey;
      customTableState.data = null;
      customTableState.failed = false;
      customTableState.filters = {};
      customTableState.textFilters = {};
      customTableState.sort = null;
      customTableState.columnsFingerprint = null;
      customTableState.columnWidths = {};
      customTableState.columnOrder = [];
      hideFloatingMsPanel();
    }
    if (customTableState.data) {
      // (2026-07-30, demandé par Nicolas) : si Nicolas modifie le
      // "Paramétrage des colonnes" (roue crantée) pendant que le tableau
      // maison est déjà affiché, on veut que ça se répercute automatiquement
      // — avant ce correctif il fallait rebasculer sur Affichage MyUnisoft
      // puis Affichage Premium pour forcer une reconstruction. On compare
      // juste la liste des libellés natifs visibles (peu coûteux, lecture
      // seule) à celle utilisée pour le dernier rendu ; seule une VRAIE
      // différence déclenche un nouveau renderCustomTable (donc pas de
      // risque de reproduire la boucle infinie du bug v3.9 : cette
      // comparaison ne touche jamais le DOM elle-même).
      const currentFingerprint = getVisibleNativeColumnLabels(parts).join('|');
      const columnsChanged = isNewWrap || currentFingerprint !== customTableState.columnsFingerprint;
      if (columnsChanged) {
        customTableState.columnsFingerprint = currentFingerprint;
        renderCustomTable(wrap);
      }
      return;
    }
    // IMPORTANT (2026-07-30, signalé par Nicolas) : un premier essai a
    // redéclenché l'appel API à CHAQUE passage de scan() (chaque seconde)
    // dès que l'appel échouait, puisque "data" restait null — resultat :
    // des dizaines d'appels identiques envoyés à l'API en boucle en
    // quelques secondes (visible dans la Console : la même erreur
    // TOKENERROR répétée en rafale). "failed" bloque désormais toute
    // nouvelle tentative automatique tant que l'utilisateur n'a pas
    // cliqué sur "Réessayer" (ou rebasculé le bouton "Affichage MyU").
    if (customTableState.failed) {
      if (isNewWrap) renderCustomTableError(wrap, customTableState.lastError);
      return;
    }
    if (customTableState.loading) return;
    customTableState.loading = true;
    wrap.innerHTML = '<div class="tmbc-ct-status">Chargement des données…</div>';
    fetchCustomTableData(viewKey)
      .then((data) => {
        customTableState.loading = false;
        if (!data) {
          customTableState.failed = true;
          customTableState.lastError = 'Impossible de récupérer les données (session/API non détectée).';
          renderCustomTableError(wrap, customTableState.lastError);
          return;
        }
        customTableState.data = data;
        customTableState.columnsFingerprint = getVisibleNativeColumnLabels(parts).join('|');
        renderCustomTable(wrap);
      })
      .catch((err) => {
        customTableState.loading = false;
        customTableState.failed = true;
        customTableState.lastError = err && err.message ? err.message : String(err);
        renderCustomTableError(wrap, customTableState.lastError);
      });
  }


  function renderCustomTableError(wrap, message) {
    wrap.innerHTML =
      '<div class="tmbc-ct-status tmbc-ct-error">Erreur : ' +
      escapeHtmlAttr(message || '') +
      '</div><button type="button" class="tmbc-ct-retry">Réessayer</button>';
    const retryBtn = wrap.querySelector('.tmbc-ct-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        customTableState.failed = false;
        customTableState.lastError = null;
        applyCustomViewState();
      });
    }
  }


  function customViewStorageKey(viewKey) {
    return 'tmbc-custom-view-' + viewKey;
  }

  // (2026-07-30) Par défaut ACTIF (Affichage Premium) — demande de Nicolas :
  // "par défaut, affiche Premium, si on clique sur Affichage MyU, ça passe
  // comme si aucune modif (même fonctionnement que balance)". Donc pas de
  // valeur stockée = actif ; seul un choix explicite de revenir à l'affichage
  // natif ('0') désactive. Reste sans effet sur les vues non couvertes par
  // CUSTOM_TABLE_VIEWS : applyCustomViewState() vérifie ça AVANT de regarder
  // cet indicateur, donc une vue "pas encore paramétrée" reste 100% native
  // quel que soit cet indicateur.
  function isCustomViewActive(viewKey) {
    return localStorage.getItem(customViewStorageKey(viewKey)) !== '0';
  }

  function setCustomViewActive(viewKey, active) {
    if (active) localStorage.removeItem(customViewStorageKey(viewKey));
    else localStorage.setItem(customViewStorageKey(viewKey), '0');
  }


  function findSuiviLoadButton() {
    return Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Charger le tableau');
  }


  const CUSTOM_VIEW_BTN_ID = 'tmbc-custom-view-toggle';


  // Bouton "Affichage Premium" / "Affichage MyUnisoft" (mêmes intitulés et
  // même principe que balance.js) : positionné juste à gauche du bouton
  // natif "Charger le tableau" par simple décalage position:fixed (jamais de
  // déplacement d'un nœud natif).
  function ensureCustomViewToggleButton(viewKey) {
    if (!CUSTOM_TABLE_VIEWS.has(viewKey)) {
      const stale = document.getElementById(CUSTOM_VIEW_BTN_ID);
      if (stale) stale.remove();
      return;
    }
    const loadBtn = findSuiviLoadButton();
    if (!loadBtn) return;

    let btn = document.getElementById(CUSTOM_VIEW_BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = CUSTOM_VIEW_BTN_ID;
      btn.type = 'button';
      btn.style.cssText = [
        'position:fixed',
        'z-index:20',
        'height:30px',
        'padding:0 12px',
        'border-radius:6px',
        'font-size:12px',
        'font-weight:600',
        'cursor:pointer',
      ].join(';');
      btn.addEventListener('click', () => {
        const currentViewKey = currentSuiviViewKey();
        const nowActive = !isCustomViewActive(currentViewKey);
        setCustomViewActive(currentViewKey, nowActive);
        // Réactiver après une précédente tentative en échec = une nouvelle
        // chance explicite demandée par l'utilisateur (pas de retry
        // automatique en boucle, cf. mountCustomTableContainer).
        if (nowActive && customTableState.failed) {
          customTableState.failed = false;
          customTableState.lastError = null;
        }
        applyCustomViewState();
      });
      document.body.appendChild(btn);
    }

    const rect = loadBtn.getBoundingClientRect();
    btn.style.top = rect.top + 'px';
    btn.style.left = rect.left - 8 - 150 + 'px';
    btn.style.width = '150px';

    const active = isCustomViewActive(viewKey);
    const menuColor = detectMenuColor();
    // IMPORTANT (même bug/correctif que mountCustomTableContainer ci-dessus,
    // 2026-07-30) : réassigner .textContent à une valeur IDENTIQUE à chaque
    // passage de scan() remplace quand même le nœud texte interne du bouton
    // -> vu comme une mutation DOM -> redéclenche l'observer -> boucle
    // infinie. On ne touche donc textContent que si la valeur change
    // réellement (bascule effective du bouton).
    // Même intitulés que balance.js : "Affichage MyUnisoft" pour revenir au
    // natif quand Premium est actif, "Affichage Premium" pour l'activer.
    const label = active ? 'Affichage MyUnisoft' : 'Affichage Premium';
    if (btn.textContent !== label) btn.textContent = label;
    btn.style.background = active ? '#fff' : menuColor;
    btn.style.color = active ? menuColor : readableTextOn(menuColor);
    btn.style.border = '1px solid ' + menuColor;
  }


  const CUSTOM_TABLE_COUNT_BADGE_ID = 'tmbc-custom-table-count-badge';


  // (2026-07-30, demandé par Nicolas, après deux tentatives rejetées : un
  // <div> avant la table en v3.26, une ligne de <thead> en v3.27) : "les
  // numeros de dossiers [...] doivent etre sur la meme ligne que les boutons
  // Affichage MyUnisoft" — le compteur "X / Y dossiers" n'a donc plus SA
  // PLACE dans le tableau maison lui-même ; il vit dans la barre d'outils
  // native, ancré comme les autres éléments flottants de cette barre
  // (position:fixed, jamais de déplacement de nœud natif), à gauche de
  // fieldsRow (zone désormais vide depuis que les 4 champs natifs
  // Portefeuille/Expert/Manager/Collaborateur y sont masqués).
  function ensureCustomTableCountBadge(viewKey) {
    if (!CUSTOM_TABLE_VIEWS.has(viewKey) || !isCustomViewActive(viewKey) || !customTableState.data) {
      const stale = document.getElementById(CUSTOM_TABLE_COUNT_BADGE_ID);
      if (stale) stale.remove();
      return;
    }
    const loadBtn = findSuiviLoadButton();
    const fieldsRow = loadBtn && loadBtn.parentElement;
    if (!loadBtn || !fieldsRow) return;

    let badge = document.getElementById(CUSTOM_TABLE_COUNT_BADGE_ID);
    if (!badge) {
      badge = document.createElement('div');
      badge.id = CUSTOM_TABLE_COUNT_BADGE_ID;
      badge.style.cssText = ['position:fixed', 'z-index:20', 'font-size:12px', 'font-weight:700', 'color:#000', 'white-space:nowrap'].join(';');
      document.body.appendChild(badge);
    }
    const fieldsRect = fieldsRow.getBoundingClientRect();
    const loadRect = loadBtn.getBoundingClientRect();
    // Même ligne que "Charger le tableau" (top + hauteur identiques, texte
    // centré verticalement via line-height), tout à gauche de la ligne
    // d'outils (zone laissée vide par le masquage des champs natifs).
    // (2026-07-31) +12px : fieldsRect.left collait exactement le bord gauche
    // du contenu (donc juste contre le menu latéral), le "7" de "751 / 751
    // dossiers" chevauchait visuellement la bordure du menu (capture jointe
    // par Nicolas) — petite marge pour l'en écarter.
    badge.style.top = loadRect.top + 'px';
    badge.style.left = fieldsRect.left + 12 + 'px';
    badge.style.height = loadRect.height + 'px';
    badge.style.lineHeight = loadRect.height + 'px';
    const text = customTableState.countText || '';
    if (badge.textContent !== text) badge.textContent = text;
  }


  function findSuiviToolbarButtons(outerBox) {
    // "selectionManager" contient le champ de recherche/loupe natif + la
    // roue crantée + le menu ⋮ (kebab), dans cet ordre — suffixe de classe
    // stable (comme "gridContainer"/"GridColumn" ailleurs dans ce fichier),
    // le préfixe css-XXXXX généré par Emotion pouvant lui changer.
    const selectionManager = outerBox.querySelector('[class*="selectionManager"]');
    if (!selectionManager) return null;
    const buttons = Array.from(selectionManager.querySelectorAll('button'));
    if (buttons.length < 3) return null;
    return { searchBtn: buttons[0], gearBtn: buttons[1], kebabBtn: buttons[2] };
  }


  // (2026-07-30, demandé par Nicolas) Quand "Affichage Premium" est actif :
  // (1) masque les champs natifs Portefeuille/Expert comptable/Manager/
  // Collaborateur au-dessus du tableau — redondants avec les filtres du
  // tableau maison (capture jointe par Nicolas) ; (2) déplace "Charger le
  // tableau" sur la ligne de la roue crantée, à sa gauche (également demandé
  // par Nicolas). Jamais de déplacement d'un nœud natif hors de son parent :
  // seulement un décalage visuel position:fixed, même principe que
  // positionDrawerNextToContent plus haut dans ce fichier. Le nœud "Charger
  // le tableau" lui-même n'est PAS masqué (on en a encore besoin), seuls ses
  // 4 frères (les champs) le sont. ensureCustomViewToggleButton (notre propre
  // bouton "Affichage Premium"/"Affichage MyUnisoft") s'ancre ensuite sur le
  // nouveau rectangle de "Charger le tableau" — cf. ordre d'appel dans
  // scan(), cette fonction doit tourner AVANT.
  // (2026-07-30, demandé par Nicolas) Trouve le "carton" (MuiPaper) qui
  // contient directement le H1 "Suivi de vos sociétés" — distinct de
  // toolbarWrap (le carton du tableau/filtres juste en dessous), même si les
  // deux partagent la même classe Emotion générée (css-1a0694y-paper, posée
  // sur tout Box ayant le même style — pas un identifiant fiable à lui seul).
  function findSuiviTitleCard() {
    const h1 = Array.from(document.querySelectorAll('h1')).find((el) => el.textContent.trim() === 'Suivi de vos sociétés');
    if (!h1) return null;
    // h1 -> css-10rokvf-container -> css-1a0694y-paper (le "carton" titre)
    return h1.parentElement && h1.parentElement.parentElement;
  }


  // (2026-07-30, demandé par Nicolas) "le trait bleu est toujours là" — le
  // premier essai (border-left sur titleCard/toolbarWrap uniquement) n'a pas
  // suffi. Élargi ici à leurs parents directs (le "carton" MuiPaper englobant)
  // ET à border/outline/box-shadow (un accent coloré peut être posé par l'un
  // ou l'autre selon le composant MUI) — sans certitude absolue sur lequel,
  // faute d'accès direct à l'app Electron de Nicolas pendant cette session
  // (le navigateur Claude in Chrome connecté n'a pas premium.js chargé,
  // __tmbcDebug est undefined) : à confirmer/affiner avec Nicolas si le trait
  // persiste malgré ce correctif élargi.
  function stripLeftAccent(el, apply) {
    if (!el) return;
    // Uniquement border-left/outline — PAS box-shadow, qui porte aussi
    // l'ombre grise du carton (celle-là, Nicolas veut la garder : seul le
    // "trait bleu" doit disparaître).
    if (apply) {
      el.style.setProperty('border-left', 'none', 'important');
      el.style.setProperty('outline', 'none', 'important');
    } else {
      el.style.removeProperty('border-left');
      el.style.removeProperty('outline');
    }
  }


  function applySemaineToolbarLayout(parts, active) {
    const loadBtn = findSuiviLoadButton();
    const fieldsRow = loadBtn && loadBtn.parentElement;
    const toolbarBtns = findSuiviToolbarButtons(parts.outerBox);
    // (2026-07-30, demandé par Nicolas) "toolbarWrap" est le conteneur commun
    // du bloc titre redondant ("Semaine" + icône i, toolbarWrap.children[0])
    // et de fieldsRow (toolbarWrap.children[1]) — masquer ce bloc titre fait
    // remonter naturellement fieldsRow (et donc notre tableau, juste en
    // dessous) sous le H1 "Suivi de vos sociétés", sans déplacer aucun nœud.
    const toolbarWrap = fieldsRow && fieldsRow.parentElement;
    const redundantHeader = toolbarWrap && toolbarWrap.children[0] !== fieldsRow ? toolbarWrap.children[0] : null;
    const titleCard = findSuiviTitleCard();
    const titleOuterCard = titleCard && titleCard.parentElement;
    const toolbarOuterCard = toolbarWrap && toolbarWrap.parentElement;

    if (!active || !loadBtn || !fieldsRow || !toolbarBtns) {
      if (fieldsRow) {
        Array.from(fieldsRow.children).forEach((c) => {
          if (c !== loadBtn) c.style.removeProperty('display');
        });
      }
      if (loadBtn) {
        loadBtn.style.removeProperty('position');
        loadBtn.style.removeProperty('top');
        loadBtn.style.removeProperty('left');
        loadBtn.style.removeProperty('z-index');
      }
      if (redundantHeader) redundantHeader.style.removeProperty('display');
      if (toolbarBtns) toolbarBtns.searchBtn.style.removeProperty('display');
      if (titleCard) {
        titleCard.style.removeProperty('padding-top');
        titleCard.style.removeProperty('padding-bottom');
      }
      stripLeftAccent(titleCard, false);
      stripLeftAccent(titleOuterCard, false);
      stripLeftAccent(toolbarWrap, false);
      stripLeftAccent(toolbarOuterCard, false);
      return;
    }

    // (2026-07-30, demandé par Nicolas) "tu peux encore réduire l'espace
    // entre la bordure grise et le titre Suivi de vos sociétés" + "enleve
    // aussi la ligne bleue sur la bordure grise (à gauche)" — on ne touche
    // qu'au padding vertical et à un éventuel accent coloré, jamais de
    // déplacement/suppression de nœud.
    if (titleCard) {
      titleCard.style.setProperty('padding-top', '6px', 'important');
      titleCard.style.setProperty('padding-bottom', '6px', 'important');
    }
    stripLeftAccent(titleCard, true);
    stripLeftAccent(titleOuterCard, true);
    stripLeftAccent(toolbarWrap, true);
    stripLeftAccent(toolbarOuterCard, true);

    Array.from(fieldsRow.children).forEach((c) => {
      if (c !== loadBtn) c.style.setProperty('display', 'none', 'important');
    });
    // Titre "Semaine" + icône i redondants avec le H1 "Suivi de vos
    // sociétés" juste au-dessus — masqués pour que le tableau maison et ses
    // boutons remontent directement sous ce H1.
    if (redundantHeader) redundantHeader.style.setProperty('display', 'none', 'important');
    // Loupe native : n'a plus lieu d'être, nos propres filtres de colonnes la
    // remplacent.
    toolbarBtns.searchBtn.style.setProperty('display', 'none', 'important');

    if (loadBtn.style.position !== 'fixed') {
      loadBtn.style.setProperty('position', 'fixed', 'important');
      loadBtn.style.setProperty('z-index', '20');
    }
    const gearRect = toolbarBtns.gearBtn.getBoundingClientRect();
    const loadBtnWidth = loadBtn.offsetWidth || 140;
    loadBtn.style.setProperty('top', gearRect.top + 'px', 'important');
    loadBtn.style.setProperty('left', gearRect.left - 8 - loadBtnWidth + 'px', 'important');
  }


  function applyCustomViewState() {
    const viewKey = currentSuiviViewKey();
    const parts = findSuiviGridParts();
    if (!CUSTOM_TABLE_VIEWS.has(viewKey) || !parts) {
      removeCustomTableContainer();
      return;
    }
    if (!isCustomViewActive(viewKey)) {
      restoreNativeGrid(parts);
      applySemaineToolbarLayout(parts, false);
      removeCustomTableContainer();
      return;
    }
    parts.headerContainer.style.setProperty('display', 'none', 'important');
    parts.body.style.setProperty('display', 'none', 'important');
    applySemaineToolbarLayout(parts, true);
    mountCustomTableContainer(parts, viewKey);
  }


  function injectCustomTableStyle() {
    if (document.getElementById('tmbc-custom-table-style')) return;
    const style = document.createElement('style');
    style.id = 'tmbc-custom-table-style';
    style.textContent = `
      /* height (pas max-height) : Nicolas a signalé que le tableau se
         réduisait à la hauteur de son contenu quand un filtre laissait peu
         de lignes, ce qui coupait le panneau de sélection multiple ouvert
         juste en dessous d'un en-tête. Une hauteur fixe garde la même zone
         disponible quel que soit le nombre de lignes filtrées. Le panneau
         de sélection multiple lui-même est en plus sorti du flux normal
         (position:fixed, ancré au bouton, ajouté à document.body — jamais
         un enfant clippé par l'overflow:auto de ce conteneur, cf.
         ensureFloatingMsPanel), donc plus jamais rogné même si peu de
         lignes restent visibles. */
      /* (2026-07-30, demandé par Nicolas) "rajoute 3/4 lignes en plus dans le
         bas du tableau car on a réduit la partie haute" — la partie haute
         (titre/toolbar natifs) ayant été resserrée/masquée par ailleurs, un
         peu plus de hauteur fixe ici redonne l'équivalent de 3-4 lignes de
         plus (~26px/ligne) sans dépendre de la hauteur d'un en-tête variable. */
      .tmbc-ct-wrap { position: relative; width: 100%; height: calc(75vh + 110px); overflow: auto; background: #fff; }
      .tmbc-ct-status { padding: 20px; font-size: 13px; color: #555; }
      .tmbc-ct-status.tmbc-ct-error { color: #c00; }
      .tmbc-ct-retry { margin: 0 8px 8px; padding: 4px 12px; font-size: 12px; border: 1px solid #c00; color: #c00; background: #fff; border-radius: 4px; cursor: pointer; }
      .tmbc-ct-retry:hover { background: #fee; }
      // (2026-07-30, demandé par Nicolas) Le compteur "X / Y dossiers" ne vit
      // plus DU TOUT dans la table (ni <div> avant elle, ni ligne de <thead> —
      // les deux rejetés par Nicolas) : cf. ensureCustomTableCountBadge, un
      // badge flottant (position:fixed) ancré sur la même ligne que "Charger
      // le tableau"/"Affichage Premium", même principe que ces deux boutons.
      table.tmbc-ct-table { border-collapse: collapse; width: max-content; min-width: 100%; font-size: 12px; }
      /* (2026-07-30, demandé par Nicolas) colonnes 100% numériques resserrées
         + alignées à droite plutôt que d'occuper la même largeur qu'une
         colonne texte. */
      .tmbc-ct-table th.tmbc-ct-col-numeric, .tmbc-ct-table td.tmbc-ct-col-numeric { width: 1%; white-space: nowrap; text-align: right; }
      .tmbc-ct-table td.tmbc-ct-col-numeric { padding-right: 10px; }
      .tmbc-ct-table th, .tmbc-ct-table td {
        border: 1px solid #e2e8f0; padding: 4px 8px; white-space: nowrap; text-align: left; vertical-align: middle;
      }
      /* (2026-07-30, demandé par Nicolas) "entete possible sur 2 lignes
         (toutes les colonnes sont centrés en hauteur, que ce soit une ou 2
         lignes)" — l'en-tête (1ère ligne, libellés) peut revenir à la ligne ;
         vertical-align: middle (posé sur la règle générale ci-dessus) centre
         le contenu qu'il tienne sur 1 ou 2 lignes, sans JS supplémentaire. */
      .tmbc-ct-table thead th.tmbc-ct-th { white-space: normal; }
      .tmbc-ct-table thead th.tmbc-ct-th.tmbc-ct-col-capped { white-space: normal; overflow: visible; text-overflow: clip; }
      /* (2026-07-30, correctif) "position: sticky" écrasé par un second
         "position: relative" ajouté par erreur dans cette même règle lors du
         dernier passage — c'est la cause du bug signalé par Nicolas ("les
         entetes ne sont pas figés"), la valeur DÉCLARÉE EN DERNIER dans une
         même règle CSS gagnant toujours en cas de propriété dupliquée. Un
         élément position:sticky sert déjà de bloc de positionnement pour ses
         enfants position:absolute (ex. .tmbc-ct-resizer) : pas besoin d'un
         position:relative séparé. */
      .tmbc-ct-table thead th.tmbc-ct-th { cursor: pointer; user-select: none; background: #f1f5f9; position: sticky; top: 0; z-index: 2; }
      /* (2026-07-30, demandé par Nicolas) "on fige les entete quand on
         utilise l'ascenseur" : la 2e ligne (filtres) doit rester collée juste
         sous la 1ère, dont la hauteur varie maintenant (1 ou 2 lignes) — le
         "top" exact est posé dynamiquement en JS (cf. renderCustomTable,
         mesure de la hauteur réelle de la 1ère ligne après rendu) plutôt
         qu'une valeur fixe qui ne collerait qu'à une hauteur d'en-tête donnée. */
      .tmbc-ct-table thead tr:nth-child(2) th { background: #f8fafc; position: sticky; z-index: 2; }
      /* (2026-07-30, demandé par Nicolas) Colonnes avec une largeur imposée
         (préconisation du catalogue, ex. Dossier 40 caract., ou
         redimensionnement manuel) : on tronque avec une ellipse plutôt que de
         laisser le contenu forcer la colonne à s'élargir. */
      .tmbc-ct-table th.tmbc-ct-col-capped, .tmbc-ct-table td.tmbc-ct-col-capped {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      /* (2026-07-30, demandé par Nicolas) Centrage pour Expert comptable,
         Manager, Collab., Clôture N, Echéance TVA, TVA. */
      .tmbc-ct-table th.tmbc-ct-centered, .tmbc-ct-table td.tmbc-ct-centered { text-align: center; }
      .tmbc-ct-th-label { pointer-events: none; }
      /* (2026-07-30, demandé par Nicolas) Poignée de redimensionnement manuel
         des colonnes — même principe que .tmb-col-resizer dans balance.js,
         adapté ici à un <colgroup> partagé par l'en-tête, la ligne de filtres
         et le corps du tableau (donc un seul <col> à ajuster redimensionne
         les trois lignes d'un coup). */
      .tmbc-ct-resizer {
        position: absolute; top: 0; right: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 3;
      }
      .tmbc-ct-resizer:hover, .tmbc-ct-resizer:active { background: rgba(37, 99, 235, 0.35); }
      /* (2026-07-30, demandé par Nicolas) Glisser-déposer d'un en-tête pour
         réordonner les colonnes — curseur "grab" sur l'en-tête (mais pas sur
         la poignée de redimensionnement, qui garde col-resize), surbrillance
         de la colonne cible pendant le survol en cours de glissement. */
      .tmbc-ct-table thead th.tmbc-ct-th { cursor: grab; }
      .tmbc-ct-table thead th.tmbc-ct-th .tmbc-ct-resizer { cursor: col-resize; }
      .tmbc-ct-table thead th.tmbc-ct-th.tmbc-ct-th-dragover { outline: 2px dashed #2563eb; outline-offset: -2px; }
      /* (2026-07-30, demandé par Nicolas) Valeurs cliquables dans
         Portefeuille/Expert comptable/Manager/Collab. -> filtrent la colonne
         sur cette seule valeur au clic. */
      /* (2026-07-30, demandé par Nicolas) "ne soulignes pas les liens vers
         des pointillés, tu souligne lorsqu'on passe dessus" — pas de
         soulignement par défaut, seulement au survol. Vaut aussi pour le
         lien Dossier/Référence dossier (tmbc-ct-society-link). */
      .tmbc-ct-token, .tmbc-ct-society-link { cursor: pointer; text-decoration: none; }
      .tmbc-ct-token:hover, .tmbc-ct-society-link:hover { text-decoration: underline solid; color: #1d4ed8; }
      .tmbc-ct-token-sep { color: #94a3b8; }
      .tmbc-ct-table tbody tr:nth-child(even) { background: #fafbfc; }
      .tmbc-ct-table tbody tr:hover { background: #eef4ff; }
      /* (2026-07-30, correctif signalé par Nicolas) : les colonnes à largeur
         imposée (8ch, ex. Expert comptable/Manager/Collab.) s'élargissaient
         bien au-delà malgré widthCh — deux causes cumulées : (1)
         .tmbc-ct-text-filter (le nouveau champ + bouton flèche) n'avait
         AUCUNE règle CSS du tout, donc rendu à la largeur par défaut du
         navigateur pour un <input> (bien plus large que 8 caract.) ; (2) même
         avec une largeur déclarée, un <input> dans un conteneur flex a par
         défaut un min-width basé sur son contenu, qui l'empêche de rétrécir
         sous cette taille intrinsèque — min-width:0 lève cette limite. */
      .tmbc-ct-filter-wrap { display: flex; align-items: center; gap: 2px; min-width: 0; }
      .tmbc-ct-filter, .tmbc-ct-text-filter {
        width: 100%; min-width: 0; box-sizing: border-box; font-size: 11px; padding: 2px 4px;
        border: 1px solid #cbd5e1; border-radius: 4px;
      }
      .tmbc-ct-ms { display: flex; align-items: center; gap: 2px; }
      /* (2026-07-30, demandé par Nicolas) "la colonne TVA doit etre centré" —
         text-align:center posé sur le <th> n'a aucun effet sur .tmbc-ct-ms,
         qui est un conteneur flex (le bouton "Tous"/n sélectionné(s) partait
         donc toujours à gauche malgré la classe tmbc-ct-centered) ; il faut
         centrer explicitement le conteneur flex lui-même. */
      th.tmbc-ct-centered .tmbc-ct-ms { justify-content: center; }
      .tmbc-ct-clear {
        flex: 0 0 auto; border: none; background: none; color: #c00; font-weight: 700; font-size: 13px;
        line-height: 1; cursor: pointer; padding: 0 3px;
      }
      .tmbc-ct-clear:hover { background: #fee; border-radius: 3px; }
      .tmbc-ct-ms { position: relative; }
      .tmbc-ct-ms-btn { font-size: 11px; padding: 2px 6px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer; white-space: nowrap; }
      /* (2026-07-30, demandé par Nicolas) Portefeuille/Expert comptable/
         Manager/Collab. : champ filtre "classique" + petit bouton flèche à
         côté pour ouvrir la sélection multiple à cases à cocher. */
      .tmbc-ct-ms-arrow {
        flex: 0 0 auto; font-size: 10px; padding: 2px 5px; border: 1px solid #cbd5e1; border-radius: 4px;
        background: #fff; cursor: pointer; line-height: 1;
      }
      .tmbc-ct-ms-arrow:hover { background: #f1f5f9; }
      /* position:fixed + ajouté à document.body (cf. ensureFloatingMsPanel) —
         jamais un enfant de .tmbc-ct-wrap, qui a overflow:auto et rognerait
         ce panneau dès qu'il dépasse la zone visible (bug signalé par
         Nicolas). */
      #tmbc-ct-floating-ms-panel {
        position: fixed; z-index: 100000; background: #fff; border: 1px solid #cbd5e1;
        border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,.2); padding: 6px; max-height: 260px; overflow: auto;
        min-width: 160px; display: none;
      }
      #tmbc-ct-floating-ms-panel label { display: block; font-size: 11px; white-space: nowrap; padding: 2px 4px; cursor: pointer; }
      #tmbc-ct-floating-ms-panel label:hover { background: #eef4ff; }
    `;
    document.head.appendChild(style);
  }


  // --- Orchestrateur du module, enregistré auprès du core ---------------
  // Gating + ordre d'appel identiques à premium.js 3.31 : applyCustomViewState()
  // doit tourner AVANT ensureCustomViewToggleButton() (elle repositionne
  // d'abord le bouton natif "Charger le tableau", sur lequel notre propre
  // bouton doit ensuite s'ancrer à jour) — ordre préservé tel quel.
  let debugHookExtended = false;

  function scanSuiviSemaine() {
    if (isDisabled()) return;
    if (!debugHookExtended) {
      debugHookExtended = true;
      extendDebugHook({
        // Ex. : await window.__tmbcDebug.retry('semaine')
        retry: (viewKey) => fetchCustomTableData(viewKey || currentSuiviViewKey()),
        state: () => customTableState,
      });
    }
    injectCustomTableStyle();
    applyCustomViewState();
    ensureCustomViewToggleButton(currentSuiviViewKey());
    ensureCustomTableCountBadge(currentSuiviViewKey());
  }

  registerScan(scanSuiviSemaine);
})();
