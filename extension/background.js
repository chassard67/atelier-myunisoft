// Atelier MyUnisoft — service worker (coquille stable).
//
// Rôle :
//  1. Télécharger les modules publiés (manifest.json + fichiers .js) depuis
//     cfg.baseUrl, vérifier leur empreinte SHA-256, les garder en cache local.
//  2. Vérifier la licence de l'utilisateur (licences.json publié).
//  3. Injecter les modules actifs via chrome.userScripts (monde MAIN = même
//     contexte que la page, comme le preload Electron) — ou, sans licence
//     valide, seulement un bandeau d'information.
//  4. Servir de relais réseau (ex-GM_xmlhttpRequest / IPC Electron), limité
//     aux hôtes déclarés par @connect.
//  5. Garder les « notes de mise à jour » à afficher dans la page.
//
// Cette partie ne change presque jamais : les évolutions fonctionnelles se
// font dans /scripts et sont poussées sans réinstaller l'extension.

import { DEFAULTS, FALLBACK_SETTINGS, LICENCE_GRACE_DAYS, EXTENSION_NOTES } from './config.js';

const EXT_VERSION = chrome.runtime.getManifest().version;
const ALARM = 'atm-update-check';
const APP_MATCHES = ['https://connect.lgassocies.com/*', 'https://*.myunisoft.fr/*'];

// ---------------------------------------------------------------------------
// Configuration / état
// ---------------------------------------------------------------------------

async function getConfig() {
  const { cfg = {} } = await chrome.storage.local.get('cfg');
  return {
    ...DEFAULTS,
    ...cfg,
    modules: { ...(cfg.modules || {}) },
    settings: { ...(cfg.settings || {}) },
  };
}

async function patchConfig(patch) {
  const { cfg = {} } = await chrome.storage.local.get('cfg');
  const next = { ...cfg, ...patch };
  if (patch.settings) next.settings = { ...(cfg.settings || {}), ...patch.settings };
  if (patch.modules) next.modules = { ...(cfg.modules || {}), ...patch.modules };
  delete next.disabled; // ancien format (1.0.0)
  await chrome.storage.local.set({ cfg: next });
  return getConfig();
}

async function getState() {
  const { state = {} } = await chrome.storage.local.get('state');
  return state;
}

async function patchState(patch) {
  const state = { ...(await getState()), ...patch };
  await chrome.storage.local.set({ state });
  return state;
}

function compareVersions(a, b) {
  const pa = String(a || '0').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '0').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function userScriptsAvailable() {
  try {
    chrome.userScripts.getScripts(); // lève une exception si le bouton n'est pas activé
    return true;
  } catch {
    return false;
  }
}

// Valeurs effectives = choix de l'utilisateur, sinon défaut publié, sinon repli.
function catalogItems(manifest) {
  const out = [];
  for (const g of (manifest && manifest.catalog) || []) for (const it of g.items || []) out.push(it);
  return out;
}

function effectiveSettings(manifest, cfg) {
  const defs = {};
  for (const it of catalogItems(manifest)) if (it.type === 'setting') defs[it.id] = !!it.default;
  return { ...FALLBACK_SETTINGS, ...defs, ...cfg.settings };
}

function effectiveModules(manifest, cfg) {
  const enabled = new Set();
  if (!manifest) return enabled;
  const defs = {};
  for (const it of catalogItems(manifest)) if (it.type === 'module') defs[it.id] = !!it.default;
  for (const s of manifest.scripts) {
    const def = s.id in defs ? defs[s.id] : s.default !== false;
    if (s.required || (s.id in cfg.modules ? cfg.modules[s.id] : def)) enabled.add(s.id);
  }
  // Dépendances (ex. consult-premium a besoin de grand-livre).
  const deps = manifest.dependencies || {};
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of [...enabled]) {
      for (const d of deps[id] || []) {
        if (!enabled.has(d)) {
          enabled.add(d);
          grew = true;
        }
      }
    }
  }
  return enabled;
}

// ---------------------------------------------------------------------------
// Licence
// ---------------------------------------------------------------------------
// licences.json (publié) : { licences: [{ hash, client, status }] } où hash =
// SHA-256 de la clé normalisée. Les clés elles-mêmes ne sont jamais publiées.

function normalizeKey(k) {
  return String(k || '').trim().toUpperCase();
}

async function checkLicence(base, cfg, manifest) {
  if (manifest && manifest.licenceRequired === false) return { status: 'not-required' };
  const prev = (await getState()).licence || {};
  const key = normalizeKey(cfg.licenceKey);
  if (!key) return { status: 'missing' };
  const hash = await sha256Hex(key);
  try {
    const data = JSON.parse(await fetchText(base + 'licences.json'));
    const hit = (data.licences || []).find((l) => l.hash === hash);
    if (!hit) return { status: 'unknown', checkedAt: Date.now() };
    return {
      status: hit.status === 'active' ? 'active' : 'blocked',
      client: hit.client || '',
      checkedAt: Date.now(),
      validatedAt: hit.status === 'active' ? Date.now() : prev.validatedAt,
    };
  } catch (e) {
    // Serveur injoignable : on garde le dernier état connu, avec un délai de grâce.
    if (prev.status === 'active' && prev.keyHash === hash) {
      const age = Date.now() - (prev.validatedAt || 0);
      if (age > LICENCE_GRACE_DAYS * 86400e3) return { ...prev, status: 'expired' };
      return prev;
    }
    return { status: 'unverified', error: String(e.message || e) };
  }
}

function licenceOk(lic) {
  return lic && (lic.status === 'active' || lic.status === 'not-required');
}

// ---------------------------------------------------------------------------
// Notes de mise à jour (fenêtre affichée dans la page par le module socle)
// ---------------------------------------------------------------------------

async function addNotice(notice) {
  const { notices = [] } = await chrome.storage.local.get('notices');
  const rest = notices.filter((n) => n.id !== notice.id);
  rest.push(notice);
  await chrome.storage.local.set({ notices: rest });
}

// ---------------------------------------------------------------------------
// Téléchargement des modules
// ---------------------------------------------------------------------------

async function fetchText(url) {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(url + sep + 't=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.text();
}

async function getCachedCode(file) {
  const key = 'code:' + file;
  const { [key]: entry } = await chrome.storage.local.get(key);
  return entry || null;
}

let updateInFlight = null;

// fresh : si une vérification tourne déjà (ex. celle lancée au rechargement
// de l'extension), on attend sa fin puis on en relance une, pour tenir compte
// d'un réglage qui vient de changer (clé de licence saisie, source...).
// Sans cela, la saisie de la clé renvoyait le résultat de la vérification en
// cours, faite SANS la clé (« Aucune clé saisie »).
function checkForUpdates(reason = 'auto', { fresh = false } = {}) {
  if (updateInFlight && fresh) {
    return updateInFlight.catch(() => {}).then(() => checkForUpdates(reason));
  }
  if (!updateInFlight) {
    updateInFlight = doCheckForUpdates(reason).finally(() => {
      updateInFlight = null;
    });
  }
  return updateInFlight;
}

async function doCheckForUpdates(reason) {
  const cfg = await getConfig();
  const base = cfg.baseUrl.endsWith('/') ? cfg.baseUrl : cfg.baseUrl + '/';
  const state = await getState();
  let manifest = state.manifest || null;
  let changed = false;
  let error = null;
  try {
    manifest = JSON.parse(await fetchText(base + 'manifest.json'));
    if (!manifest || !Array.isArray(manifest.scripts) || !manifest.runtime) {
      throw new Error('manifest.json invalide');
    }
    // Télécharge uniquement ce qui a changé, vérifie chaque fichier AVANT de
    // remplacer quoi que ce soit : en cas d'erreur, l'ancienne version reste.
    const toStore = {};
    for (const item of [manifest.runtime, ...manifest.scripts]) {
      const cached = await getCachedCode(item.file);
      if (cached && cached.sha256 === item.sha256) continue;
      const code = await fetchText(base + item.file);
      const hash = await sha256Hex(code);
      if (hash !== item.sha256) {
        throw new Error(`Empreinte incorrecte pour ${item.file} (cache du serveur pas encore à jour ? réessayer dans quelques minutes)`);
      }
      toStore['code:' + item.file] = { sha256: hash, code };
    }
    changed = Object.keys(toStore).length > 0 || state.manifest?.build !== manifest.build;
    if (Object.keys(toStore).length) await chrome.storage.local.set(toStore);

    // Note de version des modules : affichée une fois quand la version de
    // publication change (jamais à la toute première installation).
    const rel = manifest.release;
    if (rel && rel.version && rel.version !== state.releaseSeen) {
      if (state.releaseSeen) {
        await addNotice({
          id: 'release-' + rel.version,
          title: `Atelier MyUnisoft ${rel.version} activé`,
          date: rel.date || '',
          lines: rel.notes || [],
        });
      }
      await patchState({ releaseSeen: rel.version });
    }
  } catch (e) {
    error = String(e.message || e);
  }

  const licence = await checkLicence(base, cfg, manifest);
  licence.keyHash = cfg.licenceKey ? await sha256Hex(normalizeKey(cfg.licenceKey)) : null;
  const licenceChanged = (state.licence || {}).status !== licence.status;

  await patchState({
    manifest,
    licence,
    lastCheck: Date.now(),
    lastError: error,
    ...(changed ? { lastUpdate: Date.now() } : {}),
  });

  const nothingRegistered =
    userScriptsAvailable() && (await chrome.userScripts.getScripts()).length === 0;
  if (changed || licenceChanged || nothingRegistered || reason !== 'alarm') {
    await applyRegistrations();
  }
  await refreshBadge();
  return error ? { ok: false, error, licence: licence.status } : { ok: true, changed, build: manifest.build, licence: licence.status };
}

// ---------------------------------------------------------------------------
// Injection dans les pages
// ---------------------------------------------------------------------------

const LICENCE_MESSAGES = {
  missing: "Atelier MyUnisoft : aucune clé de licence n'est saisie. Cliquez sur l'icône de l'extension pour la renseigner.",
  unknown: 'Atelier MyUnisoft : clé de licence non reconnue. Vérifiez la clé saisie dans l\'extension.',
  blocked: 'Atelier MyUnisoft : licence suspendue. Les fonctionnalités Premium sont désactivées — contactez votre administrateur.',
  expired: 'Atelier MyUnisoft : licence non vérifiée depuis trop longtemps. Vérifiez votre connexion puis cliquez sur « Vérifier » dans l\'extension.',
  unverified: 'Atelier MyUnisoft : licence pas encore vérifiée (serveur injoignable). Réessayez plus tard.',
};

function licenceBannerCode(message) {
  return `(function () {
  if (window.__atmLicenceBanner) return;
  window.__atmLicenceBanner = true;
  var show = function () {
    try { if (sessionStorage.getItem('atm-licence-banner')) return; sessionStorage.setItem('atm-licence-banner', '1'); } catch (e) {}
    var d = document.createElement('div');
    d.textContent = ${JSON.stringify(message)};
    d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;max-width:640px;' +
      'background:#7f1d1d;color:#fff;padding:12px 18px;border-radius:8px;font:13px/1.4 system-ui,Segoe UI,Arial;box-shadow:0 6px 20px rgba(0,0,0,.3);cursor:pointer';
    d.title = 'Cliquer pour fermer';
    d.onclick = function () { d.remove(); };
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 15000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();`;
}

async function applyRegistrations() {
  if (!userScriptsAvailable()) {
    await refreshBadge();
    return { ok: false, error: 'userScripts indisponible' };
  }
  const cfg = await getConfig();
  const { manifest, licence } = await getState();
  await chrome.userScripts.unregister(); // repart de zéro (idempotent)
  if (!manifest) return { ok: true, count: 0 };

  if (!licenceOk(licence)) {
    const msg = LICENCE_MESSAGES[(licence && licence.status) || 'missing'] || LICENCE_MESSAGES.missing;
    await chrome.userScripts.register([
      { id: 'atm-licence', matches: APP_MATCHES, runAt: 'document_idle', world: 'MAIN', allFrames: false, js: [{ code: licenceBannerCode(msg) }] },
    ]);
    return { ok: true, count: 0, licence: licence && licence.status };
  }

  const runtime = await getCachedCode(manifest.runtime.file);
  if (!runtime) return { ok: false, error: 'runtime absent du cache' };

  const preamble = `window.__ATM_BOOT = ${JSON.stringify({
    extVersion: EXT_VERSION,
    build: manifest.build,
    release: manifest.release ? manifest.release.version : null,
    settings: effectiveSettings(manifest, cfg),
  })};\n`;

  // UN SEUL enregistrement contenant tous les modules actifs, dans l'ordre de
  // publication (= ordre de require() du preload Electron) : premium.js
  // définit window.TMBC avant les autres. document_start comme le preload.
  const enabled = effectiveModules(manifest, cfg);
  const js = [{ code: preamble + runtime.code + `\n//# sourceURL=atelier-myunisoft/${manifest.runtime.file}` }];
  const matches = new Set();
  for (const s of manifest.scripts) {
    if (!enabled.has(s.id)) continue;
    const cached = await getCachedCode(s.file);
    if (!cached) continue;
    s.matches.forEach((m) => matches.add(m));
    js.push({
      code:
        `try {\n${cached.code}\n} catch (e) { console.error('[Atelier] erreur au chargement du module ${s.id}', e); }` +
        `\n//# sourceURL=atelier-myunisoft/${s.file}`,
    });
  }
  if (js.length > 1) {
    await chrome.userScripts.register([
      { id: 'atm-bundle', matches: [...matches], runAt: 'document_start', world: 'MAIN', allFrames: false, js },
    ]);
  }
  return { ok: true, count: js.length - 1 };
}

async function refreshBadge() {
  const { manifest, lastError, licence } = await getState();
  let text = '';
  let color = '#10b981';
  let title = 'Atelier MyUnisoft';
  if (!userScriptsAvailable()) {
    text = '!';
    color = '#dc2626';
    title += ' — activer « Autoriser les scripts utilisateur »';
  } else if (manifest && !licenceOk(licence)) {
    text = 'LIC';
    color = '#dc2626';
    title += ' — licence : ' + ((licence && licence.status) || 'absente');
  } else if (manifest && compareVersions(manifest.minExtensionVersion, EXT_VERSION) > 0) {
    text = 'EXT';
    color = '#f97316';
    title += ` — nouvelle version de l'extension requise (${manifest.minExtensionVersion})`;
  } else if (!manifest && lastError) {
    text = '?';
    color = '#f97316';
    title += ' — modules jamais téléchargés : ' + lastError;
  }
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setTitle({ title });
}

async function scheduleAlarm() {
  const cfg = await getConfig();
  await chrome.alarms.clear(ALARM);
  await chrome.alarms.create(ALARM, {
    delayInMinutes: 1,
    periodInMinutes: Math.max(5, Number(cfg.checkIntervalMin) || 30),
  });
}

// ---------------------------------------------------------------------------
// Relais réseau et services pour les modules
// ---------------------------------------------------------------------------

function hostAllowed(hostname, hosts) {
  for (const h of hosts) {
    if (hostname === h || hostname.endsWith('.' + h)) return true;
  }
  return false;
}

async function proxyHttp({ url, method = 'GET', headers, body, responseType = 'text' }) {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('Seul https est autorisé');
  const { manifest } = await getState();
  if (!hostAllowed(u.hostname, new Set((manifest && manifest.connect) || []))) {
    throw new Error(`Hôte non autorisé : ${u.hostname} (ajouter @connect dans le module)`);
  }
  const res = await fetch(url, { method, headers, body, credentials: 'omit' });
  const out = {
    status: res.status,
    statusText: res.statusText,
    finalUrl: res.url,
    headers: Object.fromEntries(res.headers.entries()),
  };
  out.body = responseType === 'json' ? await res.json() : await res.text();
  return out;
}

// Ex-ipcMain.handle('fetch-meteo-status') de main.js.
async function meteoStatus() {
  const html = (await proxyHttp({ url: 'https://meteo.myunisoft.fr/widget/compact/' })).body;
  const match = html.match(/class="([^"]*status-icon[^"]*)"/);
  return match ? match[1].split(/\s+/) : null;
}

async function storeGet(key) {
  const k = 'us:' + key;
  const { [k]: v } = await chrome.storage.local.get(k);
  return v === undefined ? null : v;
}
async function storeSet(key, value) {
  const k = 'us:' + key;
  if (value === null || value === undefined) await chrome.storage.local.remove(k);
  else await chrome.storage.local.set({ [k]: value });
  return true;
}

const PAGE_HANDLERS = {
  http: proxyHttp,
  'meteo-status': meteoStatus,
  'store-get': ({ key }) => storeGet(key),
  'store-set': ({ key, value }) => storeSet(key, value),
  ping: () => ({ extVersion: EXT_VERSION }),
  // Ex-webFrame.setZoomFactor d'Electron : zoom propre à l'onglet.
  'set-zoom': async ({ factor }, sender) => {
    const f = Number(factor);
    if (!sender.tab || !(f >= 0.25 && f <= 5)) throw new Error('zoom invalide');
    await chrome.tabs.setZoomSettings(sender.tab.id, { mode: 'automatic', scope: 'per-tab' });
    await chrome.tabs.setZoom(sender.tab.id, f);
    return true;
  },
  // Notes de mise à jour en attente (affichées une fois par le module socle).
  'notices-get': async () => (await chrome.storage.local.get('notices')).notices || [],
  'notices-ack': async ({ ids }) => {
    const { notices = [] } = await chrome.storage.local.get('notices');
    await chrome.storage.local.set({ notices: notices.filter((n) => !(ids || []).includes(n.id)) });
    return true;
  },
};

// ---------------------------------------------------------------------------
// Fenêtres popup (ex-setWindowOpenHandler de main.js) : toute fenêtre popup
// qui charge une page MyUnisoft (consultation, MyU Vision...) est agrandie
// une fois à son ouverture.
// ---------------------------------------------------------------------------
const APP_URL_RE = /^https:\/\/(connect\.lgassocies\.com|[^/]*\.myunisoft\.fr)\//;

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url || !APP_URL_RE.test(changeInfo.url)) return;
  const cfg = await getConfig();
  const { manifest } = await getState();
  if (!effectiveSettings(manifest, cfg).maximizeConsultWindow) return;
  const key = 'maximized:' + tab.windowId;
  const { [key]: done } = await chrome.storage.session.get(key);
  if (done) return;
  try {
    const win = await chrome.windows.get(tab.windowId);
    if (win.type !== 'popup') return;
    await chrome.storage.session.set({ [key]: true });
    if (win.state === 'normal') await chrome.windows.update(tab.windowId, { state: 'maximized' });
  } catch {
    /* fenêtre déjà fermée */
  }
});

// ---------------------------------------------------------------------------
// Messages (pont page ⇄ extension, et fenêtre de l'extension)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg && msg.atm === 'page') {
        const fn = PAGE_HANDLERS[msg.type];
        if (!fn) throw new Error('Action inconnue : ' + msg.type);
        return { ok: true, data: await fn(msg.payload || {}, sender) };
      }
      if (msg && msg.atm === 'popup') return { ok: true, data: await handlePopup(msg) };
      return { ok: false, error: 'message ignoré' };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  })().then(sendResponse);
  return true;
});

async function handlePopup(msg) {
  switch (msg.type) {
    case 'status': {
      const [cfg, state] = await Promise.all([getConfig(), getState()]);
      const enabled = effectiveModules(state.manifest, cfg);
      return {
        extVersion: EXT_VERSION,
        extensionId: chrome.runtime.id,
        userScripts: userScriptsAvailable(),
        chromeVersion: Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 0),
        cfg,
        state,
        settings: effectiveSettings(state.manifest, cfg),
        enabledModules: [...enabled],
      };
    }
    case 'check':
      return checkForUpdates('manual', { fresh: true });
    case 'set-module':
      await patchConfig({ modules: { [msg.id]: !!msg.value } });
      return applyRegistrations();
    case 'set-setting':
      await patchConfig({ settings: { [msg.id]: !!msg.value } });
      return applyRegistrations();
    case 'reset-defaults':
      {
        const { cfg = {} } = await chrome.storage.local.get('cfg');
        await chrome.storage.local.set({ cfg: { ...cfg, modules: {}, settings: {} } });
      }
      return applyRegistrations();
    case 'set-licence':
      await patchConfig({ licenceKey: normalizeKey(msg.key) });
      return checkForUpdates('manual', { fresh: true });
    case 'set-base-url': {
      let url = String(msg.baseUrl || '').trim();
      if (url && !url.endsWith('/')) url += '/';
      await patchConfig({ baseUrl: url || DEFAULTS.baseUrl });
      return checkForUpdates('manual', { fresh: true });
    }
    case 'reload-tabs': {
      const tabs = await chrome.tabs.query({ url: APP_MATCHES });
      await Promise.all(tabs.map((t) => chrome.tabs.reload(t.id)));
      return { count: tabs.length };
    }
    case 'reapply':
      return applyRegistrations();
    default:
      throw new Error('Action inconnue : ' + msg.type);
  }
}

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

// NB : Chrome efface les scripts enregistrés à chaque mise à jour de
// l'extension → on ré-enregistre systématiquement à l'install et au démarrage.
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update' && details.previousVersion && details.previousVersion !== EXT_VERSION) {
    await addNotice({
      id: 'extension-' + EXT_VERSION,
      title: `Extension Atelier MyUnisoft mise à jour (${details.previousVersion} → ${EXT_VERSION})`,
      lines: EXTENSION_NOTES[EXT_VERSION] || [],
    });
  }
  await scheduleAlarm();
  await applyRegistrations();
  await checkForUpdates('install');
});

chrome.runtime.onStartup.addListener(async () => {
  await scheduleAlarm();
  await applyRegistrations();
  await checkForUpdates('startup');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) checkForUpdates('alarm');
});
