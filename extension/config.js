// Réglages par défaut de l'extension. Chaque utilisateur peut les surcharger
// depuis la fenêtre de l'extension (section « Avancé ») ; la surcharge est
// stockée dans chrome.storage.local sous la clé "cfg".

export const DEFAULTS = {
  // Adresse où sont publiés les modules (dossier "dist" du dépôt, publié par
  // GitHub Pages). DOIT se terminer par "/".
  // Adresse GitHub Pages par défaut ; à remplacer par le domaine perso
  // (ex. https://atelier.mondomaine.fr/) une fois le CNAME configuré.
  baseUrl: 'https://chassard67.github.io/atelier-myunisoft/',

  // Intervalle de vérification automatique des mises à jour (minutes).
  checkIntervalMin: 30,

  // Modules désactivés par l'utilisateur (ids). Vide = tout actif.
  disabled: [],

  // Réglages transmis aux modules (lisibles via ATM.settings dans la page).
  settings: {
    // Contenu centré à 60vw sur écran >= 1920px (comportement Electron).
    // false = contenu aligné à gauche (comportement Tampermonkey d'origine).
    centerLayout: true,
    // Fenêtre de consultation (…/child/consulting) agrandie automatiquement.
    maximizeConsultWindow: true,
  },
};
