// ==UserScript==
// @name         MyUnisoft - Grand livre à l'écran
// @namespace    https://nicolas.chassard/myunisoft
// @version      1.16-ext
// @description  v1.16 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — aucun changement fonctionnel, le module tourne désormais dans l'extension (même contexte de page que le preload).
//               v1.14 (2026-10-30) : openEntry (Consultation Premium) repère la ligne des résultats par date + montant (+ journal) sans exiger le n° de compte, puis double-clique pour ouvrir l'écriture dans la saisie.
//               v1.13 (2026-10-30) : loadAccountList expose le solde du compte (exercice_values[0] de la balance, comme balance.js) dans nums.solde.
//               v1.12 (2026-10-30) : loadAccountList garde aussi les champs numériques stockés en texte (soldes affichés dans le menu Compte de Consultation Premium).
//               v1.11 (2026-10-30) : TMBC_GL expose aussi fetchLedgerRaw(params) (lignes brutes de la feuille, avec en-têtes), loadAccountList(start,end) (liste n°/id/libellé des comptes via balance_dynamique/v2) et openEntry({acc,date,jnl,amt}) (ouvre une écriture dans la saisie via la recherche native) pour consult-premium.js (Consultation Premium).
//               v1.10 (2026-10-29) : expose window.TMBC_GL.fetchLedgerModel(params) pour consult-filtre.js (filtre de comptes dans la Consultation).
//               v1.9 (2026-10-22, diagnostic lu : 3 journaux = 3 appels /diary/print dont un (BCI) renvoie un JSON d'erreur {code:GBL28, "Aucune donnée pour le journal BCI"} au lieu d'un classeur) : les réponses qui ne sont pas un classeur (pas de signature ZIP "PK") sont ignorées ; leur message est signalé en bas ("journal(aux) sans donnée : BCI") ; erreur seulement si AUCUNE réponse n'est exploitable. Diagnostic temporaire retiré.
//               v1.8 (2026-10-22, retour de Nicolas : plusieurs journaux = l'appli lance DEUX appels, donc deux fichiers Excel) : la collecte des appels natifs ne s'arrête plus après 1 s mais seulement quand chaque réponse reçue est terminée ET qu'aucun nouvel appel /diary/print n'est parti depuis 1,5 s (plafond 30 s) — les appels enchaînés l'un après l'autre sont donc tous lus (et leur téléchargement neutralisé) puis fusionnés.
//               v1.7 (2026-10-22, retour de Nicolas) : (1) Journaux : les lignes sont regroupées par ÉCRITURE (une écriture = suite de lignes dont le cumul débit − crédit revient à 0) et les écritures sont alternées blanc / bleu ciel (rang calculé sur toutes les lignes du journal AVANT filtre lettrage/recherche, donc stable). (2) Plusieurs journaux sélectionnés : "Réponse non reconnue (pas un classeur Excel)" — diagnostic temporaire ajouté (écrit un fichier diag-N.txt avec la taille, les premiers octets et le paramètre jal_code de chaque réponse) pour voir ce que renvoie l'appli dans ce cas ; à retirer ensuite.
//               v1.6 (2026-10-22, demandé par Nicolas : "je veux aussi pouvoir afficher les journaux à l'écran comme le grand livre") : même mécanisme pour l'édition Journaux (Éditions courantes > Journaux, bouton "Afficher à l'écran" sur la page et dans la fenêtre "Exporter Journaux"). Appel natif intercepté : GET /diary/print?start_date&end_date&jal_code&xls=true (réponse = classeur xlsx : titre ligne 1, ligne de journal "AC - ACHATS", en-têtes Date/Compte/Pièce1/Pièce2/Lettrage/Intitulé/Débit/Crédit, ligne TOTAL). Si l'appli lance plusieurs appels (plusieurs journaux), tous ceux émis dans la seconde qui suit sont lus et fusionnés par journal. Mêmes liens (compte -> consultation, montant -> recherche, date -> écriture), même filtre Lettrage avec totaux recalculés par journal, même recherche.
//               v1.5 (2026-10-22) : le solde ("0,00") des lignes de sous-total restait à gauche malgré le style en ligne — probable règle CSS de l'appli en !important sur la 4e cellule d'une ligne (les lignes de total n'ont que 4 cellules : colspan 6 + 3 montants). Style en ligne passé en !important (seul moyen de passer devant) sur toutes les cellules de montants et en-têtes numériques.
//               v1.4 (2026-10-22, demandé par Nicolas) : (1) alignement des colonnes Débit/Crédit/Solde (en-têtes ET totaux, dont le "0,00" du solde de compte qui s'affichait à gauche) forcé à droite en style en ligne ; (2) filtre Lettrage dans la barre du haut : Toutes les écritures / Non lettrées uniquement / Lettrées uniquement — hors "Toutes", les sous-totaux par compte et le total général sont RECALCULÉS sur les lignes affichées (débit, crédit, solde = débit − crédit) et la colonne Solde devient un cumul recalculé par compte sur ces lignes ; un compte sans ligne retenue disparaît.
//               v1.3 (2026-10-22, retour de Nicolas : "quand je lance un 2e grand livre avec d'autres paramètres, ca mouline mais ne sort rien") : cause probable — l'appel natif était ANNULÉ (xhr.abort) après interception, ce qui laissait l'état interne de l'appli en "export en cours" (roue qui tourne, plus aucun export possible ensuite). Désormais l'appel natif part RÉELLEMENT et se termine normalement ; on récupère le classeur directement dans SA réponse (plus aucun second appel serveur) et le téléchargement déclenché par l'appli est neutralisé (clic d'ancre blob/download ignoré pendant la capture). Repli : rejeu avec jeton+cookies si la réponse n'est pas lisible. Garde-fous : délai max 45 s avec message, état "occupé" toujours remis à zéro.
//               v1.2 (2026-10-22, demandé par Nicolas) : liens cliquables dans le grand livre. Clic sur un NUMÉRO DE COMPTE -> fiche de consultation du compte (même URL /child/consulting que la balance, fenêtre nommée réutilisée, Maj+clic = nouvelle fenêtre ; id_account lu dans balance_dynamique/v2, un seul appel mis en cache par période). Clic sur un MONTANT -> ouvre la recherche d'écritures native (loupe) avec le montant pré-rempli et lance la recherche (aucun appel dupliqué : c'est l'appli qui interroge). Clic sur un JOURNAL -> même recherche (montant de la ligne), puis double-clic automatique sur la ligne correspondante (date + compte) pour l'ouvrir dans la saisie ; si introuvable, les résultats restent affichés. Le grand livre est masqué (pas fermé) pendant ce temps : pastille "↩ Grand livre" pour y revenir.
//               v1.1 (2026-10-22, retour de Nicolas) : (1) panneau limité à 1500 px de large et centré (écran extra large : colonnes étirées avant) ; (2) colonnes texte (Date/Jnl/Pièces/Lettrage/Intitulé) toujours alignées à GAUCHE — les journaux numériques (ex. 50) s'affichaient à droite ; (3) bouton "Afficher à l'écran" directement sur la page Éditions courantes > Grand livre (zone vide à droite des filtres), qui enchaîne seul ⋮ > Exporter > Excel > interception.
//               v1.0 (2026-10-22, demandé par Nicolas : "l'édition d'un grand livre ne peut se faire
//               qu'en pdf ou excel, j'aimerai pouvoir afficher un grand livre à l'écran") : dans la
//               fenêtre native "Exporter Grand livre", ajoute un bouton "Afficher à l'écran". Il rejoue
//               EXACTEMENT les paramètres de l'édition en cours (période, type Général/Client/
//               Fournisseur, plage de comptes, options, dossier_revision_id) : le clic déclenche
//               l'export Excel natif, dont l'appel GET /grand_livre?...&xls=true est intercepté
//               (XHR.send neutralisé : aucun fichier n'est téléchargé) puis rejoué UNE SEULE fois
//               par ce script (jeton via getApiHeaders() + cookies de session : credentials
//               'include', constaté indispensable pour cet endpoint). L'API ne sait renvoyer que
//               du PDF (xls=false) ou de l'Excel (xls=true) — jamais de JSON : le classeur .xlsx
//               reçu est lu en mémoire (ZIP + DecompressionStream, XML de la feuille 1 et des
//               chaînes partagées), sans aucune bibliothèque (CSP stricte) puis affiché dans un
//               panneau plein écran (groupé par compte, sous-totaux natifs "Solde du compte",
//               recherche, négatifs en rouge, chiffres en Consolas). Aucun nœud natif déplacé ni
//               supprimé : bouton et panneau sont de nouveaux nœuds ajoutés (panneau sur <body>).
//               Plafond d'affichage : 20 000 lignes.
// @author       Nicolas
// ==/UserScript==

(function () {
  'use strict';

  const { isDisabled, getApiHeaders, registerScan, MONO_FONT_STACK } = window.TMBC;
  // v1.15 : jeton le plus récent (fourni par consult-premium.js) pour les appels grand livre / liste de comptes
  const ownHeaders = () => { const h = Object.assign({}, getApiHeaders()); try { const b = window.TMBC_BEST_AUTH && window.TMBC_BEST_AUTH(); if (b) h.Authorization = b; } catch (e) { /* ignore */ } return h; };
  const MONO = MONO_FONT_STACK || 'Consolas, monospace';
  const BTN_ATTR = 'data-tmbc-gl-btn';
  const PANEL_ID = 'tmbc-gl-panel';
  const MAX_ROWS = 20000;
  const EXPORT_TITLE_RE = /Exporter\s+(Grand\s+livre|Journaux)/i;

  // ------------------------------------------------------------------
  // Interception du prochain appel natif GET /grand_livre (une seule fois)
  // ------------------------------------------------------------------
  let captureResolve = null;
  let collecting = false;
  let lastCaptureTs = 0;
  let captureList = [];
  let suppressDownloadUntil = 0;
  const XOpen = XMLHttpRequest.prototype.open;
  const XSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      this.__tmbcGL = /\/grand_livre|\/diary\/print/.test(String(url));
      this.__tmbcGLUrl = String(url);
    } catch (e) { /* ignore */ }
    return XOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if ((captureResolve || collecting) && this.__tmbcGL) {
      const xhr = this;
      // L'appel natif PART réellement (l'appli finit son cycle normalement) ;
      // on lit sa réponse au passage, sans second appel.
      const done = new Promise((res) => {
        const finish = async () => {
          try {
            const r = xhr.response;
            if (r instanceof ArrayBuffer) return res(r);
            if (typeof Blob !== 'undefined' && r instanceof Blob) return res(await r.arrayBuffer());
          } catch (e) { /* ignore */ }
          res(null);
        };
        xhr.addEventListener('load', finish);
        xhr.addEventListener('error', () => res(null));
        xhr.addEventListener('abort', () => res(null));
        xhr.addEventListener('timeout', () => res(null));
      });
      suppressDownloadUntil = Date.now() + 60000;
      const item = { url: this.__tmbcGLUrl, done, fin: false };
      done.then(() => { item.fin = true; });
      captureList.push(item);
      lastCaptureTs = Date.now();
      if (captureResolve) {
        // Plusieurs journaux = plusieurs appels, parfois enchaînés : on attend que
        // tout soit terminé et qu'aucun nouvel appel ne soit parti depuis 1,5 s.
        const resolve = captureResolve;
        captureResolve = null;
        collecting = true;
        const t0 = Date.now();
        const iv = setInterval(() => {
          const idle = Date.now() - lastCaptureTs > 1500 && captureList.every((c) => c.fin);
          if (idle || Date.now() - t0 > 30000) {
            clearInterval(iv);
            collecting = false;
            resolve(captureList.slice());
          }
        }, 250);
      }
    }
    return XSend.apply(this, arguments);
  };
  // Neutralise le téléchargement de fichier déclenché par l'appli pendant la capture.
  const shouldSuppress = (a) => Date.now() < suppressDownloadUntil && a && (a.hasAttribute('download') || /^blob:/.test(a.href || ''));
  const AClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (shouldSuppress(this)) return;
    return AClick.apply(this, arguments);
  };
  const ADispatch = HTMLAnchorElement.prototype.dispatchEvent;
  HTMLAnchorElement.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && shouldSuppress(this)) return true;
    return ADispatch.apply(this, arguments);
  };

  // ------------------------------------------------------------------
  // Lecture du .xlsx en mémoire
  // ------------------------------------------------------------------
  async function readZipEntries(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    let eocd = -1;
    for (let k = u8.length - 22; k >= 0; k--) {
      if (dv.getUint32(k, true) === 0x06054b50) { eocd = k; break; }
    }
    if (eocd < 0) throw new Error('Réponse non reconnue (pas un classeur Excel)');
    const n = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const entries = {};
    for (let e = 0; e < n; e++) {
      const method = dv.getUint16(off + 10, true);
      const csize = dv.getUint32(off + 20, true);
      const nl = dv.getUint16(off + 28, true);
      const el = dv.getUint16(off + 30, true);
      const cl = dv.getUint16(off + 32, true);
      const lho = dv.getUint32(off + 42, true);
      const name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nl));
      entries[name] = { method, csize, lho };
      off += 46 + nl + el + cl;
    }
    const read = async (name) => {
      const en = entries[name];
      if (!en) return null;
      const nl = dv.getUint16(en.lho + 26, true);
      const el = dv.getUint16(en.lho + 28, true);
      const data = u8.subarray(en.lho + 30 + nl + el, en.lho + 30 + nl + el + en.csize);
      if (en.method === 0) return new TextDecoder().decode(data);
      const ds = new DecompressionStream('deflate-raw');
      const w = ds.writable.getWriter();
      w.write(data);
      w.close();
      return await new Response(ds.readable).text();
    };
    return read;
  }

  function unxml(s) {
    return s
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
      .replace(/&amp;/g, '&');
  }

  function parseShared(xml) {
    const out = [];
    if (!xml) return out;
    const re = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = re.exec(xml))) {
      let txt = '';
      const tre = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let t;
      while ((t = tre.exec(m[1]))) txt += t[1];
      out.push(unxml(txt));
    }
    return out;
  }

  function parseSheet(xml, shared) {
    const rows = [];
    const rre = /<row\b[^>]*?\br="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;
    let rm;
    while ((rm = rre.exec(xml))) {
      const cells = {};
      if (rm[2]) {
        const cre = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
        let cm;
        while ((cm = cre.exec(rm[2]))) {
          const attrs = cm[1];
          const ref = /\br="([A-Z]+)\d+"/.exec(attrs);
          if (!ref || cm[2] === undefined) continue;
          const type = (/\bt="(\w+)"/.exec(attrs) || [])[1];
          let val = null;
          const v = /<v>([\s\S]*?)<\/v>/.exec(cm[2]);
          if (type === 's' && v) val = shared[+v[1]];
          else if (type === 'inlineStr') {
            const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(cm[2]);
            val = t ? unxml(t[1]) : '';
          } else if (v) val = type === 'str' ? unxml(v[1]) : parseFloat(v[1]);
          if (val !== null && val !== undefined && val !== '') cells[ref[1]] = val;
        }
      }
      rows.push({ r: +rm[1], c: cells });
    }
    return rows;
  }

  // ------------------------------------------------------------------
  // Mise en forme
  // ------------------------------------------------------------------
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function fmtNum(v) {
    if (typeof v !== 'number' || isNaN(v)) return '';
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function numCell(v) {
    if (typeof v !== 'number') return '<td class="n" style="text-align:right!important"></td>';
    return '<td style="text-align:right!important" class="n lk' + (v < 0 ? ' neg' : '') + '" data-act="amt" data-v="' + v + '" title="Rechercher ce montant dans la compta">' + fmtNum(v) + '</td>';
  }

  function buildModel(rows) {
    let title = '';
    const groups = [];
    let cur = null;
    let grandTotal = null;
    let lineCount = 0;
    for (const row of rows) {
      const c = row.c;
      if (row.r === 1 && c.A) { title = String(c.A); continue; }
      if (c.A === 'Compte' && c.B === 'Intitulé compte') continue; // en-tête
      if (c.A !== undefined && String(c.A).length) {
        if (!cur || cur.num !== String(c.A)) {
          cur = { num: String(c.A), label: c.B ? String(c.B) : '', lines: [], total: null };
          groups.push(cur);
        }
        cur.lines.push(c);
        lineCount++;
      } else if (c.H && /^solde du compte/i.test(String(c.H)) && cur) {
        cur.total = c;
      } else if (c.H || c.I !== undefined || c.J !== undefined) {
        grandTotal = c; // total général éventuel
      }
    }
    return { title, groups, grandTotal, lineCount };
  }

  const isLettered = (l) => l.G !== undefined && String(l.G).trim() !== '';
  const r2 = (x) => Math.round(x * 100) / 100;

  function renderRows(model, filter, mode) {
    const f = filter ? filter.toLowerCase() : '';
    const recalc = mode === 'non' || mode === 'let';
    const out = [];
    let shown = 0;
    let truncated = false;
    let gI = 0;
    let gJ = 0;
    for (const g of model.groups) {
      let base = g.lines;
      if (mode === 'non') base = base.filter((l) => !isLettered(l));
      else if (mode === 'let') base = base.filter(isLettered);
      if (!base.length) continue;
      let sumI = 0;
      let sumJ = 0;
      if (recalc) {
        // Solde = cumul recalculé sur les lignes retenues (débit − crédit).
        let run = 0;
        base = base.map((l) => {
          const di = typeof l.I === 'number' ? l.I : 0;
          const cj = typeof l.J === 'number' ? l.J : 0;
          sumI += di;
          sumJ += cj;
          run = r2(run + di - cj);
          return Object.assign({}, l, { K: run });
        });
        sumI = r2(sumI);
        sumJ = r2(sumJ);
        gI += sumI;
        gJ += sumJ;
      }
      const head = (g.num + ' ' + g.label).toLowerCase();
      const accountMatch = !f || head.indexOf(f) !== -1;
      const lines = accountMatch
        ? base
        : base.filter((l) => Object.keys(l).some((k) => String(l[k]).toLowerCase().indexOf(f) !== -1));
      if (!lines.length) continue;
      out.push('<tr class="acc"><td colspan="9" class="lk" data-a="' + esc(g.num) + '" data-act="acc" title="Ouvrir la consultation du compte (Maj+clic : nouvelle fenêtre)"><b>' + esc(g.num) + '</b> &nbsp; ' + esc(g.label) + '</td></tr>');
      for (const l of lines) {
        if (shown >= MAX_ROWS) { truncated = true; break; }
        shown++;
        const amt = typeof l.I === 'number' && l.I !== 0 ? l.I : typeof l.J === 'number' ? l.J : 0;
        out.push(
          '<tr data-a="' + esc(g.num) + '" data-d="' + esc(l.C || '') + '" data-j="' + esc(l.D || '') + '" data-m="' + amt + '"><td>' + esc(l.C || '') + '</td><td class="lk" data-act="ent" title="Ouvrir l\'écriture dans la saisie">' + esc(l.D || '') + '</td><td>' + esc(l.E || '') +
          '</td><td>' + esc(l.F || '') + '</td><td>' + esc(l.G || '') + '</td><td class="lib">' + esc(l.H || '') + '</td>' +
          numCell(l.I) + numCell(l.J) + numCell(l.K) + '</tr>'
        );
      }
      if (!f) {
        if (recalc) {
          out.push(
            '<tr class="tot"><td colspan="6">Solde du compte ' + esc(g.num) + (mode === 'non' ? ' (non lettré)' : ' (lettré)') + '</td>' +
            numCell(sumI) + numCell(sumJ) + numCell(r2(sumI - sumJ)) + '</tr>'
          );
        } else if (g.total) {
          out.push(
            '<tr class="tot"><td colspan="6">Solde du compte ' + esc(g.num) + '</td>' +
            numCell(g.total.I) + numCell(g.total.J) + numCell(typeof g.total.I === 'number' && typeof g.total.J === 'number' ? r2(g.total.I - g.total.J) : undefined) + '</tr>'
          );
        }
      }
      if (truncated) break;
    }
    if (!f && !truncated) {
      if (recalc) {
        gI = r2(gI);
        gJ = r2(gJ);
        out.push('<tr class="tot gt"><td colspan="6">Total général (' + (mode === 'non' ? 'non lettré' : 'lettré') + ')</td>' + numCell(gI) + numCell(gJ) + numCell(r2(gI - gJ)) + '</tr>');
      } else if (model.grandTotal) {
        const t = model.grandTotal;
        out.push('<tr class="tot gt"><td colspan="6">' + esc(t.H || 'Total') + '</td>' + numCell(t.I) + numCell(t.J) + numCell(t.K) + '</tr>');
      }
    }
    if (truncated) out.push('<tr class="tot"><td colspan="9">Affichage limité à ' + MAX_ROWS + ' lignes — affinez la plage de comptes ou la recherche.</td></tr>');
    return { html: out.join(''), shown };
  }


  // ------------------------------------------------------------------
  // Édition "Journaux" (GET /diary/print)
  // ------------------------------------------------------------------
  const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

  function buildJournalModel(sheets) {
    let title = '';
    const sections = [];
    let lineCount = 0;
    for (const rows of sheets) {
      let cur = null;
      for (const row of rows) {
        const c = row.c;
        const a = c.A !== undefined ? String(c.A) : '';
        if (row.r === 1 && a) { if (!title) title = a; continue; }
        if (a === 'Date' && c.B === 'Compte') continue;
        if (DATE_RE.test(a)) {
          if (!cur) { cur = { name: 'Journal', code: '', lines: [], total: null }; sections.push(cur); }
          cur.lines.push({ C: a, B: c.B, P1: c.C, P2: c.D, L: c.E, H: c.F, I: c.G, J: c.H });
          lineCount++;
        } else if (a && c.B === undefined && c.F === undefined && c.G === undefined) {
          const m = /^(.+?)\s+-\s+(.*)$/.exec(a);
          cur = { name: a, code: m ? m[1] : a, lines: [], total: null };
          sections.push(cur);
        } else if (c.F && /^total/i.test(String(c.F)) && cur) {
          cur.total = { I: c.G, J: c.H };
        }
      }
    }
    // Regroupement en écritures : une écriture est terminée quand le cumul
    // débit - crédit des lignes retombe à 0.
    sections.forEach((sec) => {
      let bal = 0;
      let n = 0;
      let idx = 0;
      sec.lines.forEach((l) => {
        if (n > 0 && Math.abs(bal) < 0.005) { idx++; bal = 0; n = 0; }
        bal += (typeof l.I === 'number' ? l.I : 0) - (typeof l.J === 'number' ? l.J : 0);
        n++;
        l.e = idx;
      });
    });
    return { kind: 'journal', title, sections, lineCount, groups: sections };
  }

  function renderJournalRows(model, filter, mode) {
    const f = filter ? filter.toLowerCase() : '';
    const recalc = mode === 'non' || mode === 'let';
    const out = [];
    let shown = 0;
    let truncated = false;
    let gI = 0;
    let gJ = 0;
    for (const sec of model.sections) {
      let base = sec.lines;
      if (mode === 'non') base = base.filter((l) => !(l.L !== undefined && String(l.L).trim() !== ''));
      else if (mode === 'let') base = base.filter((l) => l.L !== undefined && String(l.L).trim() !== '');
      if (!base.length) continue;
      let sI = 0;
      let sJ = 0;
      base.forEach((l) => {
        sI += typeof l.I === 'number' ? l.I : 0;
        sJ += typeof l.J === 'number' ? l.J : 0;
      });
      sI = r2(sI);
      sJ = r2(sJ);
      gI += sI;
      gJ += sJ;
      const lines = !f ? base : base.filter((l) => (sec.name + ' ' + Object.keys(l).map((k) => l[k]).join(' ')).toLowerCase().indexOf(f) !== -1);
      if (!lines.length) continue;
      out.push('<tr class="acc"><td colspan="8"><b>' + esc(sec.name) + '</b></td></tr>');
      let prevKey = null;
      for (const l of lines) {
        if (shown >= MAX_ROWS) { truncated = true; break; }
        shown++;
        const sep = (prevKey !== null && l.e !== prevKey ? ' style="border-top:2px solid #c9d2de"' : '') ;
        const shade = l.e % 2 === 1 ? ' class="eo"' : '';
        prevKey = l.e;
        const amt = typeof l.I === 'number' && l.I !== 0 ? l.I : typeof l.J === 'number' ? l.J : 0;
        out.push(
          '<tr' + shade + sep + ' data-a="' + esc(l.B || '') + '" data-d="' + esc(l.C) + '" data-j="' + esc(sec.code) + '" data-m="' + amt + '">' +
          '<td class="lk" data-act="ent" title="Ouvrir l\'écriture dans la saisie">' + esc(l.C) + '</td>' +
          '<td class="lk" data-act="acc" data-a="' + esc(l.B || '') + '" title="Ouvrir la consultation du compte (Maj+clic : nouvelle fenêtre)">' + esc(l.B || '') + '</td>' +
          '<td>' + esc(l.P1 || '') + '</td><td>' + esc(l.P2 || '') + '</td><td>' + esc(l.L || '') + '</td><td>' + esc(l.H || '') + '</td>' +
          numCell(l.I) + numCell(l.J) + '</tr>'
        );
      }
      if (!f) {
        const t = recalc ? { I: sI, J: sJ } : sec.total || { I: sI, J: sJ };
        out.push('<tr class="tot"><td colspan="6">Total ' + esc(sec.name) + (recalc ? (mode === 'non' ? ' (non lettré)' : ' (lettré)') : '') + '</td>' + numCell(t.I) + numCell(t.J) + '</tr>');
      }
      if (truncated) break;
    }
    if (!f && !truncated && model.sections.length > 1) {
      out.push('<tr class="tot gt"><td colspan="6">Total général' + (recalc ? (mode === 'non' ? ' (non lettré)' : ' (lettré)') : '') + '</td>' + numCell(r2(gI)) + numCell(r2(gJ)) + '</tr>');
    }
    if (truncated) out.push('<tr class="tot"><td colspan="8">Affichage limité à ' + MAX_ROWS + ' lignes — affinez la recherche.</td></tr>');
    return { html: out.join(''), shown };
  }

  // ------------------------------------------------------------------
  // Liens : compte -> consultation, montant -> recherche, journal -> écriture
  // ------------------------------------------------------------------
  let panelModelPeriod = null; // { start:'YYYYMMDD', end:'YYYYMMDD' }
  let accountIdMap = null;
  let accountIdKey = '';

  function parsePeriod(title) {
    const m = /(\d{2})\/(\d{2})\/(\d{4})\s+au\s+(\d{2})\/(\d{2})\/(\d{4})/.exec(title || '');
    return m ? { start: m[3] + m[2] + m[1], end: m[6] + m[5] + m[4] } : null;
  }

  async function loadAccountIds(period) {
    const key = location.pathname.split('/')[2] + '|' + period.start + period.end;
    if (accountIdMap && accountIdKey === key) return accountIdMap;
    const q = new URLSearchParams({
      start_date: period.start, end_date: period.end, compare: 'false', unbalanced_only: 'false',
      cumul: 'false', an_simulation: 'false', centralize_account: 'false', extended: 'false',
      subtype: '0', unvalidated_accounts_only: 'false',
    });
    const r = await fetch('https://prod-ws.myunisoft.fr/balance_dynamique/v2?' + q.toString(), {
      credentials: 'include', headers: getApiHeaders(),
    });
    if (!r.ok) throw new Error('Balance : HTTP ' + r.status);
    const j = await r.json();
    const map = {};
    (function walk(nodes) {
      for (const n of nodes || []) {
        if (n.account_List && n.account_List.length) walk(n.account_List);
        else if (n.id_account) map[String(n.account_number)] = n.id_account;
      }
    })(j.data);
    accountIdMap = map;
    accountIdKey = key;
    return map;
  }

  let consultCounter = 0;
  async function openConsultation(num, forceNew) {
    try {
      const period = panelModelPeriod;
      if (!period) throw new Error('Période du grand livre inconnue');
      const map = await loadAccountIds(period);
      const id = map[num];
      if (!id) throw new Error('Compte ' + num + ' introuvable dans la balance');
      const m = location.pathname.match(/^(\/tab\/\d+)\//);
      const qs = new URLSearchParams({
        isAllLines: 'true', accountId: String(id), dateStart: period.start, dateEnd: period.end,
        lettered: 'all', isSituation: 'false',
      });
      const url = location.origin + (m ? m[1] : '') + '/child/consulting?' + qs.toString();
      // Mêmes conventions que balance.js : fenêtre nommée réutilisée, Maj+clic =
      // nouvelle fenêtre ; taille seulement (jamais de position issue de window.screen).
      const name = forceNew ? 'tmb-consult-window-' + ++consultCounter : 'tmb-consult-window';
      const finalUrl = forceNew ? url + '#tmb-force-new-' + consultCounter : url;
      window.open(finalUrl, name, 'width=' + Math.round(window.outerWidth) + ',height=' + Math.round(window.outerHeight) + ',resizable=yes,scrollbars=yes');
    } catch (e) {
      toast('Consultation : ' + e.message);
    }
  }

  // --- masquage / retour du grand livre pendant l'usage de la recherche native
  const BACK_ID = 'tmbc-gl-back';
  function hidePanel() {
    const p = document.getElementById(PANEL_ID);
    if (!p) return;
    p.style.display = 'none';
    if (document.getElementById(BACK_ID)) return;
    const b = document.createElement('button');
    b.id = BACK_ID;
    b.type = 'button';
    b.textContent = '↩ Grand livre';
    b.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483600;padding:6px 16px;border:1px solid #0b3d7a;background:#0b3d7a;color:#fff;border-radius:16px;cursor:pointer;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    b.addEventListener('click', () => {
      const pp = document.getElementById(PANEL_ID);
      if (pp) pp.style.display = 'flex';
      b.remove();
    });
    document.body.appendChild(b);
  }

  function findSearchButton() {
    const cands = Array.from(document.querySelectorAll('button,[role=button]')).filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.top >= 0 && r.top < 45 && r.left > window.innerWidth * 0.45 && !b.textContent.trim();
    });
    const byLabel = cands.find((b) => /recherch|search/i.test((b.getAttribute('aria-label') || '') + (b.title || '') + (b.getAttribute('data-testid') || '')));
    if (byLabel) return byLabel;
    cands.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    return cands[0] || null; // la loupe est la première icône de la barre de droite
  }

  function setNativeValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function runNativeSearch(amount) {
    const btn = findSearchButton();
    if (!btn) throw new Error('Loupe de recherche introuvable');
    hidePanel();
    btn.click();
    const dlg = await waitFor(
      () => Array.from(document.querySelectorAll('[role=dialog]')).find((d) => /Rechercher des écritures/i.test(d.textContent.slice(0, 120))),
      4000
    );
    if (!dlg) throw new Error('Fenêtre de recherche introuvable');
    // champ Montant : l'input qui suit le libellé "Montant"
    const label = await waitFor(() => Array.from(dlg.querySelectorAll('label')).find((l) => /^montant$/i.test(l.textContent.trim())), 3000);
    if (!label) throw new Error('Champ Montant introuvable');
    let input = label.htmlFor ? dlg.querySelector('#' + CSS.escape(label.htmlFor)) : null;
    if (!input) input = (label.parentElement && label.parentElement.querySelector('input')) || null;
    if (!input) throw new Error('Champ Montant introuvable');
    input.focus();
    setNativeValue(input, String(Math.abs(amount)).replace('.', ','));
    await sleep(250);
    const apply = Array.from(dlg.querySelectorAll('button')).find((b) => /appliquer les filtres/i.test(b.textContent));
    if (!apply) throw new Error('Bouton "Appliquer les filtres" introuvable');
    apply.click();
    return dlg;
  }

  async function onAmountClick(v) {
    try { await runNativeSearch(v); } catch (e) { toast('Recherche : ' + e.message); }
  }

  async function onEntryClick(tr) {
    const acc = tr.dataset.a, date = tr.dataset.d, jnl = tr.dataset.j, amt = parseFloat(tr.dataset.m);
    try {
      const dlg = await runNativeSearch(amt);
      // résultats : ligne dont les cellules contiennent la date ET le compte
      const row = await waitFor(() => {
        return Array.from(dlg.querySelectorAll('tr,[role=row]')).find((r) => {
          const t = r.textContent;
          return t.indexOf(date) !== -1 && t.indexOf(acc) !== -1 && (!jnl || t.indexOf(jnl) !== -1);
        });
      }, 6000);
      if (!row) { toast("Écriture non trouvée dans les résultats — choisis-la dans la recherche."); return; }
      const target = row.querySelector('td:nth-child(3),td:nth-child(2)') || row;
      ['mousedown', 'mouseup', 'click', 'mousedown', 'mouseup', 'click', 'dblclick'].forEach((type) =>
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, detail: type === 'dblclick' ? 2 : 1 }))
      );
    } catch (e) {
      toast('Écriture : ' + e.message);
    }
  }

  function onPanelClick(ev) {
    const td = ev.target.closest('[data-act]');
    if (!td) return;
    const act = td.dataset.act;
    if (act === 'acc') openConsultation(td.dataset.a, ev.shiftKey);
    else if (act === 'amt') onAmountClick(parseFloat(td.dataset.v));
    else if (act === 'ent') onEntryClick(td.closest('tr'));
  }

  function closePanel() {
    const p = document.getElementById(PANEL_ID);
    if (p) p.remove();
    const bk = document.getElementById(BACK_ID);
    if (bk) bk.remove();
    document.removeEventListener('keydown', onEsc, true);
  }
  function onEsc(ev) {
    const pp = document.getElementById(PANEL_ID);
    if (ev.key === 'Escape' && pp && pp.style.display !== 'none') { ev.stopPropagation(); closePanel(); }
  }

  function showPanel(model) {
    closePanel();
    const p = document.createElement('div');
    p.id = PANEL_ID;
    p.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#fff;display:flex;flex-direction:column;font-family:inherit;';
    p.innerHTML =
      '<style>' +
      '#' + PANEL_ID + ' table{border-collapse:collapse;font-size:12px;width:100%;table-layout:fixed}' +
      '#' + PANEL_ID + ' td:not(.n),#' + PANEL_ID + ' th:not(.n){text-align:left!important}' +
      '#' + PANEL_ID + ' th{position:sticky;top:0;background:#0b3d7a;color:#fff;text-align:left;padding:6px 10px;white-space:nowrap}' +
      '#' + PANEL_ID + ' td{padding:3px 10px;border-bottom:1px solid #eef1f5;white-space:nowrap}' +
      '#' + PANEL_ID + ' td{overflow:hidden;text-overflow:ellipsis}' +
      '#' + PANEL_ID + ' td.n{text-align:right;font-family:' + MONO + '}' +
      '#' + PANEL_ID + ' td.neg{color:#d32f2f}' +
      '#' + PANEL_ID + ' tr.acc td{background:#e8eef7;padding:6px 10px;position:sticky;top:29px}' +
      '#' + PANEL_ID + ' tr.eo td{background:#e3effa}' +
      '#' + PANEL_ID + ' tr.tot td{background:#f4f6f9;font-weight:600;border-top:1px solid #c9d2de}' +
      '#' + PANEL_ID + ' tr.gt td{background:#dfe6f1}' +
      '#' + PANEL_ID + ' th.n{text-align:right}' +
      '#' + PANEL_ID + ' .lk{cursor:pointer}' +
      '#' + PANEL_ID + ' .lk:hover{text-decoration:underline;color:#0b3d7a}' +
      '</style>' +
      '<div style="border-bottom:1px solid #d5dbe3;background:#f7f9fc"><div style="display:flex;align-items:center;gap:16px;padding:10px 16px;max-width:1500px;margin:0 auto">' +
      '<b style="font-size:15px">' + (model.kind === 'journal' ? 'Journaux' : 'Grand livre') + '</b>' +
      '<span data-t style="color:#52606d;font-size:12px;flex:1"></span>' +
      "<select data-l style=\"padding:6px 8px;border:1px solid #b8c2cf;border-radius:4px;font-size:13px\"><option value=\"all\">Toutes les écritures</option><option value=\"non\">Non lettrées uniquement</option><option value=\"let\">Lettrées uniquement</option></select>" +
      '<input data-q type="search" placeholder="Rechercher (compte, libellé, pièce, date…)" style="width:340px;padding:6px 10px;border:1px solid #b8c2cf;border-radius:4px;font-size:13px">' +
      '<button data-x style="padding:6px 14px;border:1px solid #0b3d7a;background:#0b3d7a;color:#fff;border-radius:4px;cursor:pointer">Fermer</button>' +
      '</div></div>' +
      '<div style="overflow:auto;flex:1"><div style="max-width:1500px;margin:0 auto"><table>' +
      (model.kind === 'journal'
        ? '<colgroup><col style="width:90px"><col style="width:130px"><col style="width:140px"><col style="width:140px"><col style="width:60px"><col><col style="width:120px"><col style="width:120px"></colgroup><thead><tr><th>Date</th><th>Compte</th><th>Pièce 1</th><th>Pièce 2</th><th>Lett.</th><th>Intitulé</th><th class="n" style="text-align:right!important">Débit</th><th class="n" style="text-align:right!important">Crédit</th></tr></thead>'
        : '<colgroup><col style="width:90px"><col style="width:60px"><col style="width:140px"><col style="width:140px"><col style="width:60px"><col><col style="width:120px"><col style="width:120px"><col style="width:120px"></colgroup><thead><tr><th>Date</th><th>Jnl</th><th>Pièce</th><th>Pièce 2</th><th>Lett.</th><th>Intitulé</th><th class="n" style="text-align:right!important">Débit</th><th class="n" style="text-align:right!important">Crédit</th><th class="n" style="text-align:right!important">Solde</th></tr></thead>') +
      '<tbody></tbody></table></div></div>';
    document.body.appendChild(p);
    panelModelPeriod = parsePeriod(model.title);
    p.addEventListener('click', onPanelClick);
    const tbody = p.querySelector('tbody');
    const info = p.querySelector('[data-t]');
    let curQ = '';
    let curMode = 'all';
    const refresh = () => {
      const r = model.kind === 'journal' ? renderJournalRows(model, curQ, curMode) : renderRows(model, curQ, curMode);
      tbody.innerHTML = r.html;
      const lab = curMode === 'non' ? ' — non lettrées' : curMode === 'let' ? ' — lettrées' : '';
      info.textContent = (model.title ? model.title + ' — ' : '') + model.groups.length + (model.kind === 'journal' ? ' journal(aux), ' : ' compte(s), ') + model.lineCount + ' ligne(s)' + lab + (curQ || curMode !== 'all' ? ' — ' + r.shown + ' affichée(s)' : '');
    };
    refresh();
    let timer = null;
    p.querySelector('[data-q]').addEventListener('input', (e) => {
      clearTimeout(timer);
      const v = e.target.value.trim();
      timer = setTimeout(() => { curQ = v; refresh(); }, 200);
    });
    p.querySelector('[data-l]').addEventListener('change', (e) => {
      curMode = e.target.value;
      refresh();
    });
    p.querySelector('[data-x]').addEventListener('click', closePanel);
    document.addEventListener('keydown', onEsc, true);
    p.querySelector('[data-q]').focus();
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1f2933;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.3)';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ------------------------------------------------------------------
  // Déroulé : clic sur "Afficher à l'écran"
  // ------------------------------------------------------------------
  let busy = false;

  function findDialogButton(dlg, text) {
    return Array.from(dlg.querySelectorAll('button')).find(
      (b) => !b.hasAttribute(BTN_ATTR) && b.textContent.trim() === text
    );
  }

  async function onViewClick(dlg) {
    if (busy) return;
    busy = true;
    const guard = setTimeout(() => { busy = false; captureResolve = null; }, 60000);
    try {
      captureResolve = null;
      captureList = [];
      collecting = false;
      // 1) Excel coché
      const lab = Array.from(dlg.querySelectorAll('label')).find((l) => /^excel$/i.test(l.textContent.trim()));
      const radio = lab ? lab.querySelector('input[type=radio]') : null;
      if (radio && !radio.checked) radio.click();
      await new Promise((r) => setTimeout(r, 150));
      // 2) on arme la capture puis on déclenche l'export natif
      const capPromise = new Promise((resolve, reject) => {
        captureResolve = resolve;
        setTimeout(() => {
          if (captureResolve === resolve) { captureResolve = null; reject(new Error("L'application n'a pas lancé l'export (réessaie)")); }
        }, 8000);
      });
      const exportBtn = findDialogButton(dlg, 'Exporter');
      if (!exportBtn) throw new Error('Bouton Exporter introuvable');
      exportBtn.click();
      const caps = await capPromise;
      toast('Chargement…');
      // 3) réponses des appels natifs (délai max 45 s)
      const bufs = [];
      for (const cap of caps) {
        let buf = await Promise.race([cap.done, new Promise((r) => setTimeout(() => r('timeout'), 45000))]);
        if (buf === 'timeout') throw new Error('Délai dépassé (45 s) — réessaie');
        // 4) repli : rejeu unique avec jeton + cookies
        if (!buf) {
          const r = await fetch(cap.url, { headers: getApiHeaders(), credentials: 'include' });
          if (!r.ok) throw new Error('Serveur : HTTP ' + r.status);
          buf = await r.arrayBuffer();
        }
        bufs.push({ url: cap.url, buf });
      }
      // 3 bis) fenêtre native encore ouverte : on la ferme proprement
      setTimeout(() => {
        const d2 = Array.from(document.querySelectorAll('[role=dialog]')).find((d) => EXPORT_TITLE_RE.test(d.textContent.slice(0, 80)));
        const cancel = d2 && findDialogButton(d2, 'Annuler');
        if (cancel) cancel.click();
      }, 1200);
      const isJournal = /\/diary\/print/.test(bufs[0].url);
      const parsed = [];
      const skipped = [];
      for (const b of bufs) {
        const head = new Uint8Array(b.buf.slice(0, 2));
        if (!(head[0] === 0x50 && head[1] === 0x4b)) {
          // pas un classeur : réponse d'erreur JSON (ex. "Aucune donnée pour le journal BCI")
          let msg = 'réponse illisible';
          try { msg = JSON.parse(new TextDecoder().decode(b.buf)).message || msg; } catch (e) { /* ignore */ }
          const code = new URL(b.url, location.href).searchParams.get('jal_code');
          skipped.push((code ? code + ' : ' : '') + msg);
          continue;
        }
        const read = await readZipEntries(b.buf);
        const shared = parseShared(await read('xl/sharedStrings.xml'));
        const sheet = await read('xl/worksheets/sheet1.xml');
        if (!sheet) throw new Error('Feuille introuvable dans le classeur');
        parsed.push(parseSheet(sheet, shared));
      }
      if (!parsed.length) throw new Error(skipped.length ? skipped.join(' / ') : 'Aucune donnée');
      if (skipped.length) toast('Ignoré : ' + skipped.join(' / '));
      if (isJournal) {
        const model = buildJournalModel(parsed);
        if (!model.sections.length) { toast('Aucune écriture pour ces critères.'); return; }
        showPanel(model);
      } else {
        const model = buildModel(parsed[0]);
        if (!model.groups.length) { toast('Grand livre vide pour ces critères.'); return; }
        showPanel(model);
      }
    } catch (e) {
      console.log('[grand-livre]', e);
      toast('Grand livre : ' + e.message);
    } finally {
      clearTimeout(guard);
      captureResolve = null;
      busy = false;
    }
  }

  function scanGrandLivre() {
    if (isDisabled()) return;
    const dlgs = document.querySelectorAll('[role=dialog]');
    dlgs.forEach((dlg) => {
      const h = dlg.querySelector('h1,h2,h3,h6,[class*=Title]');
      const isGL = EXPORT_TITLE_RE.test((h ? h.textContent : dlg.textContent).slice(0, 80));
      if (!isGL) return;
      if (dlg.querySelector('[' + BTN_ATTR + ']')) return;
      const paper = dlg.querySelector('.MuiDialog-paper') || dlg;
      if (getComputedStyle(paper).position === 'static') paper.style.position = 'relative';
      const b = document.createElement('button');
      b.setAttribute(BTN_ATTR, '1');
      b.type = 'button';
      b.textContent = "Afficher à l'écran";
      b.style.cssText =
        'position:absolute;left:20px;bottom:16px;padding:6px 14px;border:1px solid #0b3d7a;' +
        'background:#fff;color:#0b3d7a;border-radius:4px;cursor:pointer;font-size:13px;';
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onViewClick(dlg);
      });
      paper.appendChild(b);
    });
  }


  // ------------------------------------------------------------------
  // Bouton sur la page Éditions courantes > Grand livre
  // ------------------------------------------------------------------
  const PAGE_BTN_ID = 'tmbc-gl-page-btn';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeout) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(100);
    }
    return null;
  }

  function findKebabButton() {
    const btns = Array.from(document.querySelectorAll('button')).filter((b) => {
      if (b.hasAttribute(BTN_ATTR) || b.id === PAGE_BTN_ID) return false;
      if (b.textContent.trim() || !b.querySelector('svg')) return false;
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.top > 60 && r.top < 160;
    });
    if (!btns.length) return null;
    return btns.reduce((a, b) => (b.getBoundingClientRect().left > a.getBoundingClientRect().left ? b : a));
  }

  async function onPageBtnClick() {
    if (busy) return;
    const kebab = findKebabButton();
    if (!kebab) { toast('Menu ⋮ introuvable'); return; }
    kebab.click();
    const item = await waitFor(
      () => Array.from(document.querySelectorAll('li,[role=menuitem],button')).find(
        (e) => !e.hasAttribute(BTN_ATTR) && e.textContent.trim() === 'Exporter' && e.getBoundingClientRect().width > 0
      ),
      3000
    );
    if (!item) { toast('Entrée « Exporter » introuvable'); return; }
    item.click();
    const dlg = await waitFor(
      () => Array.from(document.querySelectorAll('[role=dialog]')).find((d) => EXPORT_TITLE_RE.test(d.textContent.slice(0, 80))),
      3000
    );
    if (!dlg) { toast("Fenêtre d'export introuvable"); return; }
    onViewClick(dlg);
  }

  function scanPageButton() {
    let btn = document.getElementById(PAGE_BTN_ID);
    const onLedger = !isDisabled() && /\/current-editions\/(ledger|currentEditionDiary)/.test(location.pathname);
    const popupOpen = !!document.querySelector('.MuiPopover-root,.MuiMenu-root,.MuiModal-root,[role=dialog]');
    if (!onLedger) { if (btn) btn.remove(); return; }
    const kebab = findKebabButton();
    if (!kebab) { if (btn) btn.style.display = 'none'; return; }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = PAGE_BTN_ID;
      btn.type = 'button';
      btn.textContent = "Afficher à l'écran";
      btn.style.cssText =
        'position:fixed;z-index:1300;padding:7px 16px;border:1px solid #0b3d7a;background:#0b3d7a;' +
        'color:#fff;border-radius:4px;cursor:pointer;font-size:13px;';
      btn.addEventListener('click', onPageBtnClick);
      document.body.appendChild(btn);
    }
    // Zone vide à droite des filtres : sous le ⋮, à la hauteur de la ligne
    // "Toutes les lignes / plage de comptes", alignée à droite du ⋮.
    const kr = kebab.getBoundingClientRect();
    const bw = btn.offsetWidth || 140;
    btn.style.display = popupOpen && !busy ? 'none' : 'block';
    // Repère privilégié : champ "Ex: 1-3, 5, 6-7" (plage de comptes) -> le bouton
    // se place dans la zone vide à sa droite, légèrement plus bas (emplacement
    // désigné par Nicolas). Repli : sous le ⋮, aligné à droite.
    const rangeInput = Array.from(document.querySelectorAll('input')).find((i) => /^Ex\s*:/i.test(i.placeholder || '') && i.getBoundingClientRect().width > 0);
    if (rangeInput) {
      const rr = rangeInput.getBoundingClientRect();
      btn.style.top = Math.round(rr.top + 14) + 'px';
      btn.style.left = Math.round(rr.right + 150) + 'px';
    } else {
      btn.style.top = Math.round(kr.bottom + 28) + 'px';
      btn.style.left = Math.round(kr.right - bw) + 'px';
    }
  }

  // Exposé pour d'autres modules (ex. consult-filtre.js) : charge un grand livre Excel
  // (GET /grand_livre, xls=true, jeton + cookies) et le renvoie sous forme de modèle
  // { groups:[{num,label,lines:[{C date,D jnl,E pièce,F pièce2,G lettrage,H intitulé,I débit,J crédit,K solde}]}] }.
  window.TMBC_GL = {
    async fetchLedgerModel(params) {
      const q = new URLSearchParams(params);
      const r = await fetch('https://prod-ws.myunisoft.fr/grand_livre?' + q.toString(), {
        headers: ownHeaders(), credentials: 'include', __tmbcOwn: true,
      });
      if (!r.ok) throw new Error('Grand livre : HTTP ' + r.status);
      const buf = await r.arrayBuffer();
      const head = new Uint8Array(buf.slice(0, 2));
      if (!(head[0] === 0x50 && head[1] === 0x4b)) {
        let msg = 'réponse illisible';
        try { msg = JSON.parse(new TextDecoder().decode(buf)).message || msg; } catch (e) { /* ignore */ }
        throw new Error(msg);
      }
      const read = await readZipEntries(buf);
      const shared = parseShared(await read('xl/sharedStrings.xml'));
      const sheet = await read('xl/worksheets/sheet1.xml');
      if (!sheet) throw new Error('Feuille introuvable dans le classeur');
      return buildModel(parseSheet(sheet, shared));
    },
    async fetchLedgerRaw(params) {
      const q = new URLSearchParams(params);
      const r = await fetch('https://prod-ws.myunisoft.fr/grand_livre?' + q.toString(), {
        headers: ownHeaders(), credentials: 'include', __tmbcOwn: true,
      });
      if (!r.ok) throw new Error('Grand livre : HTTP ' + r.status);
      const buf = await r.arrayBuffer();
      const head = new Uint8Array(buf.slice(0, 2));
      if (!(head[0] === 0x50 && head[1] === 0x4b)) {
        let msg = 'réponse illisible';
        try { msg = JSON.parse(new TextDecoder().decode(buf)).message || msg; } catch (e) { /* ignore */ }
        throw new Error(msg);
      }
      const read = await readZipEntries(buf);
      const shared = parseShared(await read('xl/sharedStrings.xml'));
      const sheet = await read('xl/worksheets/sheet1.xml');
      if (!sheet) throw new Error('Feuille introuvable dans le classeur');
      return parseSheet(sheet, shared);
    },
    async loadAccountList(start, end) {
      const period = { start: String(start).replace(/-/g, ''), end: String(end).replace(/-/g, '') };
      const key = location.pathname.split('/')[2] + '|' + period.start + period.end;
      if (window.TMBC_GL._accKey === key && window.TMBC_GL._accList) return window.TMBC_GL._accList;
      const q = new URLSearchParams({
        start_date: period.start, end_date: period.end, compare: 'false', unbalanced_only: 'false',
        cumul: 'false', an_simulation: 'false', centralize_account: 'false', extended: 'false',
        subtype: '0', unvalidated_accounts_only: 'false',
      });
      const r = await fetch('https://prod-ws.myunisoft.fr/balance_dynamique/v2?' + q.toString(), { credentials: 'include', headers: ownHeaders(), __tmbcOwn: true });
      if (!r.ok) throw new Error('Balance : HTTP ' + r.status);
      const j = await r.json();
      const list = [];
      const idmap = {};
      (function walk(nodes) {
        for (const n of nodes || []) {
          if (n.account_List && n.account_List.length) walk(n.account_List);
          else if (n.id_account) {
            let label = n.account_label || n.label || n.name || n.account_name || n.libelle || n.wording || '';
            if (!label) {
              const k = Object.keys(n).find((x) => /label|name|libel|wording|intitul/i.test(x) && typeof n[x] === 'string' && n[x]);
              label = k ? n[k] : '';
            }
            const nums = {};
            Object.keys(n).forEach((k) => { const v = n[k]; if (typeof v === 'number') nums[k] = v; else if (typeof v === 'string' && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) nums[k] = parseFloat(v.replace(',', '.')); });
            if (Array.isArray(n.exercice_values) && typeof n.exercice_values[0] === 'number') nums.solde = n.exercice_values[0];
            list.push({ num: String(n.account_number), id: n.id_account, label: String(label || ''), nums });
            idmap[String(n.account_number)] = n.id_account;
          }
        }
      })(j.data);
      list.sort((a, b) => (a.num < b.num ? -1 : a.num > b.num ? 1 : 0));
      window.TMBC_GL._accKey = key;
      window.TMBC_GL._accList = list;
      accountIdMap = idmap; accountIdKey = key; // un seul appel : alimente aussi le cache des ids
      return list;
    },
    async openEntry(o) {
      // Recherche native (loupe) par montant, puis double-clic sur la ligne : date + montant (+ journal).
      // Le n° de compte n'apparaît pas forcément dans les résultats, on ne l'exige plus.
      try {
        const amt = Math.abs(parseFloat(o.amt));
        const dlg = await runNativeSearch(amt);
        const strip = (x) => String(x || '').replace(/[\s\u00a0\u202f]/g, '');
        const amtTxt = strip(amt.toFixed(2).replace('.', ','));
        const dateTxt = strip(o.date);
        const jn = strip(o.jnl);
        const row = await waitFor(() => {
          const rows = Array.from(dlg.querySelectorAll('tr,[role=row]')).filter((r) => !r.querySelector('tr,[role=row]') && r.querySelector('td,[role=cell],[role=gridcell]'));
          const t = (r) => strip(r.textContent);
          return rows.find((r) => t(r).indexOf(dateTxt) !== -1 && t(r).indexOf(amtTxt) !== -1 && (!jn || t(r).indexOf(jn) !== -1))
            || rows.find((r) => t(r).indexOf(dateTxt) !== -1 && t(r).indexOf(amtTxt) !== -1);
        }, 8000);
        if (!row) { toast('Écriture non trouvée dans les résultats : double-clique-la dans la recherche.'); return; }
        const target = row.querySelector('td:nth-child(3),td:nth-child(2),[role=cell],[role=gridcell]') || row;
        ['mousedown', 'mouseup', 'click', 'mousedown', 'mouseup', 'click', 'dblclick'].forEach((type) =>
          target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, detail: type === 'dblclick' ? 2 : 1 }))
        );
      } catch (e) { toast('Écriture : ' + e.message); }
    },
  };

  registerScan(scanGrandLivre);
  registerScan(scanPageButton);
})();
