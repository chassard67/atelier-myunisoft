// Réglages par défaut de l'extension. Les choix de l'utilisateur (fenêtre de
// l'extension) sont stockés dans chrome.storage.local sous la clé "cfg" et
// ne contiennent que ce qu'il a modifié (le reste suit les valeurs par défaut
// publiées, qui peuvent donc évoluer sans réinstaller l'extension).

export const DEFAULTS = {
  // Serveur de licences (Cloudflare Worker) : il ne livre le code des modules
  // qu'aux clés valides. Adresse propre possible plus tard (ex.
  // https://atelier.mondomaine.fr/) sans rien casser.
  baseUrl: 'https://atelier-myunisoft.chassard.workers.dev/',

  // Intervalle de vérification automatique (mises à jour + licence), minutes.
  checkIntervalMin: 30,

  // Clé de licence saisie par l'utilisateur.
  licenceKey: '',

  // Choix de l'utilisateur, par id : { "balance": false, ... } — vide = défauts.
  modules: {},
  settings: {},
};

// Valeurs de repli des réglages si la publication ne les définit pas (le
// catalogue publié dans manifest.json fait foi).
export const FALLBACK_SETTINGS = {
  centerLayout: true,
  gridLines: true,
  monoFont: true,
  showStatus: false,
  glPremium: true,
  maximizeConsultWindow: true,
};

// Une licence validée reste utilisable hors ligne pendant ce délai (serveur
// de publication injoignable) ; au-delà, les modules sont désactivés.
export const LICENCE_GRACE_DAYS = 14;

// Notes affichées aux utilisateurs quand la COQUILLE elle-même est mise à jour.
export const EXTENSION_NOTES = {
  '1.2.0': ['Les modules Premium sont maintenant servis par un serveur de licences : le code n\'est livré qu\'aux clés valides.'],
  '1.1.2': ['Boutons « Vérifier les mises à jour » et « Recharger les onglets » placés en haut de la fenêtre de l\'extension.', 'Plus d\'alerte « source non officielle » à tort.'],
  '1.1.1': ['Correctif : la clé de licence est prise en compte dès sa validation.'],
  '1.1.0': [
    'Fonctionnalités activables une à une depuis l\'icône de l\'extension.',
    'Licence d\'utilisation (clé à saisir dans l\'extension).',
    'Fenêtre d\'information à chaque mise à jour.',
  ],
};
