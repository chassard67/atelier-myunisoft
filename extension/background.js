// Atelier MyUnisoft — service worker (coquille stable).
//
// Rôle :
//  1. Télécharger les modules publiés (manifest.json + fichiers .js) depuis
//     cfg.baseUrl, vérifier leur empreinte SHA-256, les garder en cache local.
//  2. Les enregistrer via chrome.userScripts (monde MAIN = même contexte que
//     la page, indispensable pour renifler fetch/XHR comme le faisait le
//     preload Electron avec contextIsolation:false).
//  3. Servir de relais réseau (remplace GM_xmlhttpRequest / l'IPC Electron) :
//     les requêtes partent d'ici, sans contrainte CORS, mais UNIQUEMENT vers
//     les hôtes déclarés par @connect dans les modules publiés.
//  4. Reproduire les quelques comportements qui étaient dans main.js
//     (fenêtre de consultation agrandie, état « météo » MyUnisoft).
//
// Cette partie ne change presque jamais : toutes les évolutions fonctionnelles
// se font dans /scripts et sont poussées sans réinstaller l'extension.

import { DEFAULTS } from './config.js';

const EXT_VERSION = chrome.runtime.getManifest().version;
const ALARM = 'atm-update-check';
const RUN_AT = {
  'document-start': 'document_start',
  'document-end': 'document_end',
  'document-idle': 'document_idle',
};

// ---------------------------------------------------------------------------
// Configuration / état
// ---------------------------------------------------------------------------

async function getConfig() {
  const { cfg = {} } = await chrome.storage.local.get('cfg');
  return {
    ...DEFAULTS,
    ...cfg,
    settings: { ...DEFAULTS.settings, ...(cfg.settings || {}) },
    disabled: cfg.disabled || DEFAULTS.disabled,
  };
}

async function patchConfig(patch) {
  const { cfg = {} } = await chrome.storage.local.get('cfg');
  const next = { ...cfg, ...patch };
  if (patch.settings) next.settings = { ...(cfg.settings || {}), ...patch.settings };
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

function checkForUpdates(reason = 'auto') {
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
  try {
    const manifest = JSON.parse(await fetchText(base + 'manifest.json'));
    if (!manifest || !Array.isArray(manifest.scripts) || !manifest.runtime) {
      throw new Error('manifest.json invalide');
    }

    // Télécharge uniquement ce qui a changé (empreinte différente du cache),
    // vérifie chaque fichier AVANT de remplacer quoi que ce soit : en cas
    // d'erreur, l'ancienne version reste en place et continue de tourner.
    const wanted = [manifest.runtime, ...manifest.scripts];
    const toStore = {};
    for (const item of wanted) {
      const cached = await getCachedCode(item.file);
      if (cached && cached.sha256 === item.sha256) continue;
      const code = await fetchText(base + item.file);
      const hash = await sha256Hex(code);
      if (hash !== item.sha256) {
        throw new Error(`Empreinte incorrecte pour ${item.file} (cache CDN pas encore à jour ? réessayer dans quelques minutes)`);
      }
      toStore['code:' + item.file] = { sha256: hash, code };
    }

    const changed = Object.keys(toStore).length > 0 || state.manifest?.build !== manifest.build;
    if (Object.keys(toStore).length) await chrome.storage.local.set(toStore);
    await patchState({
      manifest,
      lastCheck: Date.now(),
      lastError: null,
      ...(changed ? { lastUpdate: Date.now() } : {}),
    });
    // Ré-enregistre aussi si rien n'est enregistré (ex. bouton « Autoriser les
    // scripts utilisateur » activé APRÈS l'installation).
    const nothingRegistered =
      userScriptsAvailable() && (await chrome.userScripts.getScripts()).length === 0;
    if (changed || nothingRegistered || reason === 'install' || reason === 'startup') {
      await applyRegistrations();
    }
    await refreshBadge();
    return { ok: true, changed, build: manifest.build };
  } catch (e) {
    await patchState({ lastCheck: Date.now(), lastError: String(e.message || e) });
    await refreshBadge();
    return { ok: false, error: String(e.message || e) };
  }
}

// ---------------------------------------------------------------------------
// Enregistrement des modules dans les pages
// ---------------------------------------------------------------------------

async function applyRegistrations() {
  if (!userScriptsAvailable()) {
    await refreshBadge();
    return { ok: false, error: 'userScripts indisponible' };
  }
  const cfg = await getConfig();
  const { manifest } = await getState();
  await chrome.userScripts.unregister(); // repart de zéro (idempotent)
  if (!manifest) return { ok: true, count: 0 };

  const runtime = await getCachedCode(manifest.runtime.file);
  if (!runtime) return { ok: false, error: 'runtime absent du cache' };

  const preamble =
    `window.__ATM_BOOT = ${JSON.stringify({
      extVersion: EXT_VERSION,
      build: manifest.build,
      settings: cfg.settings,
    })};\n`;

  const registrations = [];
  for (const s of manifest.scripts) {
    if (cfg.disabled.includes(s.id)) continue;
    const cached = await getCachedCode(s.file);
    if (!cached) continue;
    registrations.push({
      id: 'atm-' + s.id,
      matches: s.matches,
      excludeMatches: s.excludeMatches && s.excludeMatches.length ? s.excludeMatches : undefined,
      runAt: RUN_AT[s.runAt] || 'document_idle',
      world: 'MAIN',
      allFrames: false, // jamais dans les iframes (équivalent @noframes)
      js: [
        { code: preamble + runtime.code + `\n//# sourceURL=atelier-myunisoft/${manifest.runtime.file}` },
        { code: cached.code + `\n//# sourceURL=atelier-myunisoft/${s.file}` },
      ],
    });
  }
  if (registrations.length) await chrome.userScripts.register(registrations);
  return { ok: true, count: registrations.length };
}

async function refreshBadge() {
  const { manifest, lastError } = await getState();
  let text = '';
  let color = '#10b981';
  let title = 'Atelier MyUnisoft';
  if (!userScriptsAvailable()) {
    text = '!';
    color = '#dc2626';
    title += ' — activer « Autoriser les scripts utilisateur »';
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
// Relais réseau (ex-GM_xmlhttpRequest / ex-IPC Electron)
// ---------------------------------------------------------------------------

async function allowedHosts() {
  const { manifest } = await getState();
  return new Set((manifest && manifest.connect) || []);
}

function hostAllowed(hostname, hosts) {
  for (const h of hosts) {
    if (hostname === h || hostname.endsWith('.' + h)) return true;
  }
  return false;
}

async function proxyHttp({ url, method = 'GET', headers, body, responseType = 'text' }) {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('Seul https est autorisé');
  if (!hostAllowed(u.hostname, await allowedHosts())) {
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

// Petit stockage persistant par module (ex-GM_setValue/GM_getValue).
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
};

// ---------------------------------------------------------------------------
// Fenêtre de consultation (ex-setWindowOpenHandler de main.js)
// ---------------------------------------------------------------------------

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url || !changeInfo.url.includes('/child/consulting')) return;
  const cfg = await getConfig();
  if (!cfg.settings.maximizeConsultWindow) return;
  const key = 'maximized:' + tab.windowId;
  const { [key]: done } = await chrome.storage.session.get(key);
  if (done) return; // une seule fois par fenêtre : l'utilisateur garde la main ensuite
  try {
    const win = await chrome.windows.get(tab.windowId);
    if (win.type === 'popup' && win.state === 'normal') {
      await chrome.windows.update(tab.windowId, { state: 'maximized' });
    }
    await chrome.storage.session.set({ [key]: true });
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
        return { ok: true, data: await fn(msg.payload || {}) };
      }
      if (msg && msg.atm === 'popup') return { ok: true, data: await handlePopup(msg) };
      return { ok: false, error: 'message ignoré' };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  })().then(sendResponse);
  return true; // réponse asynchrone
});

async function handlePopup(msg) {
  switch (msg.type) {
    case 'status': {
      const [cfg, state] = await Promise.all([getConfig(), getState()]);
      return {
        extVersion: EXT_VERSION,
        extensionId: chrome.runtime.id,
        userScripts: userScriptsAvailable(),
        chromeVersion: Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 0),
        cfg,
        state,
      };
    }
    case 'check':
      return checkForUpdates('manual');
    case 'set-disabled':
      await patchConfig({ disabled: msg.disabled });
      return applyRegistrations();
    case 'set-settings':
      await patchConfig({ settings: msg.settings });
      return applyRegistrations();
    case 'set-base-url': {
      let url = String(msg.baseUrl || '').trim();
      if (url && !url.endsWith('/')) url += '/';
      await patchConfig({ baseUrl: url || DEFAULTS.baseUrl });
      return checkForUpdates('manual');
    }
    case 'reload-tabs': {
      const tabs = await chrome.tabs.query({
        url: ['https://connect.lgassocies.com/*', 'https://*.myunisoft.fr/*'],
      });
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
chrome.runtime.onInstalled.addListener(async () => {
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
