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

function showReloadHint() {
  $('reload-hint').hidden = false;
}

async function render() {
  const st = await send('status');
  const { cfg, state } = st;
  const m = state.manifest;

  $('versions').textContent = `extension ${st.extVersion}` + (m ? ` · modules ${m.build}` : '');
  $('last-check').textContent = 'vérifié : ' + fmtDate(state.lastCheck);
  $('ext-id').textContent = 'ID : ' + st.extensionId;
  $('base-url').value = cfg.baseUrl;

  // Bouton « Autoriser les scripts utilisateur » / mode développeur.
  const steps = $('warn-steps');
  steps.replaceChildren();
  if (!st.userScripts) {
    const items =
      st.chromeVersion >= 138
        ? [
            'Cliquez sur le bouton ci-dessous (page de l\'extension).',
            'Activez « Autoriser les scripts utilisateur ».',
            'Revenez ici et rechargez vos onglets MyUnisoft.',
          ]
        : [
            'Ouvrez chrome://extensions.',
            'Activez le « Mode développeur » (en haut à droite).',
            'Revenez ici et rechargez vos onglets MyUnisoft.',
          ];
    for (const t of items) {
      const li = document.createElement('li');
      li.textContent = t;
      steps.appendChild(li);
    }
  }
  $('warn-userscripts').hidden = st.userScripts;

  const warnExt = $('warn-ext');
  if (m && cmp(m.minExtensionVersion, st.extVersion) > 0) {
    warnExt.hidden = false;
    warnExt.textContent =
      `Les modules publiés demandent l'extension ${m.minExtensionVersion} ou plus (vous avez ${st.extVersion}). ` +
      `Téléchargez la nouvelle version (${new URL('atelier-myunisoft-extension.zip', cfg.baseUrl)}), ` +
      `remplacez le dossier de l'extension puis cliquez sur ↻ dans chrome://extensions.`;
  } else {
    warnExt.hidden = true;
  }

  const err = $('error');
  err.hidden = !state.lastError;
  err.textContent = state.lastError ? 'Dernière vérification en échec : ' + state.lastError : '';

  // Liste des modules avec interrupteur.
  const ul = $('modules');
  if (m && m.scripts.length) {
    ul.replaceChildren();
    for (const s of m.scripts) {
      const li = document.createElement('li');
      li.className = 'module';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = s.name;
      name.title = s.description || '';
      const ver = document.createElement('span');
      ver.className = 'ver';
      ver.textContent = 'v' + s.version;
      const sw = document.createElement('label');
      sw.className = 'switch';
      sw.title = 'Activer / désactiver ce module';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = s.required || !cfg.disabled.includes(s.id);
      if (s.required) {
        input.disabled = true;
        sw.title = 'Module indispensable (utilisé par les autres)';
      }
      input.addEventListener('change', async () => {
        const fresh = (await send('status')).cfg.disabled.filter((x) => x !== s.id);
        if (!input.checked) fresh.push(s.id);
        await send('set-disabled', { disabled: fresh });
        showReloadHint();
      });
      sw.append(input, document.createElement('span'));
      li.append(name, ver, sw);
      ul.appendChild(li);
    }
  }

  document.querySelectorAll('[data-setting]').forEach((cb) => {
    cb.checked = !!cfg.settings[cb.dataset.setting];
  });

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

$('reload-tabs').addEventListener('click', async () => {
  const r = await send('reload-tabs');
  $('reload-hint').hidden = true;
  $('reload-tabs').textContent = `${r.count} onglet(s) rechargé(s)`;
});

$('open-ext-page').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
});

document.querySelectorAll('[data-setting]').forEach((cb) => {
  cb.addEventListener('change', async () => {
    await send('set-settings', { settings: { [cb.dataset.setting]: cb.checked } });
    showReloadHint();
  });
});

$('save-base-url').addEventListener('click', async () => {
  await send('set-base-url', { baseUrl: $('base-url').value });
  await render();
  showReloadHint();
});

$('use-dev').addEventListener('click', async () => {
  $('base-url').value = 'http://localhost:8787/';
  await send('set-base-url', { baseUrl: 'http://localhost:8787/' });
  await render();
  showReloadHint();
});

// À l'ouverture : si le bouton vient d'être activé, on (ré)enregistre les modules.
render().then((st) => {
  if (st.userScripts) send('reapply').catch(() => {});
});
