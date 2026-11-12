// ==UserScript==
// @name         MyUnisoft - Consultation Premium (page de consultation de compte maison)
// @namespace    https://nicolas.chassard/myunisoft
// @version      2.11-ext
// @description  v2.11 (2026-11-12, demandé par Nicolas) : colonne Lettrage placée entre Débit et Crédit (ordre par défaut ;
//               un ordre de colonnes déjà mémorisé est migré une fois, les déplacements faits ensuite restent respectés).
//               v2.10 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — diagnostic téléchargé en diag-N.txt (ATM.diag) au lieu de l'IPC Electron.
//               v2.9 (2026-10-30, retours de Nicolas) : (1) ajustement automatique des colonnes : largeurs désormais MESURÉES dans le DOM (vrais styles des cellules, signe « - » et espaces des milliers compris) au lieu d'une estimation, avec marge ; (2) code journal (et lettrage, pièce, libellé, saisi par) traités comme du texte : un autre script de l'appli reformatait les valeurs 100 % numériques (ex. journal « 99 ») en chiffres alignés à droite -> séparateur invisible ajouté.
//               v2.8 (2026-10-30, demandé par Nicolas) : sélection à la souris : un clic sur une ligne la coche (et décoche les autres) ; Ctrl+clic ajoute/retire une ligne ; Maj+clic coche toutes les lignes entre la dernière ligne cliquée et celle-ci (Ctrl+Maj+clic : les ajoute à la sélection) ; Maj+clic sur une case à cocher fait de même.
//               v2.7 (2026-10-30, demandé par Nicolas) : période par défaut = exercice N (celui qui contient aujourd'hui) + N+1 s'il existe, sans N-1 : exercices lus par GET /exercices?society_id= (appel natif relevé, réponse lue de façon tolérante) ; repli sur l'année civile en cours. La dernière période utilisée n'est plus réappliquée à l'ouverture.
//               v2.6 (2026-10-30, retours de Nicolas) : (1) comptes de contrepartie en TEXTE à gauche (un autre script reformatait les numéros seuls en chiffres : séparateur ajouté pour l'éviter) ; (2) contreparties seulement pour les journaux achats/ventes (AC, ACH, 60, VE, VT, VEN, 70) ; (3) colonne Pièce placée entre Montant signé et Compte TTC ; (4) colonnes déplaçables : glisser-déposer de l'en-tête (ordre mémorisé) ; (5) double-clic sur une poignée de largeur = ajustement automatique de toutes les colonnes (sauf Commentaire) ; (6) la barre Débit/Crédit/Solde du haut porte sur le compte complet (sans les filtres). Lignes de totaux et de sous-totaux désormais construites colonne par colonne (suivent l'ordre choisi).
//               v2.5 (2026-10-30, diag de Nicolas lu) : contreparties : POST /entries/v2 répondait HTTP 500 « GBL1 » (même pour une seule écriture) quand l'appli native n'avait pas juste avant appelé GET /entries/default_filter?etablissement_id=<dossier> (état de filtre côté serveur) : cet appel natif est désormais fait avant la lecture (et rejoué une fois sur erreur 500), avec l'en-tête society-id du dossier courant.
//               v2.4 (2026-10-30, retours de Nicolas) : contreparties : 3 colonnes fixes « Compte TTC », « Compte HT », « Compte TVA » (texte, plus de format chiffre) ; seules les contreparties pertinentes sont remplies selon le compte affiché : 6 ou 7 -> TTC + TVA ; 40x/41x (ex. 401) -> HT (6/7, et 2) + TVA ; 445 -> HT + TTC ; autre -> vide.
//               v2.3 (2026-10-30, demandé par Nicolas) : colonnes de CONTREPARTIE : compte 7 -> TTC (411…) et TVA (445…) ; compte 6 -> TTC (401…) et TVA (445…) ; compte 445 -> HT (6/7) et TTC (401/411) ; autre compte -> colonnes vides. Numéros de comptes cliquables (ouvrent ce compte dans la consultation premium), survol = liste de tous les comptes de l'écriture (avec liens) ; plusieurs comptes -> « premier +n ». Lecture des écritures par POST /entries/v2 (appel natif relevé), en arrière-plan, par paquets, mémorisée ; filtrable et triable.
//               v2.2 (2026-10-30, retours de Nicolas) : (1) « Filtre de comptes : Grand livre : HTTP 400 » = jeton expiré sur l'appel grand livre : il utilise désormais le jeton le plus récent (grand-livre.js >= 1.15) et, sur erreur de jeton, attend un jeton frais puis réessaie ; (2) totaux (barre, TOTAUX, dont non lettré, SÉLECTION, sous-totaux) : alignement à droite forcé par CSS (!important) ; (3) survol PJ : diagnostic ajouté (Ctrl+Alt+J).
//               v2.1 (2026-10-30, retours de Nicolas) : (1) à la réouverture, retour sur le dernier compte consulté (mémorisé par dossier) ; (2) à l'ouverture, le curseur est sur le champ Compte (Tab passe aux champs suivants) ; (3) filtre de comptes : « Tous les fournisseurs » en tête du groupe Fournisseurs, « Tous les clients » en tête du groupe Clients, groupe « Plan comptable » remplacé par « Comptes généraux » ; (4) totaux : Débit/Crédit/Solde de la barre et des lignes TOTAUX alignés à droite.
//               v2.0 (2026-10-30, diag-1..5 lus) : (1) Ctrl+F7 lettre réellement : PUT /entry/lettering {lettering:<code suivant>, line_entry_list:[{line_entry_id}]} (code = suivant le plus grand code du compte, AAA, AAB…) après contrôle d'équilibre et confirmation ; (2) clic droit PJ > Supprimer : DELETE /document {document_id:[id], location:"ENTRIES", object_id:<écriture>} ; (3) double-clic / Entrée : l'écriture s'ouvre en modification dans la fenêtre de consultation native (celle qui se scinde avec le volet écriture, comme dans ton diagnostic : entries/v2 filtre id_entry) — ouverture de la fenêtre nommée sur le compte puis double-clic automatique sur la ligne (date souple jj/mm/aa ou aaaa, montant, journal) avec journal des essais dans Ctrl+Alt+J et message si la ligne n'est pas trouvée.
//               v1.9 (2026-10-30, diag-2 lu) : (1) jeton : le panneau lit désormais (passivement, sans jamais rejouer ce refresh) la réponse du renouvellement de session de l'appli (auth.myunisoft.fr .../openid-connect/token) et utilise toujours le jeton le plus récent (lecture du champ iat) parmi ceux relevés -> fin des "Token expiré" / chargements sans fin des commentaires ; (2) Ctrl+F7 : lettrage des écritures non lettrées sélectionnées si elles sont équilibrées (appel natif de lettrage à relever, voir message) ; (3) clic droit sur la cellule PJ : Ajouter / Ouvrir / Supprimer (suppression : appel natif à relever) ; (4) diagnostic : relevé des navigations (pushState, postMessage, BroadcastChannel, storage, window.open) pour retrouver comment l'appli ouvre une écriture en modification.
//               v1.8 (2026-10-30, appels natifs lus dans diag-3/4) : (1) commentaires : modifier = PUT /comments/<id> {location, entry_id, comment}, supprimer = DELETE /comments/<id> (boutons dans la bulle des commentaires d'écriture ; champs de compte : texte modifié + Entrée = modifier le dernier commentaire, champ vidé = supprimer avec confirmation) ; (2) F7 délettre : PUT /entry/lettering {lettering:"", line_entry_list:[{line_entry_id}...]} sur TOUTES les lignes du lettrage de la sélection (confirmation) ; (3) PJ : indicateur lu dans documents.totaldocs de la ligne ; Inser / Ctrl+Insert / clic sur une cellule PJ vide ouvrent le choix du fichier (écouteur aussi posé sur window pour passer avant l'appli).
//               v1.7 (2026-10-30, retours de Nicolas, diag-2 lu) : (1) "Token expiré" / "invalid token" (cause des erreurs 400/401/404 en parcourant les comptes) : nos propres appels ne réécrasent plus le jeton relevé (marqueur __tmbcOwn, avec premium.js 4.x patché), et sur jeton expiré le panneau attend un jeton frais d'un appel natif (focus simulé pour provoquer un rafraîchissement) puis réessaie ; (2) champs réels des lignes (diag) : libellé = intitule_ligne, échéance = date_echeance, Saisi par = creator {prenom, nom}, id de ligne = idligneecriture, commentaire d'écriture lu directement dans la ligne (plus d'appel par écriture) ; (3) filtres de comptes : Fournisseurs / Clients / Généraux / 6 et 7 uniquement ; (4) commentaire annuel avant le permanent ; (5) pas de fenêtre d'aperçu vide sans pièce jointe ; (6) F7 : délettrage (appel natif à relever, voir message) ; (7) Inser : message explicite.
//               v1.6 (2026-10-30, retours de Nicolas, appels natifs lus dans diag-2) : (1) commentaires de compte branchés sur ceux de MyUnisoft (dossier annuel) : GET /comments?account_id=ID (permanent) et ...&dossier_revision_id=ID (annuel de l'exercice), écriture par POST /comments {location:PERMANENT_ACCOUNT | ACCOUNT, account_id, [dossier_revision_id], comment, summary:false} ; le dossier_revision_id de l'exercice est relevé sur les appels natifs (jamais recalculé) ; (2) Sous-total mensuel en 3 états : sous-totaux + détail / sous-totaux seuls / affichage normal ; (3) erreur 404 en parcourant les comptes : l'erreur réelle du serveur est désormais remontée (elle était masquée par un second essai sur un autre hôte) ; (4) double-clic : retour à l'ouverture de l'écriture dans la saisie via la recherche native, repérage de la ligne élargi (date + montant + journal, sans le n° de compte absent des résultats) ; (5) Saisi par : recherche élargie du champ + relevé de la première ligne brute dans le diagnostic Ctrl+Alt+J.
//               v1.5 (2026-10-30, retours de Nicolas) : (1) icône PJ affichée seulement si une pièce est attachée ; (2) Inser : sans ligne active, agit sur la première ligne (et message clair si l'écriture n'a pas d'identifiant) ; (3) Alt+C depuis la saisie : ouvre directement le compte de la ligne en cours de saisie ; (4) Ctrl+W ferme la Consultation Premium ; (5) accessible uniquement quand un dossier est ouvert (menu + Alt+C masqués sur Accueil) ; (6) panneau passé au-dessus des éléments natifs qui transparaissaient (Mois / 12/2026) ; (7) barre Débit/Crédit/Solde limitée à la largeur du tableau (plus collée au bord droit des grands écrans).
//               v1.4 (2026-10-30, retours de Nicolas) : colonnes redimensionnables (poignée à droite de chaque en-tête, largeurs mémorisées) et Libellé réduit par défaut (~40 car.) ; Alt+C ouvre Consultation Premium ; colonne Commentaire sans icône (texte seul) ; PJ placée entre Pièce et Échéance ; CJ -> Journal, Lett. -> Lettrage ; colonne Saisi par ; bouton Sous-total mensuel (sous-totaux Débit/Crédit par mois, tri par date) ; champ Commentaire du compte à côté de Du/Au (mémorisé localement) ; HTTP 401/400 après un moment : le jeton natif est rafraîchi/attendu avant un nouvel essai et le message d'erreur est explicite ; tri conservé quand un filtre est actif.
//               v1.3 (2026-10-30, retours de Nicolas) : (1) appels /api/v1/core : HTTP 401 "invalid token" sur prod-ws -> le script mémorise désormais l'hôte ET les en-têtes (jeton) des propres appels /api/v1/* de l'appli native (vus passer, jamais rejoués à l'identique : seulement réutilisés pour nos requêtes) ; (2) soldes dans la liste de comptes : lecture tolérante des champs de la balance (nombres ou chaînes) ; (3) filtres de montants non restrictifs : sans opérateur, "2" affiche tout montant CONTENANT 2 (120, 201…) ; opérateurs > >= < <= = <> et intervalles inchangés ; (4) totaux Débit/Crédit (+ non lettré, + sélection) affichés juste sous la dernière ligne du tableau ; (5) Ctrl+A sélectionne toutes les écritures affichées ; (6) double-clic = ouvre la ligne dans la fenêtre de consultation native (route /child/consulting, lettrage "toutes") et y double-clique la ligne pour lancer la modification de l'écriture (au lieu de la recherche d'écritures) ; (7) journal des appels : en-têtes (noms) des appels /api/v1.
//               v1.2 (2026-10-30, diag de Nicolas lu : appels natifs de la consultation classique) : (1) lignes d'un compte lues comme la consultation native : POST /api/v1/core/accounting/entry/searchConsulting (idEtablissement, startDate, endDate, entryType NORMAL, searchType consulting, fetchDocuments, fetchTotals, accountIds, page, resultPerPage 200, tri date_piece) -> id d'écriture, pièces, etc. ; liste des comptes : POST /api/v1/core/accounting/account/search ; le grand livre Excel ne sert plus que de repli et aux filtres de comptes ; (2) PJ : survol = aperçu grand format de la pièce (GET /document/all_types?location=ENTRIES&objectId=<id_ecriture>, miniature GED agrandie comme dans la saisie premium), clic = ouvre la pièce ; Inser = choisir un fichier et le déposer (POST /document/add_all_types, appel confirmé en saisie premium) ; (3) Commentaire : GET/POST /comments (confirmés en saisie premium), saisie directe dans une bulle (Ctrl+Entrée pour enregistrer) ; texte du dernier commentaire affiché dans la colonne (préchargement plafonné).
//               v1.1 (2026-10-30, retours de Nicolas) : (1) intégré dans la zone de contenu (à droite du menu bleu, sous les onglets) au lieu d'un plein écran ; (2) libellés d'écritures TOUJOURS en majuscules ; (3) boutons Année retirés (reste Du/Au) ; (4) ouvre directement le 1er compte ; (5) Ctrl+← / Ctrl+→ = compte précédent / suivant ; (6) liste déroulante de comptes maison avec le SOLDE de chaque compte, limitée aux comptes du filtre actif ; (7) nouvelle colonne "Montant signé" (débit +, crédit −) avec filtre normal et filtre en valeur absolue (abs=100, abs>=200) ; (8) double-clic / Inser corrigés (plus de reconstruction du tableau au clic, retour visible en cas d'erreur) ; (9) colonnes PJ et Commentaire prêtes à brancher, journal des appels API enrichi (Ctrl+Alt+J) pour relever les appels natifs d'aperçu de pièce et de commentaire.
//               v1.0 (2026-10-30, demandé par Nicolas, maquette validée) : nouvelle entrée "Consultation Premium"
//               dans le menu Tenue (entre "Consultation" et "Ancienne consultation") qui ouvre un panneau
//               plein écran DESSINÉ PAR NOUS (aucune manipulation du tableau natif) :
//               - données : GET /grand_livre (xls=true, un compte, jeton + cookies) lu via
//                 window.TMBC_GL.fetchLedgerRaw (grand-livre.js >= 1.11) ; colonnes repérées par leurs EN-TÊTES
//                 (Date, Journal, Pièce, Lettrage, Intitulé, Débit, Crédit + Échéance / Commentaire / PJ si
//                 le classeur les contient) ; solde cumulé recalculé ;
//               - sélection : compte (liste + saisie), flèches ◀ ▶, période Du/Au, filtre de comptes
//                 (fournisseurs / clients : débits ou crédits non lettrés, solde proche de 0 (|solde| <= 1,
//                 hors 0), factures non soldées depuis plus de 60 j, débiteurs / créditeurs, intitulé vide) ;
//               - lettrage Toutes / Non lettrées / Lettrées (F12 fait défiler), tri par colonne (clic),
//                 filtre sous chaque colonne (jokers * et ?, > >= < <= = <> et intervalles a..b sur les montants
//                 et dates), recherche par montant (avec tolérance) et recherche globale ;
//               - totaux affichés + totaux de la sélection (cases à cocher) + non lettré ;
//               - double-clic ou Entrée : ouvre l'écriture dans la saisie (recherche native, comme le grand livre) ;
//               - Inser : ouvre l'écriture pour y joindre la pièce ; survol PJ : info-bulle (aperçu : appel natif
//                 à identifier, cf. diagnostic Ctrl+Alt+J) ;
//               - Export Excel (.xlsx écrit sans bibliothèque) de ce qui est affiché, Impression.
//               Diagnostic temporaire : Ctrl+Alt+J écrit un diag-N.txt (en-têtes du classeur, premières lignes,
//               derniers appels API vus) pour brancher commentaires / PJ sur les vrais appels natifs.
// @author       Nicolas
// @match        https://connect.lgassocies.com/*
// @match        https://*.myunisoft.fr/*
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const { isDisabled, registerScan, MONO_FONT_STACK } = window.TMBC;
  const MONO = MONO_FONT_STACK || 'Consolas, "Courier New", monospace';

  const PANEL_ID = 'tmbc-cp-panel';
  const BACK_ID = 'tmbc-cp-back';
  const LI_ID = 'menu-item-consultationPremium';
  const NATIVE_CONSULT_SELECTOR = 'li[data-id="menu-item-accountConsultation"]';
  const MAX_LINES = 5000;
  const SIDE_RANGE = { fourn: { range: '40-409999', subtype: '2' }, client: { range: '41-419999', subtype: '1' } };

  // ------------------------------------------------------------------
  // Utilitaires purs (testables)
  // ------------------------------------------------------------------
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const r2 = (n) => Math.round(n * 100) / 100;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isoToFr = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
  function frToIso(t) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(String(t || '').trim());
    if (!m) return '';
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  }
  function excelDateToIso(v) {
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    }
    const s = String(v == null ? '' : v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return frToIso(s);
  }
  function parseNum(t) {
    const s = String(t).trim().replace(/\s| | /g, '').replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
  }

  // Texte : sans * ni ? => "contient" ; sinon motif ancré. Insensible casse / accents.
  function textMatcher(pat) {
    pat = norm(pat).trim();
    if (!pat) return null;
    if (/[*?]/.test(pat)) {
      const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      return (v) => re.test(norm(v));
    }
    return (v) => norm(v).indexOf(pat) !== -1;
  }
  // Nombre : > >= < <= = <> et a..b
  function numMatcher(expr) {
    const e = String(expr || '').trim().replace(/\s| /g, '');
    if (!e) return null;
    let m = /^(-?[\d.,]+)\.\.(-?[\d.,]+)$/.exec(e.replace(/,/g, '.').replace(/\.\.(?=-?\d)/, '..'));
    if (m) {
      const a = parseNum(m[1]), b = parseNum(m[2]);
      if (!isNaN(a) && !isNaN(b)) return (n) => n >= Math.min(a, b) - 0.0049 && n <= Math.max(a, b) + 0.0049;
    }
    m = /^(>=|<=|<>|!=|>|<|=)?(-?[\d.,]+)$/.exec(e);
    if (!m) return null;
    const v = parseNum(m[2]);
    if (isNaN(v)) return null;
    const op = m[1] || '';
    if (!op) {
      // sans opérateur : "contient" (taper 2 affiche 120, 201, 2 500,00…)
      const typed = m[2].replace('.', ',');
      return (n) => fmt(n).replace(/[\s\u00a0\u202f]/g, '').indexOf(typed) !== -1;
    }
    if (op === '>') return (n) => n > v + 0.0049;
    if (op === '>=') return (n) => n >= v - 0.0049;
    if (op === '<') return (n) => n < v - 0.0049;
    if (op === '<=') return (n) => n <= v + 0.0049;
    if (op === '<>' || op === '!=') return (n) => Math.abs(n - v) > 0.0049;
    return (n) => Math.abs(n - v) < 0.0049;
  }
  // Montant signé : filtre normal, ou en valeur absolue avec le préfixe abs (abs=100, abs>=200, abs100..300)
  function msMatcher(expr) {
    const e = String(expr || '').trim();
    if (!e) return null;
    const m = /^abs\s*(.*)$/i.exec(e);
    if (m) {
      const inner = numMatcher(m[1] || '');
      return inner ? (n) => inner(Math.abs(n)) : null;
    }
    return numMatcher(e);
  }
  // Date (ISO) : op + jj/mm/aaaa, mm/aaaa (= le mois), a..b, sinon "contient" sur jj/mm/aaaa
  function dateMatcher(expr) {
    const e = String(expr || '').trim();
    if (!e) return null;
    const m1 = /^(.+?)\.\.(.+)$/.exec(e);
    if (m1 && frToIso(m1[1]) && frToIso(m1[2])) {
      const a = frToIso(m1[1]), b = frToIso(m1[2]);
      return (iso) => iso >= a && iso <= b;
    }
    const m = /^(>=|<=|<>|>|<|=)?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\/\d{4})$/.exec(e);
    if (m) {
      const op = m[1] || '=';
      if (/^\d{1,2}\/\d{4}$/.test(m[2])) {
        const [mm, yy] = m[2].split('/');
        const ym = yy + '-' + mm.padStart(2, '0');
        if (op === '=') return (iso) => iso.slice(0, 7) === ym;
        if (op === '>=' || op === '>') return (iso) => (op === '>' ? iso.slice(0, 7) > ym : iso.slice(0, 7) >= ym);
        if (op === '<=' || op === '<') return (iso) => (op === '<' ? iso.slice(0, 7) < ym : iso.slice(0, 7) <= ym);
        return (iso) => iso.slice(0, 7) !== ym;
      }
      const d = frToIso(m[2]);
      if (op === '>') return (iso) => iso > d;
      if (op === '>=') return (iso) => iso >= d;
      if (op === '<') return (iso) => iso < d;
      if (op === '<=') return (iso) => iso <= d;
      if (op === '<>') return (iso) => iso !== d;
      return (iso) => iso === d;
    }
    const tm = textMatcher(e);
    return tm ? (iso) => tm(isoToFr(iso)) : null;
  }

  // ------------------------------------------------------------------
  // Lecture du classeur du grand livre : colonnes repérées par leurs en-têtes
  // ------------------------------------------------------------------
  function mapHeader(hdr) {
    const m = {};
    Object.keys(hdr).forEach((col) => {
      const t = norm(hdr[col]).trim();
      if (/^compte$/.test(t)) m.acc = col;
      else if (/intitule compte/.test(t)) m.accLabel = col;
      else if (/^date/.test(t)) m.date = col;
      else if (/^(journal|jnl|jal|cj)/.test(t)) m.jnl = col;
      else if (/^piece 2|^piece2/.test(t)) m.piece2 = col;
      else if (/^piece/.test(t)) m.piece = col;
      else if (/lettr/.test(t)) m.lett = col;
      else if (/^(intitule|libelle)$/.test(t)) m.lib = col;
      else if (/^debit/.test(t)) m.deb = col;
      else if (/^credit/.test(t)) m.cre = col;
      else if (/^solde/.test(t)) m.solde = col;
      else if (/echeance/.test(t)) m.ech = col;
      else if (/comment/.test(t)) m.com = col;
      else if (/^pj$|piece.?jointe|document|attach/.test(t)) m.pj = col;
    });
    return m;
  }
  // Retourne { cols, accounts: { num: {num,label,lines:[…]} }, order:[num], headerFound }
  function parseLedgerRows(rows) {
    let cols = null;
    let headerFound = false;
    for (const row of rows) {
      const c = row.c;
      if (c.A === 'Compte' || Object.keys(c).some((k) => /^intitule compte$/.test(norm(c[k]).trim()))) {
        cols = mapHeader(c);
        headerFound = true;
        break;
      }
    }
    if (!cols) cols = { acc: 'A', accLabel: 'B', date: 'C', jnl: 'D', piece: 'E', piece2: 'F', lett: 'G', lib: 'H', deb: 'I', cre: 'J', solde: 'K' };
    const accounts = {};
    const order = [];
    let cur = null;
    let last = null;
    let seq = 0;
    let started = !headerFound;
    for (const row of rows) {
      const c = row.c;
      if (!started) {
        if (c === undefined) continue;
        if (c.A === 'Compte' || Object.keys(c).some((k) => /^intitule compte$/.test(norm(c[k]).trim()))) started = true;
        continue;
      }
      const num = c[cols.acc] !== undefined ? String(c[cols.acc]).trim() : '';
      const txt = (k) => (cols[k] && c[cols[k]] !== undefined ? String(c[cols[k]]) : '');
      const nm = (k) => (cols[k] && typeof c[cols[k]] === 'number' ? c[cols[k]] : 0);
      if (num) {
        if (!accounts[num]) { accounts[num] = { num, label: txt('accLabel').trim(), lines: [] }; order.push(num); }
        cur = accounts[num];
        const iso = excelDateToIso(cols.date ? c[cols.date] : '');
        last = {
          id: ++seq, acc: num, date: iso, dateTxt: iso ? isoToFr(iso) : txt('date'),
          jnl: txt('jnl'), piece: txt('piece'), piece2: txt('piece2'), lett: txt('lett').trim(), lib: txt('lib').toUpperCase(),
          d: nm('deb'), c: nm('cre'), ech: cols.ech ? excelDateToIso(c[cols.ech]) : '', com: txt('com'),
          pj: cols.pj ? (parseFloat(c[cols.pj]) > 0 || /oui|x|1/i.test(txt('pj'))) : false,
        };
        last.ms = r2(last.d - last.c);
        cur.lines.push(last);
      } else if (last && !(c[cols.lib] && /^solde du compte/i.test(String(c[cols.lib])))) {
        // ligne de commentaire sous l'écriture (cas où l'option commentaire insère une ligne) : rattachée à la précédente
        const extra = Object.keys(c).map((k) => String(c[k])).join(' ').trim();
        if (extra && cols.com === undefined && !/^total|^solde/i.test(extra)) last.com = (last.com ? last.com + ' ' : '') + extra;
      }
    }
    return { cols, accounts, order, headerFound };
  }

  // Solde cumulé chronologique (ordre date puis ordre d'origine)
  function withRunningBalance(lines) {
    const ord = lines.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
    let run = 0;
    ord.forEach((l) => { run = r2(run + l.d - l.c); l.solde = run; });
    return lines;
  }

  // ------------------------------------------------------------------
  // Filtres de comptes (fournisseurs / clients)
  // ------------------------------------------------------------------
  const ACC_MODES = [
    { key: 'fall', side: 'fourn', label: 'Tous les fournisseurs', test: () => true },
    { key: 'fnl', side: 'fourn', label: 'Fourn. débits non lettrés', test: (a) => a.lines.some((l) => !l.lett && l.d > 0) },
    { key: 'fz', side: 'fourn', label: 'Fourn. solde proche de 0 (entre -1 et 1)', test: (a) => Math.abs(a.solde) > 0.004 && Math.abs(a.solde) <= 1.004 },
    { key: 'f60', side: 'fourn', label: 'Fourn. factures non soldées depuis plus de 60 j', test: (a, cut) => a.lines.some((l) => !l.lett && l.c > 0 && (l.date || '9') < cut) },
    { key: 'fdeb', side: 'fourn', label: 'Fourn. débiteurs', test: (a) => a.solde > 0.004 },
    { key: 'fvide', side: 'fourn', label: 'Fourn. avec intitulé de compte vide', test: (a) => !a.label },
    { key: 'call', side: 'client', label: 'Tous les clients', test: () => true },
    { key: 'cnl', side: 'client', label: 'Clients crédits non lettrés', test: (a) => a.lines.some((l) => !l.lett && l.c > 0) },
    { key: 'cz', side: 'client', label: 'Clients solde proche de 0 (entre -1 et 1)', test: (a) => Math.abs(a.solde) > 0.004 && Math.abs(a.solde) <= 1.004 },
    { key: 'c60', side: 'client', label: 'Clients factures non soldées depuis plus de 60 j', test: (a, cut) => a.lines.some((l) => !l.lett && l.d > 0 && (l.date || '9') < cut) },
    { key: 'ccred', side: 'client', label: 'Clients créditeurs', test: (a) => a.solde < -0.004 },
    { key: 'cvide', side: 'client', label: 'Clients avec intitulé de compte vide', test: (a) => !a.label },
    { key: 'pg', side: 'plan', label: 'Tous les comptes généraux', test: (a) => /^\d+$/.test(a.num) && !/^(40|41)/.test(a.num) },
    { key: 'p67', side: 'plan', label: 'Comptes 6 et 7 uniquement', test: (a) => /^[67]/.test(a.num) },
  ];
  function cutoff60() {
    const d = new Date(Date.now() - 60 * 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ------------------------------------------------------------------
  // Export .xlsx sans bibliothèque (ZIP "stored")
  // ------------------------------------------------------------------
  const CRC_T = (function () {
    const t = [];
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zipStore(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    const u16 = (v) => [v & 255, (v >>> 8) & 255];
    const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    files.forEach((f) => {
      const name = enc.encode(f.name);
      const data = enc.encode(f.data);
      const crc = crc32(data);
      const head = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      parts.push(new Uint8Array(head), name, data);
      central.push({ name, crc, size: data.length, offset });
      offset += head.length + name.length + data.length;
    });
    const cdStart = offset;
    central.forEach((e) => {
      const h = [0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(e.crc), ...u32(e.size), ...u32(e.size), ...u16(e.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(e.offset)];
      parts.push(new Uint8Array(h), e.name);
      offset += h.length + e.name.length;
    });
    const end = [0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(offset - cdStart), ...u32(cdStart), ...u16(0)];
    parts.push(new Uint8Array(end));
    return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function colName(i) { return String.fromCharCode(65 + i); }
  // aoa : tableau de lignes ; cellule = string | number | {n:number} (nombre au format 2 décimales)
  function buildXlsx(aoa, widths) {
    const xe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
    let sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    sheet += '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols><sheetData>';
    aoa.forEach((row, ri) => {
      sheet += '<row r="' + (ri + 1) + '">';
      row.forEach((v, ci) => {
        if (v === '' || v == null) return;
        const ref = colName(ci) + (ri + 1);
        if (typeof v === 'number') sheet += '<c r="' + ref + '" s="1"><v>' + v + '</v></c>';
        else if (v && v.b) sheet += '<c r="' + ref + '" s="2" t="inlineStr"><is><t>' + xe(v.b) + '</t></is></c>';
        else if (v && v.nb !== undefined) sheet += '<c r="' + ref + '" s="3"><v>' + v.nb + '</v></c>';
        else sheet += '<c r="' + ref + '" t="inlineStr"><is><t>' + xe(v) + '</t></is></c>';
      });
      sheet += '</row>';
    });
    sheet += '</sheetData></worksheet>';
    const ns = 'http://schemas.openxmlformats.org/';
    return zipStore([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + ns + 'package/2006/relationships"><Relationship Id="rId1" Type="' + ns + 'officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="' + ns + 'spreadsheetml/2006/main" xmlns:r="' + ns + 'officeDocument/2006/relationships"><sheets><sheet name="Extrait de compte" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + ns + 'package/2006/relationships"><Relationship Id="rId1" Type="' + ns + 'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + ns + 'officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="' + ns + 'spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs></styleSheet>' },
      { name: 'xl/worksheets/sheet1.xml', data: sheet },
    ]);
  }

  // ------------------------------------------------------------------
  // Appels API natifs (hôte : prod-ws.myunisoft.fr, sinon origine de la page)
  // ------------------------------------------------------------------
  const PROD_WS = 'https://prod-ws.myunisoft.fr';
  let apiBase = null;
  const getHeaders = (extra) => { const base = Object.assign({ 'Content-Type': 'application/json' }, (window.TMBC.getApiHeaders && window.TMBC.getApiHeaders()) || {}); const b = bestAuth(); if (b) base.Authorization = b; return Object.assign(base, extra || {}); };
  const societyId = () => { const m = /\/tab\/(\d+)\//.exec(location.pathname); return m ? m[1] : ''; };
  let tokOverride = ''; // jeton lu dans la réponse du renouvellement de session natif
  const jwtIat = (a) => { try { const t = String(a || '').replace(/^Bearer\s+/i, '').split('.'); return JSON.parse(atob(t[1].replace(/-/g, '+').replace(/_/g, '/'))).iat || 0; } catch (e) { return 0; } };
  function bestAuth() {
    const c = [];
    const h = window.TMBC.getApiHeaders && window.TMBC.getApiHeaders();
    if (h && h.Authorization) c.push(h.Authorization);
    if (coreNative && (coreNative.headers.Authorization || coreNative.headers.authorization)) c.push(coreNative.headers.Authorization || coreNative.headers.authorization);
    if (tokOverride) c.push(tokOverride);
    let best = '', bi = -1;
    c.forEach((a) => { const i = jwtIat(a); if (i >= bi) { bi = i; best = a; } });
    return best;
  }
  const ofetch = (u, init) => fetch(u, Object.assign({}, init, { __tmbcOwn: true }));
  const curAuth = () => bestAuth();
  window.TMBC_BEST_AUTH = bestAuth;
  const nudge = () => { try { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); } catch (e) { /* ignore */ } };
  let tokWarn = 0;
  // Attend (max 30 s) qu'un appel natif apporte un jeton frais
  async function waitFreshToken(v0, a0) {
    if (Date.now() - tokWarn > 8000) { tokWarn = Date.now(); toast('Session MyUnisoft expirée : rafraîchissement du jeton…'); }
    nudge();
    for (let i = 0; i < 60; i++) {
      if (coreVer !== v0 || (curAuth() && curAuth() !== a0)) return true;
      if (i === 12 || i === 30) nudge();
      await new Promise((res) => setTimeout(res, 500));
    }
    return false;
  }
  const isTokErr = async (r) => {
    if (r.ok || (r.status !== 400 && r.status !== 401 && r.status !== 403)) return false;
    const t = await r.clone().text().catch(() => '');
    return /token/i.test(t) || r.status === 401;
  };
  // fetch vers prod-ws avec le jeton courant ; sur jeton expiré : attente d'un jeton frais puis un nouvel essai
  async function tokFetch(url, mk) {
    let r = await ofetch(url, mk());
    if (await isTokErr(r)) {
      if (await waitFreshToken(coreVer, curAuth())) r = await ofetch(url, mk());
    }
    return r;
  }
  let coreVer = 0;
  let coreNative = null; // { origin, headers } vus sur un appel natif /api/v1/*
  async function coreFetch(path, body) {
    if (coreNative) {
      const call = async () => {
        const h = Object.assign({}, coreNative.headers, { 'Content-Type': 'application/json' });
        const au = bestAuth();
        if (au) h.Authorization = au;
        return ofetch(coreNative.origin + path, { method: 'POST', headers: h, credentials: 'include', body: JSON.stringify(body) });
      };
      let r;
      try { r = await call(); } catch (e) { apiLog.push('ERR core natif ' + e.message); r = null; }
      if (r) {
        if (r.status === 401 || r.status === 403) {
          apiLog.push('ERR core natif ' + r.status + ' ' + path + ' : attente d\'un jeton frais');
          const a0 = (coreNative.headers.Authorization || coreNative.headers.authorization || '');
          const v0 = coreVer;
          if (await waitFreshToken(v0, a0)) {
            if (coreVer === v0 && curAuth()) { coreNative.headers = Object.assign({}, coreNative.headers, { Authorization: curAuth() }); }
            r = await call();
          }
        }
        if (r.ok) return r.json();
        const txt = await r.text().catch(() => '');
        throw new Error('HTTP ' + r.status + ' ' + path.replace(/^.*\/api\/v1\//, '') + ' ' + (body && body.accountIds ? 'compte#' + body.accountIds[0] + ' ' : '') + (txt ? txt.slice(0, 200) : '') + (r.status === 401 ? ' — session expirée : fais une action dans MyUnisoft puis réessaie' : ''));
      }
    }
    const bases = apiBase !== null ? [apiBase] : [PROD_WS, ''];
    let lastErr = null;
    for (const b of bases) {
      let r;
      try {
        r = await ofetch((b || location.origin) + path, { method: 'POST', headers: getHeaders(), credentials: 'include', body: JSON.stringify(body) });
      } catch (e) { lastErr = e; continue; }
      if (r.ok) { apiBase = b; return r.json(); }
      const txt = await r.text().catch(() => '');
      lastErr = new Error('HTTP ' + r.status + (txt ? ' ' + txt.slice(0, 160) : ''));
      if (r.status === 404 || r.status === 405 || r.status === 401) continue;
      apiBase = b;
      throw lastErr;
    }
    throw lastErr || new Error('API indisponible');
  }
  // "letteringType" : la consultation native envoie NOT_LETTERED quand le filtre est sur "non lettrées" ;
  // pour tout afficher on essaie ALL, puis on retire le champ si le serveur refuse.
  async function withLettering(path, body) {
    const variants = S.letVariant !== undefined ? [S.letVariant] : ['ALL', null];
    let err = null;
    for (const v of variants) {
      const b = Object.assign({}, body);
      if (v) b.letteringType = v;
      try { const r = await coreFetch(path, b); S.letVariant = v; return r; } catch (e) { err = e; apiLog.push('ERR ' + path + ' lettering=' + v + ' ' + e.message); }
    }
    throw err;
  }
  async function getJson(path) {
    const r = await tokFetch(PROD_WS + path, () => ({ headers: getHeaders(), credentials: 'include' }));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // ------------------------------------------------------------------
  // État et données
  // ------------------------------------------------------------------
  const S = {
    start: '', end: '', acc: '', accLabel: '', lines: [], loading: false,
    lett: 'all', fil: { date: '', jnl: '', lett: '', lib: '', deb: '', cre: '', solde: '', ms: '', cpttc: '', cpht: '', cptva: '', piece: '', ech: '', com: '', who: '' },
    sortK: 'date', sortD: 1, sel: new Set(), active: 0,
    amtOp: '=', amtVal: '', amtTol: '0', qText: '',
    ddOpen: false, ddIdx: 0, ddQ: '', accMode: '', accList: null, accIdx: -1, accAll: [], sideCache: {}, accCache: {}, shown: [],
  };
  const apiLog = [];
  let lastRaw = null;

  function periodKey() { return S.start + '|' + S.end; }
  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:2147483647;background:#1f2933;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.3)';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  function ledgerParams(range, subtype, extras) {
    const p = {
      start_date: S.start, end_date: S.end, attachment: extras ? 'true' : 'false', comment_entry: extras ? 'true' : 'false',
      comment_account: 'false', not_lettered_only: 'false', not_solde_only: 'false', an_simulation: 'false',
      subtype: subtype, analytic: 'false', echeance: extras ? 'true' : 'false', exchange_rate: 'false',
      centralize_account: 'false', account_number: range, xls: 'true',
    };
    return p;
  }
  async function fetchParsed(range, subtype) {
    try { return await fetchParsed0(range, subtype); } catch (e) {
      if (!/HTTP 40[013]/.test(e.message)) throw e;
      apiLog.push('ERR grand livre ' + e.message + ' : attente d\'un jeton frais');
      if (!(await waitFreshToken(coreVer, curAuth()))) throw new Error(e.message + ' — jeton expiré ? Reviens sur un écran MyUnisoft puis réessaie');
      return fetchParsed0(range, subtype);
    }
  }
  async function fetchParsed0(range, subtype) {
    if (!window.TMBC_GL || !window.TMBC_GL.fetchLedgerRaw) throw new Error('Module grand livre (>= 1.11) indisponible');
    let rows;
    try {
      rows = await window.TMBC_GL.fetchLedgerRaw(ledgerParams(range, subtype, true));
    } catch (e) {
      rows = await window.TMBC_GL.fetchLedgerRaw(ledgerParams(range, subtype, false)); // repli : options simples
    }
    lastRaw = rows;
    let parsed = parseLedgerRows(rows);
    if (!parsed.order.length && rows.length) {
      // les options supplémentaires ont peut-être changé la structure : repli sur les options simples
      try { parsed = parseLedgerRows((lastRaw = await window.TMBC_GL.fetchLedgerRaw(ledgerParams(range, subtype, false)))); } catch (e) { /* on garde le vide */ }
    }
    return parsed;
  }

  async function loadSide(side) {
    const key = side + '|' + periodKey();
    if (S.sideCache[key]) return S.sideCache[key];
    const sr = SIDE_RANGE[side];
    const parsed = await fetchParsed(sr.range, sr.subtype);
    const out = parsed.order.map((n) => {
      const a = parsed.accounts[n];
      withRunningBalance(a.lines);
      a.solde = r2(a.lines.reduce((s, l) => s + l.d - l.c, 0));
      return a;
    });
    S.sideCache[key] = out;
    return out;
  }
  let lastCoreKeys = '';
  let lastRawLine = null;
  function mapCoreLine(r, num) {
    const key = (re, notRe) => Object.keys(r).find((k) => re.test(k) && !(notRe && notRe.test(k)));
    const val = (re, notRe) => { const k = key(re, notRe); return k ? r[k] : undefined; };
    const d = parseFloat(r.ligneEcriture_debit) || 0;
    const c = parseFloat(r.ligneEcriture_credit) || 0;
    const iso = String(r.date_piece || r.date_comptabilisation || '').slice(0, 10);
    const libKey = (r.intitule_ligne != null ? 'intitule_ligne' : null) || key(/^ligneEcriture_(libelle|intitule|label|lib)/i) || key(/(libelle|intitule|label)/i, /axe|section|compte|journal|societe|etablissement/i) || Object.keys(r).find((k) => /^ligneEcriture_/.test(k) && !/piece|debit|credit|lettr|id|date|montant|devise|quantite/i.test(k) && typeof r[k] === 'string');
    const docs = val(/^(pj_list|documents?|document_list|list_documents?)$/i);
    const ech = r.date_echeance || val(/echeance/i);
    let who = '';
    if (r.creator && typeof r.creator === 'object') who = [r.creator.prenom, r.creator.nom].filter(Boolean).join(' ');
    else { const w = val(/(saisi|created_?by|creat(eur|or)|user|auteur|author|operator|trigram|initial|collab)/i, /date|id_?user|^id/i); who = w && typeof w !== 'object' ? String(w) : ''; }
    const cm = r.comments && typeof r.comments === 'object' ? htmlToText(r.comments.comment || r.comments.body || '') : '';
    const pjDocs = r.documents && typeof r.documents === 'object' ? parseInt(r.documents.totaldocs, 10) : NaN;
    const pjKeys = Object.keys(r).filter((k) => /(document|attach|pj|piece_jointe)/i.test(k) && !/flag|^is_/i.test(k));
    const pjAny = pjKeys.some((k) => { const v = r[k]; return Array.isArray(v) ? v.length > 0 : (v && typeof v === 'object') ? Object.keys(v).length > 0 : (typeof v === 'number' ? v > 0 : (typeof v === 'string' ? v !== '' && v !== '0' && v !== 'false' : v === true)); });
    if (!lastRawLine) lastRawLine = r;
    const nbc = val(/(nb|nombre|count).*comment|comment.*(nb|count|nombre)/i);
    const l = {
      id: 0, acc: num, entryId: r.id_ecriture != null ? parseInt(r.id_ecriture, 10) : null,
      lineId: r.idligneecriture || val(/^(id_ligne|ligneEcriture_id|id_ligneEcriture|id_ligne_ecriture)/i),
      date: iso, dateTxt: isoToFr(iso), jnl: r.journal_code || '', jtype: r.journalType_code || '', piece: r.ligneEcriture_piece || '', piece2: r.ligneEcriture_piece_2 || '',
      lett: String(r.ligneEcriture_lettrage || '').trim(), lib: String(libKey ? r[libKey] || '' : '').toUpperCase(),
      d, c, ms: r2(d - c), ech: ech ? String(ech).slice(0, 10) : '', com: cm, who: who,
      pj: !isNaN(pjDocs) ? pjDocs > 0 : (Array.isArray(docs) ? docs.length > 0 : pjAny), comN: cm ? 1 : (typeof nbc === 'number' ? nbc : 0), comKnown: true,
    };
    return l;
  }
  async function loadCoreLines(acc) {
    const base = {
      idEtablissement: societyId(), startDate: S.start, endDate: S.end, entryType: 'NORMAL', searchType: 'consulting',
      fetchDocuments: true, fetchTotals: true, accountIds: [parseInt(acc.id, 10)], resultPerPage: 200, sortByKey: 'date_piece', sortByDirection: 'ASC',
    };
    let page = 1;
    let rows = [];
    let total = Infinity;
    let asked = false;
    while (rows.length < total) {
      const res = await withLettering('/api/v1/core/accounting/entry/searchConsulting', Object.assign({}, base, { page }));
      const data = (res && res.data) || [];
      if (page === 1 && data[0]) lastCoreKeys = JSON.stringify(data[0]).slice(0, 1800);
      total = res && res.totals && res.totals.totalRows != null ? +res.totals.totalRows : rows.length + data.length;
      if (!data.length) break;
      rows = rows.concat(data);
      page++;
      if (rows.length < total && rows.length >= MAX_LINES && !asked) {
        asked = true;
        if (!window.confirm('Le compte ' + acc.num + ' compte ' + total + ' lignes. Continuer le chargement ?')) break;
      }
    }
    const lines = rows.map((r) => mapCoreLine(r, acc.num));
    lines.forEach((l, i) => { l.id = i + 1; });
    return { num: acc.num, label: acc.label || '', lines: withRunningBalance(lines), source: 'core' };
  }

  async function loadAccountLines(num) {
    const ck = num + '|' + periodKey();
    if (S.accCache[ck]) return S.accCache[ck];
    const acc = S.accAll.find((x) => x.num === num);
    let a = null;
    if (acc && acc.id) {
      try { a = await loadCoreLines(acc); } catch (e) { apiLog.push('ERR core ' + e.message); toast('Lecture directe indisponible (' + e.message + ')'); }
    }
    if (!a) {
      for (const k of Object.keys(S.sideCache)) {
        if (k.endsWith('|' + periodKey())) {
          const hit = S.sideCache[k].find((x) => x.num === num);
          if (hit) { a = hit; break; }
        }
      }
    }
    if (!a) {
      if (!window.__cpGlWarn) { window.__cpGlWarn = 1; toast('Repli sur le grand livre'); }
      let parsed;
      try { parsed = await fetchParsed(num + '-' + num, '0'); } catch (e) { throw new Error(/HTTP 4\d\d/.test(e.message) ? e.message + ' — jeton expiré ? Recharge la page MyUnisoft (F5) puis réessaie' : e.message); }
      if (!parsed.accounts[num]) parsed = await fetchParsed(num, '0');
      a = parsed.accounts[num] || { num, label: '', lines: [] };
      withRunningBalance(a.lines);
    }
    a.solde = r2(a.lines.reduce((x, l) => x + l.d - l.c, 0));
    S.accCache[ck] = a;
    return a;
  }

  // ------------------------------------------------------------------
  // Panneau
  // ------------------------------------------------------------------
  const COLS = [
    { k: 'chk', w: 34 }, { k: 'date', w: 96, t: 'Date', sort: 'date' }, { k: 'jnl', w: 70, t: 'Journal', sort: 'jnl' },
    { k: 'lib', w: 300, t: 'Libellé', sort: 'lib' },
    // (v2.11) Lettrage entre Débit et Crédit (demande de Nicolas).
    { k: 'deb', w: 112, t: 'Débit', sort: 'd', num: true }, { k: 'lett', w: 78, t: 'Lettrage', sort: 'lett' }, { k: 'cre', w: 112, t: 'Crédit', sort: 'c', num: true },
    { k: 'solde', w: 120, t: 'Solde', sort: 'solde', num: true }, { k: 'ms', w: 124, t: 'Montant signé', sort: 'ms', num: true }, { k: 'piece', w: 130, t: 'Pièce', sort: 'piece' }, { k: 'cpttc', w: 104, t: 'Compte TTC', sort: 'cpttc' }, { k: 'cpht', w: 104, t: 'Compte HT', sort: 'cpht' }, { k: 'cptva', w: 104, t: 'Compte TVA', sort: 'cptva' },
    { k: 'pj', w: 54, t: 'PJ' }, { k: 'ech', w: 98, t: 'Échéance', sort: 'ech' }, { k: 'com', w: 230, t: 'Commentaire', sort: 'com' },
    { k: 'who', w: 130, t: 'Saisi par', sort: 'who' },
  ];
  const COLORD_KEY = 'tmbcCpColOrder';
  function loadColOrder() {
    try {
      const o = JSON.parse(localStorage.getItem(COLORD_KEY) || '[]');
      if (!Array.isArray(o) || !o.length) return;
      // (v2.11) Migration unique d'un ordre déjà mémorisé : Lettrage replacé
      // entre Débit et Crédit ; un déplacement fait ensuite à la souris reste respecté.
      if (!localStorage.getItem(COLORD_KEY + '|lettMoved')) {
        localStorage.setItem(COLORD_KEY + '|lettMoved', '1');
        const li = o.indexOf('lett');
        if (li >= 0 && o.includes('deb')) {
          o.splice(li, 1);
          o.splice(o.indexOf('deb') + 1, 0, 'lett');
          localStorage.setItem(COLORD_KEY, JSON.stringify(o));
        }
      }
      const rank = (k) => { const i = o.indexOf(k); return i < 0 ? 999 : i; };
      const base = COLS.slice();
      const sorted = base.filter((c) => c.k !== 'chk').sort((a, b) => (rank(a.k) - rank(b.k)) || (base.indexOf(a) - base.indexOf(b)));
      const chk = base.find((c) => c.k === 'chk');
      COLS.length = 0;
      if (chk) COLS.push(chk);
      sorted.forEach((c) => COLS.push(c));
    } catch (e) { /* ignore */ }
  }
  function saveColOrder() { try { localStorage.setItem(COLORD_KEY, JSON.stringify(COLS.map((c) => c.k))); } catch (e) { /* ignore */ } }
  const COLW_KEY = 'tmbcCpColW';
  function loadColW() {
    try { const o = JSON.parse(localStorage.getItem(COLW_KEY) || '{}'); COLS.forEach((c) => { if (o[c.k] > 24) c.w = o[c.k]; }); } catch (e) { /* ignore */ }
  }
  function saveColW() {
    try { const o = {}; COLS.forEach((c) => { o[c.k] = c.w; }); localStorage.setItem(COLW_KEY, JSON.stringify(o)); } catch (e) { /* ignore */ }
  }
  function applyColW(p) {
    const cols = p.querySelectorAll('colgroup col');
    COLS.forEach((c, i) => { if (cols[i]) cols[i].style.width = c.w + 'px'; });
    const t = p.querySelector('table');
    if (t) t.style.width = COLS.reduce((x, c) => x + c.w, 0) + 'px';
    const bar = p.querySelector('[data-bar]');
    if (bar) bar.style.width = (COLS.reduce((x, c) => x + c.w, 0) + 2) + 'px';
  }

  const CLIP = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.6 8.6a2 2 0 0 1-3-3L15 7"/></svg>';

  const BUBBLE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa7bb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  function closePanel() {
    hidePjPreview(); closeCommentPopup(); closePjMenu(); hideCpPop(); cpTok++;
    const p = document.getElementById(PANEL_ID);
    if (p) p.remove();
    const b = document.getElementById(BACK_ID);
    if (b) b.remove();
    document.removeEventListener('keydown', onDocKey, true);
    window.removeEventListener('keydown', onDocKey, true);
  }
  // Ctrl+F7 : lettrage des écritures non lettrées sélectionnées, si équilibrées.
  // Appel natif relevé : PUT /entry/lettering {lettering:"AAA", line_entry_list:[{line_entry_id}, ...]} (code suivant : AAA, AAB…)
  function nextLett(codes) {
    const ok = codes.filter((c) => /^[A-Z]{1,4}$/.test(c));
    if (!ok.length) return 'AAA';
    ok.sort((a, b) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0));
    const arr = ok[ok.length - 1].split('');
    let i = arr.length - 1;
    while (i >= 0) { if (arr[i] === 'Z') { arr[i] = 'A'; i--; } else { arr[i] = String.fromCharCode(arr[i].charCodeAt(0) + 1); break; } }
    if (i < 0) arr.unshift('A');
    return arr.join('');
  }
  async function letterSelection() {
    const rows = S.shown.filter((l) => S.sel.has(l.id));
    if (!rows.length) { toast('Ctrl+F7 : sélectionne d\'abord des écritures non lettrées.'); return; }
    if (rows.some((l) => l.lett)) { toast('Ctrl+F7 : la sélection contient des lignes déjà lettrées.'); return; }
    const d = r2(rows.reduce((x, l) => x + l.d, 0)), c = r2(rows.reduce((x, l) => x + l.c, 0));
    if (Math.abs(d - c) > 0.004) { toast('Ctrl+F7 : sélection non équilibrée (débit ' + fmt(d) + ' / crédit ' + fmt(c) + ', écart ' + fmt(r2(d - c)) + ').'); return; }
    const ids = rows.map((l) => parseInt(l.lineId, 10)).filter((x) => x > 0);
    if (ids.length !== rows.length) { toast('Ctrl+F7 : identifiants de lignes indisponibles (lecture directe requise).'); return; }
    const code = nextLett(S.lines.map((l) => l.lett));
    if (!window.confirm('Lettrer ' + ids.length + ' lignes (' + fmt(d) + ') du compte ' + S.acc + ' avec le code ' + code + ' ?')) return;
    try {
      const r = await tokFetch(PROD_WS + '/entry/lettering', () => ({ method: 'PUT', headers: getHeaders(), credentials: 'include', body: JSON.stringify({ lettering: code, line_entry_list: ids.map((x) => ({ line_entry_id: x })) }) }));
      const txt = await r.text().catch(() => '');
      if (!r.ok || /"code"\s*:\s*"(?!Success)/i.test(txt)) throw new Error('HTTP ' + r.status + ' ' + txt.slice(0, 160));
      rows.forEach((l) => { l.lett = code; });
      S.sel = new Set();
      Object.keys(S.accCache).forEach((k) => { if (k.indexOf(S.acc + '|') === 0) delete S.accCache[k]; });
      render(true);
      toast('Lettré (' + code + ') : ' + ids.length + ' lignes.');
    } catch (e) { apiLog.push('ERR lettrage ' + e.message); toast('Lettrage : ' + e.message); }
  }
  // F7 : délettrage (appel natif relevé : PUT /entry/lettering {lettering:"", line_entry_list:[{line_entry_id}, ...]} sur toutes
  // les lignes du lettrage)
  async function unletterSelection() {
    const sel = S.shown.filter((l) => S.sel.has(l.id));
    const rows = sel.length ? sel : S.shown.filter((l) => l.id === S.active);
    const codes = Array.from(new Set(rows.filter((l) => l.lett).map((l) => l.lett)));
    if (!codes.length) { toast('F7 : sélectionne d\'abord une écriture lettrée.'); return; }
    const group = S.lines.filter((l) => codes.indexOf(l.lett) !== -1);
    const ids = group.map((l) => parseInt(l.lineId, 10)).filter((x) => x > 0);
    if (!ids.length || ids.length !== group.length) { toast('F7 : identifiants de lignes indisponibles (lecture directe requise).'); return; }
    if (!window.confirm('Délettrer ' + (codes.length > 1 ? 'les lettrages ' : 'le lettrage ') + codes.join(', ') + ' (' + ids.length + ' ligne' + (ids.length > 1 ? 's' : '') + ') du compte ' + S.acc + ' ?')) return;
    try {
      const r = await tokFetch(PROD_WS + '/entry/lettering', () => ({ method: 'PUT', headers: getHeaders(), credentials: 'include', body: JSON.stringify({ lettering: '', line_entry_list: ids.map((x) => ({ line_entry_id: x })) }) }));
      const txt = await r.text().catch(() => '');
      if (!r.ok || /"code"\s*:\s*"(?!Success)/i.test(txt)) throw new Error('HTTP ' + r.status + ' ' + txt.slice(0, 160));
      group.forEach((l) => { l.lett = ''; });
      Object.keys(S.accCache).forEach((k) => { if (k.indexOf(S.acc + '|') === 0) delete S.accCache[k]; });
      render(true);
      toast('Délettré : ' + ids.length + ' ligne' + (ids.length > 1 ? 's' : '') + '.');
    } catch (e) { apiLog.push('ERR delettrage ' + e.message); toast('Délettrage : ' + e.message); }
  }
  function onDocKey(ev) {
    if (ev.__cpDone) return;
    const p = document.getElementById(PANEL_ID);
    if (!p || p.style.display === 'none') return;
    ev.__cpDone = true;
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'w' || ev.key === 'W')) { ev.preventDefault(); ev.stopPropagation(); closePanel(); return; }
    if (ev.key === 'F7') {
      ev.preventDefault(); ev.stopPropagation();
      if (ev.ctrlKey) letterSelection(); else unletterSelection();
      return;
    }
    if (ev.key === 'F12') {
      ev.preventDefault(); ev.stopPropagation();
      S.lett = S.lett === 'all' ? 'non' : S.lett === 'non' ? 'let' : 'all';
      const sel = p.querySelector('[data-lett]');
      if (sel) sel.value = S.lett;
      render();
      return;
    }
    if (ev.ctrlKey && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
      ev.preventDefault(); ev.stopPropagation();
      stepAccount(ev.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    const tg = ev.target || {};
    const typing = tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA' || (tg.tagName === 'INPUT' && !/^(checkbox|radio|button)$/i.test(tg.type || 'text'));
    if (ev.key === 'Escape' && !typing) { ev.stopPropagation(); closePanel(); return; }
    if (typing) return;
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'a' || ev.key === 'A')) {
      ev.preventDefault(); ev.stopPropagation();
      const all = S.shown.length > 0 && S.shown.every((l) => S.sel.has(l.id));
      S.shown.forEach((l) => { if (all) S.sel.delete(l.id); else S.sel.add(l.id); });
      render(true);
      return;
    }
    const rows = S.shown;
    if (!rows.length) return;
    let i = rows.findIndex((l) => l.id === S.active);
    if (ev.key === 'ArrowDown') { ev.preventDefault(); S.active = rows[Math.min(rows.length - 1, i + 1)].id; render(true); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); S.active = rows[Math.max(0, i - 1)].id; render(true); }
    else if (ev.key === ' ') { ev.preventDefault(); if (i >= 0) toggleSel(rows[i].id); }
    else if (ev.key === 'Enter' && i >= 0) openEntry(rows[i]);
    else if (ev.key === 'Insert' || (ev.altKey && (ev.key === 'i' || ev.key === 'I'))) { ev.preventDefault(); const tl = rows[i >= 0 ? i : 0]; toast('Inser : pièce à joindre à la ligne du ' + tl.dateTxt + ' (' + (tl.lib || '').slice(0, 30) + ')'); attachPiece(tl); }
  }

  function hideMine() {
    const p = document.getElementById(PANEL_ID);
    if (!p) return;
    p.style.display = 'none';
    if (document.getElementById(BACK_ID)) return;
    const b = document.createElement('button');
    b.id = BACK_ID; b.type = 'button'; b.textContent = '↩ Consultation Premium';
    b.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483600;padding:6px 16px;border:1px solid #0f2a52;background:#0f2a52;color:#fff;border-radius:16px;cursor:pointer;font-size:13px';
    b.addEventListener('click', () => { const pp = document.getElementById(PANEL_ID); if (pp) pp.style.display = 'flex'; b.remove(); });
    document.body.appendChild(b);
  }
  async function openEntryOld(l) {
    if (!window.TMBC_GL || !window.TMBC_GL.openEntry) { toast('Ouverture d\'écriture indisponible (grand-livre.js >= 1.11)'); return; }
    toast('Ouverture de l\'écriture du ' + l.dateTxt + '…');
    hideMine();
    const amt = l.d || l.c;
    try { await window.TMBC_GL.openEntry({ acc: S.acc, date: l.dateTxt, jnl: l.jnl, amt }); } catch (e) { apiLog.push('ERR openEntry ' + e.message); toast('Écriture : ' + e.message); }
  }
  // Double-clic / Entrée : ouvre la consultation native du compte dans la fenêtre nommée et y double-clique
  // la ligne correspondante (= "modifier l'entrée", comme dans la consultation classique).
  function openEntryNew(l, ev) {
    const acc = S.accAll.find((x) => x.num === S.acc);
    if (!acc || !acc.id) { openEntryOld(l); return; }
    const m = location.pathname.match(/^(\/tab\/\d+)\//);
    const ymd = (iso) => String(iso).replace(/-/g, '');
    const qs = new URLSearchParams({ isAllLines: 'true', accountId: String(acc.id), dateStart: ymd(S.start), dateEnd: ymd(S.end), lettered: 'all', isSituation: 'false' });
    const job = { d: l.dateTxt, a: l.d || l.c, j: l.jnl, p: l.piece || '', t: Date.now() };
    const url = location.origin + (m ? m[1] : '') + '/child/consulting?' + qs.toString() + '#tmbcp-open=' + encodeURIComponent(JSON.stringify(job));
    const name = ev && ev.shiftKey ? 'tmb-consult-window-' + Date.now() : 'tmb-consult-window';
    try { window.open(url, name, 'width=1200,height=800,resizable=yes,scrollbars=yes'); toast('Ouverture de l\'écriture du ' + l.dateTxt + '…'); }
    catch (e) { openEntryOld(l); }
  }
  function openEntry(l, ev) { return openEntryNew(l, ev); }
  // Côté fenêtre de consultation native : exécute la consigne #tmbcp-open (double-clic automatique sur la ligne)
  let cpJobDone = '';
  function runOpenJob() {
    const m = /tmbcp-open=([^&]+)/.exec(location.hash || '');
    if (!m || !/child\/consulting/.test(location.pathname)) return;
    let job; try { job = JSON.parse(decodeURIComponent(m[1])); } catch (e) { return; }
    if (cpJobDone === m[1]) return;
    cpJobDone = m[1];
    const strip = (x) => String(x || '').replace(/[\s\u00a0\u202f]/g, '');
    const want = strip(Math.abs(job.a || 0).toFixed(2).replace('.', ','));
    const dm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(job.d || '');
    const dates = dm ? [dm[0], dm[1] + '/' + dm[2] + '/' + dm[3].slice(2)] : [job.d];
    const t0 = Date.now();
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (Date.now() - t0 > 25000) {
        clearInterval(iv);
        apiLog.push('JOB échec : ligne introuvable (date ' + dates.join('|') + ', montant ' + want + ', journal ' + job.j + ')');
        toast('Ligne introuvable dans la consultation : double-clique-la directement.');
        return;
      }
      if (document.querySelector('.MuiPopover-root,.MuiMenu-root')) return;
      const all = Array.from(document.querySelectorAll('div,span,td,p,input')).filter((e) => e.children.length === 0);
      const leaves = all.filter((e) => dates.some((d) => strip(e.tagName === 'INPUT' ? e.value : e.textContent) === strip(d)));
      for (const lf of leaves) {
        let row = lf;
        for (let i = 0; i < 8 && row.parentElement; i++) {
          row = row.parentElement;
          const r = row.getBoundingClientRect();
          if (r.height > 90) break;
          const tx = strip(row.textContent);
          if (tx.indexOf(want) >= 0 && (!job.j || tx.indexOf(strip(job.j)) >= 0)) {
            clearInterval(iv);
            apiLog.push('JOB ok : ligne trouvée après ' + tries + ' essais (' + lf.tagName + ')');
            row.scrollIntoView({ block: 'center' });
            const fire = (type, detail) => lf.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, detail }));
            ['mousedown', 'mouseup', 'click'].forEach((t) => fire(t, 1));
            ['mousedown', 'mouseup', 'click'].forEach((t) => fire(t, 2));
            fire('dblclick', 2);
            return;
          }
        }
      }
    }, 500);
  }
  if (/tmbcp-open=/.test(location.hash || '')) { window.addEventListener('load', runOpenJob); setTimeout(runOpenJob, 800); }
  window.addEventListener('hashchange', runOpenJob);
  // ------------------------------------------------------------------
  // Pièces jointes : aperçu au survol, ouverture au clic, dépôt (Inser)
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // Contreparties (TTC / TVA / HT) lues dans les écritures : POST /entries/v2 (appel natif relevé)
  // ------------------------------------------------------------------
  const entCache = new Map(); // id écriture -> [{num,label,d,c}]
  let cpTok = 0;
  let cpLogged = false;
  function cpKind(num) { num = String(num || S.acc || ''); if (/^445/.test(num)) return '445'; if (/^40/.test(num)) return '40'; if (/^41/.test(num)) return '41'; if (/^7/.test(num)) return '7'; if (/^6/.test(num)) return '6'; return ''; }
  const CP_TITLES = { cpttc: 'Compte TTC', cpht: 'Compte HT', cptva: 'Compte TVA' };
  function cpTests() {
    const k = cpKind();
    const HT = /^[267]/, TVA = /^445/;
    if (k === '7') return { cpttc: /^41/, cpht: null, cptva: TVA };
    if (k === '6') return { cpttc: /^40/, cpht: null, cptva: TVA };
    if (k === '40' || k === '41') return { cpttc: null, cpht: HT, cptva: TVA };
    if (k === '445') return { cpttc: /^(40|41)/, cpht: HT, cptva: null };
    return { cpttc: null, cpht: null, cptva: null };
  }
  const CP_JNL = /^(AC|ACH|60|VE|VT|VTE|VEN|70)$/;
  const cpEligible = (l) => CP_JNL.test(String(l.jnl || '').toUpperCase()) || CP_JNL.test(String(l.jtype || '').toUpperCase());
  function cpGroups(l, key) {
    if (!cpEligible(l)) return [];
    const t = cpTests()[key];
    const lines = entCache.get(l.entryId);
    if (!t || !lines) return [];
    const by = {};
    lines.forEach((x) => { if (t.test(x.num)) { const o = by[x.num] || (by[x.num] = { num: x.num, label: x.label, d: 0, c: 0 }); o.d += x.d; o.c += x.c; } });
    return Object.keys(by).sort().map((k) => by[k]);
  }
  function cpFull(l, key) { return cpGroups(l, key).map((g) => g.num).join(' '); }
  function applyCp() {
    S.lines.forEach((l) => { ['cpttc', 'cpht', 'cptva'].forEach((k) => { l[k] = cpFull(l, k); }); });
  }
  function cpCell(l, key) {
    const g = cpGroups(l, key);
    if (!g.length) return '<td></td>';
    return '<td data-cp="' + key + '" style="color:#1b4f9c;cursor:pointer"><span data-cpnum="' + esc(g[0].num) + '" style="text-decoration:underline">' + esc(g[0].num) + '\u2060</span>' + (g.length > 1 ? ' <span style="color:#5b6b85">+' + (g.length - 1) + '</span>' : '') + '</td>';
  }
  function updateCpHeaders() { /* titres fixes depuis v2.4 */ }
  function goAccount(num) {
    const acc = S.accAll.find((a) => a.num === num) || S.accAll.find((a) => a.num.replace(/0+$/, '') === String(num).replace(/0+$/, ''));
    if (!acc) { toast('Compte ' + num + ' introuvable dans cette période'); return; }
    selectAccount(acc.num);
  }
  // extraction tolérante des lignes (compte, débit, crédit) d'une réponse /entries/v2
  function accOf(n) {
    const a = n.account;
    const v = (a && typeof a === 'object') ? (a.account_number || a.number || a.no_compte || a.num || a.numero) : (n.account_number || n.no_compte || n.numero_compte || n.account_no || n.num_compte || n.compte || (typeof a === 'string' || typeof a === 'number' ? a : null) || n.accountNumber);
    const t = v == null ? '' : String(v).trim();
    return /^[0-9][0-9A-Za-z]{2,}$/.test(t) ? t : '';
  }
  function amtOf(n, re) { const k = Object.keys(n).find((x) => re.test(x)); if (!k) return null; const v = parseFloat(String(n[k]).replace(',', '.')); return isNaN(v) ? null : v; }
  function extractLines(root, fallbackId) {
    const out = [];
    (function w(n, ctx) {
      if (Array.isArray(n)) { n.forEach((x) => w(x, ctx)); return; }
      if (!n || typeof n !== 'object') return;
      let c = ctx;
      const eid = n.id_entry != null ? n.id_entry : n.entry_id != null ? n.entry_id : n.id_ecriture != null ? n.id_ecriture : null;
      if (eid != null && /^\d+$/.test(String(eid))) c = +eid;
      const num = accOf(n);
      if (num) {
        const d = amtOf(n, /^(ligneEcriture_)?(debit|amount_debit|debit_amount)$/i), cr = amtOf(n, /^(ligneEcriture_)?(credit|amount_credit|credit_amount)$/i);
        if (d != null || cr != null) {
          const a = n.account;
          out.push({ eid: c, num, label: String(n.label || n.account_label || n.intitule_co || (a && typeof a === 'object' ? (a.label || a.name || a.intitule) : '') || ''), d: d || 0, c: cr || 0 });
          return;
        }
      }
      Object.keys(n).forEach((k) => { if (n[k] && typeof n[k] === 'object') w(n[k], c); });
    })(root, fallbackId);
    return out;
  }
  const entFilterAt = {};
  async function ensureEntFilter(force) {
    const soc = societyId();
    if (!soc) return;
    if (!force && entFilterAt[soc] && Date.now() - entFilterAt[soc] < 300000) return;
    entFilterAt[soc] = Date.now();
    try {
      const r = await tokFetch(PROD_WS + '/entries/default_filter?etablissement_id=' + encodeURIComponent(soc), () => ({ headers: getHeaders({ 'society-id': soc }), credentials: 'include' }));
      if (!r.ok) apiLog.push('ERR default_filter HTTP ' + r.status);
    } catch (e) { apiLog.push('ERR default_filter ' + e.message); }
  }
  async function fetchEntries(ids) {
    const url = PROD_WS + '/entries/v2?type=e&RO=1&limit=100';
    const hdr = () => getHeaders({ 'society-id': societyId() });
    const call = async (value, retried) => {
      await ensureEntFilter(false);
      const body = JSON.stringify({ sort: { ecr: 'desc' }, filters: [{ name: 'type', value: 'e' }, { name: 'id_entry', value }] });
      const r = await tokFetch(url, () => ({ method: 'POST', headers: hdr(), credentials: 'include', body }));
      if (!r.ok) {
        const t = (await r.text().catch(() => '')).slice(0, 120);
        if (r.status === 500 && !retried) { await ensureEntFilter(true); return call(value, true); }
        throw new Error('HTTP ' + r.status + ' ' + t);
      }
      return r.json();
    };
    const store = (json, want) => {
      if (!cpLogged) { cpLogged = true; try { apiLog.push('ENTV2 ' + JSON.stringify(json).slice(0, 1600)); } catch (e) { /* ignore */ } }
      const ls = extractLines(json, want.length === 1 ? want[0] : null);
      const by = {};
      ls.forEach((x) => { if (x.eid != null) (by[x.eid] || (by[x.eid] = [])).push({ num: x.num, label: x.label, d: x.d, c: x.c }); });
      let ok = 0;
      want.forEach((id) => { if (by[id]) { entCache.set(id, by[id]); ok++; } });
      return ok;
    };
    if (ids.length > 1 && S.v2Batch !== false) {
      try {
        const ok = store(await call(ids), ids);
        if (ok === ids.length) { S.v2Batch = true; return; }
        if (S.v2Batch === undefined) S.v2Batch = false;
      } catch (e) { apiLog.push('ERR entries/v2 lot ' + e.message); if (S.v2Batch === undefined) S.v2Batch = false; }
    }
    const todo = ids.filter((i) => !entCache.has(i));
    let idx = 0;
    const worker = async () => {
      while (idx < todo.length) {
        const id = todo[idx++];
        try {
          const ok = store(await call(id), [id]);
          if (!ok) entCache.set(id, []);
        } catch (e) { apiLog.push('ERR entries/v2 ' + id + ' ' + e.message); if (/Token|token|401/.test(e.message)) throw e; }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }
  async function loadCounterparts(num) {
    const tok = ++cpTok;
    applyCp();
    if (!cpKind(num)) return;
    const ids = Array.from(new Set(S.lines.filter(cpEligible).map((l) => l.entryId).filter((i) => i != null && !entCache.has(i))));
    const p0 = document.getElementById(PANEL_ID);
    const info = p0 && p0.querySelector('[data-info]');
    const base = info ? info.textContent : '';
    if (ids.length > 3000 && !window.confirm(ids.length + ' écritures : charger les contreparties (peut prendre un moment) ?')) return;
    if (entCache.size > 30000) entCache.clear();
    const B = 20;
    let done = 0;
    try {
      for (let i = 0; i < ids.length; i += B) {
        if (tok !== cpTok) return;
        await fetchEntries(ids.slice(i, i + B));
        done += Math.min(B, ids.length - i);
        if (tok !== cpTok) return;
        applyCp(); render(true);
        if (info && ids.length > B) info.textContent = base + ' · contreparties ' + done + '/' + ids.length;
      }
    } catch (e) { toast('Contreparties : ' + e.message); }
    if (tok === cpTok) { applyCp(); render(true); if (info) info.textContent = base; }
  }
  let cpHideT = null;
  function hideCpPop() { clearTimeout(cpHideT); const e = document.getElementById('tmbc-cp-cpop'); if (e) e.remove(); }
  function scheduleHideCpPop() { clearTimeout(cpHideT); cpHideT = setTimeout(hideCpPop, 280); }
  function showCpPop(l, which, cell) {
    clearTimeout(cpHideT);
    const g = cpGroups(l, which);
    const old = document.getElementById('tmbc-cp-cpop');
    if (!g.length) { if (old) old.remove(); return; }
    if (old && old.dataset.k === l.id + '|' + which) return;
    if (old) old.remove();
    const box = document.createElement('div');
    box.id = 'tmbc-cp-cpop';
    box.dataset.k = l.id + '|' + which;
    const r = cell.getBoundingClientRect();
    box.style.cssText = 'position:fixed;z-index:1255;background:#fff;border:1px solid #8e9bb0;border-radius:6px;box-shadow:0 8px 24px rgba(15,42,82,.3);padding:6px 0;font-size:13px;min-width:260px;max-width:480px;left:' + Math.max(8, Math.min(window.innerWidth - 500, Math.round(r.left))) + 'px;top:' + Math.min(window.innerHeight - 60, Math.round(r.bottom + 2)) + 'px';
    box.innerHTML = '<div style="padding:2px 12px 4px;color:#5b6b85;font-size:11px">' + esc(CP_TITLES[which]) + ' de l\'écriture</div>' + g.map((x) => '<div data-cpnum="' + esc(x.num) + '" style="padding:5px 12px;cursor:pointer;display:flex;gap:10px;justify-content:space-between;color:#1b4f9c"><span style="text-decoration:underline;font-family:' + MONO + '">' + esc(x.num) + '</span><span style="color:#3a4a63;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.label || labelFor(x.num)) + '</span><span style="font-family:' + MONO + ';color:#3a4a63">' + fmt(r2(x.d - x.c)) + '</span></div>').join('');
    box.addEventListener('mouseenter', () => clearTimeout(cpHideT));
    box.addEventListener('mouseleave', scheduleHideCpPop);
    box.addEventListener('click', (ev) => { const it = ev.target.closest('[data-cpnum]'); if (it) { hideCpPop(); goAccount(it.dataset.cpnum); } });
    document.body.appendChild(box);
  }

  const docCache = new Map();
  let lastDocKeys = '';
  function bigUrl(d) {
    if (d.thumbnail) {
      try { const u = new URL(d.thumbnail, location.href); u.searchParams.set('y', '1400'); u.searchParams.delete('x'); return u.toString(); } catch (e) { return d.thumbnail; }
    }
    return d.link ? d.link + '/preview?y=1400' : '';
  }
  async function loadDocs(l) {
    if (!l.entryId) return [];
    if (docCache.has(l.entryId)) return docCache.get(l.entryId);
    const raw = await getJson('/document/all_types?location=ENTRIES&objectId=' + l.entryId);
    const flat = [];
    (function walk(x) {
      if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === 'object') {
        if (x.link || x.thumbnail || x.document_id || x.filename || typeof x.name === 'string') flat.push(x);
        else Object.keys(x).forEach((k) => { if (x[k] && typeof x[k] === 'object') walk(x[k]); });
      }
    })(raw);
    if (flat[0]) lastDocKeys = JSON.stringify(flat[0]).slice(0, 700);
    const docs = flat.map((d) => ({ name: d.name || d.filename || d.document_name || 'fichier', link: d.link || d.url || '', big: bigUrl(d), download: d.download || '', id: d.document_id }));
    docCache.set(l.entryId, docs);
    S.lines.filter((x) => x.entryId === l.entryId).forEach((x) => { x.pj = docs.length > 0; });
    return docs;
  }
  let pjTimer = null;
  function closePjMenu() { const m = document.getElementById('tmbc-cp-ctx'); if (m) m.remove(); document.removeEventListener('mousedown', pjMenuOut, true); }
  function pjMenuOut(e) { const m = document.getElementById('tmbc-cp-ctx'); if (m && !m.contains(e.target)) closePjMenu(); }
  async function showPjMenu(l, ev) {
    closePjMenu(); hidePjPreview();
    const m = document.createElement('div');
    m.id = 'tmbc-cp-ctx';
    m.style.cssText = 'position:fixed;z-index:1260;min-width:230px;background:#fff;border:1px solid #8e9bb0;border-radius:6px;box-shadow:0 8px 24px rgba(15,42,82,.3);padding:4px 0;font-size:13px;left:' + Math.min(window.innerWidth - 260, ev.clientX) + 'px;top:' + Math.min(window.innerHeight - 160, ev.clientY) + 'px';
    const item = (label, fn, danger) => { const d = document.createElement('div'); d.textContent = label; d.style.cssText = 'padding:7px 14px;cursor:pointer;white-space:nowrap;max-width:420px;overflow:hidden;text-overflow:ellipsis;color:' + (danger ? '#c62828' : '#0f2a52'); d.onmouseenter = () => (d.style.background = '#e4ecfa'); d.onmouseleave = () => (d.style.background = ''); d.onclick = () => { closePjMenu(); fn(); }; m.appendChild(d); };
    item('Ajouter une pièce…', () => attachPiece(l));
    document.body.appendChild(m);
    document.addEventListener('mousedown', pjMenuOut, true);
    if (l.entryId) {
      let docs = [];
      try { docs = await loadDocs(l); } catch (e) { /* ignore */ }
      docs.forEach((d) => {
        item('Ouvrir « ' + d.name + ' »', () => window.open(d.link || d.download, 'tmb-pj-window'));
        item('Supprimer « ' + d.name + ' »', () => deletePj(l, d), true);
      });
    }
  }
  // Suppression d'une pièce : appel natif relevé : DELETE /document {document_id:[id], location:"ENTRIES", object_id:<écriture>}
  async function deletePj(l, d) {
    if (!d.id) { toast('Suppression : identifiant de la pièce inconnu.'); return; }
    if (!window.confirm('Supprimer la pièce « ' + d.name + ' » de cette écriture ?')) return;
    try {
      const r = await tokFetch(PROD_WS + '/document', () => ({ method: 'DELETE', headers: getHeaders(), credentials: 'include', body: JSON.stringify({ document_id: [d.id], location: 'ENTRIES', object_id: l.entryId }) }));
      const txt = await r.text().catch(() => '');
      if (!r.ok || /"status"\s*:\s*"(?!success)/i.test(txt)) throw new Error('HTTP ' + r.status + ' ' + txt.slice(0, 160));
      docCache.delete(l.entryId);
      const left = await loadDocs(l).catch(() => []);
      S.lines.filter((x) => x.entryId === l.entryId).forEach((x) => { x.pj = left.length > 0; });
      render(true);
      toast('Pièce supprimée.');
    } catch (e) { apiLog.push('ERR delete pj ' + e.message); toast('Suppression de pièce : ' + e.message); }
  }
  function hidePjPreview() {
    clearTimeout(pjTimer);
    const e = document.getElementById('tmbc-cp-pjprev');
    if (e) e.remove();
  }
  function showPjPreview(l) {
    clearTimeout(pjTimer);
    pjTimer = setTimeout(async () => {
      let docs = [];
      try { docs = await loadDocs(l); } catch (e) { apiLog.push('ERR docs ' + e.message); toast('Pièces jointes : ' + e.message); return; }
      hidePjPreview();
      const p = document.getElementById(PANEL_ID);
      if (!p || !l.entryId || !docs.length) return;
      const pr = p.getBoundingClientRect();
      const box = document.createElement('div');
      box.id = 'tmbc-cp-pjprev';
      box.style.cssText = 'position:fixed;z-index:1200;pointer-events:none;background:#fff;border:1px solid #8e9bb0;border-radius:6px;box-shadow:0 8px 26px rgba(15,42,82,.3);padding:10px;overflow:auto;display:flex;flex-direction:column;gap:10px;' +
        'left:' + Math.round(pr.left + pr.width * 0.42) + 'px;top:' + Math.round(pr.top + 70) + 'px;width:' + Math.round(pr.width * 0.58 - 24) + 'px;height:' + Math.round(pr.height - 90) + 'px';
      box.innerHTML = docs.length
        ? docs.map((d) => '<div style="display:flex;flex-direction:column;gap:6px;flex:1;min-height:0">' + (d.big ? '<img src="' + esc(d.big) + '" alt="" style="max-width:100%;max-height:100%;object-fit:contain;border:1px solid #ddd">' : '') + '<b style="word-break:break-all">' + esc(d.name) + '</b></div>').join('')
        : '<div style="color:#5b6b85;padding:10px">Aucune pièce jointe sur cette écriture.</div>';
      document.body.appendChild(box);
    }, 180);
  }
  async function openPj(l) {
    try {
      const docs = await loadDocs(l);
      if (!docs.length) { toast('Aucune pièce jointe sur cette écriture (Inser pour en ajouter).'); return; }
      const d = docs[0];
      window.open(d.link || d.big, 'tmb-pj-window', 'width=1000,height=900,resizable=yes,scrollbars=yes');
    } catch (e) { toast('Pièces jointes : ' + e.message); }
  }
  function attachPiece(l) {
    if (!l.entryId) { toast('Écriture inconnue : ouverture dans la saisie.'); openEntry(l); return; }
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      try {
        toast('Envoi de « ' + f.name + ' »…');
        const qs = 'location=ENTRIES&object_id=' + encodeURIComponent(l.entryId) + '&filename_extension=' + encodeURIComponent(f.name) + '&type_result=1';
        const buf = await f.arrayBuffer();
        const r = await tokFetch(PROD_WS + '/document/add_all_types?' + qs, () => ({ method: 'POST', headers: getHeaders({ 'Content-Type': 'application/octet-stream' }), credentials: 'include', body: buf }));
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 160));
        docCache.delete(l.entryId);
        S.lines.filter((x) => x.entryId === l.entryId).forEach((x) => { x.pj = true; });
        render(true);
        toast('Pièce « ' + f.name + ' » ajoutée à l\'écriture.');
      } catch (e) { apiLog.push('ERR upload ' + e.message); toast('Ajout de la pièce : ' + e.message); }
    });
    inp.click();
  }

  // ------------------------------------------------------------------
  // Commentaires : lecture / saisie directe (GET et POST /comments)
  // ------------------------------------------------------------------
  function htmlToText(h) { return String(h || '').replace(/<\/p>\s*<p>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(); }
  function applyComments(l, arr) {
    const last = arr.length ? htmlToText(arr[arr.length - 1].body) : '';
    S.lines.filter((x) => x.entryId === l.entryId).forEach((x) => { x.com = last; x.comN = arr.length; });
  }
  let pfToken = 0;
  async function prefetchComments(lines) {
    const tok = ++pfToken;
    const ids = Array.from(new Set(lines.filter((l) => !l.comKnown).map((l) => l.entryId).filter(Boolean))).slice(0, 150);
    let i = 0, done = 0;
    const worker = async () => {
      while (i < ids.length && tok === pfToken) {
        const id = ids[i++];
        try {
          const arr = await getJson('/comments?entry_id=' + id);
          if (Array.isArray(arr) && arr.length && tok === pfToken) applyComments({ entryId: id }, arr);
        } catch (e) { /* commentaire illisible : on ignore */ }
        if (++done % 20 === 0 && tok === pfToken) render(true);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (tok === pfToken) render(true);
  }
  function closeCommentPopup() {
    const e = document.getElementById('tmbc-cp-com');
    if (e) e.remove();
  }
  async function openComments(l, ev) {
    closeCommentPopup();
    if (!l.entryId) { toast('Écriture inconnue : commentaire indisponible.'); return; }
    const box = document.createElement('div');
    box.id = 'tmbc-cp-com';
    const x = Math.min(window.innerWidth - 440, Math.max(10, (ev && ev.clientX) || 200));
    const y = Math.min(window.innerHeight - 330, Math.max(10, ((ev && ev.clientY) || 200) + 8));
    box.style.cssText = 'position:fixed;z-index:1250;width:420px;background:#fff;border:1px solid #8e9bb0;border-radius:8px;box-shadow:0 10px 30px rgba(15,42,82,.3);padding:12px;font-size:13px;display:flex;flex-direction:column;gap:8px;left:' + x + 'px;top:' + y + 'px';
    box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><b>Commentaires – écriture ' + l.entryId + '</b><button data-x type="button" aria-label="Fermer" style="border:0;background:transparent;font-size:16px;cursor:pointer">✕</button></div>' +
      '<div data-list style="max-height:180px;overflow:auto;display:flex;flex-direction:column;gap:6px;color:#5b6b85">Chargement…</div>' +
      '<textarea data-t rows="3" placeholder="Nouveau commentaire (Ctrl+Entrée pour enregistrer)" style="border:1px solid #b8c2cf;border-radius:6px;padding:7px 9px;font:13px inherit;resize:vertical"></textarea>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button data-s type="button" style="border:0;background:#0f2a52;color:#fff;border-radius:6px;padding:7px 14px;cursor:pointer;font-weight:600">Enregistrer</button></div>';
    document.body.appendChild(box);
    const list = box.querySelector('[data-list]');
    const ta = box.querySelector('[data-t]');
    const draw = (arr) => {
      list.innerHTML = arr.length ? arr.map((c) => '<div data-cid="' + esc(String(c.id)) + '" style="border-bottom:1px solid #eef1f6;padding-bottom:5px;color:#1c2b44"><span data-cact style="float:right;font-size:11px"><a data-edit href="#" style="color:#1b4f9c;margin-right:8px">Modifier</a><a data-del href="#" style="color:#c62828">Supprimer</a></span><span style="color:#5b6b85;font-size:11px">' + esc(c.name || '') + ' · ' + esc(String(c.date || '').replace('T', ' ').slice(0, 16)) + '</span><div style="white-space:pre-wrap">' + esc(htmlToText(c.body)) + '</div></div>').join('') : '<span>Aucun commentaire.</span>';
      list.scrollTop = list.scrollHeight;
    };
    try { draw(await getJson('/comments?entry_id=' + l.entryId)); } catch (e) { list.textContent = 'Lecture impossible : ' + e.message; }
    const save = async () => {
      const t = ta.value.trim();
      if (!t) return;
      const html = t.split(/\n/).map((ln) => '<p>' + esc(ln) + '</p>').join('');
      try {
        const r = await tokFetch(PROD_WS + '/comments', () => ({ method: 'POST', headers: getHeaders(), credentials: 'include', body: JSON.stringify({ location: 'ENTRIES', entry_id: l.entryId, society_id: parseInt(societyId(), 10), comment: html, summary: false }) }));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const arr = await r.json().catch(() => []);
        ta.value = '';
        const a2 = Array.isArray(arr) ? arr : [];
        draw(a2);
        applyComments(l, a2);
        render(true);
        toast('Commentaire enregistré.');
      } catch (e) { apiLog.push('ERR comment ' + e.message); toast('Commentaire : ' + e.message); }
    };
    const reload = async () => { const a2 = await getJson('/comments?entry_id=' + l.entryId); const arr2 = Array.isArray(a2) ? a2 : []; draw(arr2); applyComments(l, arr2); if (!arr2.length) { S.lines.filter((x) => x.entryId === l.entryId).forEach((x) => { x.com = ''; x.comN = 0; }); } render(true); };
    list.addEventListener('click', async (e2) => {
      const ed = e2.target.closest('[data-edit]'), dl = e2.target.closest('[data-del]');
      if (!ed && !dl) return;
      e2.preventDefault();
      const row = e2.target.closest('[data-cid]');
      const cid = row.dataset.cid;
      try {
        if (dl) {
          if (!window.confirm('Supprimer ce commentaire ?')) return;
          const r = await tokFetch(PROD_WS + '/comments/' + cid, () => ({ method: 'DELETE', headers: getHeaders(), credentials: 'include' }));
          if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 120));
          await reload(); toast('Commentaire supprimé.');
        } else {
          const cur = htmlToText(((await getJson('/comments?entry_id=' + l.entryId)).find((c) => String(c.id) === cid) || {}).body);
          const holder = row.querySelector('div');
          holder.innerHTML = '<textarea data-et rows="3" style="width:100%;box-sizing:border-box;border:1px solid #b8c2cf;border-radius:6px;padding:6px 8px;font:13px inherit"></textarea><div style="margin-top:4px;display:flex;gap:6px;justify-content:flex-end"><button data-eok type="button" style="border:0;background:#0f2a52;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer">Valider</button><button data-eno type="button" style="border:1px solid #b8c2cf;background:#fff;border-radius:6px;padding:5px 12px;cursor:pointer">Annuler</button></div>';
          const et = holder.querySelector('[data-et]'); et.value = cur; et.focus();
          holder.querySelector('[data-eno]').addEventListener('click', () => reload().catch(() => {}));
          holder.querySelector('[data-eok]').addEventListener('click', async () => {
            const t2 = et.value.trim();
            if (!t2 || t2 === cur) { reload().catch(() => {}); return; }
            try {
              const html2 = t2.split(/\n/).map((ln) => '<p>' + esc(ln) + '</p>').join('');
              const r = await tokFetch(PROD_WS + '/comments/' + cid, () => ({ method: 'PUT', headers: getHeaders(), credentials: 'include', body: JSON.stringify({ location: 'ENTRIES', entry_id: l.entryId, comment: html2 }) }));
              if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 120));
              await reload(); toast('Commentaire modifié.');
            } catch (e4) { apiLog.push('ERR comment edit ' + e4.message); toast('Commentaire : ' + e4.message); }
          });
        }
      } catch (e3) { apiLog.push('ERR comment edit ' + e3.message); toast('Commentaire : ' + e3.message); }
    });
    box.querySelector('[data-s]').addEventListener('click', save);
    box.querySelector('[data-x]').addEventListener('click', closeCommentPopup);
    ta.addEventListener('keydown', (ev2) => { if (ev2.key === 'Enter' && ev2.ctrlKey) { ev2.preventDefault(); save(); } else if (ev2.key === 'Escape') { ev2.stopPropagation(); closeCommentPopup(); } });
    ta.focus();
  }
  function selectRange(id, add) {
    const ids = S.shown.map((l) => l.id);
    const b = ids.indexOf(id);
    let a = ids.indexOf(S.anchor);
    if (b < 0) return;
    if (a < 0) a = b;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    if (!add) S.sel = new Set();
    for (let i = lo; i <= hi; i++) S.sel.add(ids[i]);
    render(true);
  }
  function toggleSel(id) {
    S.anchor = id;
    if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id);
    render(true);
  }

  function placePanel(p) {
    const sb = window.TMBC.getSidebar && window.TMBC.getSidebar();
    const sr = sb && sb.getBoundingClientRect();
    const left = sr && sr.width > 0 ? Math.round(sr.right) : 160;
    const home = Array.from(document.querySelectorAll('button,a,[role=tab]')).find((e) => {
      if (!/^Accueil$/.test(e.textContent.trim())) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.top < 90;
    });
    const top = home ? Math.round(home.getBoundingClientRect().bottom + 8) : 58;
    p.style.left = left + 'px';
    p.style.top = top + 'px';
  }

  function showPanel() {
    closePanel();
    loadColW(); loadColOrder();
    const p = document.createElement('div');
    p.id = PANEL_ID;
    p.style.cssText = 'position:fixed;left:160px;top:58px;right:0;bottom:0;z-index:1195;background:#eef1f6;display:flex;flex-direction:column;font-family:"Segoe UI",system-ui,sans-serif;font-size:13px;color:#1c2b44;min-width:0;overflow:auto';
    const inp = 'border:1px solid #b8c2cf;border-radius:6px;padding:7px 9px;font-size:13px;background:#fff;box-sizing:border-box';
    const lbl = 'font-size:11px;color:#5b6b85';
    const btn = 'border:1px solid #b8c2cf;background:#fff;color:#0f2a52;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer';
    const headParts = () => ({
      cg: COLS.map((c) => '<col style="width:' + c.w + 'px">').join(''),
      h1: COLS.map((c) => c.k === 'chk' ? '<th class="h" style="text-align:center"><input data-all type="checkbox" aria-label="Tout sélectionner"></th>' : '<th class="h' + (c.sort ? ' s' : '') + (c.num ? ' n' : '') + '" data-col="' + c.k + '"' + (c.sort ? ' data-sort="' + c.sort + '"' : '') + '>' + c.t + ' <span data-arrow="' + (c.sort || '') + '"></span><span class="rz" data-rz="' + c.k + '"></span></th>').join(''),
      h2: COLS.map((c) => (c.k === 'chk' || c.k === 'pj') ? '<th style="background:#fbfcfe;position:sticky;top:34px;z-index:2;border-bottom:1px solid #aebbd0;border-right:1px solid #c3cddd"></th>' : thFilter(c.k)).join(''),
    });
    S.rebuildHead = () => {
      const pp = document.getElementById(PANEL_ID);
      if (!pp) return;
      const h = headParts();
      pp.querySelector('colgroup').innerHTML = h.cg;
      const trs = pp.querySelectorAll('thead tr');
      trs[0].innerHTML = h.h1; trs[1].innerHTML = h.h2;
      pp.querySelectorAll('[data-f]').forEach((i) => { i.value = S.fil[i.dataset.f] || ''; });
      applyColW(pp);
    };
    const thFilter = (k) => '<th style="padding:3px;background:#fbfcfe;position:sticky;top:34px;z-index:2;border-bottom:1px solid #aebbd0;border-right:1px solid #c3cddd"><input data-f="' + k + '" type="text" style="width:100%;min-width:0;' + inp + ';padding:4px 6px;font-size:12px;border-radius:4px;' + (/^(deb|cre|solde|ms)$/.test(k) ? 'text-align:right;font-family:' + MONO : '') + '"></th>';
    const HP = headParts();
    p.innerHTML =
      '<style>' +
      '#' + PANEL_ID + ' table{border-collapse:separate;border-spacing:0;table-layout:fixed}' +
      '#' + PANEL_ID + ' thead th.h{position:sticky;top:0;z-index:2;background:#f3f6fb;color:#0f2a52;font-weight:600;font-size:12px;height:34px;padding:0 6px;text-align:left;border-bottom:1px solid #aebbd0;border-right:1px solid #c3cddd;white-space:nowrap;cursor:default}' +
      '#' + PANEL_ID + ' thead th.h{position:sticky}#' + PANEL_ID + ' .rz{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:5}#' + PANEL_ID + ' .rz:hover{background:#6a9be0}#' + PANEL_ID + ' tr.sub td{background:#e8eef8;color:#0f2a52;font-weight:700;border-top:1px solid #8aa0c4}#' + PANEL_ID + ' thead th.s{cursor:pointer}#' + PANEL_ID + ' thead th.s:hover{background:#e4ecfa}' +
      '#' + PANEL_ID + ' thead th.n{text-align:right}' +
      '#' + PANEL_ID + ' thead th.dragover{box-shadow:inset 3px 0 0 #1b4f9c}#' + PANEL_ID + ' thead th[data-col]{cursor:grab}' +
      '#' + PANEL_ID + ' td{padding:5px 6px;border-bottom:1px solid #c3cddd;border-right:1px solid #c3cddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}' +
      '#' + PANEL_ID + ' td.n{text-align:right;font-family:' + MONO + '}' +
      '#' + PANEL_ID + ' tbody td.n,#' + PANEL_ID + ' tbody tr.tot td.n,#' + PANEL_ID + ' tbody tr.tot2 td.n,#' + PANEL_ID + ' tbody tr.tot3 td.n,#' + PANEL_ID + ' tbody tr.sub td.n{text-align:right!important}' +
      '#' + PANEL_ID + ' thead th.n{text-align:right!important}' +
      '#' + PANEL_ID + ' td.neg{color:#c62828}#' + PANEL_ID + ' td.cr{color:#c62828}' +
      '#' + PANEL_ID + ' td.m{font-family:' + MONO + '}' +
      '#' + PANEL_ID + ' tbody tr{background:#fff}#' + PANEL_ID + ' tbody tr:nth-child(even){background:#f8fafd}' +
      '#' + PANEL_ID + ' tbody tr.tot td{background:#b4c6e7;font-weight:700;color:#0f2a52;border-top:2px solid #0f2a52}#' + PANEL_ID + ' tbody tr.tot2 td{background:#dbe5f5;color:#0f2a52}#' + PANEL_ID + ' tbody tr.tot3 td{background:#fff0b3;color:#0f2a52;font-weight:700}' +
      '#' + PANEL_ID + ' tbody tr.sel{background:#fff4cc}#' + PANEL_ID + ' tbody tr.act{background:#dbe8fb!important}' +
      '#' + PANEL_ID + ' input:focus,#' + PANEL_ID + ' select:focus{outline:2px solid #6a9be0;outline-offset:0}' +
      '</style>' +
      // en-tête
      '<div style="display:flex;align-items:center;gap:14px;padding:12px 20px 6px;flex-wrap:wrap">' +
      '<b style="font-size:20px;color:#0f2a52;font-weight:600">Consultation Premium</b>' +
      '<span style="background:#0f2a52;color:#fff;font-size:10px;font-weight:700;letter-spacing:.08em;padding:4px 10px;border-radius:999px">PREMIUM</span>' +
      '<span data-info style="color:#5b6b85"></span><div style="flex:1"></div>' +
      '<button data-act="print" type="button" style="' + btn + '">Imprimer</button>' +
      '<button data-act="xlsx" type="button" style="' + btn + ';background:#0f2a52;color:#fff;border-color:#0f2a52;font-weight:600">Export Excel</button>' +
      '<button data-act="close" type="button" aria-label="Fermer" style="' + btn + ';width:36px;padding:8px 0">✕</button></div>' +
      // sélection
      '<div style="margin:0 20px;background:#fff;border:1px solid #d5dce8;border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:12px">' +
      '<div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap">' +
      '<div style="display:flex;flex-direction:column;gap:3px"><span style="' + lbl + '">Compte</span><div style="display:flex;gap:5px;align-items:center">' +
      '<button data-act="prev" type="button" style="' + btn + ';padding:7px 10px">◀</button>' +
      '<div style="position:relative"><input data-acc type="text" autocomplete="off" style="' + inp + ';width:360px"><div data-dd style="display:none;position:absolute;left:0;top:100%;margin-top:2px;width:600px;max-height:380px;overflow:auto;background:#fff;border:1px solid #aebbd0;border-radius:6px;box-shadow:0 8px 24px rgba(15,42,82,.25);z-index:60"></div></div>' +
      '<button data-act="next" type="button" style="' + btn + ';padding:7px 10px">▶</button>' +
      '<span data-count style="font-family:' + MONO + ';color:#5b6b85;min-width:56px"></span></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:3px"><span style="' + lbl + '">Filtre de comptes</span><select data-mode style="' + inp + ';width:340px"></select></div>' +
      '<div style="display:flex;flex-direction:column;gap:3px"><span style="' + lbl + '">Du</span><input data-start type="text" style="' + inp + ';width:104px;font-family:' + MONO + '"></div>' +
      '<div style="display:flex;flex-direction:column;gap:3px"><span style="' + lbl + '">Au</span><input data-end type="text" style="' + inp + ';width:104px;font-family:' + MONO + '"></div>' +
      '<div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:200px"><span style="' + lbl + '">Commentaire annuel (exercice)</span><input data-acoma type="text" autocomplete="off" style="' + inp + ';width:100%;background:#fffbe6"></div>' +
      '<div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:200px"><span style="' + lbl + '">Commentaire permanent</span><input data-acomp type="text" autocomplete="off" style="' + inp + ';width:100%;background:#fffbe6"></div>' +
      '</div>' +
      '<div style="display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap">' +
      '<div style="display:flex;flex-direction:column;gap:3px"><span style="' + lbl + '">Lettrage <b style="font-family:' + MONO + ';background:#e4ecfa;color:#1b4f9c;border-radius:3px;padding:0 4px">F12</b></span>' +
      '<select data-lett style="' + inp + '"><option value="all">Toutes les écritures</option><option value="non">Non lettrées uniquement</option><option value="let">Lettrées uniquement</option></select></div>' +
      '<div style="display:flex;flex-direction:column;gap:3px"><span style="' + lbl + '">Recherche par montant</span><div style="display:flex;gap:5px;align-items:center">' +
      '<select data-aop style="' + inp + ';font-family:' + MONO + '"><option value="=">=</option><option value=">=">≥</option><option value="<=">≤</option><option value="<>">≠</option></select>' +
      '<input data-aval type="text" style="' + inp + ';width:120px;text-align:right;font-family:' + MONO + '">' +
      '<span style="color:#5b6b85;font-size:12px">±</span><input data-atol type="text" value="0" style="' + inp + ';width:54px;text-align:right;font-family:' + MONO + '"></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:220px;max-width:420px"><span style="' + lbl + '">Recherche dans toutes les colonnes</span><input data-q type="text" style="' + inp + ';width:100%"></div>' +
      '<button data-act="monthly" type="button" style="' + btn + '">Sous-total mensuel</button>' +
      '<button data-act="reset" type="button" style="border:0;background:transparent;color:#1b4f9c;font-size:13px;cursor:pointer;text-decoration:underline;padding:8px 4px">Réinitialiser les filtres</button>' +
      '</div></div>' +
      // soldes
      '<div style="display:flex;gap:12px;padding:10px 20px 8px;flex-wrap:wrap"><div data-bar style="flex:0 1 auto;max-width:100%;box-sizing:border-box;background:#0f2a52;color:#fff;border-radius:8px;padding:9px 14px;display:flex;gap:24px;align-items:center;justify-content:space-between;flex-wrap:wrap">' +
      '<div style="font-size:12px;opacity:.9">Affichage : <b data-cnt style="font-weight:600"></b></div>' +
      '<div style="display:flex;gap:22px;font-family:' + MONO + ';font-size:15px"><span style="text-align:right">Débit <b data-td></b></span><span style="text-align:right">Crédit <b data-tc></b></span><span style="text-align:right">Solde <b data-ts></b></span></div></div></div>' +
      // tableau
      '<div style="flex:1;overflow:auto;margin:0 20px;background:#fff;border:1px solid #d5dce8;border-radius:8px;min-height:0"><table><colgroup>' + HP.cg + '</colgroup><thead><tr>' + HP.h1 + '</tr><tr>' + HP.h2 + '</tr></thead>' +
      '<tbody data-body></tbody></table></div>' +
      '<div style="margin:-4px 20px 10px;font-size:12px;color:#5b6b85;display:flex;gap:18px;flex-wrap:wrap"><span><b style="font-family:' + MONO + ';color:#1b4f9c">F12</b> lettrage</span><span><b style="font-family:' + MONO + ';color:#1b4f9c">Double-clic / Entrée</b> ouvre l\'écriture</span><span><b style="font-family:' + MONO + ';color:#1b4f9c">Inser</b> joindre une pièce</span><span><b style="font-family:' + MONO + ';color:#1b4f9c">Espace</b> sélectionner</span><span><b style="font-family:' + MONO + ';color:#1b4f9c">Ctrl+A</b> tout sélectionner</span><span><b style="font-family:' + MONO + ';color:#1b4f9c">Ctrl+←/→</b> compte précédent / suivant</span><span><b style="font-family:' + MONO + ';color:#1b4f9c">Échap</b> fermer</span></div>';
    document.body.appendChild(p);
    S.path = location.pathname;
    placePanel(p);

    // valeurs initiales
    const modeSel = p.querySelector('[data-mode]');
    modeSel.innerHTML = '<option value="">Tous les comptes</option><optgroup label="Fournisseurs">' +
      ACC_MODES.filter((m) => m.side === 'fourn').map((m) => '<option value="' + m.key + '">' + m.label + '</option>').join('') +
      '</optgroup><optgroup label="Clients">' + ACC_MODES.filter((m) => m.side === 'client').map((m) => '<option value="' + m.key + '">' + m.label + '</option>').join('') + '</optgroup>' +
      '<optgroup label="Comptes généraux">' + ACC_MODES.filter((m) => m.side === 'plan').map((m) => '<option value="' + m.key + '">' + m.label + '</option>').join('') + '</optgroup>';
    p.querySelector('[data-start]').value = isoToFr(S.start);
    p.querySelector('[data-end]').value = isoToFr(S.end);
    p.querySelector('[data-lett]').value = S.lett;
    p.querySelector('[data-mode]').value = S.accMode;
    applyColW(p);
    wire(p);
    document.addEventListener('keydown', onDocKey, true);
    window.addEventListener('keydown', onDocKey, true);
    p.setAttribute('tabindex', '-1');
    updateAccountUi();
    render();
    S.quietFocus = true; p.querySelector('[data-acc]').focus(); S.quietFocus = false;
  }

  function wire(p) {
    p.addEventListener('click', (ev) => {
      const a = ev.target.closest('[data-act]');
      if (a) {
        const act = a.dataset.act;
        if (act === 'close') closePanel();
        else if (act === 'print') window.print();
        else if (act === 'xlsx') exportXlsx();
        else if (act === 'prev') stepAccount(-1);
        else if (act === 'next') stepAccount(1);
        else if (act === 'reset') resetFilters();
        else if (act === 'monthly') {
          S.monthly = ((S.monthly || 0) + 1) % 3;
          if (S.monthly && S.sortK !== 'date') { S.sortK = 'date'; S.sortD = 1; }
          a.style.background = S.monthly ? '#0f2a52' : '#fff'; a.style.color = S.monthly ? '#fff' : '#0f2a52';
          a.textContent = S.monthly === 1 ? 'Sous-totaux + détail' : S.monthly === 2 ? 'Sous-totaux seuls' : 'Sous-total mensuel';
          render();
        }
        
        return;
      }
      const cpn = ev.target.closest && ev.target.closest('[data-cpnum]');
      if (cpn) { hideCpPop(); goAccount(cpn.dataset.cpnum); return; }
      const cbx = ev.target.closest && ev.target.closest('[data-body] input[type=checkbox]');
      if (cbx) {
        const cid = +cbx.closest('tr').dataset.id;
        if (ev.shiftKey && S.anchor != null) { ev.preventDefault(); selectRange(cid, ev.ctrlKey || ev.metaKey); }
        return;
      }
      if (ev.target.closest('[data-rz]')) return;
      const th = ev.target.closest('[data-sort]');
      if (th) { const k = th.dataset.sort; if (S.sortK === k) S.sortD = -S.sortD; else { S.sortK = k; S.sortD = 1; } render(); return; }
      const tr = ev.target.closest('tr[data-id]');
      if (!tr || ev.target.matches('input')) return;
      const id = +tr.dataset.id;
      const old = p.querySelector('tr.act');
      if (old && old !== tr) old.classList.remove('act');
      tr.classList.add('act');
      S.active = id;
      const l = S.lines.find((x) => x.id === id);
      if (!l) return;
      if (ev.target.closest('[data-pj]')) { if (l.pj) openPj(l); else attachPiece(l); return; }
      if (ev.target.closest('[data-com]') && ev.detail < 2) { openComments(l, ev); return; }
      if (ev.detail >= 2) { openEntry(l, ev); return; }
      if (ev.shiftKey) selectRange(id, ev.ctrlKey || ev.metaKey);
      else if (ev.ctrlKey || ev.metaKey) { S.anchor = id; if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id); render(true); }
      else { S.anchor = id; S.sel = new Set([id]); render(true); }
    });
    p.addEventListener('mousedown', (ev) => { if (ev.shiftKey && ev.target.closest && ev.target.closest('[data-body] tr[data-id]')) ev.preventDefault(); }, true);

    p.addEventListener('mousedown', (ev) => {
      const rz = ev.target.closest && ev.target.closest('[data-rz]');
      if (!rz) return;
      ev.preventDefault(); ev.stopPropagation();
      const col = COLS.find((c) => c.k === rz.dataset.rz);
      const x0 = ev.clientX, w0 = col.w;
      const mv = (e) => { col.w = Math.max(40, Math.round(w0 + e.clientX - x0)); applyColW(p); };
      const up = () => { document.removeEventListener('mousemove', mv, true); document.removeEventListener('mouseup', up, true); saveColW(); };
      document.addEventListener('mousemove', mv, true); document.addEventListener('mouseup', up, true);
    }, true);
    p.addEventListener('mousedown', (ev) => {
      const th = ev.target.closest && ev.target.closest('th[data-col]');
      if (th) th.draggable = !ev.target.closest('[data-rz]');
    }, true);
    p.addEventListener('dragstart', (ev) => {
      const th = ev.target.closest && ev.target.closest('th[data-col]');
      if (!th) return;
      S.dragCol = th.dataset.col;
      try { ev.dataTransfer.setData('text/plain', S.dragCol); ev.dataTransfer.effectAllowed = 'move'; } catch (e) { /* ignore */ }
    });
    p.addEventListener('dragover', (ev) => {
      const th = ev.target.closest && ev.target.closest('th[data-col]');
      if (!th || !S.dragCol) return;
      ev.preventDefault();
      p.querySelectorAll('th.dragover').forEach((x) => x.classList.remove('dragover'));
      if (th.dataset.col !== S.dragCol) th.classList.add('dragover');
    });
    p.addEventListener('drop', (ev) => {
      const th = ev.target.closest && ev.target.closest('th[data-col]');
      const from = S.dragCol; S.dragCol = null;
      p.querySelectorAll('th.dragover').forEach((x) => x.classList.remove('dragover'));
      if (!th || !from || th.dataset.col === from) return;
      ev.preventDefault();
      const fi = COLS.findIndex((c) => c.k === from), ti = COLS.findIndex((c) => c.k === th.dataset.col);
      if (fi < 0 || ti < 1) return;
      const [mv] = COLS.splice(fi, 1);
      COLS.splice(ti, 0, mv);
      saveColOrder(); S.rebuildHead(); render(true);
    });
    p.addEventListener('dragend', () => { S.dragCol = null; p.querySelectorAll('th.dragover').forEach((x) => x.classList.remove('dragover')); });
    p.addEventListener('dblclick', (ev) => {
      const rz = ev.target.closest && ev.target.closest('[data-rz]');
      if (!rz) return;
      ev.preventDefault(); ev.stopPropagation(); autoFitCols();
    }, true);
    p.addEventListener('contextmenu', (ev) => {
      const c = ev.target.closest && ev.target.closest('[data-pj]');
      if (!c) return;
      const tr = c.closest('tr[data-id]');
      const l = tr && S.lines.find((x) => x.id === +tr.dataset.id);
      if (!l) return;
      ev.preventDefault(); ev.stopPropagation();
      showPjMenu(l, ev);
    });
    p.addEventListener('mouseover', (ev) => {
      const cc = ev.target.closest('[data-cp]');
      if (cc) { const tr0 = cc.closest('tr[data-id]'); const l0 = tr0 && S.lines.find((x) => x.id === +tr0.dataset.id); if (l0) showCpPop(l0, cc.dataset.cp, cc); return; }
      const c = ev.target.closest('[data-pj]');
      if (!c || (ev.relatedTarget && c.contains(ev.relatedTarget))) return;
      const tr = c.closest('tr[data-id]');
      const l = tr && S.lines.find((x) => x.id === +tr.dataset.id);
      apiLog.push('HOVER pj entry=' + (l && l.entryId) + ' pj=' + (l && l.pj));
      if (l) showPjPreview(l);
    });
    p.addEventListener('mouseout', (ev) => {
      if (ev.target.closest && ev.target.closest('[data-cp]')) { scheduleHideCpPop(); return; }
      const c = ev.target.closest('[data-pj]');
      if (c && !(ev.relatedTarget && c.contains(ev.relatedTarget))) { clearTimeout(pjTimer); hidePjPreview(); }
    });
    p.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.matches('[data-body] input[type=checkbox]')) { toggleSel(+t.closest('tr').dataset.id); return; }
      if (t.matches('[data-all]')) { S.shown.forEach((l) => { if (t.checked) S.sel.add(l.id); else S.sel.delete(l.id); }); render(true); return; }
      if (t.matches('[data-lett]')) { S.lett = t.value; render(); }
      else if (t.matches('[data-mode]')) applyAccMode(t.value);
      else if (t.matches('[data-aop]')) { S.amtOp = t.value; render(); }
      else if (t.matches('[data-start],[data-end]')) changePeriod();
    });
    [['[data-acomp]', 'perm'], ['[data-acoma]', 'ann']].forEach(([sel, kind]) => {
      const el = p.querySelector(sel);
      el.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') { saveAccCom(kind, el); el.blur(); } else if (ev.key === 'Escape') { el.value = (S.accCom && S.accCom[kind] ? S.accCom[kind].text : ''); el.blur(); } });
      el.addEventListener('blur', () => saveAccCom(kind, el));
    });
    p.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.matches('[data-f]')) { S.fil[t.dataset.f] = t.value; render(true); }
      else if (t.matches('[data-aval]')) { S.amtVal = t.value; render(true); }
      else if (t.matches('[data-atol]')) { S.amtTol = t.value; render(true); }
      else if (t.matches('[data-q]')) { S.qText = t.value; render(true); }
      else if (t.matches('[data-acc]')) { S.ddQ = t.value; S.ddIdx = 0; S.ddOpen = true; renderDropdown(); }
    });
    const ai = p.querySelector('[data-acc]');
    ai.addEventListener('focus', () => { if (S.quietFocus) { S.quietFocus = false; ai.select(); return; } S.ddOpen = true; S.ddQ = ''; S.ddIdx = Math.max(0, accItems().findIndex((a) => a.num === S.acc)); ai.select(); renderDropdown(); });
    ai.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== ai) { closeDropdown(); updateAccountUi(); } }, 150));
    ai.addEventListener('keydown', (ev) => {
      if (ev.ctrlKey) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); S.ddIdx = Math.min((S.ddItems || []).length - 1, S.ddIdx + 1); renderDropdown(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); S.ddIdx = Math.max(0, S.ddIdx - 1); renderDropdown(); }
      else if (ev.key === 'Escape') { ev.stopPropagation(); closeDropdown(); ai.blur(); }
      else if (ev.key === 'Enter') {
        ev.preventDefault();
        const it = (S.ddItems || [])[S.ddIdx];
        closeDropdown();
        if (it) selectAccount(it.num); else pickAccountFromInput(ai.value);
        ai.blur();
      }
    });
    p.addEventListener('mousedown', (ev) => {
      const it = ev.target.closest('[data-dd] [data-num]');
      if (!it) return;
      ev.preventDefault();
      closeDropdown();
      selectAccount(it.dataset.num);
      ai.blur();
    });
  }

  function resetFilters() {
    S.lett = 'all'; S.amtVal = ''; S.amtTol = '0'; S.amtOp = '='; S.qText = '';
    Object.keys(S.fil).forEach((k) => (S.fil[k] = ''));
    const p = document.getElementById(PANEL_ID);
    p.querySelectorAll('[data-f]').forEach((i) => (i.value = ''));
    p.querySelector('[data-lett]').value = 'all';
    p.querySelector('[data-aval]').value = ''; p.querySelector('[data-atol]').value = '0'; p.querySelector('[data-aop]').value = '=';
    p.querySelector('[data-q]').value = '';
    render();
  }

  // Exercices du dossier : GET /exercices?society_id= (appel natif relevé). Lecture tolérante : objets portant une date de début et une de fin.
  const exCache = {};
  function toIsoDate(v) {
    const t = String(v == null ? '' : v).trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    return frToIso(t);
  }
  function parseExercises(root) {
    const out = [];
    (function w(n) {
      if (Array.isArray(n)) { n.forEach(w); return; }
      if (!n || typeof n !== 'object') return;
      let st = '', en = '';
      Object.keys(n).forEach((k) => {
        if (n[k] && typeof n[k] === 'object') return;
        const d = toIsoDate(n[k]);
        if (!d) return;
        if (!st && /(deb|start|begin)/i.test(k)) st = d;
        else if (!en && /(fin|end)/i.test(k)) en = d;
      });
      if (st && en && st < en) out.push({ start: st, end: en });
      else Object.keys(n).forEach((k) => { if (n[k] && typeof n[k] === 'object') w(n[k]); });
    })(root);
    const seen = {};
    return out.filter((e) => (seen[e.start + e.end] ? false : (seen[e.start + e.end] = true))).sort((a, b) => (a.start < b.start ? -1 : 1));
  }
  function pickPeriod(exs, todayIso) {
    if (!exs.length) return null;
    let n = exs.find((e) => e.start <= todayIso && todayIso <= e.end);
    if (!n) { const past = exs.filter((e) => e.start <= todayIso); n = past.length ? past[past.length - 1] : exs[0]; }
    const nxt = exs.find((e) => e.start > n.end && e.start <= addDaysIso(n.end, 7));
    return { start: n.start, end: nxt ? nxt.end : n.end };
  }
  function addDaysIso(iso, d) { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); }
  async function exercisePeriod() {
    const soc = societyId();
    if (!soc) return null;
    if (!exCache[soc]) {
      const raw = await getJson('/exercices?society_id=' + encodeURIComponent(soc));
      try { apiLog.push('EXERCICES ' + JSON.stringify(raw).slice(0, 700)); } catch (e) { /* ignore */ }
      exCache[soc] = parseExercises(raw);
    }
    return pickPeriod(exCache[soc], new Date().toISOString().slice(0, 10));
  }
  function defaultPeriod() {
    const y = new Date().getFullYear();
    return { start: (y - 1) + '-01-01', end: y + '-12-31' };
  }
  function setYear(act) {
    const y = new Date().getFullYear();
    if (act === 'yN') { S.start = y + '-01-01'; S.end = y + '-12-31'; }
    else if (act === 'yN1') { S.start = (y - 1) + '-01-01'; S.end = (y - 1) + '-12-31'; }
    else { S.start = (y - 1) + '-01-01'; S.end = y + '-12-31'; }
    const p = document.getElementById(PANEL_ID);
    p.querySelector('[data-start]').value = isoToFr(S.start);
    p.querySelector('[data-end]').value = isoToFr(S.end);
    afterPeriodChange();
  }
  function changePeriod() {
    const p = document.getElementById(PANEL_ID);
    const a = frToIso(p.querySelector('[data-start]').value), b = frToIso(p.querySelector('[data-end]').value);
    if (!a || !b || a > b) { toast('Période invalide (jj/mm/aaaa)'); return; }
    S.start = a; S.end = b;
    afterPeriodChange();
  }
  async function afterPeriodChange() {
    S.accAll = []; S.accCache = {};
    try { localStorage.setItem('tmbcCpPeriod', S.start + '|' + S.end); } catch (e) { /* ignore */ }
    await loadAllAccounts();
    if (S.accMode) await applyAccMode(S.accMode, true);
    if (S.acc) await selectAccount(S.acc);
  }

  async function loadAllAccounts() {
    const byNum = {};
    try {
      const list = await withLettering('/api/v1/core/accounting/account/search', { idEtablissement: societyId(), startDate: S.start, endDate: S.end });
      (Array.isArray(list) ? list : []).forEach((x) => {
        byNum[String(x.no_compte)] = { num: String(x.no_compte), id: x.id_compte, label: String(x.intitule_co || ''), lines: x.total_lines, nums: null };
      });
    } catch (e) { apiLog.push('ERR account/search ' + e.message); }
    try {
      const bal = await window.TMBC_GL.loadAccountList(S.start, S.end);
      bal.forEach((x) => {
        const o = byNum[x.num];
        if (o) { o.nums = x.nums; if (!o.label) o.label = x.label; }
        else byNum[x.num] = { num: x.num, id: x.id, label: x.label, lines: null, nums: x.nums };
      });
    } catch (e) { apiLog.push('ERR balance list ' + e.message); if (!Object.keys(byNum).length) toast('Liste des comptes : ' + e.message); }
    S.accAll = Object.keys(byNum).map((k) => byNum[k]).sort((a, b) => (a.num < b.num ? -1 : a.num > b.num ? 1 : 0));
    updateAccountUi();
  }

  function labelFor(num) {
    const a = S.accAll.find((x) => x.num === num);
    return a ? a.label : '';
  }

  function guessSolde(a) {
    const n = a.nums || {};
    const keys = Object.keys(n);
    const bad = /(n_?1|n-1|prev|compare|anterieur|precedent|simul|budget)/i;
    let k = keys.find((x) => /^solde$/i.test(x)) || keys.find((x) => /solde|balance/i.test(x) && !bad.test(x));
    if (k) return n[k];
    const dk = keys.find((x) => /debit/i.test(x) && !bad.test(x)), ck = keys.find((x) => /credit/i.test(x) && !bad.test(x));
    return dk && ck ? r2(n[dk] - n[ck]) : null;
  }
  function accItems() {
    if (S.accList) {
      return S.accList.map((num) => {
        const a = S.sideAcc && S.sideAcc[num];
        return { num, label: (a && a.label) || labelFor(num), solde: a ? a.solde : null };
      });
    }
    return S.accAll.map((a) => ({ num: a.num, label: a.label, solde: guessSolde(a), n: a.lines }));
  }
  function renderDropdown() {
    const p = document.getElementById(PANEL_ID);
    if (!p) return;
    const dd = p.querySelector('[data-dd]');
    if (!S.ddOpen) { dd.style.display = 'none'; return; }
    const q = norm(S.ddQ).trim();
    let items = accItems();
    if (q) items = items.filter((a) => a.num.toLowerCase().indexOf(q) === 0 || norm(a.num + ' ' + a.label).indexOf(q) !== -1);
    const total = items.length;
    items = items.slice(0, 300);
    S.ddItems = items;
    if (S.ddIdx >= items.length) S.ddIdx = items.length - 1;
    if (S.ddIdx < 0) S.ddIdx = 0;
    const head = '<div style="padding:5px 10px;font-size:11px;color:#5b6b85;background:#f3f6fb;position:sticky;top:0">' + (S.accList ? 'Comptes du filtre : ' + total : 'Tous les comptes : ' + total) + '</div>';
    dd.innerHTML = head + (items.length ? items.map((a, i) =>
      '<div data-num="' + esc(a.num) + '" style="display:flex;gap:10px;padding:4px 10px;cursor:pointer;background:' + (i === S.ddIdx ? '#dbe8fb' : a.num === S.acc ? '#f0f5ff' : '#fff') + '">' +
      '<span style="font-family:' + MONO + ';min-width:92px">' + esc(a.num) + '</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.label) + '</span>' +
      '<span style="font-family:' + MONO + ';text-align:right;min-width:100px;' + (a.solde != null && a.solde < 0 ? 'color:#c62828' : '') + '">' + (a.solde != null ? fmt(a.solde) : a.n != null ? '<span style="color:#8a97ab;font-family:Segoe UI,sans-serif">' + a.n + ' lig.</span>' : '') + '</span></div>'
    ).join('') : '<div style="padding:12px;color:#5b6b85">Aucun compte</div>') + (total > 300 ? '<div style="padding:5px 10px;font-size:11px;color:#5b6b85">… affine la saisie pour voir les ' + (total - 300) + ' autres</div>' : '');
    dd.style.display = 'block';
    const cur = dd.querySelector('[data-num]:nth-of-type(' + (S.ddIdx + 2) + ')');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function closeDropdown() { S.ddOpen = false; renderDropdown(); }

  function updateAccountUi() {
    const p = document.getElementById(PANEL_ID);
    if (!p) return;
    const inp = p.querySelector('[data-acc]');
    if (document.activeElement !== inp) inp.value = S.acc ? S.acc + (S.accLabel ? ' – ' + S.accLabel : '') : '';
    const cnt = p.querySelector('[data-count]');
    if (S.accList) cnt.textContent = (S.accIdx >= 0 ? S.accIdx + 1 : '–') + ' / ' + S.accList.length;
    else cnt.textContent = S.loading ? '…' : '';
    refreshAccComUi();
    if (S.ddOpen) renderDropdown();
  }
  // ---- Commentaires de compte (ceux du dossier annuel) : GET/POST /comments (appels natifs relevés en direct) ----
  let drSeen = null; // dossier_revision_id de l'exercice courant, relevé sur les appels natifs (jamais recalculé)
  function currentDr() {
    if (drSeen) return drSeen;
    try { const v = parseInt(localStorage.getItem('tmbcCpDr|' + societyId()), 10); return v || null; } catch (e) { return null; }
  }
  function refreshAccComUi() {
    const p = document.getElementById(PANEL_ID);
    if (!p) return;
    const c = S.accCom && S.accCom.num === S.acc ? S.accCom : null;
    [['[data-acomp]', 'perm'], ['[data-acoma]', 'ann']].forEach(([sel, kind]) => {
      const el = p.querySelector(sel);
      if (!el || document.activeElement === el) return;
      const d = c && c[kind];
      el.value = d ? d.text : '';
      el.title = d && d.all ? d.all : (kind === 'ann' && !currentDr() ? 'Exercice inconnu : ouvre une fois le dossier annuel (Révision) pour que le panneau le relève' : 'Clic pour saisir ; Entrée ou sortie du champ = enregistre un nouveau commentaire dans MyUnisoft');
      el.disabled = kind === 'ann' && !currentDr();
    });
  }
  async function loadAccComments(num) {
    const acc = S.accAll.find((x) => x.num === num);
    S.accCom = { num, perm: null, ann: null };
    refreshAccComUi();
    if (!acc || !acc.id) return;
    const fmtC = (arr) => {
      const last = arr.length ? htmlToText(arr[arr.length - 1].body) : '';
      return { text: last, id: arr.length ? arr[arr.length - 1].id : null, n: arr.length, all: arr.map((x) => (x.name || '') + ' ' + String(x.date || '').slice(0, 10) + ' : ' + htmlToText(x.body)).join('\n') };
    };
    const get = async (qs) => {
      const r = await tokFetch(PROD_WS + '/comments?' + qs, () => ({ headers: getHeaders(), credentials: 'include' }));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    };
    try { S.accCom.perm = fmtC(await get('account_id=' + acc.id)); } catch (e) { apiLog.push('ERR comment compte perm ' + e.message); }
    const dr = currentDr();
    if (dr) { try { S.accCom.ann = fmtC(await get('account_id=' + acc.id + '&dossier_revision_id=' + dr)); } catch (e) { apiLog.push('ERR comment compte annuel ' + e.message); } }
    if (S.acc === num || true) refreshAccComUi();
  }
  async function saveAccCom(kind, el) {
    if (el.__saving) return;
    el.__saving = true;
    try { await saveAccCom2(kind, el); } finally { el.__saving = false; }
  }
  async function saveAccCom2(kind, el) {
    const txt = el.value.trim();
    const c = S.accCom;
    if (!c || c.num !== S.acc) return;
    const cur = c[kind] ? c[kind].text : '';
    const curId = c[kind] ? c[kind].id : null;
    if (txt === cur) return;
    const acc = S.accAll.find((x) => x.num === S.acc);
    if (!acc || !acc.id) return;
    const esc2 = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const loc = kind === 'perm' ? { location: 'PERMANENT_ACCOUNT', account_id: acc.id } : { location: 'ACCOUNT', account_id: acc.id, dossier_revision_id: currentDr() };
    if (kind === 'ann' && !loc.dossier_revision_id) return;
    try {
      let r;
      if (!txt) {
        if (!curId) return;
        if (!window.confirm('Supprimer le commentaire ' + (kind === 'perm' ? 'permanent' : 'annuel') + ' du compte ' + S.acc + ' ?')) { el.value = cur; return; }
        r = await tokFetch(PROD_WS + '/comments/' + curId, () => ({ method: 'DELETE', headers: getHeaders(), credentials: 'include' }));
      } else if (curId) {
        r = await tokFetch(PROD_WS + '/comments/' + curId, () => ({ method: 'PUT', headers: getHeaders(), credentials: 'include', body: JSON.stringify(Object.assign({}, loc, { comment: '<p>' + esc2(txt) + '</p>' })) }));
      } else {
        r = await tokFetch(PROD_WS + '/comments?', () => ({ method: 'POST', headers: getHeaders(), credentials: 'include', body: JSON.stringify(Object.assign({}, loc, { comment: '<p>' + esc2(txt) + '</p>', summary: false })) }));
      }
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 160));
      toast('Commentaire ' + (kind === 'perm' ? 'permanent' : 'annuel') + (!txt ? ' supprimé.' : curId ? ' modifié.' : ' enregistré.'));
      await loadAccComments(S.acc);
    } catch (e) { apiLog.push('ERR save comment compte ' + e.message); toast('Commentaire du compte : ' + e.message); }
  }

  async function applyAccMode(key, keepAcc) {
    S.accMode = key;
    const p = document.getElementById(PANEL_ID);
    if (p) p.querySelector('[data-mode]').value = key;
    if (!key) { S.accList = null; S.sideAcc = null; S.accIdx = -1; updateAccountUi(); return; }
    const m = ACC_MODES.find((x) => x.key === key);
    setBusy(true, 'Recherche des comptes…');
    try {
      const accs = m.side === 'plan' ? S.accAll : await loadSide(m.side);
      const cut = cutoff60();
      const hit = accs.filter((a) => m.test(a, cut));
      S.sideAcc = {};
      hit.forEach((a) => (S.sideAcc[a.num] = a));
      S.accList = hit.map((a) => a.num).sort();
      S.accIdx = -1;
      toast(S.accList.length + ' compte(s) : ' + m.label);
      updateAccountUi();
      if (S.accList.length && !keepAcc) {
        const at = S.acc ? S.accList.indexOf(S.acc) : -1;
        await selectAccount(S.accList[at >= 0 ? at : 0]);
      }
    } catch (e) {
      toast('Filtre de comptes : ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  function stepAccount(dir) {
    const list = S.accList || S.accAll.map((a) => a.num);
    if (!list.length) return;
    let i = list.indexOf(S.acc);
    if (i < 0) i = dir > 0 ? -1 : 0;
    i = (i + dir + list.length) % list.length;
    selectAccount(list[i]);
  }
  function pickAccountFromInput(v) {
    const m = /^\s*([0-9A-Za-z]+)/.exec(v || '');
    if (m) selectAccount(m[1]);
  }

  function setBusy(on, msg) {
    S.loading = on;
    const p = document.getElementById(PANEL_ID);
    if (!p) return;
    const info = p.querySelector('[data-info]');
    if (info) info.textContent = on ? (msg || 'Chargement…') : info.textContent;
    p.style.cursor = on ? 'progress' : '';
  }

  async function selectAccount(num) {
    if (!num) return;
    setBusy(true, 'Chargement du compte ' + num + '…');
    try {
      const a = await loadAccountLines(num);
      if (a.lines.length > MAX_LINES && !window.confirm('Le compte ' + num + ' compte ' + a.lines.length + ' lignes. Les afficher quand même ?')) { setBusy(false); return; }
      S.acc = num;
      try { localStorage.setItem('tmbcCpLastAcc|' + societyId(), num); } catch (e) { /* ignore */ }
      S.accLabel = a.label || labelFor(num);
      S.lines = a.lines;
      S.sel = new Set();
      S.active = 0;
      S.accIdx = S.accList ? S.accList.indexOf(num) : -1;
      hidePjPreview(); closeCommentPopup();
      const p = document.getElementById(PANEL_ID);
      const info = p.querySelector('[data-info]');
      info.textContent = num + (S.accLabel ? ' – ' + S.accLabel : '') + ' · du ' + isoToFr(S.start) + ' au ' + isoToFr(S.end);
      S.ddOpen = false;
      updateAccountUi();
      render();
      prefetchComments(S.lines);
      loadAccComments(num);
      updateCpHeaders();
      loadCounterparts(num);
    } catch (e) {
      toast('Consultation : ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------
  // Filtrage / tri / rendu
  // ------------------------------------------------------------------
  function computeShown() {
    const f = S.fil;
    const mLib = textMatcher(f.lib), mJnl = textMatcher(f.jnl), mLett = textMatcher(f.lett), mPiece = textMatcher(f.piece), mCom = textMatcher(f.com);
    const mDate = dateMatcher(f.date), mEch = dateMatcher(f.ech);
    const mDeb = numMatcher(f.deb), mCre = numMatcher(f.cre), mSolde = numMatcher(f.solde), mMs = msMatcher(f.ms);
    const mWho = textMatcher(f.who);
    const mCpT = textMatcher(f.cpttc), mCpH = textMatcher(f.cpht), mCpV = textMatcher(f.cptva);
    const mQ = textMatcher(S.qText);
    let amtTest = null;
    const av = parseNum(S.amtVal);
    if (!isNaN(av)) {
      const tol = Math.abs(parseNum(S.amtTol) || 0) + 0.0049;
      const op = S.amtOp;
      amtTest = (l) => {
        const a = l.d || l.c;
        if (op === '=') return Math.abs(a - av) <= tol;
        if (op === '>=') return a >= av - tol;
        if (op === '<=') return a <= av + tol;
        return Math.abs(a - av) > tol;
      };
    }
    let rows = S.lines.filter((l) => {
      if (S.lett === 'non' && l.lett) return false;
      if (S.lett === 'let' && !l.lett) return false;
      if (mDate && !mDate(l.date || '')) return false;
      if (mJnl && !mJnl(l.jnl)) return false;
      if (mLett && !mLett(l.lett)) return false;
      if (mLib && !mLib(l.lib)) return false;
      if (mPiece && !mPiece(l.piece + ' ' + l.piece2)) return false;
      if (mEch && !mEch(l.ech || '')) return false;
      if (mCom && !mCom(l.com)) return false;
      if (mWho && !mWho(l.who)) return false;
      if (mCpT && !mCpT(l.cpttc || '')) return false;
      if (mCpH && !mCpH(l.cpht || '')) return false;
      if (mCpV && !mCpV(l.cptva || '')) return false;
      if (mDeb && !mDeb(l.d)) return false;
      if (mCre && !mCre(l.c)) return false;
      if (mSolde && !mSolde(l.solde)) return false;
      if (mMs && !mMs(l.ms)) return false;
      if (amtTest && !amtTest(l)) return false;
      if (mQ && !mQ([l.dateTxt, l.jnl, l.lett, l.lib, l.piece, l.piece2, l.com, l.who, fmt(l.d), fmt(l.c), fmt(l.solde)].join(' | '))) return false;
      return true;
    });
    const k = S.sortK, dir = S.sortD;
    rows = rows.slice().sort((a, b) => {
      let va = a[k], vb = b[k];
      if (va == null) va = typeof vb === 'number' ? 0 : '';
      if (vb == null) vb = typeof va === 'number' ? 0 : '';
      if (typeof va === 'string' || typeof vb === 'string') { va = norm(String(va)); vb = norm(String(vb)); }
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return a.id - b.id;
    });
    return rows;
  }

  const txt = (v) => { const t = String(v == null ? '' : v); return esc(t) + (/^[\d\s.,]+$/.test(t.trim()) && t.trim() ? '\u2060' : ''); };
  function cellFor(k, l, on) {
    switch (k) {
      case 'chk': return '<td style="text-align:center"><input type="checkbox" aria-label="Sélectionner"' + (on ? ' checked' : '') + '></td>';
      case 'date': return '<td class="m">' + esc(l.dateTxt) + '</td>';
      case 'jnl': return '<td>' + txt(l.jnl) + '</td>';
      case 'lett': return '<td class="m" style="color:#0f6b4a">' + txt(l.lett) + '</td>';
      case 'lib': return '<td title="' + esc(l.lib) + '">' + txt(l.lib) + '</td>';
      case 'deb': return '<td class="n">' + (l.d ? fmt(l.d) : '') + '</td>';
      case 'cre': return '<td class="n cr">' + (l.c ? fmt(l.c) : '') + '</td>';
      case 'solde': return '<td class="n' + (l.solde < 0 ? ' neg' : '') + '">' + fmt(l.solde) + '</td>';
      case 'ms': return '<td class="n' + (l.ms < 0 ? ' neg' : '') + '">' + fmt(l.ms) + '</td>';
      case 'cpttc': case 'cpht': case 'cptva': return cpCell(l, k);
      case 'piece': return '<td>' + txt(l.piece) + (l.piece2 ? ' / ' + txt(l.piece2) : '') + '</td>';
      case 'pj': return '<td data-pj style="text-align:center;color:#1b4f9c;cursor:pointer" title="' + (l.pj ? 'Survol : aperçu · clic : ouvrir · ' : '') + 'Inser : ajouter une pièce">' + (l.pj ? CLIP : '') + '</td>';
      case 'ech': return '<td class="m" style="color:#5b6b85">' + esc(l.ech ? isoToFr(l.ech) : '') + '</td>';
      case 'com': return '<td data-com title="' + esc(l.com) + '" style="color:#3a4a63;cursor:text">' + (l.comN > 1 ? '(' + l.comN + ') ' : '') + esc(l.com) + '</td>';
      case 'who': return '<td title="' + esc(l.who) + '" style="color:#3a4a63">' + txt(l.who) + '</td>';
      default: return '<td></td>';
    }
  }
  // ligne de totaux / sous-totaux construite colonne par colonne (suit l'ordre des colonnes)
  function rowCells(cls, label, vals, bold) {
    let lead = 0;
    while (lead < COLS.length && !vals[COLS[lead].k]) lead++;
    const out = ['<tr class="' + cls + '">'];
    if (lead > 0) out.push('<td colspan="' + lead + '" style="text-align:left">' + esc(label) + '</td>');
    for (let i = lead; i < COLS.length; i++) {
      const v = vals[COLS[i].k];
      out.push(v ? '<td class="n' + (v.neg ? ' neg' : '') + (v.cr ? ' cr' : '') + '" style="text-align:right' + (bold ? ';font-weight:700' : '') + '">' + fmt(v.v) + '</td>' : '<td></td>');
    }
    out.push('</tr>');
    return out.join('');
  }
  // ajustement automatique de la largeur des colonnes (sauf Commentaire)
  function autoFitCols() {
    const p = document.getElementById(PANEL_ID);
    if (!p) return;
    const rows = S.shown && S.shown.length ? S.shown : S.lines;
    let td = 0, tc = 0;
    rows.forEach((l) => { td += l.d; tc += l.c; });
    const val = {
      date: (l) => l.dateTxt, jnl: (l) => l.jnl, lett: (l) => l.lett, lib: (l) => l.lib,
      deb: (l) => (l.d ? fmt(l.d) : ''), cre: (l) => (l.c ? fmt(l.c) : ''), solde: (l) => fmt(l.solde), ms: (l) => fmt(l.ms),
      cpttc: (l) => l.cpttc || '', cpht: (l) => l.cpht || '', cptva: (l) => l.cptva || '',
      piece: (l) => l.piece + (l.piece2 ? ' / ' + l.piece2 : ''), ech: (l) => (l.ech ? isoToFr(l.ech) : ''), who: (l) => l.who,
    };
    const cls = { date: 'm', lett: 'm', ech: 'm', deb: 'n', cre: 'n', solde: 'n', ms: 'n' };
    // sonde cachée : même table / mêmes styles que le tableau réel, largeur automatique
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none';
    probe.innerHTML = '<table style="table-layout:auto;width:auto;border-collapse:separate;border-spacing:0"><thead><tr><th class="h" data-pr="h" style="position:static;width:auto"></th></tr></thead><tbody><tr><td data-pr="c" style="width:auto;overflow:visible;text-overflow:clip"></td></tr></tbody></table>';
    p.appendChild(probe);
    const th = probe.querySelector('[data-pr=h]'), tdp = probe.querySelector('[data-pr=c]');
    const widthOf = (el, html, klass, bold) => { el.className = klass; el.style.fontWeight = bold ? '700' : ''; el.innerHTML = html; return el.offsetWidth; };
    COLS.forEach((c) => {
      if (c.k === 'chk' || c.k === 'com') return;
      if (c.k === 'pj') { c.w = 54; return; }
      let w = c.t ? widthOf(th, esc(c.t) + ' <span>▲</span>', 'h' + (c.sort ? ' s' : ''), false) + 8 : 40;
      const g = val[c.k];
      if (g) {
        const strs = Array.from(new Set(rows.map(g).filter(Boolean)));
        strs.sort((x, y) => y.length - x.length);
        strs.slice(0, 30).forEach((t) => { w = Math.max(w, widthOf(tdp, esc(t) + (/^cp/.test(c.k) ? ' +9' : ''), cls[c.k] || '', false)); });
      }
      const tot = c.k === 'deb' ? td : c.k === 'cre' ? tc : (c.k === 'solde' || c.k === 'ms') ? r2(td - tc) : null;
      if (tot != null) w = Math.max(w, widthOf(tdp, fmt(tot), 'n', true), widthOf(tdp, fmt(-Math.abs(tot) - 0.01), 'n', true));
      c.w = Math.max(50, Math.min(c.k === 'lib' ? 460 : 320, Math.ceil(w + 14)));
    });
    probe.remove();
    applyColW(p); saveColW();
    toast('Colonnes ajustées');
  }

  function render(keepScroll) {
    const p = document.getElementById(PANEL_ID);
    if (!p) return;
    const rows = computeShown();
    S.shown = rows;
    let td = 0, tc = 0, tnl = 0, sd = 0, sc = 0, sn = 0;
    const html = [];
    const monthly = S.monthly && S.sortK === 'date';
    let mk = '', md = 0, mc = 0, mn = 0;
    const flushMonth = () => {
      if (!mn) return;
      const ms = r2(md - mc);
      html.push(rowCells('sub', 'Sous-total ' + mk.slice(5, 7) + '/' + mk.slice(0, 4) + ' (' + mn + ')', { deb: { v: md }, cre: { v: mc, cr: true }, solde: { v: ms, neg: ms < 0 }, ms: { v: ms, neg: ms < 0 } }, false));
      md = 0; mc = 0; mn = 0;
    };
    rows.forEach((l) => {
      if (monthly) { const k2 = String(l.date).slice(0, 7); if (k2 !== mk) { flushMonth(); mk = k2; } md += l.d; mc += l.c; mn++; }
      td += l.d; tc += l.c;
      if (!l.lett) tnl += l.d - l.c;
      const on = S.sel.has(l.id);
      if (on) { sd += l.d; sc += l.c; sn++; }
      (monthly && S.monthly === 2 ? { push() {} } : html).push(
        '<tr data-id="' + l.id + '" class="' + (on ? 'sel ' : '') + (l.id === S.active ? 'act' : '') + '">' + COLS.map((c) => cellFor(c.k, l, on)).join('') + '</tr>'
      );
    });
    if (monthly) flushMonth();
    if (!rows.length) html.push('<tr><td colspan="17" style="text-align:center;padding:30px;color:#5b6b85">' + (S.acc ? 'Aucune écriture ne correspond aux filtres.' : 'Choisis un compte ou un filtre de comptes.') + '</td></tr>');
    else {
      const msTot = r2(td - tc);
      html.push(rowCells('tot', 'TOTAUX (' + rows.length + ' écriture' + (rows.length > 1 ? 's' : '') + ')', { deb: { v: td }, cre: { v: tc }, solde: { v: msTot, neg: msTot < 0 }, ms: { v: msTot, neg: msTot < 0 } }, true));
      html.push(rowCells('tot2', 'dont non lettré', { solde: { v: r2(tnl), neg: tnl < 0 }, ms: { v: r2(tnl), neg: tnl < 0 } }, true));
      if (sn) html.push(rowCells('tot3', 'SÉLECTION (' + sn + ')', { deb: { v: sd }, cre: { v: sc }, solde: { v: r2(sd - sc), neg: sd - sc < 0 }, ms: { v: r2(sd - sc), neg: sd - sc < 0 } }, true));
    }
    const body = p.querySelector('[data-body]');
    const sc0 = body.parentElement.parentElement.scrollTop;
    body.innerHTML = html.join('');
    if (keepScroll) body.parentElement.parentElement.scrollTop = sc0;
    let ad = 0, ac = 0;
    S.lines.forEach((l) => { ad += l.d; ac += l.c; });
    const bal = r2(ad - ac);
    const set = (sel, v, neg) => { const e = p.querySelector(sel); e.textContent = v; e.style.color = neg ? '#ff9a9a' : ''; };
    set('[data-td]', fmt(ad)); set('[data-tc]', fmt(ac)); set('[data-ts]', fmt(bal), bal < 0);
    p.querySelector('[data-cnt]').textContent = rows.length + ' écriture' + (rows.length > 1 ? 's' : '') + ' sur ' + S.lines.length;
    p.querySelectorAll('[data-arrow]').forEach((e) => { e.textContent = e.dataset.arrow === S.sortK ? (S.sortD > 0 ? '▲' : '▼') : ''; });
    const all = p.querySelector('[data-all]');
    if (all) all.checked = rows.length > 0 && rows.every((l) => S.sel.has(l.id));
  }

  // ------------------------------------------------------------------
  // Export Excel
  // ------------------------------------------------------------------
  function exportXlsx() {
    if (!S.acc) { toast('Aucun compte affiché'); return; }
    const rows = S.shown;
    const aoa = [];
    aoa.push([{ b: 'Extrait de compte ' + S.acc + (S.accLabel ? ' – ' + S.accLabel : '') }]);
    aoa.push(['Période du ' + isoToFr(S.start) + ' au ' + isoToFr(S.end) + (S.lett === 'non' ? ' · non lettrées' : S.lett === 'let' ? ' · lettrées' : '') + ' · ' + rows.length + ' écriture(s)']);
    aoa.push([]);
    aoa.push(['Date', 'Journal', 'Lettrage', 'Libellé', 'Débit', 'Crédit', 'Solde', 'Montant signé', 'Pièce', 'Compte TTC', 'Compte HT', 'Compte TVA', 'Échéance', 'Commentaire', 'Saisi par'].map((h) => ({ b: h })));
    let td = 0, tc = 0;
    rows.forEach((l) => {
      td += l.d; tc += l.c;
      aoa.push([l.dateTxt, l.jnl, l.lett, l.lib, l.d || '', l.c || '', l.solde, l.ms, l.piece + (l.piece2 ? ' / ' + l.piece2 : ''), cpFull(l, 'cpttc'), cpFull(l, 'cpht'), cpFull(l, 'cptva'), l.ech ? isoToFr(l.ech) : '', l.com, l.who]);
    });
    aoa.push([]);
    aoa.push([{ b: 'Totaux' }, '', '', '', { nb: r2(td) }, { nb: r2(tc) }, { nb: r2(td - tc) }]);
    const blob = buildXlsx(aoa, [12, 6, 8, 42, 14, 14, 14, 14, 18, 12, 40]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Extrait_' + S.acc + '_' + S.start.replace(/-/g, '') + '_' + S.end.replace(/-/g, '') + '.xlsx';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  // ------------------------------------------------------------------
  // Ouverture (menu Tenue) + initialisation
  // ------------------------------------------------------------------
  async function openPremium(startAccount) {
    if (!window.TMBC_GL || !window.TMBC_GL.fetchLedgerRaw) { toast('Consultation Premium : module grand livre (>= 1.11) indisponible'); return; }
    let per = defaultPeriod();
    try { const ex = await Promise.race([exercisePeriod(), new Promise((res) => setTimeout(() => res(null), 4000))]); if (ex) per = ex; } catch (e) { apiLog.push('ERR exercices ' + e.message); }
    S.start = per.start; S.end = per.end;
    S.monthly = 0; S.accCom = null;
    S.acc = ''; S.accLabel = ''; S.lines = []; S.sel = new Set(); S.accMode = ''; S.accList = null; S.sideAcc = null; S.accIdx = -1;
    showPanel();
    await loadAllAccounts();
    const firstWith = S.accAll.find((a) => a.lines > 0) || S.accAll[0];
    let first = firstWith && firstWith.num;
    if (!startAccount) { try { startAccount = localStorage.getItem('tmbcCpLastAcc|' + societyId()) || ''; } catch (e) { /* ignore */ } }
    if (startAccount) {
      const sa = String(startAccount);
      const hit = S.accAll.find((a) => a.num === sa) || S.accAll.find((a) => a.num.replace(/0+$/, '') === sa.replace(/0+$/, '')) || S.accAll.find((a) => a.num.startsWith(sa));
      if (hit) first = hit.num; else if (arguments[0]) toast('Compte ' + sa + ' introuvable dans cette période');
    }
    if (first) await selectAccount(first);
    const pp = document.getElementById(PANEL_ID);
    const ai0 = pp && pp.querySelector('[data-acc]');
    if (ai0) { S.quietFocus = true; ai0.focus(); try { ai0.select(); } catch (e) { /* ignore */ } S.quietFocus = false; }
  }

  function closeNativeMenu() {
    const dlg = document.querySelector('.MuiDialog-root:has(.dialogContainer__menu)') || document.querySelector('[role=dialog]');
    if (!dlg) return;
    dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
    setTimeout(() => {
      const d2 = document.querySelector('.MuiDialog-root:has(.dialogContainer__menu)');
      if (d2) {
        const x = d2.querySelector('.dialogContainer__header button') || Array.from(d2.querySelectorAll('button')).find((b) => !b.textContent.trim());
        if (x) x.click();
      }
    }, 120);
  }

  function dossierOpen() {
    const m = /^\/tab\/(\d+)\//.exec(location.pathname);
    if (!m || m[1] === '0') return false;
    const home = Array.from(document.querySelectorAll('button,a,[role=tab]')).find((e) => {
      if (!/^Accueil$/.test(e.textContent.trim())) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.top < 90;
    });
    if (home && (home.getAttribute('aria-selected') === 'true' || home.getAttribute('aria-current') === 'page' || /(^|\s)(Mui-selected|active|selected)(\s|$)/.test(home.className || ''))) return false;
    return true;
  }
  function ensureMenuItem() {
    if (!dossierOpen()) { const old = document.querySelector('li[data-id="' + LI_ID + '"]'); if (old) old.remove(); return; }
    const consultLi = document.querySelector(NATIVE_CONSULT_SELECTOR);
    if (!consultLi) return;
    if (document.querySelector('li[data-id="' + LI_ID + '"]')) return;
    const li = consultLi.cloneNode(true);
    li.setAttribute('data-id', LI_ID);
    li.removeAttribute('aria-selected');
    li.classList.remove('Mui-selected');
    const span = li.querySelector('span');
    if (span) span.textContent = 'Consultation Premium';
    li.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      closeNativeMenu();
      setTimeout(() => { if (dossierOpen()) openPremium(); }, 150);
    });
    consultLi.parentElement.insertBefore(li, consultLi.nextSibling);
  }

  function scanConsultPremium() {
    if (isDisabled()) { const li = document.querySelector('li[data-id="' + LI_ID + '"]'); if (li) li.remove(); return; }
    ensureMenuItem();
    const p = document.getElementById(PANEL_ID);
    if (p) {
      if (p.style.display === 'none') return;
      if (S.path && location.pathname !== S.path) { closePanel(); return; }
      placePanel(p);
    }
  }

  // Diagnostic temporaire (Ctrl+Alt+J) + journal passif des appels API vus (méthode, chemin, paramètres,
  // corps de requête, début de réponse JSON pour les chemins "intéressants" : pièces, commentaires, écritures…)
  (function installApiLog() {
    const interesting = /letter|lettr|attach|document|comment|ged|piece|pj|file|preview|download|image|pdf|entry|ecriture|consult|accounting|line|annot|note|memo/i;
    const push = (t, max) => { apiLog.push(String(t).slice(0, max || 900)); if (apiLog.length > 220) apiLog.shift(); };
    const lim = (path) => (/searchConsulting|entry\/search/i.test(path) ? 3600 : /all_types|document/i.test(path) ? 1500 : 500);
    const describe = (m, u, body) => {
      try {
        const x = new URL(u, location.href);
        if (!/myunisoft/.test(x.host)) return null;
        if (!/\/comments/.test(x.pathname)) { const mm = /(?:dossier_revision_id|dossierRevisionId|review_id)=(\d+)/.exec(x.search); if (mm) { drSeen = parseInt(mm[1], 10); try { localStorage.setItem('tmbcCpDr|' + societyId(), String(drSeen)); } catch (e2) { /* ignore */ } } }
        const qs = Array.from(x.searchParams.entries()).map((e) => e[0] + '=' + String(e[1]).slice(0, 24)).join('&');
        const b = typeof body === 'string' ? ' BODY ' + body.replace(/(refresh_token|access_token|client_secret)=[^&]+/g, '$1=***').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<jwt>').slice(0, 300) : '';
        return { x, line: m + ' ' + x.host + x.pathname + '?' + qs + b };
      } catch (e) { return null; }
    };
    try {
      const oo = XMLHttpRequest.prototype.open;
      const os = XMLHttpRequest.prototype.send;
      const osh = XMLHttpRequest.prototype.setRequestHeader;
      XMLHttpRequest.prototype.setRequestHeader = function (n, v) {
        if (this.__cp) (this.__cp.h = this.__cp.h || {})[n] = v;
        return osh.apply(this, arguments);
      };
      XMLHttpRequest.prototype.open = function (m, u) { this.__cp = { m, u }; return oo.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function (body) {
        try {
          const d = this.__cp && describe(this.__cp.m, this.__cp.u, body);
          if (d) {
            push(d.line);
            if (/^\/api\/v1\//.test(d.x.pathname) && this.__cp.h && (this.__cp.h.Authorization || this.__cp.h.authorization)) {
              const hh = Object.assign({}, this.__cp.h);
              Object.keys(hh).forEach((k) => { if (/^content-(type|length)$/i.test(k)) delete hh[k]; });
              coreNative = { origin: d.x.origin, headers: hh }; coreVer++;
              push('  hdr ' + d.x.origin + ' ' + Object.keys(hh).join(','));
            }
            if (/openid-connect\/token/.test(d.x.pathname)) {
              this.addEventListener('load', () => { try { const j = JSON.parse(this.responseText); if (j && j.access_token) { tokOverride = 'Bearer ' + j.access_token; push('  tok refresh lu (iat ' + jwtIat(tokOverride) + ')'); } } catch (e) { /* ignore */ } });
            }
            if (interesting.test(d.x.pathname)) {
              this.addEventListener('load', () => {
                try {
                  const ct = this.getResponseHeader('content-type') || '';
                  let t;
                  if (/json|text/.test(ct) && (this.responseType === '' || this.responseType === 'text')) t = String(this.responseText).slice(0, lim(d.x.pathname));
                  else t = '[' + ct + ' ' + ((this.response && (this.response.size || this.response.byteLength)) || '?') + ']';
                  push('  -> ' + this.status + ' ' + d.x.host + d.x.pathname + ' ' + t, lim(d.x.pathname) + 120);
                } catch (e) { /* ignore */ }
              });
            }
          }
        } catch (e) { /* ignore */ }
        return os.apply(this, arguments);
      };
      const of = window.fetch;
      window.fetch = function (u, o) {
        const url = typeof u === 'string' ? u : (u && u.url) || '';
        const d = describe((o && o.method) || 'GET', url, o && o.body);
        try {
          if (d && !(o && o.__tmbcOwn) && /^\/api\/v1\//.test(d.x.pathname)) {
            const hs = {};
            const ih = (o && o.headers) || (u && u.headers);
            if (ih) { if (typeof ih.forEach === 'function') ih.forEach((v, k) => (hs[k] = v)); else Object.assign(hs, ih); }
            if (hs.Authorization || hs.authorization) {
              Object.keys(hs).forEach((k) => { if (/^content-(type|length)$/i.test(k)) delete hs[k]; });
              coreNative = { origin: d.x.origin, headers: hs }; coreVer++;
              push('  hdr ' + d.x.origin + ' ' + Object.keys(hs).join(','));
            }
          }
        } catch (e) { /* ignore */ }
        const pr = of.apply(this, arguments);
        if (d && /openid-connect\/token/.test(d.x.pathname)) {
          pr.then((r) => r.clone().json().then((j) => { if (j && j.access_token) { tokOverride = 'Bearer ' + j.access_token; push('  tok refresh lu (iat ' + jwtIat(tokOverride) + ')'); } }).catch(() => {})).catch(() => {});
        }
        if (d) {
          push(d.line);
          if (interesting.test(d.x.pathname)) {
            pr.then((r) => {
              try {
                const ct = r.headers.get('content-type') || '';
                if (/json|text/.test(ct)) r.clone().text().then((t) => push('  -> ' + r.status + ' ' + d.x.host + d.x.pathname + ' ' + t.slice(0, lim(d.x.pathname)), lim(d.x.pathname) + 120)).catch(() => {});
                else push('  -> ' + r.status + ' ' + d.x.pathname + ' [' + ct + ']');
              } catch (e) { /* ignore */ }
            }).catch(() => {});
          }
        }
        return pr;
      };
    } catch (e) { /* ignore */ }
  })();
  (function navLog() {
    const L = (t) => { try { apiLog.push(String(t).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<jwt>').slice(0, 500)); if (apiLog.length > 220) apiLog.shift(); } catch (e) { /* ignore */ } };
    try {
      ['pushState', 'replaceState'].forEach((m) => { const o = history[m]; history[m] = function (st, ti, url) { L('NAV ' + m + ' ' + url + ' state=' + JSON.stringify(st || null).slice(0, 200)); return o.apply(this, arguments); }; });
      const pm = window.postMessage; window.postMessage = function (msg) { L('NAV postMessage ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)).slice(0, 300)); return pm.apply(this, arguments); };
      if (window.BroadcastChannel) { const bp = BroadcastChannel.prototype.postMessage; BroadcastChannel.prototype.postMessage = function (msg) { L('NAV broadcast ' + this.name + ' ' + JSON.stringify(msg).slice(0, 300)); return bp.apply(this, arguments); }; }
      const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (!/^tmbcCp/.test(k)) L('NAV storage ' + k + ' ' + String(v).slice(0, 200)); return si.apply(this, arguments); };
      const wo = window.open; window.open = function (u) { L('NAV window.open ' + u); return wo.apply(this, arguments); };
      window.addEventListener('popstate', () => L('NAV popstate ' + location.href));
      window.addEventListener('hashchange', () => L('NAV hashchange ' + location.href));
    } catch (e) { /* ignore */ }
  })();
  document.addEventListener('keydown', (ev) => {
    if (!(ev.ctrlKey && ev.altKey && (ev.key === 'j' || ev.key === 'J'))) return;
    try {
      const L = [];
      L.push('consult-premium 1.2 | base=' + apiBase + ' | letVariant=' + S.letVariant + ' | lastCoreKeys=' + lastCoreKeys + ' | lastDocKeys=' + lastDocKeys + ' | compte=' + S.acc + ' | lignes=' + S.lines.length + ' | période=' + S.start + '..' + S.end);
      if (lastRaw) {
        const hdr = lastRaw.find((r) => r.c.A === 'Compte' || Object.keys(r.c).some((k) => /intitule compte/.test(norm(r.c[k]))));
        L.push('HEADER ' + JSON.stringify(hdr ? hdr.c : null));
        L.push('MAP ' + JSON.stringify(hdr ? mapHeader(hdr.c) : null));
        lastRaw.slice(0, 14).forEach((r) => L.push('ROW ' + r.r + ' ' + JSON.stringify(r.c).slice(0, 300)));
        L.push('NBROWS ' + lastRaw.length);
      }
      L.push('URL ' + location.href);
      try { if (lastRawLine) L.push('CORELINE0 KEYS ' + Object.keys(lastRawLine).join(',')); } catch (e) { /* ignore */ }
      try { if (lastRawLine) L.push('CORELINE0 ' + JSON.stringify(lastRawLine).slice(0, 1800)); } catch (e) { /* ignore */ }
      try { const l0 = S.accAll && S.accAll[0]; if (l0) L.push('ACCLIST[0] ' + JSON.stringify(l0).slice(0, 400)); } catch (e) { /* ignore */ }
      L.push('--- derniers appels API ---');
      apiLog.slice(-150).forEach((x) => L.push(x));
      window.ATM.diag(L.join('\n'));
      toast('Diagnostic Consultation Premium écrit (diag-N.txt)');
    } catch (e) { console.log('[consult-premium diag]', e); }
  }, true);

  // Alt+C : ouvre Consultation Premium (hors fenêtres de consultation natives et hors saisie dans un champ)
  document.addEventListener('keydown', (ev) => {
    if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey || (ev.key !== 'c' && ev.key !== 'C')) return;
    if (isDisabled() || /child\/consulting/.test(location.pathname)) return;
    if (!dossierOpen()) return;
    ev.preventDefault(); ev.stopPropagation();
    let fromSaisie = '';
    try {
      let el = document.activeElement;
      for (let i = 0; el && i < 8 && !fromSaisie; i++, el = el.parentElement) {
        const hit = Array.from(el.querySelectorAll('input')).find((x) => /^\d{3,8}$/.test((x.value || '').trim()) && (x.value || '').trim().length >= 6);
        if (hit) fromSaisie = hit.value.trim();
      }
    } catch (e) { /* ignore */ }
    const p = document.getElementById(PANEL_ID);
    if (p && p.style.display !== 'none') { const a = p.querySelector('[data-acc]'); if (a) a.focus(); return; }
    openPremium(fromSaisie || undefined);
  }, true);
  registerScan(scanConsultPremium);

  if (window.__TMBC_TEST) {
    window.__tmbcCp = { selectRange, parseExercises, pickPeriod, showPanel, render, S, COLS, autoFitCols, rowCells, cpCell, entCache, applyCp, mapCoreLine, msMatcher, textMatcher, numMatcher, dateMatcher, parseLedgerRows, mapHeader, withRunningBalance, ACC_MODES, buildXlsx, frToIso, excelDateToIso, crc32 };
  }
})();
