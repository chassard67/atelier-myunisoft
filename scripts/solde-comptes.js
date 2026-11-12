// ==UserScript==
// @name         MyUnisoft - Solde des comptes dans les listes de recherche de compte
// @namespace    https://nicolas.chassard/myunisoft
// @version      1.6-ext
// @description  v1.6 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — aucun changement fonctionnel, le module tourne désormais dans l'extension (même contexte de page que le preload).
//               v1.5 (2026-10-22, CHAPI 1 : compte 455100 affiché -8 790 au lieu de -25 615,91) : règle de Nicolas "toujours prendre les à-nouveaux, l'exercice N et l'exercice N+1". Le solde est maintenant calculé sur UNE période allant du 1er jour de N à la fin de N+1 (l'API y cumule les à-nouveaux : vérifié en direct, 01/01/2025-31/12/2026 -> -25 615,91 sur 45510000), pour les comptes de bilan (classes 1-5). Comptes de gestion (6-9) : uniquement l'exercice en cours de saisie (N+1 si N est terminé, sinon N), jamais la somme de deux exercices. N = exercice le plus récent ouvert, trouvé par 2 sondes (findCurrentFiscalYear, cf. commentaire : fiscal_year_list contient la période demandée, qui masque N) et mémorisé 30 min ; ensuite 1 appel (2 si N est terminé) toutes les 3 min par société. Un 2027 entier hors exercice renvoie HTTP 500 : on ne dépasse jamais la fin de N+1.
//               v1.4 (2026-10-21) : l'exercice courant n'est plus lu dans fiscal_year_list[0] — constaté en direct que ce premier élément est remplacé par la période demandée quand elle ne correspond pas à un exercice (ADS CARROSSERIE : on obtenait 01/01/2026-31/12/2026 au lieu de 01/07/2025-30/06/2026, d'où solde 0). On lit désormais fiscal_year_list[1] (N-1) et on en déduit N (nextFiscalYear).
//               v1.3 (2026-10-21, ADS CARROSSERIE : compte 101300 à 5 000 € affiché 0) : deux causes corrigées. (1) Le numéro de la liste ("101300") n'a pas la même longueur que celui de la balance ("10130000", complété à 8 chiffres) : comparaison désormais sans les zéros de fin pour les numéros purement numériques (normKey). (2) Période : l'année civile était supposée ; l'exercice de ce dossier est 01/07/2025-30/06/2026. Le script lit maintenant fiscal_year_list dans la réponse (exercice le plus récent) et ne refait un 2e appel que si cet exercice diffère de l'année civile ; l'infobulle indique l'exercice utilisé. Toujours 1 à 2 appels par société et par 3 minutes.
//               v1.2 (2026-10-21) : reconnaît aussi les comptes de tiers alphanumériques (ex. "411CSPBUTIN - ...") et les numéros de plus de 11 caractères (ex. 12 chiffres), qui étaient ignorés par la regex (chiffres uniquement, 4 à 11). La clé de recherche dans la balance est comparée en majuscules.
//               v1.1 (2026-10-21) : le libellé du compte n'empiète plus sur le solde — la ligne réserve une colonne de droite (padding-right 110px via feuille de style injectée une fois, attribut data-tmbc-solde-row sur le <li>) et le libellé passe à la ligne au lieu de passer sous le montant ; infobulle = libellé complet.
//               v1.0 (2026-10-21, demandé par Nicolas : "quand je cherche un compte (consultation,
//               ou en saisie), il s'affiche le numéro de compte et le nom, j'aimerai aussi que
//               s'affiche le solde du compte") : dans toute liste déroulante MUI de comptes
//               (li[role=option] dont le texte commence par "NNNNNN - Libellé"), ajoute à droite
//               le solde du compte sur l'exercice courant (signe natif : débit +, crédit -,
//               négatif en rouge, police à chasse fixe Consolas). Source : UN SEUL appel à
//               balance_dynamique/v2 (le même que la balance native, jeton réutilisé via
//               getApiHeaders()), SANS dossier_revision_id (comme l'affichage natif sur
//               période personnalisée, cf. balance.js v3.36), mis en cache par société
//               (CACHE_TTL_MS) — jamais un appel par compte ni par frappe. Période = 01/01 au
//               31/12 de l'année en cours (exercices non calendaires non gérés — à adapter).
//               Un compte absent de la balance (aucun mouvement) s'affiche à 0,00.
//               Le span ajouté est en position:absolute dans le <li> (aucun nœud natif déplacé ni
//               supprimé). Aucun nouveau MutationObserver : s'enregistre auprès du scan() commun.
// @author       Nicolas
// ==/UserScript==

(function () {
  'use strict';

  const {
    isDisabled,
    getApiHeaders,
    registerScan,
    extendDebugHook,
    MONO_FONT_STACK,
  } = window.TMBC;

  const API = 'https://prod-ws.myunisoft.fr/balance_dynamique/v2';
  const CACHE_TTL_MS = 3 * 60 * 1000;
  const FY_TTL_MS = 30 * 60 * 1000; // l'exercice N est mémorisé 30 min
  const ATTR = 'data-tmbc-solde';
  const OPTION_RE = /^\s*([0-9A-Za-z]{3,20})\s+-\s/;

  // societyId -> { ts, map: {accountNumber: solde}, loading, error }
  const cache = {};

  function fmt(n) {
    const abs = Math.abs(n)
      .toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (n < 0 ? '-' : '') + abs;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function buildUrl(start, end) {
    const p = {
      start_date: start,
      end_date: end,
      compare: 'false',
      unbalanced_only: 'false',
      cumul: 'false',
      an_simulation: 'false',
      centralize_account: 'false',
      extended: 'false',
      subtype: '0',
      unvalidated_accounts_only: 'false',
    };
    return (
      API +
      '?' +
      Object.keys(p)
        .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(p[k]))
        .join('&')
    );
  }

  // "01/07/2025 au 30/06/2026" -> { start: '20250701', end: '20260630' }
  function parseFiscalYear(str) {
    const m = /(\d{2})\/(\d{2})\/(\d{4})\s+au\s+(\d{2})\/(\d{2})\/(\d{4})/.exec(str || '');
    return m ? { start: m[3] + m[2] + m[1], end: m[6] + m[5] + m[4], label: str } : null;
  }

  // Exercice qui suit fy (même durée en mois) : { start, end, label } (AAAAMMJJ).
  function nextFiscalYear(fy) {
    const toDate = (t) => new Date(Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8)));
    const toStr = (d) => d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate());
    const s0 = toDate(fy.start);
    const e0 = toDate(fy.end);
    e0.setUTCDate(e0.getUTCDate() + 1); // lendemain de la fin = début de N
    const months = (e0.getUTCFullYear() - s0.getUTCFullYear()) * 12 + (e0.getUTCMonth() - s0.getUTCMonth());
    if (months < 1 || months > 24) return null;
    const ns = new Date(e0.getTime());
    const ne = new Date(Date.UTC(ns.getUTCFullYear(), ns.getUTCMonth() + months, ns.getUTCDate()));
    ne.setUTCDate(ne.getUTCDate() - 1);
    const lab = (d) => pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
    return { start: toStr(ns), end: toStr(ne), label: lab(ns) + ' au ' + lab(ne) };
  }

  // Le numéro de la liste (ex. "101300") et celui de la balance ("10130000",
  // complété à 8 chiffres) désignent le même compte : pour les numéros
  // purement numériques on compare sans les zéros de fin.
  function normKey(num) {
    const s = String(num).toUpperCase();
    return /^\d+$/.test(s) ? s.replace(/0+$/, '') : s;
  }

  // pred(numéro) décide si le compte est retenu (classes 1-5 ou 6+).
  function collectLeaves(nodes, out, pred) {
    for (const n of nodes || []) {
      if (n.account_List && n.account_List.length) collectLeaves(n.account_List, out, pred);
      else if (!pred || pred(String(n.account_number))) {
        const v = n.exercice_values && n.exercice_values[0];
        out[normKey(n.account_number)] = typeof v === 'number' ? v : 0;
      }
    }
    return out;
  }

  const isBalanceSheet = (num) => /^[1-5]/.test(num);
  const isPnl = (num) => !/^[1-5]/.test(num);

  function ymd(d) {
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }

  // Détermine N, l'exercice le plus récent OUVERT (celui que la balance native
  // propose par défaut). Particularité de l'API (constatée en direct) :
  // fiscal_year_list = exercices réels, SAUF que la période demandée y est
  // insérée (ou remplace l'exercice qu'elle chevauche), liste tronquée à 2.
  //  - sonde A (aujourd'hui) -> fy[1] = X : N si aujourd'hui est après N, sinon
  //    N-1 (si aujourd'hui tombe dans N, qui a alors été remplacé).
  //  - sonde B (1er jour de X) -> si fy[0] est notre propre période, X est
  //    bien le plus récent (X = N) ; sinon fy[0] est le vrai N.
  async function findCurrentFiscalYear(get) {
    const t = ymd(new Date());
    const A = await get(buildUrl(t, t));
    const X = parseFiscalYear((A.fiscal_year_list || [])[1]);
    if (!X) return null;
    const B = await get(buildUrl(X.start, X.start));
    const f0 = parseFiscalYear((B.fiscal_year_list || [])[0]);
    if (!f0 || (f0.start === X.start && f0.end === X.start)) return X;
    return f0;
  }

  function ensureLoaded(headers) {
    const sid = String(headers['society-id'] || '');
    if (!sid) return null;
    const c = cache[sid];
    if (c && (c.loading || (c.map && Date.now() - c.ts < CACHE_TTL_MS))) return c;
    // Échec récent : on ne réessaie pas en boucle (scan toutes les ~secondes).
    if (c && c.error && Date.now() - c.ts < 30000) return c;
    const entry = {
      ts: Date.now(),
      map: c ? c.map : null,
      fy: c ? c.fy : null, // exercice N mémorisé (change rarement)
      fyTs: c ? c.fyTs : 0,
      label: c ? c.label : '',
      loading: true,
      error: null,
    };
    cache[sid] = entry;
    const get = (url) =>
      fetch(url, { credentials: 'include', headers }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))
      );

    (async () => {
      // Règle de Nicolas : toujours prendre les à-nouveaux + exercice N +
      // exercice N+1. Une période qui commence au 1er jour de N et finit à la
      // fin de N+1 contient exactement cela (l'API cumule les à-nouveaux).
      if (!entry.fy || Date.now() - entry.fyTs > FY_TTL_MS) {
        entry.fy = await findCurrentFiscalYear(get);
        entry.fyTs = Date.now();
      }
      let N = entry.fy;
      if (!N) {
        // Repli : année civile.
        const y = new Date().getFullYear();
        N = { start: y + '0101', end: y + '1231', label: y + '0101 - ' + y + '1231' };
      }
      const N1 = nextFiscalYear(N) || N;
      entry.label = 'à-nouveaux + ' + N.label + ' + N+1 (' + N1.label + ')';
      // Repli si l'API refuse une fin d'exercice N+1 trop lointaine (HTTP 500).
      const all = await get(buildUrl(N.start, N1.end)).catch(() => get(buildUrl(N.start, N.end)));
      const map = collectLeaves(all.data, {}, isBalanceSheet);
      // Comptes de gestion (6-7...) : uniquement l'exercice en cours de saisie
      // (N+1 si N est terminé, sinon N), pas la somme de deux exercices.
      const today = ymd(new Date());
      if (today > N.end && N1 !== N) {
        const pnl = await get(buildUrl(N1.start, N1.end));
        collectLeaves(pnl.data, map, isPnl);
      } else {
        collectLeaves(all.data, map, isPnl);
      }
      entry.map = map;
      entry.ts = Date.now();
      entry.loading = false;
    })().catch((e) => {
      entry.error = String(e && e.message ? e.message : e);
      entry.ts = Date.now();
      entry.loading = false;
    });
    return entry;
  }

  function ensureStyle() {
    if (document.getElementById('tmbc-solde-style')) return;
    const st = document.createElement('style');
    st.id = 'tmbc-solde-style';
    st.textContent =
      'li[data-tmbc-solde-row]{padding-right:110px !important;}' +
      'li[data-tmbc-solde-row] > div{min-width:0 !important;white-space:normal !important;overflow-wrap:anywhere;}';
    (document.head || document.documentElement).appendChild(st);
  }

  function scanSoldes() {
    if (isDisabled()) return;
    const options = document.querySelectorAll('.MuiAutocomplete-popper li[role="option"], .MuiAutocomplete-listbox li[role="option"]');
    if (!options.length) return;

    const candidates = [];
    options.forEach((li) => {
      const m = OPTION_RE.exec(li.textContent || '');
      if (m) candidates.push([li, m[1]]);
    });
    if (!candidates.length) return;

    const headers = getApiHeaders();
    if (!headers || !headers.Authorization) return;
    const entry = ensureLoaded(headers);
    if (!entry || !entry.map) return;

    ensureStyle();
    candidates.forEach(([li, acc]) => {
      if (!li.hasAttribute('data-tmbc-solde-row')) li.setAttribute('data-tmbc-solde-row', '1');
      let span = li.querySelector(':scope > [' + ATTR + ']');
      if (!span) {
        span = document.createElement('span');
        span.setAttribute(ATTR, '1');
        span.style.cssText =
          'position:absolute;right:12px;top:50%;transform:translateY(-50%);' +
          'font-family:' + (MONO_FONT_STACK || 'Consolas, monospace') + ';' +
          'font-size:12px;pointer-events:none;white-space:nowrap;';
        if (getComputedStyle(li).position === 'static') li.style.position = 'relative';
        li.appendChild(span);
      }
      const k = normKey(acc);
      const v = Object.prototype.hasOwnProperty.call(entry.map, k) ? entry.map[k] : 0;
      const txt = fmt(v);
      if (span.textContent !== txt) span.textContent = txt;
      span.style.color = v < 0 ? '#d32f2f' : '#1f2933';
      span.style.opacity = v === 0 ? '0.5' : '1';
      span.title = 'Solde du compte : ' + (entry.label || 'exercice en cours') + ' (débit +, crédit -)';
    });
  }

  extendDebugHook({
    soldesCache: () => cache,
    soldesReset: () => Object.keys(cache).forEach((k) => delete cache[k]),
  });

  registerScan(scanSoldes);
})();
