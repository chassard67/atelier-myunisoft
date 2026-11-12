const $ = (id) => document.getElementById(id);

function send(type, extra = {}) {
  return chrome.runtime.sendMessage({ atm: 'popup', type, ...extra }).then((r) => {
    if (!r || !r.ok) throw new Error((r && r.error) || 'Erreur');
    return r.data;
  });
}

function fmtDate(ts) {
  if (!ts) return 'jamais';
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function cmp(a, b) {
  const pa = String(a || '0').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '0').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

const LICENCE_TEXT = {
  active: ['info', 'Licence active'],
  'not-required': ['info', 'Licence non requise'],
  missing: ['danger', 'Aucune clé saisie : les fonctionnalités sont désactivées.'],
  unknown: ['danger', 'Clé non reconnue.'],
  blocked: ['danger', 'Licence suspendue : les fonctionnalités sont désactivées. Contactez votre administrateur.'],
  expired: ['danger', 'Licence non vérifiée depuis trop longtemps (connexion ?).'],
  unverified: ['warning', 'Licence pas encore vérifiée (serveur injoignable).'],
};

let forceLicenceBox = false;

function showReloadHint() {
  $('reload-hint').hidden = false;
}

function switchRow(label, checked, disabled, title, onChange) {
  const row = document.createElement('label');
  row.className = 'feature';
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = label;
  if (title) name.title = title;
  const sw = document.createElement('span');
  sw.className = 'switch';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.disabled = disabled;
  input.addEventListener('change', () => onChange(input.checked));
  sw.append(input, document.createElement('span'));
  row.append(name, sw);
  return row;
}

async function render() {
  const st = await send('status');
  const { cfg, state, settings } = st;
  const m = state.manifest;
  const lic = state.licence || {};

  $('versions').textContent =
    `extension ${st.extVersion}` + (m ? ` · modules ${m.release ? m.release.version + ' · ' : ''}${m.build}` : '');
  $('last-check').textContent = 'vérifié : ' + fmtDate(state.lastCheck);
  $('ext-id').textContent = 'ID : ' + st.extensionId;
  $('base-url').value = cfg.baseUrl;
  $('warn-source').hidden = cfg.baseUrl === st.defaultBaseUrl;
  $('warn-source-url').textContent = cfg.baseUrl;

  // Bouton « Autoriser les scripts utilisateur » / mode développeur.
  const steps = $('warn-steps');
  steps.replaceChildren();
  if (!st.userScripts) {
    const items =
      st.chromeVersion >= 138
        ? ["Cliquez sur le bouton ci-dessous (page de l'extension).", 'Activez « Autoriser les scripts utilisateur ».', 'Revenez ici et rechargez vos onglets MyUnisoft.']
        : ['Ouvrez chrome://extensions.', 'Activez le « Mode développeur » (en haut à droite).', 'Revenez ici et rechargez vos onglets MyUnisoft.'];
    for (const t of items) {
      const li = document.createElement('li');
      li.textContent = t;
      steps.appendChild(li);
    }
  }
  $('warn-userscripts').hidden = st.userScripts;

  // Licence.
  const [kind, text] = LICENCE_TEXT[lic.status] || LICENCE_TEXT.missing;
  const licOk = lic.status === 'active' || lic.status === 'not-required';
  $('licence-box').hidden = licOk && !forceLicenceBox;
  $('licence-status').className = 'alert small ' + kind;
  $('licence-status').textContent = text + (lic.client ? ' — ' + lic.client : '');
  if (!$('licence-key').value) $('licence-key').value = cfg.licenceKey || '';
  $('licence-mini').textContent = text + (lic.client ? ' — ' + lic.client : '');

  const warnExt = $('warn-ext');
  if (m && cmp(m.minExtensionVersion, st.extVersion) > 0) {
    warnExt.hidden = false;
    warnExt.textContent =
      `Les modules publiés demandent l'extension ${m.minExtensionVersion} ou plus (vous avez ${st.extVersion}). ` +
      `Téléchargez la nouvelle version (${new URL('atelier-myunisoft-extension.zip', cfg.baseUrl)}), ` +
      `extrayez-la par-dessus le dossier de l'extension puis cliquez sur ↻ dans chrome://extensions.`;
  } else {
    warnExt.hidden = true;
  }

  const err = $('error');
  err.hidden = !state.lastError;
  err.textContent = state.lastError ? 'Dernière vérification en échec : ' + state.lastError : '';

  // Catalogue publié : groupes de fonctionnalités (modules ou réglages).
  const box = $('catalog');
  if (m && m.catalog && m.catalog.length) {
    box.replaceChildren();
    const enabled = new Set(st.enabledModules);
    const scriptById = Object.fromEntries(m.scripts.map((s) => [s.id, s]));
    for (const g of m.catalog) {
      const det = document.createElement('details');
      det.className = 'group';
      det.open = !g.collapsed;
      const sum = document.createElement('summary');
      sum.textContent = g.group;
      det.appendChild(sum);
      for (const it of g.items || []) {
        if (it.type === 'module') {
          const s = scriptById[it.id];
          if (!s) continue;
          const title = (s.name || '') + ' — v' + s.version;
          det.appendChild(
            switchRow(it.label, enabled.has(it.id), !!s.required, title, async (v) => {
              await send('set-module', { id: it.id, value: v });
              showReloadHint();
            })
          );
        } else if (it.type === 'setting') {
          det.appendChild(
            switchRow(it.label, !!settings[it.id], false, it.help || '', async (v) => {
              await send('set-setting', { id: it.id, value: v });
              showReloadHint();
            })
          );
        }
      }
      box.appendChild(det);
    }
  }
  return st;
}

$('check').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = 'Vérification…';
  try {
    const r = await send('check');
    btn.textContent = r.ok ? (r.changed ? 'Mis à jour ✔' : 'Déjà à jour ✔') : 'Échec';
    if (r.ok && r.changed) showReloadHint();
  } catch (err) {
    btn.textContent = 'Échec';
  }
  await render();
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'Vérifier les mises à jour';
  }, 1500);
});

$('save-licence').addEventListener('click', async () => {
  $('save-licence').disabled = true;
  try {
    const r = await send('set-licence', { key: $('licence-key').value });
    forceLicenceBox = r.licence !== 'active' && r.licence !== 'not-required';
    await render();
    if (!forceLicenceBox) showReloadHint();
  } finally {
    $('save-licence').disabled = false;
  }
});

$('change-licence').addEventListener('click', (e) => {
  e.preventDefault();
  forceLicenceBox = true;
  render();
});

$('reload-tabs').addEventListener('click', async () => {
  const r = await send('reload-tabs');
  $('reload-hint').hidden = true;
  $('reload-tabs').textContent = `${r.count} onglet(s) rechargé(s)`;
});

$('open-ext-page').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
});

$('save-base-url').addEventListener('click', async () => {
  await send('set-base-url', { baseUrl: $('base-url').value });
  await render();
  showReloadHint();
});

$('use-dev').addEventListener('click', async () => {
  if (!confirm('Source de développement (localhost:8787) : ne fonctionne que si le serveur de développement tourne sur ce PC. Continuer ?')) return;
  $('base-url').value = 'http://localhost:8787/';
  await send('set-base-url', { baseUrl: 'http://localhost:8787/' });
  await render();
  showReloadHint();
});

async function useOfficial() {
  const st = await send('status');
  await send('set-base-url', { baseUrl: st.defaultBaseUrl });
  await render();
  showReloadHint();
}
$('use-official').addEventListener('click', useOfficial);
$('fix-source').addEventListener('click', useOfficial);

$('reset-defaults').addEventListener('click', async () => {
  await send('reset-defaults');
  await render();
  showReloadHint();
});

// À l'ouverture : si le bouton vient d'être activé, on (ré)enregistre les modules.
render().then((st) => {
  if (st.userScripts) send('reapply').catch(() => {});
});
