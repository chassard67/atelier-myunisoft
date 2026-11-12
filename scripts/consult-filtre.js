// ==UserScript==
// @name         MyUnisoft - Consultation : filtre de comptes (fournisseurs / clients non lettrés)
// @namespace    https://nicolas.chassard/myunisoft
// @version      1.2-ext
// @description  v1.2 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — diagnostic Ctrl+Alt+K téléchargé en diag-N.txt (ATM.diag) au lieu de l'IPC Electron.
//               v1.1 (2026-10-29) : le menu est déplacé DANS le panneau natif "Filtres" (ligne Sens, à droite du champ "+/-"),
//               visible quand le panneau est déplié ; le filtre reste actif s'il est replié.
//               v1.0 (2026-10-29, demandé par Nicolas) : dans la page Consultation (tenue / fenêtre de
//               consultation), un petit menu à droite des filtres (zone entourée en rouge) propose :
//               "Fourn. débits non lettrés" et "Clients crédits non lettrés". Au choix, le script
//               charge UNE FOIS le grand livre Excel natif (GET /grand_livre, not_lettered_only=true,
//               subtype fournisseur/client, mêmes dates que la page, jeton + cookies — réutilise le
//               lecteur xlsx de grand-livre.js via window.TMBC_GL) et retient les comptes qui ont au
//               moins une ligne NON LETTRÉE au débit (fournisseurs) / au crédit (clients).
//               Effets : (1) la liste déroulante "Sélectionner un compte" n'affiche plus que ces
//               comptes (options masquées en display:none, rien de supprimé) ; (2) les flèches
//               gauche/droite à côté du titre parcourent CETTE liste (interceptées tant qu'un
//               filtre est actif ; boutons ◀ ▶ + compteur n/N en doublon dans le menu) ; (3) à
//               chaque compte, le filtre natif "Lettrage" est remis sur TOUTES les écritures (on
//               veut voir toutes les écritures du compte, pas seulement les non lettrées).
//               Pilotage de l'interface native par événements (saisie dans l'auto-complétion,
//               clic sur l'option) — aucun appel serveur dupliqué en dehors du grand livre.
//               Diagnostic temporaire : Ctrl+Alt+K écrit un diag-N.txt décrivant l'en-tête.
// @author       Nicolas
// ==/UserScript==

(function () {
  'use strict';

  const { isDisabled, registerScan } = window.TMBC;

  const BAR_ID = 'tmbc-cf-bar';
  const HIDDEN_ATTR = 'data-tmbc-cf-hidden';
  const MODES = {
    fourn: { label: 'Fourn. débits non lettrés', subtype: '2', range: '40-409999', side: 'I' },
    client: { label: 'Clients crédits non lettrés', subtype: '1', range: '41-419999', side: 'J' },
  };

  const state = { mode: '', list: null, set: null, idx: -1, busy: false };

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
  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText =
      'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1f2933;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.3)';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ------------------------------------------------------------------
  // Repérage de la page / des champs natifs
  // ------------------------------------------------------------------
  function leafWithText(re, root) {
    const r = root || document;
    return Array.from(r.querySelectorAll('label,p,span,h1,h2,h3,div')).find(
      (e) => e.children.length === 0 && re.test(e.textContent.trim()) && e.getBoundingClientRect().width > 0
    );
  }
  const titleEl = () => leafWithText(/^Consultation\s+-\s+/);
  const accountLabel = () => leafWithText(/^Sélectionner un compte$/);
  const lettrageLabel = () => leafWithText(/^Lettrage$/);
  const exerciceLabel = () => leafWithText(/^Exercice\(s\)$/);

  function controlNear(label) {
    // conteneur du champ : on remonte jusqu'à trouver un input / combobox
    let c = label;
    for (let i = 0; i < 4 && c; i++, c = c.parentElement) {
      const f = c.querySelector('input,[role=combobox],[role=button]');
      if (f) return f;
    }
    return null;
  }

  function currentAccountNum() {
    const lab = accountLabel();
    const input = lab && controlNear(lab);
    const v = input ? input.value || input.textContent : '';
    const m = /^\s*([0-9A-Za-z]+)\s+-\s+/.exec(v || '');
    if (m) return m[1];
    const t = titleEl();
    const m2 = t && /Consultation\s+-\s+([0-9A-Za-z]+)\s/.exec(t.textContent);
    return m2 ? m2[1] : null;
  }

  function readPeriod() {
    // champs Du / Au : inputs dont la valeur est une date jj/mm/aaaa, dans l'ordre
    const vals = Array.from(document.querySelectorAll('input'))
      .map((i) => i.value)
      .filter((v) => /^\d{2}\/\d{2}\/\d{4}$/.test(v));
    if (vals.length < 2) return null;
    const iso = (d) => d.slice(6, 10) + '-' + d.slice(3, 5) + '-' + d.slice(0, 2);
    return { start: iso(vals[0]), end: iso(vals[1]) };
  }

  // ------------------------------------------------------------------
  // Pilotage de l'auto-complétion "Sélectionner un compte"
  // ------------------------------------------------------------------
  function setNativeValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function clickLike(el) {
    ['mousedown', 'mouseup', 'click'].forEach((t) =>
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }))
    );
  }

  async function selectAccount(num) {
    const lab = accountLabel();
    const input = lab && controlNear(lab);
    if (!input || input.tagName !== 'INPUT') throw new Error('Champ "Sélectionner un compte" introuvable');
    input.focus();
    clickLike(input);
    setNativeValue(input, num);
    const opt = await waitFor(
      () => Array.from(document.querySelectorAll('[role=listbox] [role=option], li[role=option]')).find(
        (li) => new RegExp('^\\s*' + num.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+-\\s+').test(li.textContent) && li.getBoundingClientRect().height > 0
      ),
      4000
    );
    if (!opt) throw new Error('Compte ' + num + ' introuvable dans la liste');
    clickLike(opt);
    await sleep(500);
  }

  async function ensureLettrageAll() {
    const lab = lettrageLabel();
    const ctrl = lab && controlNear(lab);
    if (!ctrl) return;
    const cur = (ctrl.value || ctrl.textContent || '').trim();
    if (cur && !/uniquement/i.test(cur)) return; // déjà sur "Toutes"
    clickLike(ctrl);
    const opts = await waitFor(() => {
      const o = Array.from(document.querySelectorAll('[role=listbox] [role=option], li[role=option]')).filter((li) => li.getBoundingClientRect().height > 0);
      return o.length ? o : null;
    }, 2500);
    if (!opts) return;
    const all = opts.find((o) => !/uniquement/i.test(o.textContent));
    if (all) clickLike(all);
    await sleep(300);
  }

  async function goTo(idx) {
    if (!state.list || !state.list.length || state.busy) return;
    state.busy = true;
    try {
      state.idx = (idx + state.list.length) % state.list.length;
      const num = state.list[state.idx];
      await selectAccount(num);
      await ensureLettrageAll();
    } catch (e) {
      toast('Filtre comptes : ' + e.message);
    } finally {
      state.busy = false;
      updateBar();
    }
  }

  // ------------------------------------------------------------------
  // Calcul de la liste des comptes
  // ------------------------------------------------------------------
  async function applyMode(modeKey) {
    if (!modeKey) {
      state.mode = '';
      state.list = null;
      state.set = null;
      state.idx = -1;
      updateBar();
      return;
    }
    if (!window.TMBC_GL) { toast('Module grand livre indisponible'); return; }
    const m = MODES[modeKey];
    const period = readPeriod();
    if (!period) { toast('Période de la page introuvable'); return; }
    state.busy = true;
    updateBar();
    toast('Recherche des comptes…');
    try {
      const model = await window.TMBC_GL.fetchLedgerModel({
        start_date: period.start, end_date: period.end,
        attachment: 'false', comment_entry: 'false', comment_account: 'false',
        not_lettered_only: 'true', not_solde_only: 'false', an_simulation: 'false',
        subtype: m.subtype, analytic: 'false', echeance: 'false', exchange_rate: 'false',
        centralize_account: 'false', account_number: m.range, xls: 'true',
      });
      const nums = [];
      model.groups.forEach((g) => {
        const ok = g.lines.some((l) => typeof l[m.side] === 'number' && l[m.side] > 0 && (l.G === undefined || String(l.G).trim() === ''));
        if (ok) nums.push(g.num);
      });
      nums.sort();
      state.mode = modeKey;
      state.list = nums;
      state.set = new Set(nums);
      state.idx = -1;
      if (!nums.length) { toast('Aucun compte ne correspond.'); state.busy = false; updateBar(); return; }
      toast(nums.length + ' compte(s) : ' + m.label);
      state.busy = false;
      const cur = currentAccountNum();
      const at = cur ? nums.indexOf(cur) : -1;
      await goTo(at >= 0 ? at : 0);
    } catch (e) {
      state.busy = false;
      toast('Filtre comptes : ' + e.message);
    }
    updateBar();
  }

  // ------------------------------------------------------------------
  // Barre (menu + flèches) placée à droite des filtres
  // ------------------------------------------------------------------
  function buildBar() {
    const bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.style.cssText =
      'position:fixed;z-index:1000;display:flex;align-items:center;gap:8px;font-size:13px;' +
      'background:transparent;border:0;padding:0';
    bar.innerHTML =
      '<select data-m style="padding:5px 8px;border:1px solid #b8c2cf;border-radius:4px;font-size:13px;max-width:230px">' +
      '<option value="">Filtrer les comptes…</option>' +
      '<option value="fourn">' + MODES.fourn.label + '</option>' +
      '<option value="client">' + MODES.client.label + '</option></select>' +
      '<button data-p type="button" title="Compte précédent de la liste" style="border:1px solid #b8c2cf;background:#f7f9fc;border-radius:4px;padding:3px 9px;cursor:pointer">◀</button>' +
      '<span data-c style="min-width:46px;text-align:center;font-family:Consolas,monospace"></span>' +
      '<button data-n type="button" title="Compte suivant de la liste" style="border:1px solid #b8c2cf;background:#f7f9fc;border-radius:4px;padding:3px 9px;cursor:pointer">▶</button>';
    bar.querySelector('[data-m]').addEventListener('change', (e) => applyMode(e.target.value));
    bar.querySelector('[data-p]').addEventListener('click', () => goTo(state.idx - 1));
    bar.querySelector('[data-n]').addEventListener('click', () => goTo(state.idx + 1));
    document.body.appendChild(bar);
    return bar;
  }

  function updateBar() {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;
    const sel = bar.querySelector('[data-m]');
    if (sel.value !== state.mode) sel.value = state.mode;
    sel.disabled = state.busy;
    const has = !!(state.list && state.list.length);
    bar.querySelector('[data-p]').disabled = !has || state.busy;
    bar.querySelector('[data-n]').disabled = !has || state.busy;
    bar.querySelector('[data-c]').textContent = has ? (state.idx + 1) + '/' + state.list.length : state.busy ? '…' : '';
  }

  function positionBar(bar) {
    // v1.1 : dans le panneau natif "Filtres" (ligne Sens / +/-), à droite du champ "+/-".
    // Visible uniquement quand le panneau Filtres est déplié ; le filtre reste actif s'il est replié.
    const lab = leafWithText(/^\+\/-$/);
    if (!lab) return false;
    let inp = lab.id ? document.getElementById(lab.id.replace(/-label$/, '')) : null;
    if (!inp) inp = controlNear(lab);
    const r = (inp || lab).getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(inp || lab);
    if (cs.visibility === 'hidden') return false;
    bar.style.left = Math.round(r.right + 28) + 'px';
    bar.style.top = Math.round(r.top + r.height / 2 - bar.offsetHeight / 2) + 'px';
    return true;
  }

  // ------------------------------------------------------------------
  // Scan périodique
  // ------------------------------------------------------------------
  function hideOptions() {
    const active = !!state.set;
    document.querySelectorAll('li[role=option]').forEach((li) => {
      const m = /^\s*([0-9A-Za-z]+)\s+-\s+/.exec(li.textContent);
      if (!m) return;
      const hide = active && !state.set.has(m[1]);
      if (hide && !li.hasAttribute(HIDDEN_ATTR)) {
        li.setAttribute(HIDDEN_ATTR, li.style.display || '');
        li.style.setProperty('display', 'none', 'important');
      } else if (!hide && li.hasAttribute(HIDDEN_ATTR)) {
        li.style.removeProperty('display');
        li.removeAttribute(HIDDEN_ATTR);
      }
    });
  }

  function scanConsultFilter() {
    let bar = document.getElementById(BAR_ID);
    // Pré-test peu coûteux : la page de consultation porte l'icône native data-id="splitScreen".
    const onPage = !isDisabled() && !!document.querySelector('[data-id="splitScreen"]') && titleEl() && accountLabel();
    if (!onPage) {
      if (bar) bar.remove();
      if (state.mode) { state.mode = ''; state.list = null; state.set = null; state.idx = -1; }
      return;
    }
    if (!bar) { bar = buildBar(); updateBar(); }
    bar.style.display = positionBar(bar) ? 'flex' : 'none';
    hideOptions();
    // suit le compte affiché si on change de compte à la main
    if (state.list && !state.busy) {
      const cur = currentAccountNum();
      const at = cur ? state.list.indexOf(cur) : -1;
      if (at >= 0 && at !== state.idx) { state.idx = at; updateBar(); }
    }
  }

  // Flèches natives (à gauche du titre) : tant qu'un filtre est actif, elles parcourent NOTRE liste.
  document.addEventListener(
    'click',
    (ev) => {
      if (!state.list || !state.list.length) return;
      const b = ev.target.closest && ev.target.closest('button');
      if (!b || b.closest('#' + BAR_ID) || b.textContent.trim()) return;
      const t = titleEl();
      if (!t) return;
      const tr = t.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      if (br.right > tr.left + 8 || Math.abs((br.top + br.bottom) / 2 - (tr.top + tr.bottom) / 2) > 40) return;
      const band = Array.from(document.querySelectorAll('button')).filter((x) => {
        const r = x.getBoundingClientRect();
        return r.width > 0 && !x.textContent.trim() && r.right <= tr.left + 8 && Math.abs((r.top + r.bottom) / 2 - (tr.top + tr.bottom) / 2) < 40;
      }).sort((a, c) => a.getBoundingClientRect().left - c.getBoundingClientRect().left);
      const pos = band.indexOf(b);
      if (pos !== 0 && pos !== 1) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      goTo(state.idx + (pos === 0 ? -1 : 1));
    },
    true
  );

  // Diagnostic temporaire : Ctrl+Alt+K
  document.addEventListener(
    'keydown',
    (ev) => {
      if (!(ev.ctrlKey && ev.altKey && (ev.key === 'k' || ev.key === 'K'))) return;
      try {
        const L = [];
        const t = titleEl();
        L.push('url=' + location.pathname + location.search.replace(/[?&](token|auth)[^&]*/g, ''));
        L.push('title=' + (t ? t.tagName + ' ' + t.textContent.slice(0, 60) : 'absent'));
        const fmt = (e) => {
          const r = e.getBoundingClientRect();
          return e.tagName + '.' + String(e.className).replace(/css-\w+/g, '').slice(0, 40) + ' role=' + (e.getAttribute('role') || '') + ' aria=' + (e.getAttribute('aria-label') || '') + ' rect=' + [r.left, r.top, r.width, r.height].map(Math.round).join(',');
        };
        [accountLabel(), lettrageLabel(), exerciceLabel()].forEach((l, i) => {
          L.push('label' + i + '=' + (l ? fmt(l) : 'absent'));
          const c = l && controlNear(l);
          L.push('  control=' + (c ? fmt(c) + ' value=' + (c.value || c.textContent).slice(0, 50) : 'absent'));
        });
        if (t) {
          const tr = t.getBoundingClientRect();
          Array.from(document.querySelectorAll('button')).filter((b) => {
            const r = b.getBoundingClientRect();
            return r.width > 0 && r.top < tr.bottom + 120 && r.bottom > tr.top - 40;
          }).forEach((b) => L.push('BTN ' + fmt(b) + ' text=' + b.textContent.trim().slice(0, 20)));
          let h = t;
          for (let i = 0; i < 4 && h.parentElement; i++) h = h.parentElement;
          L.push('HEADER HTML: ' + h.outerHTML.replace(/ class="[^"]*"/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').slice(0, 3500));
        }
        L.push('state=' + JSON.stringify({ mode: state.mode, n: state.list && state.list.length, idx: state.idx }));
        window.ATM.diag(L.join('\n'));
      } catch (e) { console.log('[consult-filtre diag]', e); }
    },
    true
  );

  registerScan(scanConsultFilter);
})();
