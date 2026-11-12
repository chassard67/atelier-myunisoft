// ==UserScript==
// @name         MyUnisoft - Saisie Premium (vue fusionnée)
// @namespace    https://nicolas.chassard/myunisoft
// @version      2.60-ext
// v2.60 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — aucun changement fonctionnel, le module tourne désormais dans l'extension (même contexte de page que le preload).
// v2.59 (2026-08-05, retours répétés de Nicolas : "RIEN NE S'affiche" / "ca
// marche toujours pas.") : VRAIE cause racine du bug Début/Fin trouvée après
// une longue investigation en direct (Console DevTools, appels rejoués à la
// main avec un jeton confirmé frais via window.__tmbcDebug.decodeToken()) :
// fetchDossierRevisionList() attendait un TABLEAU NU en réponse de
// GET /dadp/dossier_revision_list?balance=true, et testait
// Array.isArray(data) sur toute la réponse — or la vraie réponse est un OBJET
// {"dossier_revision_list": [...]} (confirmé en direct : réponse HTTP 200
// bien reçue, avec un vrai tableau de ~17 dossiers BIL dedans, mais
// Array.isArray() sur l'objet entier renvoyait false -> [] systématiquement,
// SANS AUCUNE ERREUR). Le paramEntry (CCA/PCA) et le wt étaient donc
// toujours trouvés correctement, mais "dossier" ne l'était jamais (recherche
// dans un tableau vide), donc worksheet/bills n'était jamais appelé et le
// résultat était mis en cache à null (pas de correspondance) — d'où des
// colonnes vides en PERMANENCE, y compris quand tout le reste (flag détecté,
// token valide, worksheet/param OK) fonctionnait. Fix : lecture de
// data.dossier_revision_list au lieu de data directement. Chemin de
// diagnostic qui a permis de le confirmer : navigation manuelle vers Révision
// > Cut-off > CCA (pour forcer un jeton frais via l'action réelle du
// sélecteur "Exercice(s)", cf. convention déjà connue du projet à ce sujet),
// puis rejeu direct en console de fetch('.../dossier_revision_list...') avec
// window.TMBC.getApiHeaders() — la réponse brute affichait bien
// '{"dossier_revision_list":[...]}'. Nettoyage au passage : suppression du
// hook de debug temporaire window.__tmbcCutoffDebug et des console.debug
// ajoutés en v2.57/v2.58 pour cette investigation (plus nécessaires). NOTE
// SÉPARÉE (déjà corrigée en v2.58, toujours valable) : le jeton sniffé
// (window.TMBC.getApiHeaders(), alimenté par installApiHeaderSniffer() dans
// premium.js v4.4) a une durée de vie courte (5 min) et peut être expiré si
// aucun appel authentifié n'a été fait récemment — les 3 fetchers de ce
// fichier retentent automatiquement au prochain rendu en cas d'échec HTTP
// (cf. v2.58), donc ce n'est plus bloquant, seulement une question de délai.
// v2.58 (2026-08-05, correctif suite retour de Nicolas : "J'ai regardé dans
// saisie premium, journal AC, 06/2026. il devrait y avoir un flag et une
// période pour le compte 615000 (ecriture du 30/06/2026), mais rien ne
// s'affiche.") — bug des colonnes Début/Fin (v2.57) qui restaient vides en
// permanence pour une ligne pourtant bien flaguée CCA. Diagnostic en direct
// (console DevTools, appel fetch('/worksheet/param', ...) rejoué à la main
// avec les vrais headers de window.TMBC.getApiHeaders()) : la réponse était
// un 400 avec le corps {"code":"TOKENERROR","message":"Token expir..."} — le
// tout premier appel réseau avait échoué (token expiré à ce moment précis),
// mais fetchWorksheetParams()/fetchDossierRevisionList() mémorisaient leur
// promise (worksheetParamsPromise/dossierRevisionListPromise) sans jamais la
// réinitialiser en cas d'échec : un seul échec au premier appel restait donc
// mémorisé pour TOUTE la session, bloquant définitivement toute résolution
// ultérieure (cutoffPeriodCache ne se remplissait jamais, mais surtout les
// deux fetchers renvoyaient pour toujours le même résultat vide/échoué déjà
// mémorisé). Correctif : les 3 fetchers (fetchWorksheetParams,
// fetchDossierRevisionList, fetchWorksheetBills) rejettent désormais
// explicitement sur réponse HTTP non-ok (au lieu de retomber silencieusement
// sur [] / {bills:[]}), et RÉINITIALISENT leur cache (promise ou entrée de
// Map) dans le .catch() correspondant — un nouvel essai réseau est donc
// retenté au prochain appel plutôt que de rester bloqué sur l'échec initial.
// resolveCutoffPeriod() distingue maintenant clairement les deux cas : en
// cas d'échec (catch), cutoffPeriodCache n'est PAS mis à jour, pour laisser
// le prochain passage de renderTable() (appelé très régulièrement — polling
// /entries en arrière-plan) retenter la résolution ; seul un résultat
// réellement déterminé (bail trouvée ou vérifiée absente) est mémorisé de
// façon définitive. Suppression au passage des console.debug/console.error
// temporaires ajoutés pendant cette investigation (ENTER/SKIP/params=/DEBUG
// cutoff line/ERROR), qui avaient permis de confirmer que line.flags
// contenait bien ["CCA"] et que resolveCutoffPeriod() était bien appelée —
// le blocage se situait donc uniquement dans la mémorisation permanente de
// l'échec réseau initial, pas dans la détection du flag.
// v2.57 (2026-08-05, retour direct : "allez on essaie" — suite d'une
// investigation en direct sur 3 messages : "regarde dans révision > Cut-off
// > CCA le tableau s'affiche avec les infos du compte flagué, regarde
// l'appel. je me suis mis dessus") — ajout de deux colonnes "Début"/"Fin",
// EN LECTURE SEULE, affichant la période de cut-off (CCA/PCA) d'une ligne
// d'écriture flaguée. Trois appels GET confirmés en direct (Network,
// jamais deviné) :
//   1) GET https://prod-ws.myunisoft.fr/worksheet/param (sans paramètre)
//      -> liste de {id_param_account_worksheet, account_ttc:{number,...},
//         worksheet_type:[{id_worksheet_type, code:"CCA"|"PCA"|..., label}]}
//      = fait le lien entre un code de flag (ligne.flags, ex. "CCA") et
//      les 2 ids nécessaires à l'appel bills ci-dessous.
//   2) GET https://prod-ws.myunisoft.fr/dadp/dossier_revision_list?balance=true
//      -> liste des dossiers de révision {id_dossier_revision, start_date,
//         end_date, type:{code:"BIL"|...}} = pour retrouver l'id du dossier
//      dont la période couvre la date de l'écriture (entry.date_piece).
//   3) GET https://prod-ws.myunisoft.fr/worksheet/bills?id_society=<...>&
//      id_param_account_worksheet=<...>&id_worksheet_type=<...>&
//      id_dossier_revision=<...>&limit=1000000&offset=0
//      -> {"bills":[{date, total_incl_taxes, start_period, end_period,
//         worksheet_account:{number,label}, ...}]} = LA réponse contenant
//      enfin start_period/end_period. Aucun line_entry_id direct dans cette
//      liste : rapprochement fait par n° de compte + date + montant (cf.
//      resolveCutoffPeriod()) — imparfait en théorie (double ambiguïté
//      possible si 2 lignes identiques le même jour) mais suffisant en
//      pratique. Les 2 premiers appels sont mis en cache (une fois par
//      session), le 3e est mis en cache par (dossier_revision, type) — donc
//      un seul appel réseau par exercice/type de flag rencontré, pas un par
//      ligne. Résolution async, non bloquante (même schéma que
//      prefetchCommentCounts()) : les cellules Début/Fin démarrent vides et
//      se remplissent dès que la réponse arrive, sans re-render complet du
//      tableau (mise à jour DOM directe via data-tmbc-cutoff-start/-end).
//      Uniquement en lecture pour l'instant (pas de saisie/modification de
//      la période depuis Saisie Premium, comme demandé).
// v2.56 (2026-08-04, retour direct avec capture d'écran annotée : "CA MET
// LA FACTURE uniquement à droite de la fenetre myu, il faudrait qu'elle
// recouvre aussi la partie non utilisé, EN BLANC") — suite du v2.55 : le
// panneau se positionnait via #tmbc-sp-scroll.getBoundingClientRect(),
// mais ce conteneur de scroll (overflow-x:auto) est plus LARGE que le
// tableau qu'il contient réellement (il occupe toute la largeur dispo
// même quand les colonnes visibles sont plus étroites) — d'où un grand
// espace non couvert entre la fin réelle des colonnes et le panneau.
// Repositionné sur #tmbc-sp-table (le <table> lui-même, qui épouse
// exactement la largeur de ses colonnes) au lieu du conteneur de scroll.
// v2.55 (2026-08-04, retour direct avec capture d'écran annotée : "affiche
// la piece jointe sur tout l'espace dispo comme capture ecran joint") —
// suite du v2.54 : le panneau restait cantonné à une largeur/hauteur fixes
// (640px / 85vh) collées en haut, alors que la capture montre qu'il doit
// couvrir TOUT l'espace vide à droite du tableau, du bord droit du
// tableau jusqu'au bord de la fenêtre, et du haut du tableau jusqu'en bas
// de la fenêtre. Position/dimensions recalculées depuis
// #tmbc-sp-scroll.getBoundingClientRect() + window.innerWidth/innerHeight
// (calc() plutôt que des px fixes) pour occuper tout l'espace disponible,
// quelle que soit la taille de la fenêtre.
// v2.54 (2026-08-04, retour direct : "je veux un apercu en taille reelle,
// comme dans la consultation") : l'aperçu au survol (v2.53) restait flou/
// petit car il affichait d.thumbnail tel quel — cette image vient de
// pj_list[].thumbnail dont l'URL est .../preview?x=90&y=120... (miniature
// basse résolution utilisée pour l'icône Pj de la ligne). Repéré en direct
// (sniffing réseau, cf. investigation FOGLIA v2.52) que le MEME endpoint
// GED accepte une taille demandée bien plus grande (l'aperçu natif "grande
// vue" appelait .../preview?...&y=1187... au lieu de y=120) — donc pas de
// nouvel endpoint à deviner, juste réécrire x/y sur la même URL. Nouvelle
// fonction pjBigPreviewUrl(d) : parse d.thumbnail, remplace y par une
// valeur large (1400) et retire x (pour ne pas contraindre la largeur et
// laisser le ratio d'origine), avec repli sur d.thumbnail tel quel si le
// parsing échoue.
// v2.53 (2026-08-04, retours directs, dont capture d'écran annotée) : trois ajouts —
// 1) Colonnes "Jour" (44 -> 62px) et "N° écriture" (80 -> 110px) élargies
//    pour que le libellé et la flèche de tri tiennent sur une seule ligne
//    dans l'en-tête (repli en 2 lignes qui masquait la flèche auparavant).
// 2) "N° écriture" : suppression défensive de tout espace/séparateur
//    (.replace(/[^\d-]/g, ''), white-space:nowrap, letter-spacing:normal)
//    sur les deux cellules concernées (ligne historique + ligne d'édition).
// 3) Aperçu au survol de la Pj. (v2.32) repensé : panneau FIXE et large
//    (420px) ancré dans l'espace vide à droite du tableau (repéré via
//    #tmbc-sp-scroll.getBoundingClientRect()), au lieu d'une petite bulle
//    (220px) collée au curseur — ne suit plus la souris (mousemove retiré).
// @version      2.52-electron-poc
// v2.52 (2026-08-04, retour direct : "j'ai par ex la facture FOGLIA du
// 24/07 qui a un commentaire et une piece jointe, mais je ne vois pas la
// piece jointe ajouté sur cette vue (je la voie dans consultation !)" —
// "VERIFIE POURQUOI, prend le main si besoin") — root cause trouvée en
// prenant la main (DevTools Network) : la réponse de /entries (déjà chargée)
// contient un champ "pj_list" par écriture jamais lu par ce script — les
// PJ existantes (ajoutées via l'appli standard ou une session précédente)
// étaient donc invisibles, faute de synchronisation avec cette donnée
// pourtant déjà disponible. pjCounts/pjDocs synchronisés désormais à chaque
// renderTable() avec entry.pj_list. Au passage : confirmation que le clic PJ
// natif charge l'aperçu via une simple requête GET cross-origin (pas de l'IPC
// comme suspecté), mais servie en no-cors (balise <img>, cookies envoyés
// nativement) — cohérent avec le fix CORS wildcard de la v2.44 pour notre
// propre fetch().
// @version      2.51-electron-poc
// v2.51 (2026-08-04, demande explicite) : deux ajouts —
// 1) Colonne "N° écriture" déplacée en TOUTE FIN de tableau (après
//    "Annuler la modification"), affichée en gris (nouveau flag `dim: true`
//    dans COLUMNS, lu par cells.forEach()/cellsDefs) pour signaler que ce
//    n'est pas un champ modifiable. Indices i===8/i===9 (Comm./Pj.) remis à
//    leur valeur d'origine suite au retrait de la colonne de sa précédente
//    position (juste après la case à cocher).
// 2) Le <select> "Trier par" (v2.50) est retiré : en-têtes "Jour" et "N°
//    écriture" cliquables, avec une flèche ▲/▼ affichant le sens de tri
//    actif, mise à jour à chaque renderTable(). Un clic sur "Jour" trie par
//    date (toggle ↑/↓), un clic sur "N° écriture" trie par entry_id (toggle
//    ↑/↓) — même variable sortMode qu'avant, juste un nouveau déclencheur.
// @version      2.50-electron-poc
// v2.50 (2026-08-04, demande explicite) : deux ajouts —
// 1) "est ce que chaque ecriture est lié à une id spécifique. si oui
//    possible de l'afficher ?" — OUI (entry_id, déjà utilisé partout en
//    interne) : nouvelle colonne "N° écriture" juste après la case à cocher
//    (COLUMNS/cells/cellsDefs mis à jour en conséquence, tous les index i
//    décalés de +1 pour Comm./Pj.). Affiché aussi sur la ligne d'édition
//    (entry_id de l'écriture éditée), vide sur une nouvelle écriture pas
//    encore enregistrée (aucun entry_id n'existe avant createEntry()).
// 2) "rajoute une option pour trier par date (plus ancien à plus récent,
//    plus récent à plus ancien), tri par id specique" — <select> "Trier
//    par" dans la barre de contrôles (date ↑/↓, N° écriture ↑/↓), pilote
//    sortMode utilisé dans le tri de `entries` en tête de renderTable().
// @version      2.49-electron-poc
// v2.49 (2026-08-04, demande explicite) — écritures triées par date_piece
// croissante (la plus ancienne en haut, la plus récente juste avant la
// ligne de saisie/édition en bas), départagées par entry_id croissant pour
// les écritures du même jour. Tri fait sur une COPIE du tableau (jamais
// lastEntriesResponse.entry_array directement, réutilisé ailleurs).
// @version      2.48-electron-poc
// v2.48 (2026-08-04, retour direct avec capture d'écran annotée) : deux ajouts —
// 1) Espacement augmenté entre la barre d'onglets native et le panneau
//    Saisie Premium (padding-top 12 -> 24px), trop serré signalé.
// 2) Cocher une écriture met désormais TOUTES ses lignes en surbrillance
//    (pas seulement la 1ère) — mise à jour DOM directe sur clic simple (pas
//    de renderTable() complet, cohérent avec le choix déjà fait pour ne pas
//    perdre de perf/focus), et appliqué aussi à l'état initial/après un
//    Shift+clic (renderTable() complet).
// @version      2.47-electron-poc
// v2.47 (2026-08-04, demande explicite) : deux ajouts —
// 1) Suppression de la popup de confirmation pour passer en édition (double-
//    clic ou clic droit > Modifier) : "on sait que ca modifie" — c'est
//    désormais immédiat.
// 2) Timeout de sécurité de 60s : si une écriture en cours de modification
//    n'est pas validée (Tab/Entrée sur le dernier champ) dans la minute,
//    l'édition est annulée automatiquement (cancelEditEntry()), pour éviter
//    qu'une suppression+recréation ne parte sur des données potentiellement
//    désynchronisées (fenêtre laissée ouverte, changement d'onglet, etc.).
//    Désactivé dès qu'une validation démarre réellement (clearEditTimeout()
//    dans submitDraft()).
// @version      2.46-electron-poc
// v2.46 (2026-08-04, retour direct : "le fichier disparait (l'icone
// tromboner indique bien 1 piece jointe, mais elle n'est plus la)") — cause
// RÉELLE trouvée (rien à voir avec v2.44/v2.45, pas d'erreur console) :
// pjCounts (compteur affiché sur le badge 📎) était bien incrémenté après
// upload réussi, mais pjDocs (la VRAIE liste lue par openPjPopup()/
// showPjHoverPreview() pour afficher le détail et l'aperçu) n'était JAMAIS
// alimenté, ni pour les PJ ajoutées directement en cours de saisie
// (extras.files) ni pour celles reprises lors d'une modification
// (carryOver.attachments) — bug présent depuis la v2.27 pour le premier cas,
// jamais remarqué avant. Les deux boucles alimentent maintenant pjDocs avec
// la même structure que pickFileAndUpload() (name/previewLink/downloadLink/
// thumbnail extraits de la réponse d'upload).
// @version      2.45-electron-poc
// v2.45 (2026-08-04, retour direct : "il m'affiche toujours une piece
// jointe, mais pas de detail, pas de visualition et en fait pas de pdf dans
// le détail de la PH") — le fix CORS v2.44 (credentials: 'omit') a bien
// arrêté l'erreur réseau, MAIS le token seul dans l'URL de téléchargement ne
// suffit visiblement pas toujours à authentifier la requête sans cookie : le
// serveur peut répondre 200 OK avec une page HTML (erreur/connexion) au lieu
// du vrai fichier. res.ok restait vrai, donc l'ancienne version uploadait ce
// contenu invalide tel quel comme "pièce jointe" (badge affiché sans rien de
// réel derrière). Ajout d'une vérification du content-type/de la taille
// avant tout envoi, avec bascule sur le repli <img>/canvas pour les images
// dans TOUS les cas d'échec (réseau OU contenu invalide) — refactorisé en
// fonction fetchAttachmentBlob() dédiée pour plus de clarté.
// @version      2.44-electron-poc
// v2.44 (2026-08-04, retour direct avec logs console complets) — deux corrections :
// 1) Cause RÉELLE de l'échec de reprise des PJ enfin identifiée (v2.42/v2.43
//    avaient diagnostiqué à tort la CSP) : erreur CORS explicite "the value
//    of the Access-Control-Allow-Origin header ... must not be the wildcard
//    '*' when the request's credentials mode is 'include'" — le serveur
//    répond bien avec les en-têtes CORS, mais en wildcard, incompatible avec
//    l'envoi de cookies. Le lien de téléchargement contient déjà son propre
//    token dans l'URL (pas besoin de cookie de session) : fetch() n'envoie
//    plus les credentials, ce qui devrait désormais fonctionner pour TOUS
//    les formats de PJ (pas seulement les images comme le contournement
//    <img> de la v2.43, conservé en repli).
// 2) draftExtras (commentaire/PJ en attente sur la ligne de saisie du bas)
//    n'était jamais réinitialisé en entrant en édition — un fichier resté en
//    attente d'une saisie précédente pouvait s'attacher par erreur à
//    l'écriture éditée, expliquant le badge "1 pièce jointe" fantôme
//    signalé. Remis à zéro systématiquement dans startEditEntry().
// v2.43 (2026-08-04, retour direct confirmant l'hypothèse v2.42 : "échec
// réseau (CSP ?) en récupérant le fichier depuis https://app.myunisoft.fr")
// — CSP connect-src confirmée bloquer app.myunisoft.fr (contrairement à
// prod-ws.myunisoft.fr). Ajout d'un repli fetchImageBlobViaImgTag() (balise
// <img> + canvas, gouvernée par img-src, généralement moins restrictive)
// pour les PJ de type image uniquement (détecté via l'extension du nom de
// fichier) — les autres formats (PDF, etc.) ne peuvent pas passer par ce
// chemin et continuent d'échouer avec le message clair déjà en place.
// v2.42 (2026-08-04, retour direct : "échec sur : pièce jointe ... reprise :
// Failed to fetch") — une TypeError "Failed to fetch" (contrairement à un
// simple mauvais code HTTP) veut dire que la requête n'a pas abouti au
// niveau réseau : suspecté (pas encore confirmé) un blocage par la CSP
// stricte de l'appli sur le domaine du lien de téléchargement, différent de
// prod-ws.myunisoft.fr (seul domaine confirmé autorisé pour nos appels
// fetch). Ajout d'un log console (URL + domaine exact + erreur brute) pour
// confirmer l'hypothèse au prochain test, et d'un message d'erreur affiché
// plus précis. L'écriture elle-même reste enregistrée normalement, seule la
// PJ reprise échoue (comportement déjà non bloquant).
// v2.41 (2026-08-04, demande explicite) : quatre ajouts —
// 0) Reprise automatique des commentaires (texte complet, via GET /comments
//    CONFIRMÉ) et des pièces jointes CONNUES localement (session en cours,
//    aucune route serveur pour lister les PJ existantes) lors d'une
//    modification d'écriture : récupérés AVANT la suppression de l'ancienne
//    écriture (cf. startEditEntry()/editCarryOver), puis rejoués sur le
//    nouvel entry_id juste après la recréation (cf. submitDraft()). Limite
//    annoncée explicitement dans le message de confirmation : les PJ
//    ajoutées via l'appli standard ou une session précédente ne peuvent pas
//    être détectées, donc pas reprises.
// 1) Double-clic sur une écriture historique = raccourci direct vers
//    "Modifier" (même mécanisme que le clic droit, cf. startEditEntry()).
// 2) Bouton "Annuler la modification" ajouté aussi APRÈS la colonne
//    Échéance (nouvelle colonne vide sur les lignes historiques, visible
//    uniquement sur la 1ère ligne du brouillon en édition) — en plus de
//    celui déjà présent dans la barre de contrôles en haut.
// 3) Séparateur épais (3px solid #333, identique à celui entre deux lots
//    d'écritures historiques) entre la dernière écriture et la ligne de
//    saisie/édition, à la place du fin liseré bleu précédent (retour direct
//    avec capture d'écran annotée).
// v2.40 (2026-08-04) — root cause DÉFINITIVE du blocage sur le champ
// Intitulé en édition, confirmée via les logs [DEBUG] v2.39 : "window blur"
// suivi 1 à 4s plus tard de "window focus", le focusin réussi tombant
// EXACTEMENT à la ms où "window focus" revient. window.confirm() (utilisé
// dans startEditEntry() pour l'avertissement suppression+recréation, et dans
// confirmAndDeleteEntry() pour la suppression) est un dialogue NATIF
// bloquant ; sous Electron sa fermeture fait perdre le focus OS à la
// fenêtre pendant 1 à 4s, et tant que la fenêtre n'a pas regagné ce focus,
// cliquer dans un champ ne fait que refocaliser la fenêtre sans jamais
// atteindre le champ visé. Remplacé dans les deux cas par une popup 100%
// custom (openConfirmPopup(), même famille que les popups commentaires/PJ/
// menu contextuel déjà existants), qui n'affecte jamais le focus fenêtre.
// Tous les logs de diagnostic temporaires (v2.36/v2.38/v2.39) retirés, cause
// confirmée.
// v2.39 (2026-08-04, retour direct : logs v2.38 montrent le compteur
// renderTable() figé pendant les clics ratés sur INPUT[0-label] — donc CE
// N'EST PLUS un rebuild DOM qui casse le focus, contrairement à v2.35/v2.37.
// Diagnostic étendu : document.hasFocus()/activeElement/elementFromPoint à
// chaque pointerdown (pour vérifier si un overlay invisible intercepte le
// clic malgré un e.target correct) + traçage des événements blur/focus de la
// FENÊTRE Electron elle-même (le focus OS peut se perdre indépendamment du
// DOM). À RETIRER une fois la cause confirmée.
// v2.38 (2026-08-04, retour direct : "c un peu plus rapide, mais j'ai encore
// dû attendre") — le fix v2.37 a réduit mais pas éliminé le blocage :
// remise en place de logs de diagnostic temporaires (pointerdown/focusin +
// compteur global de renderTable() + un log avec stack trace si renderTable()
// est encore appelé pendant editingEntryId !== null) pour repérer le ou les
// points d'entrée restants non couverts par v2.37. À RETIRER une fois la
// cause confirmée.
// v2.37 (2026-08-04) — root cause RÉELLE du blocage de plusieurs secondes
// (jusqu'à ~10s) en édition, confirmée via les logs [DEBUG] de la v2.36
// (retirés dans cette version, cause trouvée) : de nombreux
// "pointerdown sur INPUT[0-label]" n'aboutissaient JAMAIS à un focusin. Le
// coupable est installEntriesSniffer() : l'appli native repolle /entries en
// arrière-plan en continu (indépendamment de toute action de Nicolas), et
// CHAQUE réponse déclenchait un renderTable() COMPLET — y compris pendant
// une édition en cours (editingEntryId !== null) — détruisant et recréant
// tous les <input> du tableau, dont celui visé par le clic, souvent entre le
// clic et la prise de focus. Fix : pendant toute l'édition, on continue de
// mettre à jour lastEntriesResponse (rien n'est perdu quand l'édition se
// termine) mais on NE reconstruit PLUS le tableau tant qu'une écriture est
// en cours de modification. Le fix v2.35 (blur N° Compte) reste valide mais
// n'était qu'un facteur mineur du problème.
// v2.35 (2026-08-04, retour direct : "ca se met bien en mode edition, mais
// seulement au bout de 2/3 secondes sans bouger") — root cause : le blur du
// champ N° Compte (en mode édition d'une écriture, buildDraftRows()) appelait
// renderTable() COMPLET dès qu'un intitulé était auto-rempli depuis le compte,
// reconstruisant tout le tableau (tous les <input>, tout le <datalist> natif)
// pile au moment où le focus se déplaçait vers Intitulé. Fix : mise à jour de
// l'input Intitulé directement en place (comme déjà fait pour le champ Jour),
// plus jamais de renderTable() complet sur ce blur.
// v2.34 (2026-08-04, retour direct : "ca buge sur les modif, je ne peux pas
// changer facilement un libelle ou un montant") — root cause : PAS le
// blocage du champ Jour (celui-ci est déjà pré-rempli par startEditEntry(),
// donc jamais bloquant en édition), mais attemptAutoSubmit() (déclenché au
// blur des champs Débit/Crédit) — en mode édition l'écriture chargée est
// DÉJÀ équilibrée avec tous les comptes déjà remplis, donc le moindre blur
// (même juste pour passer au champ suivant) soumettait immédiatement
// (suppression + recréation) AVANT que Nicolas ait pu toucher au libellé ou
// à un autre champ. Auto-soumission désormais désactivée pendant toute
// l'édition (cf. editingEntryId) ; validation uniquement via Tab/Entrée sur
// le dernier champ, comme pour la saisie normale d'une nouvelle écriture.
// v2.33 (2026-08-04, demande explicite : "regarde avec les api si
// possibilité de modifier en direct une ecriture. à l'endroit ou elle
// s'affiche. elle sera validé uniquement lorsqu'on arrive à la fin de
// l'écriture ... mais j'aimerai pouvoir la modifier en direct, sans qu'elle
// passe en bas de la page") :
// - Recherche API : la doc Partenaires officielle (json.md, import JSON
//   d'écritures) confirme explicitement qu'il n'existe QUE deux routes de
//   création (POST /entry?type=e et /entry/temp), aucune route de
//   modification/mise à jour d'une écriture existante n'est documentée nulle
//   part (ni côté Partenaires, ni sniffée côté prod-ws) — le mécanisme
//   "supprimer puis recréer" introduit en v2.32 reste donc la seule voie
//   possible, CONFIRMÉ par la doc et pas seulement supposé ;
// - UX : "Modifier" n'envoie plus le brouillon en bas de page — les lignes
//   éditables s'affichent maintenant EN PLACE, à la position exacte de
//   l'écriture dans le tableau (buildDraftRows(), appelée soit en bas pour
//   une nouvelle écriture, soit depuis entries.forEach à la position de
//   l'écriture en cours d'édition). Navigation clavier (Tab/Entrée/Echap),
//   validation en fin de saisie (dernier champ, si équilibré) et tous les
//   autres mécanismes de la ligne de brouillon sont réutilisés à l'identique
//   — aucune duplication de logique, juste un autre point d'insertion dans
//   le tableau.
// v2.32 (2026-08-04, 4 demandes explicites) :
// (1) "possible de voir la piece jointe juste en survolant l'icone PJ de
//     l'écriture ?" — aperçu léger en tooltip au survol (showPjHoverPreview/
//     hidePjHoverPreview), miniature (thumbnail) si connue. Même limite que
//     le popup complet : uniquement les PJ ajoutées via cet outil pendant
//     la session en cours (pjDocs) ;
// (2) "je clic sur une premiere case à cocher, je fais shift et clic sur la
//     derniere et ca prendre les ecritures entre les 2" — Shift+clic sur
//     une case sélectionne toute la plage entre le dernier clic simple et
//     celui-ci (visibleEntryIdsOrder + lastClickedEntryIndex, écoute
//     'click' plutôt que 'change' pour accéder à shiftKey) ;
// (3) "si ecriture sélectionné, si j'appuie sur la touche suppr du clavier,
//     ca propose la suppression" — écouteur global sur la touche Delete
//     (ignoré si le focus est dans un champ de saisie), déclenche le même
//     chemin que le clic droit > Supprimer (donc groupé si plusieurs cases
//     cochées, cf. v2.31) ;
// (4) "j'aimerai aussi pouvoir rentrer sur une ectriture déjà saisi et la
//     modifier en direct" — AUCUNE route de modification directe trouvée
//     (ni sniffée, ni dans la doc Partenaires) : "Modifier" (menu contextuel,
//     jusqu'ici toujours désactivé) charge l'écriture dans le brouillon et,
//     à la validation, SUPPRIME l'ancienne puis RECRÉE une nouvelle écriture
//     avec les valeurs éditées (cf. startEditEntry()/submitDraft()) — PAS
//     une vraie mise à jour serveur. Un avertissement explicite est affiché
//     AVANT de démarrer l'édition : la nouvelle écriture aura un nouvel
//     entry_id, donc les commentaires/pièces jointes déjà liés à l'ancienne
//     ne suivent pas. Bouton "Annuler la modification" affiché pendant toute
//     l'édition pour revenir à un brouillon vide sans rien supprimer.
// v2.31 (2026-08-04, demande explicite : "si je selectionne plusieurs
// écritures (avec la case à cocher) et que je fais supprimer, il faut
// supprimer les ecritures cochés, pas seulement une") — clic droit >
// Supprimer supprimait toujours UNIQUEMENT l'écriture sous le curseur,
// même si d'autres étaient cochées. Ajout de deleteEntries() (même corps
// API déjà confirmé pour deleteEntry() — {"entry":[{"entry_id":<int>}]} —
// avec plusieurs éléments dans le tableau, pas une route devinée) ;
// confirmAndDeleteEntry() supprime maintenant TOUTES les écritures cochées
// en un seul appel dès qu'au moins une case est cochée (libellé du menu
// contextuel mis à jour en conséquence : "Supprimer (N sélectionnées)").
// v2.30 (2026-08-04) : deux corrections suite à retours directs de Nicolas :
// (1) "import possible, mais pas de prévisualisation, regarde pour mettre
//     en place (comme pour saisie standard)" — pickFileAndUpload()
//     mémorisait `download` (téléchargement direct du fichier brut) au lieu
//     de `link` (la page d'aperçu — même URL que celle ouverte par l'icône
//     Pj de la Saisie standard native, cf. https://app.myunisoft.fr/api/ged/
//     ged/document/<id>). pjDocs stocke désormais previewLink ET
//     downloadLink séparément, le popup Pj propose les deux actions
//     ("aperçu" / "télécharger") ;
// (2) "j'ai créé une ecriture, j'essaie d'en faire une 2e. il ne m'affiche
//     plus la liste déroulante au niveaux des n° de compte" — cf.
//     rebuildAccountDatalist() : le garde-fou basé uniquement sur
//     accountCache.size laissait un <datalist> VIDE si notre root avait été
//     recréé entre-temps (remontage React déclenché par
//     applyNativeHistoryFilters() après la création de la 1ère écriture) —
//     corrigé en vérifiant aussi que le datalist actuel a déjà des options.
// v2.29 (2026-08-04, demandes explicites : "je veux aussi voir si pj déjà
// lié à une écriture (et visualisation eventuelle)" + "et commentaire, je
// veux pouvoir supprimer un commentaire") :
// (1) le clic sur l'icône Pj. ouvre désormais un popup (openPjPopup(), miroir
//     de openCommentsPopup()) au lieu d'aller direct au sélecteur de
//     fichier — liste les PJ ajoutées via CET outil pendant la session en
//     cours (nom + lien "ouvrir", cf. pjDocs), avec un bouton "+ Ajouter un
//     fichier". LIMITE ASSUMÉE : aucune route "liste des PJ d'une écriture"
//     trouvée côté prod-ws ni dans la doc Partenaires -> les PJ ajoutées
//     AVANT cette session (ou via la Saisie standard native) ne peuvent pas
//     être listées ici, message explicite affiché plutôt qu'un faux
//     résultat. Un bouton "🔍 Vérifier (test)" expérimental (GET sur la
//     même route que l'upload, probeExistingAttachments(), NON confirmé)
//     est disponible pour investiguer en direct avec Nicolas ;
// (2) suppression de commentaire : icône 🗑 sur chaque commentaire listé
//     (deleteComment()) — route DELETE /comments/:id déduite par analogie
//     avec la doc Partenaires (DELETE .../entry/comment/:comment_id) et le
//     style déjà confirmé de nos autres routes /comments internes, MAIS PAS
//     ENCORE TESTÉE EN DIRECT — à valider avec Nicolas (l'échec, le cas
//     échéant, s'affiche clairement dans le popup plutôt que de planter
//     silencieusement).
// v2.28 (2026-08-04, demande explicite : "ecarte de quelques pixels la
// colonne journal, et réduit la colonne intitulé (50 car)") : Jour élargie
// 34px -> 44px ; Intitulé passe de "flex" (largeur automatique) à une
// largeur fixe ~50 caractères (340px). Comme Intitulé était la seule
// colonne flex du tableau, ce changement modifie aussi le comportement
// global : le tableau ne s'étire plus pour remplir toute la largeur
// disponible (table width:auto au lieu de 100%, overflow-x:auto ajouté sur
// le conteneur de scroll) — choix délibéré pour garder toutes les largeurs
// de colonnes fixes/fiables plutôt qu'un étirement proportionnel de TOUTES
// les colonnes qui aurait cassé l'alignement pixel-perfect déjà en place.
// v2.27 (2026-08-04) : implémentation réelle de la pièce jointe (débloquée
// par le test en direct de Nicolas : POST /document/add_all_types confirmé
// fonctionnel sur prod-ws.myunisoft.fr avec l'auth de session habituelle,
// status 200, fichier vérifié réellement persisté via Consultation de
// compte — cf. uploadAttachment()). Ajouts :
// (1) bouton 📎 réel dans la colonne Pj. des écritures historiques (1ère
//     ligne du lot) — ouvre un sélecteur de fichier natif et upload
//     immédiatement sur l'entry_id de l'écriture ;
// (2) badge de comptage 💬N sur l'icône Commentaires, rempli en arrière-plan
//     par prefetchCommentCounts() (GET /comments par écriture visible, non
//     bloquant, ne relance pas tout renderTable() pour ne pas perdre le
//     focus) ;
// (3) badge de comptage 📎N sur le Pj. — LIMITE CONNUE : aucune route "liste
//     des PJ d'une écriture" trouvée côté prod-ws (ni dans la doc
//     Partenaires) → ce compteur est purement local/optimiste (incrémenté
//     après un upload réussi dans CETTE session), il repart à zéro si on
//     quitte/rentre dans le journal — à documenter pour Nicolas plutôt que
//     fabriquer une fausse persistance ;
// (4) "je veux pouvoir mettre une piece jointe ou un commentaire sur une
//     écriture que je saisis, pas uniquement sur une écriture existante" —
//     ajout de boutons 💬/📎 sur la ligne de brouillon (1ère ligne) qui
//     mettent en attente (draftExtras) le commentaire/les fichiers choisis
//     AVANT tout entry_id réel ; submitDraft() les envoie automatiquement
//     juste après la création réussie de l'écriture, en utilisant l'entry_id
//     retourné par POST /entry (même format que GET /entries, jamais
//     deviné). Échec de l'envoi différé = non bloquant pour l'écriture déjà
//     enregistrée (message d'erreur dédié, écriture conservée).
// v2.26 (2026-08-04) : investigation de l'upload de pièce jointe (test1.txt
// fourni par Nicolas). Un sniffer temporaire (patch fetch/XHR/window.open +
// panneau flottant, retiré après coup) a été branché en direct sur MANO/AC.
// Résultat confirmé : cliquer l'icône "Pj" native (qui ouvre bien le contenu
// réel de test1.txt dans une fenêtre de prévisualisation, donc le fichier
// EST persisté côté serveur) ne déclenche AUCUNE requête fetch/XHR ni
// window.open côté renderer — zéro appel prod-ws.myunisoft.fr capturé au clic
// alors que le fichier s'affiche bien. Conclusion : ce mécanisme (upload ET
// consultation de pièce jointe) passe par IPC vers le process principal
// Electron, qui fait lui-même l'appel HTTP hors de portée d'un script
// injecté dans la page. Sniffing renderer = IMPASSE pour cette
// fonctionnalité précise (contrairement aux commentaires, qui eux passent
// bien par fetch côté page, cf. v2.25). La fonctionnalité pièce jointe
// n'est donc TOUJOURS PAS implémentée dans Saisie Premium — nécessiterait un
// proxy réseau (ex. mitmproxy) pour intercepter le trafic du process
// principal, à voir avec Nicolas avant de continuer.
// v2.25 (2026-08-04, demande explicite : "rajoute la possibilité de
// rajouter un commentaire sur une ligne") — API reniflée en direct depuis la
// Saisie standard native (jamais devinée), cf. fetchComments()/postComment()
// plus bas pour le détail exact (GET/POST https://prod-ws.myunisoft.fr/comments,
// entry_id = celui de l'écriture entière, confirmé en observant que l'icône
// "Comm." native n'est active que sur la 1ère ligne d'un lot). Icône 💬
// cliquable ajoutée sur la 1ère ligne de chaque écriture historique, ouvre un
// petit panneau listant les commentaires existants + un champ pour en
// ajouter un nouveau (openCommentsPopup()).
// Trombone / pièce jointe (même demande) : NON IMPLÉMENTÉ à ce stade — la
// pièce jointe est au niveau de l'écriture entière (pas de la ligne), gérée
// nativement via un drag-and-drop de fichier réel (zone "Glisser les pj de
// l'écriture ou importer depuis fichiers"), et je n'ai pas pu renifler
// l'appel d'upload sans un vrai fichier à déposer dans le sélecteur natif —
// à reprendre avec Nicolas (fournir/désigner un fichier de test) avant
// d'implémenter, pour ne jamais deviner ce paramètre.
// v2.24 (2026-08-04, retours après test v2.23) : (1) colonne Jour trop
// serrée pour afficher les 2 chiffres (retour direct) -> réélargie
// 26px -> 34px ; (2) séparateur entre écritures repassé en simple trait
// épais (3px solid) au lieu du double testé en v2.23 ("met une ligne en
// gras plutot que double ligne") ; (3) fix : valider une suggestion de
// compte dans la liste déroulante native (datalist) avec Entrée ne faisait
// pas avancer le focus vers Intitulé (le keydown Entrée est intercepté par
// le popup natif du datalist et n'atteint jamais notre listener) — détecté
// via event.inputType === "insertReplacementText" sur l'event "input", seul
// signal fiable de ce cas précis.
// v2.23 (2026-08-04, demandes explicites) : (1) "FORCE LA Saisie d'un jour,
// avant de pouvoir passer au champ n° de compte" — Tab/Entrée depuis le
// champ Jour de la ligne 1 sont bloqués (contour rouge + message de statut)
// tant qu'aucun chiffre n'y a été tapé ; (2) Echap se comporte désormais
// comme Maj+Tab sur tous les champs de la ligne de saisie (recule d'un
// champ) — "idem pour alt tab ou echap qui permet de revenir en arrière" ;
// (3) colonne Jour rétrécie (40px -> 26px) et vraies largeurs de colonnes
// appliquées via <colgroup> (jusqu'ici COLUMNS[].width n'était pas
// réellement utilisé) ; (4) le Jour est désormais affiché sur CHAQUE ligne
// d'une écriture historique (plus seulement la première) ; (5) séparateur
// entre écritures affichées passé en trait double gras (comme la Saisie
// standard native), au lieu d'un simple trait plein.
// v2.22 (2026-08-04) : fix v2.21 (journal inconnu) confirmé en direct sur
// MANO après relance complète de l'app. Ajout demandé : petite roue de
// chargement CSS (#tmbc-sp-spinner, à côté du texte de statut) affichée
// pendant populateCustomFields() (montage initial) et pendant les retries
// refreshJournalOptionsCache()/refreshPeriodOptionsCache() — demande
// explicite : "tu peux mettre une roue de la mort le temps du chargement
// des journaux et périodes".
// v2.21 (2026-08-04) : root cause enfin isolée et corrigée (diagnostic en
// direct via window.tmbcTestJournal(), dossier MANO). Repro exact fourni par
// Nicolas : "si je met BBE, et une période, ca m'affiche les écritures. puis
// je met AC, là il m'ouvre un journal où je peux saisir une ecriture. puis si
// je change la période, il me remet journal inexistant". Confirmé : dans ce
// scénario le champ natif Journal contient DÉJÀ exactement "AC - ACHATS" (la
// 1ère résolution avait réussi) ; tryTrigger() rappelle quand même
// commitNativeJournal("AC - ACHATS") au changement de Période (le "key" =
// journal+période a changé), et reposer la MÊME valeur sur le champ (même via
// setNativeValue, qui dispatche bien input+change) ne rouvre PAS la liste
// déroulante MUI — confirmé en direct : window.tmbcTestJournal("AC - ACHATS")
// retournait null alors que le champ affichait déjà "AC - ACHATS". Fix :
// commitNativeJournal()/selectNativeAutocompleteOption() retournent
// immédiatement sans retoucher au champ natif si celui-ci contient déjà
// exactement la valeur visée — évite ce pilotage redondant qui échouait.
// v2.20 (2026-08-04) : bug v2.19 pas résolu ("marche pas, toujours journal
// inexistant" constaté par Nicolas sur MANO après le fix précédent). Diagnostic
// en direct (window.tmbcDebugJournals()) : journalOptionsCache/periodOptionsCache
// contiennent bien "AC - ACHATS" et "07/2026" pour MANO — le cache n'est donc
// PAS en cause cette fois. Ajout de window.tmbcTestJournal(typedText), qui
// appelle commitNativeJournal() isolément (sans passer par tout tryTrigger())
// pour distinguer un souci de cache d'un souci de pilotage du champ natif lui-
// même — à utiliser depuis les DevTools pour la suite du diagnostic.
// v2.19 (2026-08-04) : root cause du bug v2.18 (celui-ci n'était qu'un
// symptôme partiel). Testé en direct par Nicolas sur le dossier MANO : "JE
// T4AI MIS DESSus. Y A DEja des ecritures affichés avant que je mette le
// journal, déjà c bizarre. ensuite, je met AC et 07/2026, ca me met journal
// inexistant ! alors qu'il existe" — la racine custom (CUSTOM_ROOT_ID) est un
// singleton jamais recréé tant qu'un nœud avec cet id existe déjà dans le
// DOM : en changeant de dossier/onglet, journalOptionsCache/periodOptionsCache/
// lastEntriesResponse et même le texte tapé dans Journal/Période restaient
// ceux du dossier PRÉCÉDENT (constaté : les écritures de CHAPI 1 s'affichaient
// encore sur MANO avant toute saisie). guardAgainstDossierSwitch() vidait déjà
// diaryCache/accountCache au changement de dossier (v2.21 historique, cf. plus
// bas) mais pas ces caches-là ni la racine elle-même. Fix : au changement de
// dossier détecté, on retire entièrement la racine custom (nœud À NOUS,
// jamais natif — retrait autorisé) et on vide tous les caches liés à
// l'affichage (journalOptionsCache, periodOptionsCache, lastEntriesResponse,
// currentFilterJournalCode/Period, lastSyncedKey, selectedEntryIds), pour que
// tout soit reconstruit proprement pour le nouveau dossier dès le prochain
// scan. Le retry v2.18 reste utile pour la race async "premier essai trop
// tôt" mais ne suffisait pas seul face à ce mélange inter-dossiers.
// v2.18 (2026-08-04) : bug signalé en direct par Nicolas — "j'ai saisi un
// journal AC et période 07/2026 (journal et période existante), il me met
// journal Inconnu (alors qu'il fonctionne). si je change et que je mets
// BECM, il me trouve le journal, je remet AC et là il me trouve le journal
// et les écritures." Reproduit en direct (Claude in Chrome, prise de main
// LGA/Electron, nouvelle navigation Tenue > Saisie Premium sur CHAPI 1) :
// le tout premier essai d'un journal/période pourtant existants échoue,
// mais une nouvelle navigation fraîche (pas un onglet réutilisé) réussit du
// premier coup. Root cause identique à un bug déjà corrigé pour le plan
// comptable (v2.10, absorbFullChartOfAccounts) : le prop React `options` du
// champ natif Journal/Année/Mois se peuple de façon ASYNCHRONE après le
// montage de la page, et populateCustomFields() ne lit journalOptionsCache/
// periodOptionsCache qu'UNE SEULE fois (gardé par root.dataset.tmbcPopulated),
// sans retry — si ce tout premier essai arrive trop tôt, le cache reste
// figé, incomplet, pour le reste de la session. Fix : refreshJournalOptionsCache()/
// refreshPeriodOptionsCache() (mêmes fonctions sniffées fetchNativeOptions/
// buildPeriodOptions, jamais une nouvelle source) sont maintenant appelées en
// retry UNE fois dans tryTrigger() avant de conclure à un vrai "Journal
// inconnu"/"Période inexistante" — cf. window.tmbcDebugJournals() pour
// inspecter les caches en direct si le souci revient.
// v2.17 (2026-08-02) : "rajoute les coches devant, je veux pouvoir saisir une
// ecriture, la modifier ou la supprimer (clic droit > modifier ou clic droit >
// supprimer)". Sniffing en direct (Claude in Chrome + DevTools, dossier CHAPI
// 1, sur une VRAIE écriture de test que Nicolas a explicitement demandé de
// supprimer : journal AC, 12/2025, 100€ compte d'attente 471000/472000) : le
// clic droit natif ouvre bien Changer de journal/Changer la date/Dupliquer/
// Modifier/Extourner/Recherche montant/Supprimer, confirmant l'hypothèse de
// Nicolas. La confirmation de "Supprimer" a révélé DELETE
// https://prod-ws.myunisoft.fr/entry, corps {"entry":[{"entry_id": <int>}]},
// réponse `true` (jamais deviné). Ajout : case à cocher sur la 1ère ligne de
// chaque écriture historique (selectedEntryIds), clic droit sur une écriture
// -> petit menu (Modifier grisé, en attente de sniffer l'appel de MAJ ;
// Supprimer câblé) -> confirmation calquée sur le texte natif observé en
// direct -> deleteEntry() -> retrait de l'écriture du cache local
// (lastEntriesResponse) après un `true` confirmé par le serveur. L'entry_id
// utilisé en LECTURE (entry.entry_id, avec repli sur entry.id) suppose que le
// même nom de champ est exposé côté lecture que côté suppression — à
// reconfirmer au premier test réel sur une écriture non-test : en cas
// d'absence, un message d'erreur explicite s'affiche plutôt qu'un échec
// silencieux (cf. confirmAndDeleteEntry()).
// v2.16 (2026-08-02) : "OK pour le F4, quand la liste est ouverte, si je
// commence à taper le début du journal ou de la période, il doit aller
// dessus, pour que j'ai juste à taper Entrée ou tab pour le selectionner" —
// openLookupPopup() gère maintenant un index en surbrillance (lookupSetSelected)
// mis à jour soit par les flèches Haut/Bas, soit automatiquement à chaque
// frappe dans le champ ancre (lookupJumpToTyped : premier item dont le code
// ou le libellé commence par ce qui est tapé, jamais deviné — comparé
// uniquement aux items déjà présents dans journalOptionsCache/periodOptionsCache).
// Tant que le popup est ouvert, Entrée et Tab dans le champ Journal/Période
// ne déclenchent plus tryTrigger()/le comportement habituel : ils valident
// l'item en surbrillance (lookupConfirmSelection) et ferment la liste ;
// Échap ferme sans sélectionner.
// v2.15 (2026-08-02) : trois demandes après retour terrain sur v2.13/v2.14.
// (1) "il faut forcer un chiffre dans la colonne Jour (entre 1 et 31, 30 ou
// 28/29 selon la période)" : le champ Jour de la ligne 1 n'accepte plus que
// des chiffres pendant la frappe, et se corrige au blur en le bornant au
// vrai nombre de jours du mois/année choisis (daysInSelectedPeriod(), calculé
// via new Date(), jamais deviné). (2) bug constaté en direct : après que la
// complétion auto-single-match (v2.13) remplit le champ N° Compte, Tab ET
// Entrée ne faisaient PAS avancer le focus vers Intitulé — cause probable :
// la liste de suggestions native de <input list=...> "consommait" ce Tab
// pour se fermer au lieu de laisser le focus natif avancer. Fix radical :
// Tab et Entrée ne dépendent plus JAMAIS du comportement natif du navigateur
// — les deux sont désormais gérés explicitement (focusDraftStep) sur TOUS
// les champs, pas seulement le dernier. (3) "si je suis sur le champ
// journal, et que je fais touche F4, il doit m'ouvrir une liste des codes
// journaux dispos (avec l'intitulé en description). Sur le champ période,
// idem" : ajout de openLookupPopup()/closeLookupPopup(), une petite liste
// ancrée sous le champ, construite à partir des mêmes listes déjà fetchées
// depuis les composants natifs (journalOptionsCache/periodOptionsCache).
// v2.14 (2026-08-02) : Journal/Période passent de <select> à des champs
// texte libres (demandes explicites). Journal : on tape uniquement le CODE
// (ex. "02"), le nom résolu s'affiche À CÔTÉ du champ (jamais dans le champ
// lui-même) — résolution par correspondance exacte de code puis, à défaut,
// premier libellé natif qui commence par ce qui est tapé (findJournalOption,
// contre journalOptionsCache, jamais deviné : toujours la vraie liste
// fetchée depuis le composant natif). Période : accepte "0626", "022026",
// "06/26" ou "06/2026" (parsePeriodInput gérait déjà ces 4 formats), mise en
// forme immédiate en "mm/aaaa" dans le champ dès reconnu, ET vérifiée contre
// periodOptionsCache (la vraie liste Année/Mois de CE dossier) — une période
// hors de cette liste affiche une erreur explicite au lieu d'être acceptée
// à tort. Déclenchement sur Entrée ou en quittant le champ (blur), au lieu
// du "change" d'un <select>.
// v2.13 (2026-08-02) : suite de demandes sur l'ergonomie de saisie, une fois
// le fix v2.12 confirmé fonctionnel en test réel ("ca marche maintenant !") :
// (1) navigation clavier logique gauche->droite : Tab/Shift+Tab utilisaient
// déjà l'ordre naturel du DOM (rien à changer), mais Entrée ne déplaçait le
// focus nulle part (comportement par défaut d'un <input> hors <form>) — elle
// se comporte maintenant comme Tab (Entrée = suivant, Shift+Entrée =
// précédent), cf. focusDraftStep()/getDraftFocusableInputs(). (2) écritures
// multi-lignes : si l'écriture n'est pas équilibrée quand on atteint le
// dernier champ de la dernière ligne (Tab/Entrée), une ligne supplémentaire
// s'ouvre automatiquement (addDraftLine()) au lieu de bloquer avec une
// erreur — répétable autant de fois que nécessaire. (3) Intitulé/Pièce 1/
// Pièce 2 de la ligne 1 sont désormais repris par défaut sur les lignes
// suivantes (propagation en direct, même mécanisme que le Jour existant),
// SAUF si l'utilisateur corrige une ligne à la main (drapeaux *Touched par
// ligne, pour ne jamais écraser une correction volontaire). (4) N° Compte :
// dès qu'un seul compte du plan comptable (accountCache, jamais deviné)
// commence par ce qui est tapé, il est auto-complété dans le champ — un
// compte tapé qui n'existe dans aucun match ne bloque toujours pas la
// navigation Tab/Entrée (aucun preventDefault ajouté sur ce cas).
// v2.12 (2026-08-02) : "test avec la saisie classique, regarde le flux et
// reproduit après sur saisie premium" — reproduit en direct via la saisie
// standard (même journal vide "02 - VENTES", même compte 471000, débit/
// crédit 100) pour comparer le flux réseau réel au nôtre, qui échouait
// jusqu'ici avec un 500 générique "GBL1" sur ce même scénario. Deux écarts
// trouvés par comparaison directe des deux payloads (aucun deviné) : (1)
// l'appel natif cible `/entry?type=e`, pas `/entry` seul — très probable
// vraie cause du 500 ; (2) period_from calculé ici sortait décalé d'un jour
// ("2025-05-29" au lieu de "2025-05-30") à cause d'un passage par
// toISOString() qui convertit en UTC (la France est UTC+1/+2, donc minuit
// local recule d'un jour une fois converti). Les deux corrigés :
// createEntry() cible maintenant `/entry?type=e`, et computePeriodFromTo()
// formate désormais la date en LOCAL sans passer par toISOString().
// v2.11 (2026-08-02) : "dans la saisie standard, je peux saisir une écriture
// sur un journal vide. il faut prévoir l'exception." — resolveDiaryId() ne
// résolvait le diary_id QUE via l'historique (diaryCache alimenté par de
// vraies écritures déjà passées, ou widenCacheSearch() qui élargit la
// fenêtre de dates à tout l'exercice) : un journal n'ayant JAMAIS eu la
// moindre écriture restait donc "non résolu", contrairement à la saisie
// standard native. Diagnostic en direct (DevTools, fibre React) : le champ
// natif "Journal" expose son prop `options` ({label, value, additionalInfo})
// mais SEULEMENT une fois son dropdown ouvert (vide sinon) ; `value` EST
// l'id numérique interne du journal, confirmé en clair sur CHAPI 1 :
// {label:"02 - JOURNAL DE VENTES", value:118919}. Ajout de
// findJournalOptionsViaFiber() + resolveDiaryIdViaFiber() (ouvre le dropdown
// via ArrowDown, lit la fibre, referme via Escape — aucune valeur devinée,
// donnée déjà chargée par l'appli elle-même) : resolveDiaryId() l'essaie
// désormais EN PREMIER, avant le fallback historique — couvre le cas du
// journal vide et reste plus rapide dans le cas général.
// v2.10 (2026-08-02) : diagnostic en direct (prise de contrôle de l'appli,
// DevTools ouvertes) confirmé : le prop React `options` du champ N°Compte se
// peuple de façon ASYNCHRONE après montage — le tout premier essai
// automatique (au chargement de la page) arrive trop tôt et échoue
// légitimement ("34 <input> scannés, meilleur = null"), et rejouer EXACTEMENT
// la même recherche à la main quelques instants plus tard réussit aussitôt
// (513 comptes). Le essai périodique censé suivre ne revenait ensuite
// jamais en usage réel (chartOfAccountsLoaded restait bloqué à false,
// accountCache.size=2, plusieurs minutes après). Plutôt que de dépendre du
// scan périodique pour ce deuxième essai, on retente maintenant
// explicitement à deux moments fiables : (1) juste après un chargement
// d'historique réussi (Journal+Période sélectionnés), (2) au focus du champ
// N°Compte de la ligne de saisie — tous deux forcent un essai immédiat
// (throttle réinitialisé) sans dépendre du cycle de scan.
// v2.9 (2026-08-02) : app constatée FIGÉE (UI totalement non réactive) après
// quelques minutes de test réel — en prenant la main sur l'appli via
// contrôle d'écran direct, aucun clic ne produisait plus le moindre effet.
// Cause très probable : tant que absorbFullChartOfAccounts() échoue, elle
// était retentée à CHAQUE scan (~1x/s), scannant tous les <input> de la page
// avec une remontée de fibre React (jusqu'à 30 niveaux) à chaque fois — coût
// qui s'additionne indéfiniment en cas d'échec permanent. Fix : throttle à 1
// essai/3s + abandon définitif après 30 essais (~90s), avec un warning clair
// si l'abandon survient (plutôt qu'une boucle serrée silencieuse).
// v2.8 (2026-08-02) : preuve en main (tmbcDebugAccounts() -> size:5,
// chartOfAccountsLoaded:false) que la recherche par libellé "N° Compte" ne
// trouve jamais de candidat en usage réel Electron, contrairement au test
// Chrome. Remplacé par un scan de TOUS les <input> de la page (cf.
// absorbFullChartOfAccounts) — ne dépend plus d'aucun texte de libellé.
// v2.7 (2026-08-02) : le plan comptable complet fonctionne en test Chrome sur
// CHAPI 1 (513 comptes, y compris avec un filtre Journal actif — vérifié en
// direct, donc pas de sous-ensemble contextuel comme suspecté en v2.3) mais
// le bug persiste en usage réel Electron ("affiche encore les comptes du
// journal"). Plutôt que de continuer à deviner à distance sans preuve,
// ajout de logs console.debug détaillés dans absorbFullChartOfAccounts() et
// guardAgainstDossierSwitch(), + un rappel manuel window.tmbcDebugAccounts()
// pour diagnostiquer depuis les DevTools de l'appli (Ctrl+Shift+I) au
// prochain test.
// v2.6 (2026-08-02) : 500 "GBL1 - Une erreur est survenue lors du traitement"
// (message serveur générique, sans détail exploitable) reproduit en test
// réel. Cause la plus probable identifiée : diaryCache/accountCache sont des
// Maps globales JAMAIS vidées entre deux dossiers — si Nicolas a testé (ou
// simplement navigué dans) un AUTRE dossier plus tôt dans la même session
// Electron avant CHAPI 1, un code journal ou numéro de compte partagé entre
// dossiers (ex. "OD", "471000") pouvait rester résolu vers l'id interne DU
// MAUVAIS DOSSIER, provoquant un rejet serveur générique côté API (violation
// d'intégrité référentielle probable). Fix : les deux caches (+ le plan
// comptable) sont désormais vidés dès que l'etablissement_id actif change
// (cf. guardAgainstDossierSwitch()), pour ne jamais mélanger deux dossiers.
// v2.5 (2026-08-02) : 500 constaté sur POST /entry en test réel, cause exacte
// non identifiable a posteriori (le corps d'erreur n'était pas remonté).
// Deux fixes défensifs sans deviner la cause précise : (1) createEntry() lit
// désormais le corps de la réponse d'erreur et l'affiche à l'écran (au lieu
// de juste "HTTP 500"), pour diagnostiquer la prochaine occurrence ; (2)
// garde-fou sur le jour saisi par rapport au nombre de jours du mois de la
// Période choisie (un jour hors bornes, ex. 31 pour un mois de 30 jours,
// passait silencieusement avant et pouvait produire une date_piece invalide).
// v2.4 (2026-08-02), 2e retour de test live :
//  - Plan comptable : le champ "N° Compte" retenu pour lire le prop React
//    `options` pouvait être un sous-ensemble contextuel (comptes du
//    journal affiché) plutôt que le plan comptable complet — corrigé en
//    comparant TOUS les champs "N° Compte" trouvés et en gardant celui
//    exposant le plus grand nombre de comptes (garde-fou : rejeté si < 100).
//  - "Toute la partie haute doit être figée" (pas seulement l'en-tête de
//    colonnes/Journal/Période) : le design précédent laissait la PAGE
//    entière défiler (position:sticky relatif à un ancêtre de scroll
//    ambigu), donc le bandeau natif tout en haut défilait quand même.
//    Remplacé par un conteneur de scroll dédié (#tmbc-sp-scroll,
//    hauteur bornée au viewport restant) qui contient UNIQUEMENT le
//    tableau — tout ce qui est au-dessus (bandeau natif + Journal/Période +
//    en-tête de colonnes, ce dernier sticky top:0 relatif à ce conteneur
//    précis) n'a donc plus jamais besoin de défiler.
// v2.3 (2026-08-02) : la liste de comptes proposée (datalist) ne contenait que
// les comptes déjà rencontrés dans une écriture existante — insuffisant,
// demande explicite de proposer TOUT le plan comptable. Reniflage réseau
// infructueux (aucun XHR/fetch déclenché en tapant dans "N° Compte" sur CHAPI
// 1, la liste — 513 comptes constatés — est chargée une fois en mémoire au
// montage et filtrée côté client, absente aussi de localStorage/IndexedDB) ;
// récupérée via remontée de fibre React jusqu'au prop `options` du composant
// Autocomplete natif (donnée réelle déjà chargée par l'appli, jamais
// fabriquée), cf. absorbFullChartOfAccounts().
// v2.1 (2026-08-02) : fix crash "deleteIcon.click is not a function" — les puces
// (chips) de filtre Journaux natives se suppriment via une icône <svg>, qui n'a
// pas de méthode .click() (réservée à HTMLElement) ; remplacé par un vrai
// MouseEvent dispatché sur l'élément.
// v2.2 (2026-08-02), retours du premier test live sur CHAPI 1 :
//  - Suggestions de comptes : <datalist> natif alimenté par accountCache (jamais
//    deviné, uniquement des comptes déjà vus dans une vraie réponse "/entries/v2").
//  - Jour : seule la ligne 0 est éditable, propagé en direct (sans re-render, pour
//    ne pas perdre le focus) dans les lignes suivantes, qui deviennent lecture
//    seule — une écriture n'a qu'une seule date_piece.
//  - Validation automatique dès que Débit = Crédit (> 0) au blur d'un champ
//    Débit/Crédit, sans attendre Tab/Enter sur Pièce 2 (qui reste un filet de
//    sécurité). Garde submitInProgress (try/finally) pour éviter un double POST.
//  - Bandeau Journal/Période + en-tête de colonnes rendus position:sticky (demande
//    "cette partie doit rester figée").
//  - Séparateur entre lots d'écritures passé de 1px gris à 2px noir (gras).
//  - Montants Débit/Crédit affichés sans signe €, toujours alignés à droite.
// @description  v2.0 (2026-08-02) : REFONTE COMPLÈTE ("on repart d'une feuille blanche"), demandée
//               par Nicolas après 7 itérations sur l'approche v1.x (repositionnement CSS de
//               fragments de la page native — fragile : en-têtes qui disparaissent, "Chargement..."
//               bloqué, colonnes désalignées, plusieurs régressions au fil des retours). Nouvelle
//               approche : UN SEUL tableau custom (jamais un fragment de la grille native
//               repositionné) qui affiche les écritures historiques PUIS, à la suite, une ou
//               plusieurs lignes ÉDITABLES pour saisir une nouvelle écriture — alignement garanti
//               puisque c'est le MÊME <table>, plus besoin de mesurer/copier des largeurs natives.
//
//               Ceci nécessite d'enregistrer réellement une écriture SANS piloter la grille native
//               (qui est maintenant entièrement masquée) — root cause du changement d'approche :
//               piloter la grille native pour la SAISIE (pas seulement la lecture) s'est avéré trop
//               fragile en pratique (accordéon replié qui casse la détection de bouton, champs
//               masqués qui perdent leur focusabilité, conflits avec saisie.js qui tourne en
//               parallèle...). Conformément à la règle du projet ("avant de toucher à l'API :
//               reniflage d'un appel natif réel, jamais de paramètre deviné"), l'appel
//               d'enregistrement a été sniffé en direct (Claude in Chrome, dossier CHAPI 1
//               EXCLUSIVEMENT comme demandé par Nicolas — écriture de test 0,01€/0,01€ sur le compte
//               471000 "COMPTE ATTENTE", validée puis SUPPRIMÉE immédiatement après) :
//                 POST https://prod-ws.myunisoft.fr/entry
//                 Corps : {
//                   date_piece: "AAAA-MM-JJ",        // jour saisi + mois/année de la Période choisie
//                   etablissement_id: <int>,          // = le segment /tab/<id>/ de l'URL courante
//                   period_from: "AAAA-MM-JJ",        // OBSERVÉ = date_piece moins 1 mois calendaire
//                   period_to: "AAAA-MM-JJ",          // OBSERVÉ = date_piece — RÈGLE NON CONFIRMÉE
//                                                      // au-delà de ce seul test, reproduite ici à
//                                                      // l'identique (jamais inventée) ; à surveiller
//                                                      // en usage réel, cf. computePeriodFromTo().
//                   diary_id: <int>,                  // id numérique du journal — PAS le code ("CA") ;
//                                                      // résolu via un cache alimenté par les vraies
//                                                      // réponses "/entries/v2" déjà récupérées pour
//                                                      // la lecture (chaque entrée porte
//                                                      // diary.{id,code}) — jamais deviné. Si le
//                                                      // journal choisi n'a encore aucune écriture
//                                                      // connue dans ce cache, resolveDiaryId() élargit
//                                                      // la recherche à tout l'exercice avant d'échouer
//                                                      // proprement (message clair, pas de saisie
//                                                      // possible tant que non résolu).
//                   pj_list: [],
//                   entry_list: [ {                   // exactement 2 lignes supportées dans cette
//                                                      // version (limitation assumée et annoncée à
//                                                      // Nicolas — la grande majorité des écritures
//                                                      // simples n'ont que 2 lignes ; les écritures à
//                                                      // 3+ lignes restent à saisir via la Saisie
//                                                      // normale pour l'instant)
//                     currency: "EUR",
//                     date_entry: "AAAA-MM-JJ",       // OBSERVÉ = date du jour réel (pas date_piece)
//                     account_id: <int>,               // résolu via le même principe de cache que
//                     account_number: "...",           // diary_id (comptes déjà vus dans une réponse
//                     account: {account_id, account_number, label}, // "/entries/v2" lue), jamais deviné
//                     label: "...",
//                     debit: <number|null>, credit: <number|null>,  // jamais les deux à la fois
//                     payment_type_id: null,
//                     piece: "...", piece2: "...",
//                     flags: {}
//                   }, { ...ligne 2... } ]
//                 }
//               Réponse : { debit_total, credit_total, type, entry_array: [...] } (même forme que
//               "/entries/v2", pratique pour rafraîchir directement l'affichage avec la réponse de
//               création). Champs du tableau NON couverts par ce schéma (Comm./Pj./Contrepartie/
//               Echéance) : gardés à l'affichage pour l'alignement visuel des colonnes mais rendus
//               NON ÉDITABLES sur la ligne de saisie (grisés, avec une note) — jamais fabriqué de
//               paramètre supplémentaire non observé.
// @author       Nicolas
// @match        https://connect.lgassocies.com/*
// @match        https://*.myunisoft.fr/*
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const { isDisabled, registerScan, getApiHeaders, MONO_FONT_STACK } = window.TMBC;

  const PREMIUM_FLAG_KEY = 'tmbcSaisiePremium';
  const NATIVE_SAISIE_SELECTOR = 'li[data-id="menu-item-newAccounting"]';
  const NATIVE_CONSULT_SELECTOR = 'li[data-id="menu-item-accountConsultation"]';
  const PREMIUM_LI_DATA_ID = 'menu-item-newAccountingPremium';
  const CUSTOM_ROOT_ID = 'tmbc-saisie-premium-root';
  const HIDDEN_MARK = 'data-tmbc-premium-hidden';

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitFor(predicate, timeoutMs, stepMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const value = predicate();
      if (value) return value;
      await sleep(stepMs);
    }
    return null;
  }

  function setNativeValue(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function isElementVisible(el) {
    return !!el && el.offsetParent !== null;
  }

  function isSaisiePage() {
    return location.pathname.includes('/accounting/newEntry');
  }

  function isPremiumModeOn() {
    try {
      return localStorage.getItem(PREMIUM_FLAG_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setPremiumMode(on) {
    try {
      if (on) localStorage.setItem(PREMIUM_FLAG_KEY, '1');
      else localStorage.removeItem(PREMIUM_FLAG_KEY);
    } catch (e) {
      /* stockage indisponible : tant pis, le mode restera "normal" par défaut */
    }
  }

  function currentEtablissementId() {
    const m = /\/tab\/(\d+)\//.exec(location.pathname);
    return m ? parseInt(m[1], 10) : null;
  }

  // --- Injection du menu "Saisie Premium" (Tenue > Saisie/Consultation) --

  // BUG CORRIGÉ (2026-08-02, v1.2) : le clic sur notre item posait
  // setPremiumMode(true) PUIS appelait .click() sur le <li> natif "Saisie"
  // pour déclencher la vraie navigation — ce même <li> porte aussi notre
  // propre écouteur qui désactive le mode Premium sur un clic "Saisie"
  // normal ; un .click() synthétique déclenche TOUS les écouteurs, y compris
  // le nôtre, qui repassait donc le flag à false dans la foulée. Fix : garde
  // (suppressClearOnNextNativeClick) consommé par l'écouteur de nettoyage
  // pour ignorer UNIQUEMENT ce déclenchement précis.
  let suppressClearOnNextNativeClick = false;

  function ensurePremiumMenuItem() {
    const saisieLi = document.querySelector(NATIVE_SAISIE_SELECTOR);
    const consultLi = document.querySelector(NATIVE_CONSULT_SELECTOR);
    if (!saisieLi || !consultLi || saisieLi.parentElement !== consultLi.parentElement) return;
    if (document.querySelector('li[data-id="' + PREMIUM_LI_DATA_ID + '"]')) return;

    const premiumLi = saisieLi.cloneNode(true);
    premiumLi.setAttribute('data-id', PREMIUM_LI_DATA_ID);
    premiumLi.removeAttribute('aria-selected');
    premiumLi.classList.remove('Mui-selected');
    const span = premiumLi.querySelector('span');
    if (span) span.textContent = 'Saisie Premium';

    premiumLi.addEventListener('click', () => {
      setPremiumMode(true);
      const nativeSaisieLi = document.querySelector(NATIVE_SAISIE_SELECTOR);
      if (nativeSaisieLi) {
        suppressClearOnNextNativeClick = true;
        nativeSaisieLi.click();
      }
    });

    consultLi.parentElement.insertBefore(premiumLi, consultLi);
  }

  function removePremiumMenuItem() {
    const li = document.querySelector('li[data-id="' + PREMIUM_LI_DATA_ID + '"]');
    if (li) li.remove(); // nœud à NOUS (jamais natif) : retrait autorisé.
  }

  let saisieLiWired = null;
  function wireNativeSaisieLiClearsPremiumFlag() {
    const li = document.querySelector(NATIVE_SAISIE_SELECTOR);
    if (!li || li === saisieLiWired) return;
    saisieLiWired = li;
    li.addEventListener('click', () => {
      if (suppressClearOnNextNativeClick) {
        suppressClearOnNextNativeClick = false;
        return;
      }
      setPremiumMode(false);
    });
  }

  // --- Repérage défensif de la structure de la page Saisie ---------------

  function findLabelInput(labelText) {
    const label = Array.from(document.querySelectorAll('body *')).find(
      (el) => el.children.length === 0 && el.textContent.trim() === labelText && isElementVisible(el)
    );
    const container = label ? label.parentElement : null;
    const input = container ? container.querySelector('input') : null;
    return input ? { label, container, input } : null;
  }

  // saisie.js (module indépendant, tourne en parallèle) renomme le libellé
  // natif "Mois" en "Période (mm/aaaa)" pour sa propre fonctionnalité — on
  // essaie les deux libellés possibles, peu importe lequel des deux modules
  // a tourné en premier sur ce tick.
  function findMoisLabelInput() {
    return findLabelInput('Mois') || findLabelInput('Période (mm/aaaa)');
  }

  function findVisibleInputByName(name) {
    return Array.from(document.querySelectorAll('input[name="' + name + '"]')).find(isElementVisible) || null;
  }

  function findButtonByText(text) {
    return Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === text && isElementVisible(b)
    );
  }

  // Repère headerContainer (Journal/Mois/Année/Devise/N° de compte/Solde),
  // topPaper (son parent, contient aussi la grille de saisie native et les
  // actions — tout ça sera masqué, on n'en a plus besoin) et wrapper (3
  // enfants directs, display:block : topPaper, filtersBlock, grille
  // historique native).
  function locateLayoutNodes() {
    const journalField = findLabelInput('Journal');
    if (!journalField) return null;

    const headerContainer = journalField.container.closest('[class*="headerContainer"]');
    if (!headerContainer) return null;

    const topPaper = headerContainer.parentElement;
    if (!topPaper) return null;

    const wrapper = topPaper.parentElement;
    if (!wrapper || wrapper.children.length < 3) return null;
    if (wrapper.children[0] !== topPaper) return null;

    const filtersBlock = wrapper.children[1];
    const historicalPaperNative = wrapper.children[2];

    return { journalField, headerContainer, topPaper, wrapper, filtersBlock, historicalPaperNative };
  }

  // --- Masquage réversible -------------------------------------------------

  // `visibility:hidden` casse la FOCUSABILITÉ d'un élément (bug vécu en v1.4
  // — commitNativeJournal/commitNativePeriod appellent .focus() sur ces
  // champs) sans casser offsetParent ; `position:fixed` hors-écran garde
  // l'élément "visible" pour le CSS (donc focusable, offsetParent valide —
  // seul display:none le casse) tout en le sortant du flux et de l'écran.
  // Utilisé UNIQUEMENT pour headerContainer/filtersBlock, dont on continue
  // à piloter des descendants (Journal/Mois/Année/Du/Au/Journaux).
  function hideKeepingOffsetParent(el) {
    if (el.getAttribute(HIDDEN_MARK) === '1') return;
    el.setAttribute(HIDDEN_MARK, '1');
    el.style.setProperty('position', 'fixed');
    el.style.setProperty('left', '-99999px');
    el.style.setProperty('top', '-99999px');
    el.style.setProperty('margin', '0');
    el.querySelectorAll('input, button, [tabindex]').forEach((f) => f.setAttribute('tabindex', '-1'));
  }

  // display:none classique — pour tout ce dont on ne pilote plus AUCUN
  // descendant (v2.0 : la grille de nouvelle écriture native et ses actions
  // ne sont plus utilisées du tout, on écrit directement via l'API).
  function hideCompletely(el) {
    if (el.getAttribute(HIDDEN_MARK) === '2') return;
    el.setAttribute(HIDDEN_MARK, '2');
    el.style.setProperty('display', 'none');
  }

  function restoreNativeSaisieLayout() {
    document.querySelectorAll('[' + HIDDEN_MARK + ']').forEach((el) => {
      el.style.removeProperty('position');
      el.style.removeProperty('left');
      el.style.removeProperty('top');
      el.style.removeProperty('margin');
      el.style.removeProperty('display');
      el.removeAttribute(HIDDEN_MARK);
      el.querySelectorAll('[tabindex="-1"]').forEach((f) => f.removeAttribute('tabindex'));
    });
    const root = document.getElementById(CUSTOM_ROOT_ID);
    if (root) root.remove(); // nœud à NOUS, jamais natif : retrait autorisé.
    lastSyncedKey = null;
    currentNodes = null;
    currentFilterJournalCode = null;
    currentFilterPeriod = null;
  }

  function hideLegacyPeriodOverlay() {
    ['tmbc-saisie-period-field', 'tmbc-saisie-mois-relocated-label'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) hideCompletely(el);
    });
  }

  // --- Cache diary_id / account_id (jamais deviné, toujours issu d'une ----
  //     vraie réponse "/entries/v2" déjà reçue) ---------------------------

  const diaryCache = new Map(); // code journal ("CA") -> id numérique
  const accountCache = new Map(); // numéro de compte ("471000") -> {account_id, label}

  function absorbEntriesIntoCache(data) {
    const entries = data && Array.isArray(data.entry_array) ? data.entry_array : [];
    entries.forEach((entry) => {
      if (entry.diary && entry.diary.code && entry.diary.id) {
        diaryCache.set(entry.diary.code, entry.diary.id);
      }
      (entry.entry_list || []).forEach((line) => {
        if (line.account && line.account.account_number && line.account.account_id) {
          accountCache.set(line.account.account_number, {
            account_id: line.account.account_id,
            label: line.account.label || '',
          });
        }
      });
    });
  }

  // BUG SIGNALÉ (2026-08-02) : le cache ci-dessus ne contenait que les comptes
  // déjà VUS dans une écriture existante — insuffisant pour proposer tout le
  // plan comptable ("il faut proposer les numéros du plan comptable !").
  // Reniflage réseau infructueux : taper dans le champ natif "N° Compte" ne
  // déclenche AUCUN appel XHR/fetch (confirmé via patch des deux, sur CHAPI 1)
  // — la liste complète des comptes (513 comptes constatés) est chargée UNE
  // FOIS en mémoire au montage de la page et filtrée côté client à la frappe,
  // sans être mise en cache dans localStorage/IndexedDB (vérifié aussi, absent
  // de la base "localforage"). La seule source réelle et non devinée qui reste
  // est donc l'état interne du composant React natif lui-même (son prop
  // `options`), lu par remontée de fibre React à partir du champ natif — même
  // technique déjà utilisée ailleurs dans ce projet (balance.js). AUCUNE valeur
  // n'est fabriquée : on lit exactement ce que l'appli a déjà chargé pour son
  // propre Autocomplete.
  function getReactFiber(el) {
    if (!el) return null;
    const key = Object.keys(el).find(
      (k) => k.indexOf('__reactFiber$') === 0 || k.indexOf('__reactInternalInstance$') === 0
    );
    return key ? el[key] : null;
  }

  function findAccountOptionsViaFiber(inputEl) {
    let node = getReactFiber(inputEl);
    for (let i = 0; i < 30 && node; i++) {
      const props = node.memoizedProps;
      if (
        props &&
        Array.isArray(props.options) &&
        props.options.length &&
        props.options[0] &&
        props.options[0].account_number
      ) {
        return props.options;
      }
      node = node.return;
    }
    return null;
  }

  // NOUVEAU (2026-08-02, v2.11) : même technique que findAccountOptionsViaFiber,
  // mais pour le champ natif "Journal" — confirmé en direct (DevTools, dropdown
  // ouvert via ArrowDown synthétique) que son prop React `options` contient
  // {label: "02 - JOURNAL DE VENTES", value: 118919, additionalInfo: {...}},
  // où `value` EST l'id numérique interne du journal (diary_id), disponible
  // même pour un journal n'ayant JAMAIS eu la moindre écriture. On distingue
  // ces options de celles d'autres champs natifs partageant la même forme
  // {label,value} (ex. moyens de paiement : {label:'Carte bleue', value:1087})
  // via le motif du libellé, qui commence toujours par un code journal à 2
  // chiffres suivi d'un tiret ("01 - ...", "02 - ...").
  function findJournalOptionsViaFiber(inputEl) {
    let node = getReactFiber(inputEl);
    for (let i = 0; i < 30 && node; i++) {
      const props = node.memoizedProps;
      if (
        props &&
        Array.isArray(props.options) &&
        props.options.length &&
        props.options[0] &&
        typeof props.options[0].value !== 'undefined' &&
        typeof props.options[0].label === 'string' &&
        /^\d{2}\s*-\s*/.test(props.options[0].label)
      ) {
        return props.options;
      }
      node = node.return;
    }
    return null;
  }

  let chartOfAccountsLoaded = false;
  let lastChartAttemptAt = 0;
  let chartAttemptCount = 0;
  const CHART_MAX_ATTEMPTS = 30; // ~ jusqu'à 90s d'essais (throttle 3s) avant abandon définitif
  function absorbFullChartOfAccounts() {
    if (chartOfAccountsLoaded) return true;
    if (chartAttemptCount >= CHART_MAX_ATTEMPTS) return false;
    // BUG CORRIGÉ (2026-08-02, v2.9) : tant que la résolution échouait, cette
    // fonction était retentée à CHAQUE scan (~1x/seconde, cf. premium.js),
    // et scanne potentiellement des dizaines de <input> avec une remontée de
    // fibre React (jusqu'à 30 niveaux) pour chacun — un coût qui s'additionne
    // indéfiniment tant que le plan comptable n'est pas trouvé. App constatée
    // figée (UI totalement non réactive) après quelques minutes d'usage réel
    // avec ce échec permanent en boucle serrée — cause très probable. Fix :
    // on n'retente plus qu'au maximum 1 fois toutes les 3 secondes.
    const now = Date.now();
    if (now - lastChartAttemptAt < 3000) return false;
    lastChartAttemptAt = now;
    chartAttemptCount++;
    // BUG CORRIGÉ (2026-08-02, v2.8) : la recherche par libellé exact "N°
    // Compte" (v2.3-v2.7) fonctionnait en test Chrome mais échouait en usage
    // réel Electron (confirmé par log : chartOfAccountsLoaded=false,
    // size=5 — aucun candidat >=100 jamais trouvé), probablement à cause
    // d'une mise en page différente (fenêtre plus étroite, accordéon monté
    // différemment...) où le texte du libellé ou sa structure DOM ne
    // correspond pas exactement à ce qui a été observé côté Chrome. Fix
    // radical, sans dépendre d'aucun texte de libellé : on scanne TOUS les
    // <input> de la page et on retient celui dont la fibre React expose le
    // plus grand nombre de comptes — ne dépend plus que de la vraie donnée
    // (options[].account_number), jamais d'un texte d'interface qui peut
    // varier selon le layout.
    const inputs = Array.from(document.querySelectorAll('input'));
    let best = null;
    let bestInput = null;
    for (const input of inputs) {
      const options = findAccountOptionsViaFiber(input);
      if (options && (!best || options.length > best.length)) {
        best = options;
        bestInput = input;
      }
    }
    console.debug(
      '[Saisie Premium] absorbFullChartOfAccounts : ' + inputs.length + ' <input> scannés, meilleur =',
      best ? best.length : null,
      bestInput
    );
    // Garde-fou : le plan comptable complet compte forcément plusieurs
    // centaines de comptes — un résultat trop petit signale qu'on n'a
    // trouvé qu'un sous-ensemble contextuel, pas encore le bon champ (les
    // champs natifs ne sont peut-être pas tous montés à ce tick) ; dans ce
    // cas on retente au prochain scan plutôt que de figer un cache partiel.
    if (!best || best.length < 100) {
      if (chartAttemptCount >= CHART_MAX_ATTEMPTS) {
        console.warn('[Saisie Premium] plan comptable introuvable après ' + CHART_MAX_ATTEMPTS + ' essais — abandon (les suggestions de compte resteront limitées aux écritures déjà vues). Diagnostic : ' + inputs.length + ' <input> testés, meilleur résultat = ' + (best ? best.length : 0) + '.');
      } else {
        console.debug('[Saisie Premium] plan comptable non retenu (meilleur trouvé:', best ? best.length : 0, '< 100), essai', chartAttemptCount, '/', CHART_MAX_ATTEMPTS);
      }
      return false;
    }
    best.forEach((o) => {
      if (o.account_number && o.account_id) {
        accountCache.set(o.account_number, { account_id: o.account_id, label: o.account_label || o.label || '' });
      }
    });
    chartOfAccountsLoaded = true;
    console.debug('[Saisie Premium] plan comptable chargé:', best.length, 'comptes, dont 471000 ?', accountCache.has('471000'));
    return true;
  }

  // Rappel manuel pour diagnostic en direct depuis les DevTools de l'appli
  // (Ctrl+Shift+I) : `window.tmbcDebugAccounts()` réaffiche l'état courant du
  // cache sans attendre le prochain scan.
  window.tmbcDebugAccounts = function () {
    console.log('[Saisie Premium] chartOfAccountsLoaded =', chartOfAccountsLoaded, '— accountCache.size =', accountCache.size, '— has 471000 ?', accountCache.has('471000'));
    return { chartOfAccountsLoaded, size: accountCache.size, has471000: accountCache.has('471000') };
  };

  // --- Filtre historique natif (Du/Au/Journaux, masqués) + interception ---

  let lastEntriesResponse = null;

  // BUG CORRIGÉ (2026-08-02, v1.7) : l'appli garde plusieurs onglets de
  // société montés simultanément — le patch XHR est global à la page et
  // peut capturer une réponse "/entries" sans rapport avec la sélection en
  // cours (autre onglet, rafraîchissement de fond). On ne considère une
  // réponse valable que si elle correspond au journal + à la période
  // actuellement sélectionnés (code du journal + mois/année de la première
  // écriture reçue — une réponse vide n'a rien à vérifier, acceptée telle
  // quelle).
  let currentFilterJournalCode = null;
  let currentFilterPeriod = null;

  function responseMatchesCurrentFilter(data) {
    if (!currentFilterJournalCode || !currentFilterPeriod) return false;
    const entries = data && Array.isArray(data.entry_array) ? data.entry_array : [];
    if (entries.length === 0) return true;
    const first = entries[0];
    const code = first.diary && first.diary.code;
    if (code && code !== currentFilterJournalCode) return false;
    const m = /^(\d{2})\/(\d{4})$/.exec(currentFilterPeriod);
    if (m && first.date_piece) {
      const prefix = m[2] + '-' + m[1];
      if (!String(first.date_piece).startsWith(prefix)) return false;
    }
    return true;
  }

  function installEntriesSniffer() {
    if (window.__tmbcEntriesPatched) return;
    window.__tmbcEntriesPatched = true;
    const _open = XMLHttpRequest.prototype.open;
    const _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__tmbcIsEntries = typeof url === 'string' && url.indexOf('/entries') !== -1;
      return _open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      if (this.__tmbcIsEntries) {
        this.addEventListener('load', () => {
          try {
            const data = JSON.parse(this.responseText);
            absorbEntriesIntoCache(data);
            if (responseMatchesCurrentFilter(data)) {
              lastEntriesResponse = data;
              window.__tmbcLastEntries = data;
              // BUG CORRIGÉ (2026-08-04, v2.37, diagnostiqué via logs
              // [DEBUG] pointerdown/focusin : de nombreux clics sur
              // INPUT[0-label] n'aboutissaient JAMAIS à un focusin,
              // pendant ~30-40s) — l'appli native repolle /entries en
              // arrière-plan en continu (indépendamment de toute action de
              // Nicolas) ; CHAQUE réponse déclenchait ici un renderTable()
              // COMPLET, qui détruit et recrée tous les <input> du
              // tableau, y compris la ligne en cours d'édition
              // (buildDraftRows()). Le clic de Nicolas arrivait donc très
              // souvent entre la destruction et la recréation de l'input
              // ciblé, ou juste avant qu'un nouveau poll ne le remplace —
              // d'où l'attente pouvant aller jusqu'à ~10s (le temps qu'un
              // clic tombe enfin dans une fenêtre sans repoll). Fix :
              // pendant toute l'édition (editingEntryId !== null), on garde
              // lastEntriesResponse à jour (pour ne rien perdre au moment
              // où l'édition se termine) mais on NE reconstruit PLUS le
              // tableau tant que l'édition est en cours.
              const tbody = document.getElementById('tmbc-sp-tbody');
              if (tbody && editingEntryId === null) renderTable();
            }
          } catch (e) {
            /* réponse non-JSON ou vide : ignorée */
          }
        });
      }
      return _send.apply(this, arguments);
    };
  }

  async function applyNativeHistoryFilters(journalLabel, periodDisplay) {
    const m = /^(\d{2})\/(\d{4})$/.exec(periodDisplay || '');
    if (!m) return false;
    const mm = m[1];
    const aaaa = m[2];
    const month = parseInt(mm, 10);
    const year = parseInt(aaaa, 10);
    const lastDay = new Date(year, month, 0).getDate();
    const du = '01/' + mm + '/' + aaaa;
    const au = String(lastDay).padStart(2, '0') + '/' + mm + '/' + aaaa;

    const duInput = findVisibleInputByName('start_date');
    const auInput = findVisibleInputByName('end_date');
    if (!duInput || !auInput) return false;
    setNativeValue(duInput, du);
    setNativeValue(auInput, au);

    const journauxField = findLabelInput('Journaux');
    if (journauxField) {
      let guard = 0;
      while (guard < 10) {
        const deleteIcon = journauxField.container.querySelector('.MuiChip-deleteIcon');
        if (!deleteIcon) break;
        // BUG CORRIGÉ (2026-08-02) : .MuiChip-deleteIcon est un <svg> — SVGElement
        // n'a pas de méthode .click() (seul HTMLElement en a une), d'où le crash
        // "deleteIcon.click is not a function". On déclenche un vrai clic via
        // MouseEvent, qui fonctionne sur n'importe quel élément du DOM.
        deleteIcon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await sleep(80);
        guard++;
      }
      journauxField.input.focus();
      setNativeValue(journauxField.input, journalLabel);
      const option = await waitFor(() => {
        const listbox = document.querySelector('.MuiAutocomplete-listbox');
        if (!listbox) return null;
        return (
          Array.from(listbox.querySelectorAll('[role="option"], li')).find((o) => o.textContent.trim() === journalLabel) ||
          null
        );
      }, 2000, 100);
      if (option) {
        option.click();
        await sleep(150);
      } else {
        journauxField.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      }
    }

    const applyBtn = findButtonByText('Appliquer les filtres');
    if (!applyBtn) return false;
    lastEntriesResponse = null;
    applyBtn.click();
    const got = await waitFor(
      () => lastEntriesResponse && responseMatchesCurrentFilter(lastEntriesResponse) && lastEntriesResponse,
      8000,
      150
    );
    return !!got;
  }

  // Élargit la recherche à TOUT l'exercice pour un journal donné — utilisé
  // uniquement pour pré-remplir le cache diary_id/account_id quand le
  // journal/la période choisis n'ont encore aucune écriture connue dans la
  // fenêtre filtrée normale. Ne modifie jamais l'affichage courant.
  async function widenCacheSearch(journalLabel) {
    const duInput = findVisibleInputByName('start_date');
    const auInput = findVisibleInputByName('end_date');
    if (!duInput || !auInput) return;
    setNativeValue(duInput, '01/01/2000');
    setNativeValue(auInput, '31/12/2099');
    const applyBtn = findButtonByText('Appliquer les filtres');
    if (!applyBtn) return;
    const before = currentFilterJournalCode;
    currentFilterJournalCode = journalLabel.split(/\s*-\s*/)[0].trim();
    // fenêtre large : on ne peut pas prédire la période exacte des écritures
    // trouvées, donc on désactive temporairement la vérification de période
    // pour ce sondage (currentFilterPeriod reste tel quel, mais l'appel se
    // contente d'attendre une réponse avec le bon code journal).
    const savedPeriod = currentFilterPeriod;
    currentFilterPeriod = null;
    await sleep(50);
    lastEntriesResponse = null;
    applyBtn.click();
    await waitFor(() => lastEntriesResponse, 5000, 150);
    currentFilterJournalCode = before;
    currentFilterPeriod = savedPeriod;
  }

  // NOUVEAU (2026-08-02, v2.11) : résolution directe du diary_id via le prop
  // React `options` du champ natif "Journal" (cf. findJournalOptionsViaFiber),
  // en ouvrant brièvement son dropdown pour peupler ce prop (constaté en
  // direct : vide tant que le dropdown n'a jamais été ouvert), puis en le
  // refermant aussitôt sans rien changer visuellement à l'écran. Fonctionne
  // MÊME si le journal choisi n'a encore aucune écriture dans l'exercice —
  // ce que widenCacheSearch() (basé sur l'historique) ne peut pas couvrir.
  async function resolveDiaryIdViaFiber(journalLabel) {
    const code = journalLabel.split(/\s*-\s*/)[0].trim();
    const journalField = findLabelInput('Journal');
    if (!journalField) return null;
    const input = journalField.input;
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    await sleep(250);
    const options = findJournalOptionsViaFiber(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    await sleep(100);
    if (!options) return null;
    const match =
      options.find((o) => o.label === journalLabel) ||
      options.find((o) => String(o.label).split(/\s*-\s*/)[0].trim() === code) ||
      null;
    if (match && typeof match.value !== 'undefined') {
      diaryCache.set(code, match.value);
      return match.value;
    }
    return null;
  }

  async function resolveDiaryId(journalLabel) {
    const code = journalLabel.split(/\s*-\s*/)[0].trim();
    if (diaryCache.has(code)) return diaryCache.get(code);
    // v2.11 : essai direct via fibre React AVANT le fallback historique — plus
    // fiable (fonctionne même sans écriture existante) et plus rapide (pas de
    // rechargement de la table avec une fenêtre de dates 2000-2099).
    const viaFiber = await resolveDiaryIdViaFiber(journalLabel);
    if (viaFiber) return viaFiber;
    await widenCacheSearch(journalLabel);
    return diaryCache.get(code) || null;
  }

  function resolveAccount(accountNumber) {
    return accountCache.get(accountNumber) || null;
  }

  // --- Écriture d'une nouvelle ligne (POST /entry) ------------------------

  // OBSERVÉ sur le seul test réalisé (cf. en-tête du fichier) : period_from
  // = date_piece moins 1 mois calendaire, period_to = date_piece. Reproduit
  // à l'identique, JAMAIS deviné au-delà de cette observation — à
  // reconsidérer si un usage réel montre un comportement serveur inattendu
  // avec cette valeur (Nicolas signalera si un souci apparaît).
  //
  // BUG CORRIGÉ (2026-08-02, v2.12) : comparaison en direct avec le payload
  // RÉEL envoyé par la saisie standard (sniffé pendant un test sur le même
  // journal vide "02 - VENTES") a révélé que period_from calculé ici sortait
  // décalé d'un jour (ex. "2025-05-29" au lieu de "2025-05-30" attendu et
  // confirmé par la saisie standard) — cause : `new Date(...).toISOString()`
  // convertit en UTC, et en France (UTC+1/+2) minuit local recule d'un jour
  // une fois converti en UTC. Fix : on calcule le mois précédent PUIS on
  // formate en LOCAL (getFullYear/getMonth/getDate), sans jamais passer par
  // toISOString() pour une date locale.
  function computePeriodFromTo(datePieceIso) {
    const d = new Date(datePieceIso + 'T00:00:00');
    const from = new Date(d);
    from.setMonth(from.getMonth() - 1);
    const localIso = (dt) =>
      dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    return { period_from: localIso(from), period_to: datePieceIso };
  }

  function parseAmount(raw) {
    const s = String(raw || '').trim().replace(/\s/g, '').replace(',', '.');
    if (!s) return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  async function createEntry(diaryId, datePieceIso, lines) {
    const { period_from, period_to } = computePeriodFromTo(datePieceIso);
    const todayIso = new Date().toISOString().slice(0, 10);
    const body = {
      date_piece: datePieceIso,
      etablissement_id: currentEtablissementId(),
      period_from,
      period_to,
      diary_id: diaryId,
      pj_list: [],
      entry_list: lines.map((l) => ({
        currency: 'EUR',
        date_entry: todayIso,
        account_id: l.accountId,
        account_number: l.accountNumber,
        account: { account_id: l.accountId, account_number: l.accountNumber, label: l.label },
        label: l.label,
        debit: l.debit,
        credit: l.credit,
        payment_type_id: null,
        piece: l.piece || '',
        piece2: l.piece2 || '',
        flags: {},
      })),
    };
    const headers = Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders() || {});
    // BUG CORRIGÉ (2026-08-02, v2.12) : sniffing en direct du POST /entry réel
    // envoyé par la saisie standard (même journal vide, même compte, test
    // comparatif) a révélé qu'il cible `/entry?type=e` — PAS `/entry` seul.
    // C'est très probablement la vraie cause du 500 générique "GBL1" observé
    // jusqu'ici (le endpoint sans le paramètre de type semble être rejeté
    // silencieusement côté serveur, sans détail exploitable). Reproduit à
    // l'identique, jamais deviné : `type=e` confirmé tel quel dans la requête
    // native capturée.
    const res = await fetch('https://prod-ws.myunisoft.fr/entry?type=e', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include',
    });
    if (!res.ok) {
      // BUG CORRIGÉ (2026-08-02) : en cas d'échec (ex. 500 constaté en test
      // réel), on ne remontait que "HTTP 500" — aucune info exploitable pour
      // diagnostiquer sans deviner. Le corps de la réponse d'erreur du
      // serveur (souvent {"code":..., "message":...}, cf. TOKENERROR observé
      // plus tôt) est maintenant lu et inclus dans le message affiché à
      // l'écran, pour un vrai diagnostic la prochaine fois plutôt qu'une
      // boîte noire.
      let detail = '';
      try {
        detail = await res.text();
      } catch (e) {
        /* corps illisible : on garde juste le code HTTP */
      }
      throw new Error('HTTP ' + res.status + (detail ? ' — ' + detail.slice(0, 300) : ''));
    }
    return res.json();
  }

  // --- Suppression d'une écriture existante (DELETE /entry) ---------------

  // NOUVEAU (2026-08-02, v2.17) : sniffé en direct (Claude in Chrome + DevTools,
  // dossier CHAPI 1, clic droit natif > Supprimer sur une VRAIE écriture de
  // test — journal AC, 12/2025, 100€ compte d'attente 471000/472000, avec
  // l'accord explicite de Nicolas pour confirmer la suppression) :
  //   DELETE https://prod-ws.myunisoft.fr/entry
  //   Corps : {"entry": [{"entry_id": <int>}]}
  //   Réponse observée : `true` (pas d'entry_array, contrairement à POST /entry
  //   — donc pas de rafraîchissement direct possible depuis la réponse ;
  //   l'appelant doit retirer l'écriture du cache local lui-même après un
  //   `true`, cf. wireHistoryContextMenu()).
  // Jamais deviné au-delà de cette seule observation confirmée en direct.
  // v2.31 (demande explicite : "si je selectionne plusieurs écritures avec
  // la case à cocher et que je fais supprimer, il faut supprimer les
  // ecritures cochés, pas seulement une") — le corps sniffé en direct
  // ({"entry":[{"entry_id":<int>}]}) est déjà un TABLEAU ; on l'utilise tel
  // quel avec plusieurs éléments plutôt que de deviner une nouvelle route,
  // c'est la forme exacte déjà confirmée, juste avec plus d'un item.
  // deleteEntry() garde son ancienne signature (un seul id) pour ne rien
  // casser ailleurs ; deleteEntries() accepte un tableau.
  async function deleteEntries(entryIds) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders() || {});
    const res = await fetch('https://prod-ws.myunisoft.fr/entry', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ entry: entryIds.map((id) => ({ entry_id: id })) }),
      credentials: 'include',
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch (e) {
        /* corps illisible : on garde juste le code HTTP */
      }
      throw new Error('HTTP ' + res.status + (detail ? ' — ' + detail.slice(0, 300) : ''));
    }
    return res.json().catch(() => true);
  }

  async function deleteEntry(entryId) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders() || {});
    const res = await fetch('https://prod-ws.myunisoft.fr/entry', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ entry: [{ entry_id: entryId }] }),
      credentials: 'include',
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch (e) {
        /* corps illisible : on garde juste le code HTTP */
      }
      throw new Error('HTTP ' + res.status + (detail ? ' — ' + detail.slice(0, 300) : ''));
    }
    const data = await res.json().catch(() => null);
    return data === true;
  }

  // NOUVEAU (2026-08-04, demande explicite : "rajoute la possibilité de
  // rajouter un commentaire sur une ligne") — API reniflée en direct depuis
  // la Saisie standard native (jamais devinée), sur l'écriture 401AMAZONEU
  // (entry_id 7428086, dossier MANO) :
  //   GET  https://prod-ws.myunisoft.fr/comments?entry_id=<int>
  //     -> tableau de commentaires {id, body (HTML), date, name, origin,
  //        history, initials, avatarImgSrc}
  //   POST https://prod-ws.myunisoft.fr/comments
  //     Corps : {location:"ENTRIES", entry_id:<int>, society_id:<int>,
  //              comment:"<p>...</p>", summary:false}
  //     -> renvoie le tableau de commentaires à jour (même forme que le GET)
  // Confirmé que l'icône "Comm." de la Saisie standard n'est active QUE sur
  // la 1ère ligne de chaque lot d'écriture (comme Jour/Pj.) — un clic sur les
  // lignes suivantes du même lot ne fait rien côté natif ; entry_id est donc
  // bien celui de l'ÉCRITURE entière (le même que celui utilisé par
  // deleteEntry ci-dessus), pas un id de ligne individuelle.
  async function fetchComments(entryId) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders() || {});
    const res = await fetch('https://prod-ws.myunisoft.fr/comments?entry_id=' + entryId, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json().catch(() => null);
    return Array.isArray(data) ? data : [];
  }

  // --- Upload de pièce jointe (POST /document/add_all_types) --------------
  // CONFIRMÉ EN DIRECT (2026-08-04, dossier MANO, entry_id=7428298,
  // test1.txt) : status 200, réponse {"etat":true,"document_id":...,
  // "name":"test1.txt","link":"https://app.myunisoft.fr/api/ged/ged/document/
  // ...","download":"...","thumbnail":"..."} — fichier vérifié réellement
  // persisté (relu ensuite avec succès depuis Consultation de compte). Route
  // et noms de paramètres (location, object_id, filename_extension,
  // type_result) confirmés par la doc officielle API Partenaires
  // (https://partners.api.myunisoft.fr/accounting/folder/import/pj.html, qui
  // documente POST https://api.myunisoft.fr/api/v1/document/add_all_types
  // avec auth X-Third-Party-Secret + Bearer réservée aux intégrations
  // tierces) — MAIS appelée ici sur prod-ws.myunisoft.fr (domaine interne de
  // l'appli desktop) avec l'auth de session habituelle (getApiHeaders(),
  // comme /comments), sans avoir besoin d'une clé Partenaire. Corps de la
  // requête = octets bruts du fichier (Content-Type: application/octet-stream,
  // PAS de multipart/form-data).
  async function uploadAttachment(entryId, file) {
    const headers = Object.assign(
      { 'Content-Type': 'application/octet-stream' },
      getApiHeaders() || {}
    );
    const qs =
      'location=ENTRIES&object_id=' +
      encodeURIComponent(entryId) +
      '&filename_extension=' +
      encodeURIComponent(file.name) +
      '&type_result=1';
    const buf = await file.arrayBuffer();
    const res = await fetch('https://prod-ws.myunisoft.fr/document/add_all_types?' + qs, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: buf,
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch (e) {}
      throw new Error('HTTP ' + res.status + (detail ? ' — ' + detail.slice(0, 300) : ''));
    }
    const data = await res.json().catch(() => null);
    return data;
  }
  // --- FIN upload pièce jointe ---------------------------------------------

  // NOUVEAU (2026-08-04, v2.43, retour direct confirmant l'hypothèse CSP :
  // "échec réseau (CSP ?) en récupérant le fichier depuis
  // https://app.myunisoft.fr") — fetch()/XHR sont gouvernés par la directive
  // CSP connect-src, qui ne semble autoriser QUE prod-ws.myunisoft.fr (seul
  // domaine utilisé par tous nos autres appels confirmés). app.myunisoft.fr
  // (domaine du lien de téléchargement des PJ) en est donc exclu. Une balise
  // <img> est en revanche gouvernée par la directive img-src, généralement
  // moins restrictive — on tente ce contournement UNIQUEMENT pour les PJ de
  // type image (déduit de l'extension du nom de fichier ; les PDF/autres
  // formats ne peuvent pas passer par ce chemin, canvas ne sachant dessiner
  // que des images). Si le serveur ne renvoie pas d'en-tête CORS
  // (Access-Control-Allow-Origin), le canvas sera "tainted" et toBlob()
  // échouera avec une SecurityError — dans ce cas on remonte l'échec tel
  // quel, sans rien fabriquer.
  function isLikelyImageFilename(name) {
    return /\.(jpe?g|png|gif|webp|bmp)$/i.test(String(name || ''));
  }
  function fetchImageBlobViaImgTag(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('toBlob() a échoué (canvas vide ?)'));
          }, 'image/jpeg');
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('échec de chargement de l\'image (img-src bloqué aussi ?)'));
      img.src = url;
    });
  }

  // Compteurs de pièces jointes par entry_id.
  // MIS À JOUR (2026-08-04, v2.52) : LIMITATION LEVÉE — contrairement à ce
  // qui était noté ici jusqu'à présent (aucune route de listing trouvée en
  // sniffant les appels d'UPLOAD), la réponse de /entries elle-même contient
  // en réalité un champ "pj_list" par écriture (trouvé en sniffant le réseau
  // pendant l'ouverture d'une PJ existante depuis la Saisie standard native,
  // pas depuis un upload) — cf. entries.forEach() dans renderTable(), qui
  // synchronise maintenant pjCounts/pjDocs avec cette donnée serveur à
  // CHAQUE rendu. Ce Map sert quand même de source d'affichage immédiate
  // (retour visuel instantané juste après un upload, avant même le prochain
  // rafraîchissement de /entries).
  const pjCounts = new Map();
  const commentCounts = new Map();

  async function postComment(entryId, html) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders() || {});
    const res = await fetch('https://prod-ws.myunisoft.fr/comments', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        location: 'ENTRIES',
        entry_id: entryId,
        society_id: currentEtablissementId(),
        comment: html,
        summary: false,
      }),
    });
  if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json().catch(() => null);
    return Array.isArray(data) ? data : [];
  }

  // NOUVEAU (v2.29, demande explicite : "je veux pouvoir supprimer un
  // commentaire") — NON CONFIRMÉ EN DIRECT, à tester par Nicolas (comme
  // l'a été uploadAttachment() avant sa promotion en fonction "officielle").
  // La doc Partenaires (entry_comment.md) documente DELETE
  // https://api.myunisoft.fr/api/v1/entry/comment/:comment_id (domaine
  // Partenaires, auth X-Third-Party-Secret + Bearer). Notre domaine interne
  // utilise /comments (pluriel, sans préfixe /entry) pour GET/POST — on
  // applique ici la même logique (retirer le préfixe /entry, garder le
  // comment_id dans le CHEMIN comme documenté) : DELETE /comments/:id. Si ça
  // échoue (404/405...), le message d'erreur exact remonte à l'écran pour
  // ajuster sans deviner davantage.
  async function deleteComment(commentId) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders() || {});
    const res = await fetch('https://prod-ws.myunisoft.fr/comments/' + commentId, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch (e) {}
      throw new Error('HTTP ' + res.status + (detail ? ' — ' + detail.slice(0, 300) : ''));
    }
    return true;
  }

  // NOUVEAU (v2.29, demande explicite : "je peux ajouter une piece jointe,
  // mais je veux aussi voir si pj déjà lié à une écriture") — deux volets :
  // (1) pjDocs : mémorise, pour CETTE session, les métadonnées (nom + lien
  //     de visualisation) renvoyées par uploadAttachment() à chaque envoi
  //     réussi — permet de RE-consulter un fichier tout juste ajouté sans
  //     deviner de route de lecture ;
  // (2) probeExistingAttachments() : tentative expérimentale (NON confirmée)
  //     de lister les PJ déjà existantes sur une écriture (y compris celles
  //     ajoutées via la Saisie standard native, hors de cette session) — par
  //     symétrie avec l'upload (GET au lieu de POST sur la même route). À
  //     tester en direct par Nicolas : si ça échoue, on le saura clairement
  //     (message d'erreur affiché) plutôt que de fabriquer un faux résultat.
  const pjDocs = new Map();
  async function probeExistingAttachments(entryId) {
    const headers = Object.assign({}, getApiHeaders() || {});
    const qs = 'location=ENTRIES&object_id=' + encodeURIComponent(entryId);
    const res = await fetch('https://prod-ws.myunisoft.fr/document/add_all_types?' + qs, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, ok: res.ok, text: text.slice(0, 800) };
  }

  // NOUVEAU (v2.27) : icônes 💬N / 📎N avec compteur, cf. commentCounts/
  // pjCounts déclarés plus haut.
  function renderCommentBadge(entryId) {
    const n = entryId !== undefined && entryId !== null ? commentCounts.get(entryId) : undefined;
    return n ? '💬' + n : '💬';
  }
  function renderPjBadge(entryId) {
    const n = entryId !== undefined && entryId !== null ? pjCounts.get(entryId) : undefined;
    return n ? '📎' + n : '📎';
  }

  // Récupère en arrière-plan (non bloquant pour renderTable) le nombre de
  // commentaires de chaque écriture visible, et met à jour les badges déjà
  // affichés à l'écran une fois la réponse connue (par entry_id, via
  // data-tmbc-comment-btn — pas de re-render complet du tableau, pour éviter
  // de perdre le focus/curseur en cours de saisie pendant l'appel réseau).
  const commentCountsFetched = new Set();
  async function prefetchCommentCounts(entryIds) {
    for (const entryId of entryIds) {
      if (entryId === undefined || entryId === null) continue;
      if (commentCountsFetched.has(entryId)) continue;
      commentCountsFetched.add(entryId);
      try {
        const comments = await fetchComments(entryId);
        commentCounts.set(entryId, comments.length);
        const btn = document.querySelector('[data-tmbc-comment-btn="' + entryId + '"]');
        if (btn) btn.textContent = renderCommentBadge(entryId);
      } catch (e) {
        /* échec silencieux : le badge reste sans compteur, pas bloquant */
      }
    }
  }

  // --- Période de cut-off CCA/PCA (v2.57) ----------------------------------
  // cf. changelog en tête de fichier pour le détail des 3 appels sniffés en
  // direct. formatDateFr() : "YYYY-MM-DD" (ISO, format renvoyé par les 3
  // endpoints) -> "DD/MM/YYYY" (cohérent avec le reste de l'appli, ex.
  // placeholder "jj/mm/aaaa" de la colonne Echéance).
  function formatDateFr(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  // NOTE (v2.58) : sur échec HTTP (ex. token expiré -> 400 TOKENERROR,
  // confirmé en direct via la console : {"code":"TOKENERROR","message":
  // "Token expir...")) ou échec réseau, on NE mémorise PAS le résultat —
  // on réinitialise la promise à null pour permettre un nouvel essai au
  // prochain appel (renderTable() en relance régulièrement). Avant ce
  // correctif, un seul échec (ex. token expiré au moment précis du tout
  // premier appel) restait mémorisé pour toute la session -> colonnes
  // Début/Fin bloquées vides indéfiniment (bug remonté par Nicolas).
  let worksheetParamsPromise = null;
  function fetchWorksheetParams() {
    if (worksheetParamsPromise) return worksheetParamsPromise;
    const headers = Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders() || {});
    worksheetParamsPromise = fetch('https://prod-ws.myunisoft.fr/worksheet/param', {
      headers,
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status))))
      .then((data) => (Array.isArray(data) ? data : []))
      .catch((e) => {
        worksheetParamsPromise = null;
        throw e;
      });
    return worksheetParamsPromise;
  }

  let dossierRevisionListPromise = null;
  function fetchDossierRevisionList() {
    if (dossierRevisionListPromise) return dossierRevisionListPromise;
    const headers = Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders() || {});
    dossierRevisionListPromise = fetch('https://prod-ws.myunisoft.fr/dadp/dossier_revision_list?balance=true', {
      headers,
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status))))
      // BUG CORRIGÉ (2026-08-05, v2.59) : la réponse réelle est un OBJET
      // {"dossier_revision_list": [...]}, PAS un tableau nu — confirmé en
      // direct (console, sur l'écran Révision > Cut-off > CCA après
      // changement d'exercice pour forcer un jeton frais). Le code
      // précédent testait Array.isArray(data) sur l'objet entier, donc
      // renvoyait TOUJOURS [] (silencieusement, aucune erreur HTTP) même
      // quand l'appel réussissait avec de vraies données — cause racine du
      // bug "les colonnes Début/Fin restent vides" (paramEntry/wt trouvés,
      // mais "dossier" jamais trouvé car dossierList était toujours vide).
      .then((data) => (data && Array.isArray(data.dossier_revision_list) ? data.dossier_revision_list : []))
      .catch((e) => {
        dossierRevisionListPromise = null;
        throw e;
      });
    return dossierRevisionListPromise;
  }

  // Cache par (id_dossier_revision, id_worksheet_type) — un seul appel
  // réseau par combinaison exercice/type de flag rencontrée, même si
  // plusieurs lignes du tableau en dépendent.
  const worksheetBillsCache = new Map();
  function fetchWorksheetBills(idDossierRevision, idParamAccountWorksheet, idWorksheetType) {
    const key = idDossierRevision + '|' + idWorksheetType;
    if (worksheetBillsCache.has(key)) return worksheetBillsCache.get(key);
    const headers = Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders() || {});
    const qs =
      'id_param_account_worksheet=' + encodeURIComponent(idParamAccountWorksheet) +
      '&id_worksheet_type=' + encodeURIComponent(idWorksheetType) +
      '&id_dossier_revision=' + encodeURIComponent(idDossierRevision) +
      '&limit=1000000&offset=0';
    const p = fetch('https://prod-ws.myunisoft.fr/worksheet/bills?' + qs, { headers, credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status))))
      .then((data) => (data && Array.isArray(data.bills) ? data.bills : []))
      .catch((e) => {
        worksheetBillsCache.delete(key);
        throw e;
      });
    worksheetBillsCache.set(key, p);
    return p;
  }

  // cutoffPeriodCache : "entryId|lineIdx" -> {start, end} (ISO) | null (déjà
  // cherché, pas de correspondance trouvée). cutoffLookupInFlight évite de
  // relancer la même résolution en double pendant qu'elle est déjà en cours
  // (renderTable() est appelé souvent — polling /entries en arrière-plan,
  // tri, etc.).
  const cutoffPeriodCache = new Map();
  const cutoffLookupInFlight = new Set();

  async function resolveCutoffPeriod(entry, line, entryId, lineIdx) {
    const code = Array.isArray(line.flags) ? line.flags.find((f) => f === 'CCA' || f === 'PCA') : null;
    if (!code) return;
    const cacheKey = entryId + '|' + lineIdx;
    if (cutoffPeriodCache.has(cacheKey) || cutoffLookupInFlight.has(cacheKey)) {
      return;
    }
    cutoffLookupInFlight.add(cacheKey);
    try {
      const [params, dossierList] = await Promise.all([fetchWorksheetParams(), fetchDossierRevisionList()]);
      console.debug('[TMBC-CUTOFF]', cacheKey, 'params=', params.length, 'dossierList=', dossierList.length);
      const paramEntry = params.find(
        (p) => Array.isArray(p.worksheet_type) && p.worksheet_type.some((wt) => wt.code === code)
      );
      const wt = paramEntry && paramEntry.worksheet_type.find((w) => w.code === code);
      const datePiece = entry.date_piece || '';
      const dossier = dossierList.find(
        (d) =>
          d.type && d.type.code === 'BIL' && d.start_date && d.end_date && d.start_date <= datePiece && datePiece <= d.end_date
      );
      console.debug('[TMBC-CUTOFF]', cacheKey, 'paramEntry=', paramEntry, 'wt=', wt, 'datePiece=', datePiece, 'dossier=', dossier);
      let result = null;
      if (paramEntry && wt && dossier) {
        const bills = await fetchWorksheetBills(dossier.id_dossier_revision, paramEntry.id_param_account_worksheet, wt.id_worksheet_type);
        const amount = line.debit !== undefined && line.debit !== null ? line.debit : line.credit;
        const accountNumber = line.account && line.account.account_number;
        console.debug('[TMBC-CUTOFF]', cacheKey, 'bills=', bills.length, 'amount=', amount, 'accountNumber=', accountNumber, bills);
        const match = bills.find((b) => {
          const acctOk = b.worksheet_account && b.worksheet_account.number === accountNumber;
          const dateOk = b.date === datePiece;
          const amountOk = Math.abs((b.total_incl_taxes || 0) - (amount || 0)) < 0.01;
          return acctOk && dateOk && amountOk;
        });
        console.debug('[TMBC-CUTOFF]', cacheKey, 'match=', match);
        if (match) result = { start: match.start_period, end: match.end_period };
      } else {
        console.debug('[TMBC-CUTOFF]', cacheKey, 'SKIP bills fetch : paramEntry/wt/dossier manquant');
      }
      cutoffPeriodCache.set(cacheKey, result);
      const startEl = document.querySelector('[data-tmbc-cutoff-start="' + cacheKey + '"]');
      if (startEl) startEl.textContent = result ? formatDateFr(result.start) : '';
      const endEl = document.querySelector('[data-tmbc-cutoff-end="' + cacheKey + '"]');
      if (endEl) endEl.textContent = result ? formatDateFr(result.end) : '';
    } catch (e) {
      // Echec réseau/HTTP (ex. token expiré) : on NE met PAS cutoffPeriodCache
      // à jour, pour que le prochain passage de renderTable() retente la
      // résolution au lieu de rester bloqué sur un résultat vide définitif.
      console.debug('[Saisie Premium] resolveCutoffPeriod : échec (nouvel essai au prochain rendu)', cacheKey, e);
    } finally {
      cutoffLookupInFlight.delete(cacheKey);
    }
  }

  // Ouvre un sélecteur de fichier natif puis upload immédiatement sur
  // l'écriture existante donnée (uploadAttachment()). Met à jour le badge
  // localement (pjCounts) et mémorise le lien de visualisation renvoyé par
  // le serveur (pjDocs) une fois l'upload confirmé.
  function pickFileAndUpload(entryId, onDone) {
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      document.body.removeChild(input);
      if (!file) return;
      try {
        const data = await uploadAttachment(entryId, file);
        pjCounts.set(entryId, (pjCounts.get(entryId) || 0) + 1);
        const list = pjDocs.get(entryId) || [];
        // BUG CORRIGÉ (v2.30, retour direct : "import possible mais pas de
        // prévisualisation, regarde pour mettre en place (comme pour saisie
        // standard)") — on stockait `download` en priorité sur `link`, ce
        // qui déclenchait un téléchargement direct au lieu d'ouvrir la page
        // d'aperçu. `link` (https://app.myunisoft.fr/api/ged/ged/document/
        // <id>) EST la même page que la Saisie standard native ouvre pour
        // son icône Pj (identique à ce qu'on a observé en direct avec
        // Nicolas : aperçu image/PDF si dispo, sinon "aperçu non
        // disponible" + bouton Télécharger) — c'est donc exactement le
        // comportement "comme pour saisie standard" demandé, à condition
        // d'ouvrir CE lien-là et pas le lien de téléchargement direct.
        list.push({
          name: (data && data.name) || file.name,
          previewLink: data && data.link,
          downloadLink: data && data.download,
          // v2.32 (demande explicite : "possible de voir la piece jointe
          // juste en survolant l'icone PJ de l'écriture ?") — thumbnail
          // renvoyé par le serveur au moment de l'upload (cf. réponse brute
          // testée en direct par Nicolas : champ "thumbnail"), utilisé pour
          // l'aperçu au survol (cf. pjHoverPreview()).
          thumbnail: data && data.thumbnail,
        });
        pjDocs.set(entryId, list);
        const btn = document.querySelector('[data-tmbc-pj-btn="' + entryId + '"]');
        if (btn) btn.textContent = renderPjBadge(entryId);
        if (onDone) onDone(null);
      } catch (e) {
        if (onDone) onDone(e);
      }
    });
    input.click();
  }

  // NOUVEAU (v2.29) : popup Pj (miroir de openCommentsPopup) — liste les
  // pièces jointes connues (ajoutées via cet outil dans la session en
  // cours, cf. pjDocs), propose d'en ajouter une nouvelle, et un bouton
  // expérimental pour tenter de détecter des PJ déjà existantes côté
  // serveur (probeExistingAttachments(), NON confirmé — cf. commentaire sur
  // cette fonction plus haut).
  // NOUVEAU (v2.32, demande explicite : "possible de voir la piece jointe
  // juste en survolant l'icone PJ de l'écriture ?") — aperçu léger en
  // tooltip au survol (sans clic), limité comme le popup complet aux PJ
  // connues pour CETTE session (pjDocs — aucune route de listing serveur
  // trouvée, cf. v2.29/v2.30). Affiche la miniature (thumbnail) si connue,
  // sinon juste le nom du fichier.
  let pjHoverEl = null;
  function hidePjHoverPreview() {
    if (pjHoverEl) {
      pjHoverEl.remove();
      pjHoverEl = null;
    }
  }
  // BUG CORRIGÉ (2026-08-04, v2.53, retour direct avec capture d'écran
  // annotée : "affiche l'apercu de la piece jointe en gras dans l'espace
  // vide (en rouge)") — l'aperçu au survol tenait jusqu'ici dans une petite
  // bulle (220px) collée au curseur, qui suivait la souris (cf. mousemove
  // sur le badge Pj., retiré ci-dessous). Remplacé par un panneau FIXE, en
  // grand, ancré dans l'espace vide à droite du tableau (celui entouré en
  // rouge) — ne suit plus le curseur, reste stable tant que la souris est
  // sur le badge. Position calculée depuis le bord droit du conteneur de
  // scroll du tableau (#tmbc-sp-scroll), pas depuis x/y de la souris.
  // v2.54 — d.thumbnail pointe vers .../preview?x=90&y=120... (miniature
  // basse résolution). Le même endpoint GED accepte une taille bien plus
  // grande (confirmé en direct : l'aperçu natif "grande vue" demande
  // .../preview?...&y=1187...). On réécrit donc x/y sur la même URL au
  // lieu d'inventer un autre endpoint. Repli sur d.thumbnail tel quel si
  // l'URL ne peut pas être parsée.
  function pjBigPreviewUrl(d) {
    if (!d || !d.thumbnail) return (d && (d.previewLink || d.link)) || '';
    try {
      const u = new URL(d.thumbnail, window.location.href);
      u.searchParams.set('y', '1400');
      u.searchParams.delete('x');
      return u.toString();
    } catch (e) {
      return d.thumbnail;
    }
  }

  function showPjHoverPreview(entryId) {
    hidePjHoverPreview();
    const docs = pjDocs.get(entryId) || [];
    if (!docs.length) return;
    // v2.56 : #tmbc-sp-table (pas #tmbc-sp-scroll, plus large que les
    // colonnes réellement affichées — cf. changelog) pour épouser le bord
    // droit réel du tableau.
    const tableEl = document.getElementById('tmbc-sp-table');
    const rect = tableEl ? tableEl.getBoundingClientRect() : { right: 20, top: 100 };
    const left = Math.round(rect.right + 16);
    const top = Math.round(rect.top);
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;left:' + left + 'px;top:' + top + 'px;' +
      'width:calc(100vw - ' + left + 'px - 16px);height:calc(100vh - ' + top + 'px - 16px);' +
      'overflow:auto;background:#fff;border:1px solid #999;border-radius:6px;' +
      'box-shadow:0 6px 20px rgba(0,0,0,0.22);z-index:99999;font-size:13px;padding:12px;' +
      'pointer-events:none;display:flex;flex-direction:column;';
    el.innerHTML = docs
      .map(
        (d) =>
          '<div style="margin-bottom:10px;display:flex;flex-direction:column;flex:1;min-height:0;">' +
          (d.thumbnail
            ? '<img src="' + pjBigPreviewUrl(d) + '" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block;border:1px solid #ddd;margin-bottom:6px;margin-left:auto;margin-right:auto;">'
            : '') +
          '<div style="color:#222;font-weight:700;word-break:break-all;">' + (d.name || 'fichier') + '</div>' +
          '</div>'
      )
      .join('');
    document.body.appendChild(el);
    pjHoverEl = el;
  }

  let pjPopupEl = null;
  let pjPopupCloseHandler = null;
  function closePjPopup() {
    if (pjPopupEl) {
      pjPopupEl.remove();
      pjPopupEl = null;
    }
    if (pjPopupCloseHandler) {
      document.removeEventListener('mousedown', pjPopupCloseHandler, true);
      pjPopupCloseHandler = null;
    }
  }
  function openPjPopup(x, y, entryId) {
    closePjPopup();
    closeCommentsPopup();
    closeHistoryContextMenu();
    if (entryId === undefined || entryId === null) return;

    const popup = document.createElement('div');
    popup.style.cssText =
      'position:fixed;left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px;' +
      'width:320px;max-height:420px;overflow-y:auto;background:#fff;border:1px solid #999;' +
      'border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.18);z-index:99999;font-size:12px;padding:10px;';
    popup.innerHTML =
      '<div style="font-weight:600;margin-bottom:6px;">Pièces jointes</div>' +
      '<div id="tmbc-pj-list" style="margin-bottom:8px;color:#666;"></div>' +
      '<div style="display:flex;gap:6px;">' +
      '<button id="tmbc-pj-add" style="font-size:12px;padding:3px 10px;cursor:pointer;">+ Ajouter un fichier</button>' +
      '<button id="tmbc-pj-probe" style="font-size:11px;padding:3px 8px;cursor:pointer;color:#777;" ' +
      'title="Tentative expérimentale de détecter les PJ déjà existantes côté serveur (non confirmé)">🔍 Vérifier (test)</button>' +
      '</div>' +
      '<div id="tmbc-pj-probe-result" style="margin-top:6px;color:#666;white-space:pre-wrap;word-break:break-all;"></div>';
    document.body.appendChild(popup);
    pjPopupEl = popup;

    pjPopupCloseHandler = (e) => {
      if (!popup.contains(e.target)) closePjPopup();
    };
    setTimeout(() => document.addEventListener('mousedown', pjPopupCloseHandler, true), 0);

    function renderList() {
      const listEl = popup.querySelector('#tmbc-pj-list');
      const docs = pjDocs.get(entryId) || [];
      listEl.innerHTML = docs.length
        ? docs
            .map(
              (d, i) =>
                '<div style="border-top:1px solid #eee;padding:5px 0;display:flex;justify-content:space-between;align-items:center;">' +
                '<span>📄 ' + (d.name || 'fichier') + '</span>' +
                '<span>' +
                // v2.30 : "aperçu" ouvre la MÊME page que l'icône Pj native
                // (data.link — thumbnail/preview + bouton Télécharger côté
                // serveur), "télécharger" force le fichier brut
                // (data.download). Avant ce correctif, seul le lien de
                // téléchargement était mémorisé -> pas d'aperçu possible.
                (d.previewLink
                  ? '<a href="#" data-pj-open="' + i + '" style="color:#1565c0;margin-right:8px;">aperçu</a>'
                  : '') +
                (d.downloadLink
                  ? '<a href="#" data-pj-download="' + i + '" style="color:#555;">télécharger</a>'
                  : '') +
                '</span>' +
                '</div>'
            )
            .join('')
        : '<em>Aucune pièce jointe connue pour cette session (les PJ ajoutées avant cette session, ou via la Saisie standard, ne sont pas listées ici — aucune route de listing trouvée côté serveur).</em>';
      listEl.querySelectorAll('[data-pj-open]').forEach((a) => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const d = docs[parseInt(a.dataset.pjOpen, 10)];
          if (d && d.previewLink) window.open(d.previewLink, '_blank');
        });
      });
      listEl.querySelectorAll('[data-pj-download]').forEach((a) => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const d = docs[parseInt(a.dataset.pjDownload, 10)];
          if (d && d.downloadLink) window.open(d.downloadLink, '_blank');
        });
      });
    }
    renderList();

    popup.querySelector('#tmbc-pj-add').addEventListener('click', () => {
      const btn = popup.querySelector('#tmbc-pj-add');
      btn.disabled = true;
      pickFileAndUpload(entryId, (err) => {
        btn.disabled = false;
        if (err) {
          popup.querySelector('#tmbc-pj-list').insertAdjacentHTML(
            'beforeend',
            '<div style="color:#c62828;">Échec de l\'envoi (' + err.message + ').</div>'
          );
          return;
        }
        renderList();
      });
    });

    popup.querySelector('#tmbc-pj-probe').addEventListener('click', async () => {
      const resultEl = popup.querySelector('#tmbc-pj-probe-result');
      resultEl.textContent = 'Test en cours…';
      try {
        const r = await probeExistingAttachments(entryId);
        resultEl.textContent = 'status=' + r.status + ' ok=' + r.ok + '\n' + r.text;
      } catch (e) {
        resultEl.textContent = 'Erreur : ' + e.message;
      }
    });
  }

  // --- Options natives (journaux dispos, années/mois dispos) --------------

  async function fetchNativeOptions(input) {
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    await sleep(250);
    const listbox = document.querySelector('.MuiAutocomplete-listbox');
    const options = listbox
      ? Array.from(listbox.querySelectorAll('[role="option"], li')).map((o) => o.textContent.trim())
      : [];
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    await sleep(100);
    return options;
  }

  const MONTH_NAME_TO_NUM = {
    janvier: '01', fevrier: '02', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
    juillet: '07', aout: '08', août: '08', septembre: '09', octobre: '10', novembre: '11',
    decembre: '12', décembre: '12',
  };
  const MONTH_NUM_TO_NAME = {
    1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
    7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre',
  };

  function parsePeriodInput(raw) {
    const trimmed = String(raw || '').trim();
    let m = trimmed.match(/^(\d{1,2})[\/\-\s](\d{2}|\d{4})$/);
    if (!m) m = trimmed.match(/^(\d{2})(\d{2}|\d{4})$/);
    if (!m) return null;
    const month = parseInt(m[1], 10);
    if (month < 1 || month > 12) return null;
    const year = m[2].length === 2 ? '20' + m[2] : m[2];
    return { month, year };
  }

  async function selectNativeAutocompleteOption(input, matchText) {
    // v2.21 : même garde que commitNativeJournal() ci-dessous, même cause
    // possible (revalider Année/Mois alors que le champ contient déjà
    // exactement la valeur visée) — jamais reproduit en direct pour
    // Année/Mois spécifiquement, mais le même mécanisme MUI est en jeu.
    if (input.value.trim() === matchText.trim()) {
      return true;
    }
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    await sleep(250);
    const listbox = document.querySelector('.MuiAutocomplete-listbox');
    if (!listbox) return false;
    const option = Array.from(listbox.querySelectorAll('[role="option"], li')).find(
      (o) => o.textContent.trim() === matchText
    );
    if (!option) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      return false;
    }
    option.click();
    await sleep(200);
    return true;
  }

  async function commitNativePeriod(parsed) {
    const anneeField = findLabelInput('Année');
    const moisField = findMoisLabelInput();
    if (!anneeField || !moisField) return false;
    const yearOk = await selectNativeAutocompleteOption(anneeField.input, parsed.year);
    if (!yearOk) return false;
    return selectNativeAutocompleteOption(moisField.input, MONTH_NUM_TO_NAME[parsed.month]);
  }

  async function commitNativeJournal(typedText) {
    const journalField = findLabelInput('Journal');
    if (!journalField) return null;
    // BUG CORRIGÉ (2026-08-04, v2.21) : root cause réelle du bug v2.18/v2.19
    // ("marche pas, toujours journal inconnu" sur MANO, confirmée en direct
    // via window.tmbcTestJournal()) — scénario reproduit : Journal=BBE puis
    // Journal=AC (résolu avec succès, champ natif = "AC - ACHATS"), PUIS
    // changement de la Période SEULE (le journal ne change pas de valeur) :
    // tryTrigger() rappelle commitNativeJournal("AC - ACHATS") alors que le
    // champ natif contient DÉJÀ exactement cette valeur — reposer la même
    // valeur (même via setNativeValue) ne rouvre pas la liste déroulante
    // MUI (confirmé : le waitFor() ci-dessous finissait par timeout et
    // retournait null, "Journal inconnu", alors que le journal était déjà
    // bel et bien sélectionné). Fix : si le champ contient déjà exactement
    // le texte visé, on considère la sélection déjà faite et on retourne
    // directement sans retoucher au champ natif.
    if (journalField.input.value.trim().toLowerCase() === typedText.trim().toLowerCase()) {
      return journalField.input.value.trim();
    }
    journalField.input.focus();
    setNativeValue(journalField.input, typedText);
    const option = await waitFor(() => {
      const listbox = document.querySelector('.MuiAutocomplete-listbox');
      if (!listbox) return null;
      const options = Array.from(listbox.querySelectorAll('[role="option"], li'));
      return (
        options.find((o) => o.textContent.trim().toLowerCase() === typedText.trim().toLowerCase()) ||
        options.find((o) => o.textContent.trim().toLowerCase().startsWith(typedText.trim().toLowerCase())) ||
        null
      );
    }, 2000, 100);
    if (!option) {
      journalField.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      return null;
    }
    option.click();
    await sleep(150);
    return journalField.input.value.trim();
  }

  function currentNativePeriodDisplay() {
    const moisInput = findMoisLabelInput();
    const anneeInput = findLabelInput('Année');
    if (!moisInput || !anneeInput) return null;
    const num = MONTH_NAME_TO_NUM[(moisInput.input.value || '').trim().toLowerCase()];
    const year = (anneeInput.input.value || '').trim();
    if (!num || !year) return null;
    return num + '/' + year;
  }

  async function buildPeriodOptions() {
    const anneeField = findLabelInput('Année');
    const moisField = findMoisLabelInput();
    if (!anneeField || !moisField) return [];

    const years = await fetchNativeOptions(anneeField.input);
    const result = [];
    for (const year of years) {
      const yearOk = await selectNativeAutocompleteOption(anneeField.input, year);
      if (!yearOk) continue;
      const months = await fetchNativeOptions(moisField.input);
      months.forEach((monthName) => {
        const num = MONTH_NAME_TO_NUM[monthName.trim().toLowerCase()];
        if (num) result.push({ value: num + '/' + year, label: num + '/' + year });
      });
    }
    return result;
  }

  // --- Tableau fusionné (historique + ligne(s) éditable(s)) --------------

  // v2.28 (demande explicite : "ecarte de quelques pixels la colonne
  // journal, et réduit la colonne intitulé (50 car)") : Jour élargie
  // 34px -> 44px ; Intitulé n'est plus "flex" (largeur automatique) mais
  // fixée à ~50 caractères (13px police standard, ~6.8px/caractère mesuré à
  // l'écran -> 340px). Comme Intitulé était la SEULE colonne flex,
  // supprimer ce flex change le comportement du tableau : il ne s'étire
  // plus pour remplir toute la largeur disponible (cf. table width:auto +
  // overflow-x:auto sur le conteneur de scroll, dans ensureCustomRoot()) —
  // choix volontaire pour garder des largeurs de colonnes fixes et fiables
  // plutôt qu'un étirement proportionnel de TOUTES les colonnes (aurait
  // cassé l'alignement pixel-perfect des colonnes chiffrées/police fixe).
  const COLUMNS = [
    { label: '', width: 26 },
    // v2.53 (retour direct) : élargie (44 -> 62px) pour que la flèche de tri
    // (cf. en-tête cliquable #tmbc-sp-th-day) reste sur la même ligne que
    // "Jour" au lieu de passer en dessous.
    { label: 'Jour', width: 62, align: 'center' },
    { label: 'N° Compte', width: 90 },
    { label: 'Intitulé', width: 340 },
    { label: 'Débit', width: 90, align: 'right', mono: true },
    { label: 'Crédit', width: 90, align: 'right', mono: true },
    { label: 'Pièce 1', width: 90 },
    { label: 'Pièce 2', width: 90 },
    { label: 'Comm.', width: 70 },
    { label: 'Pj.', width: 40 },
    { label: 'Contrepartie', width: 110 },
    { label: 'Echéance', width: 100 },
    // NOUVEAU (v2.57, demande explicite : "on rajoute 2 colonnes 'debut' et
    // 'fin' dans la saisie premium, au départ juste en affichage") — période
    // de cut-off CCA/PCA d'une ligne flaguée (line.flags), résolue en
    // arrière-plan par resolveCutoffPeriod() (cf. changelog en tête de
    // fichier). Vide pour toute ligne non flaguée CCA/PCA.
    { label: 'Début', width: 90, align: 'center', mono: true, dim: true },
    { label: 'Fin', width: 90, align: 'center', mono: true, dim: true },
    // NOUVEAU (2026-08-04, demande explicite : "rajoute le bouton 'annuler
    // la modification' à droite de l'écriture (apres la colonne
    // echeance)") — colonne vide sur les lignes historiques normales,
    // n'affiche le bouton que sur la ligne en cours d'édition (cf.
    // buildDraftRows(), rowIdx===0).
    { label: '', width: 140 },
    // NOUVEAU (2026-08-04, demande explicite : "est ce que chaque ecriture
    // est lié à une id spécifique. si oui possible de l'afficher ?" puis
    // "met le numero d'écriture à la fin du tableau, en gris (pour montrer
    // que c'est pas modifiable)") — entry_id, déjà utilisé partout en
    // interne (suppression, commentaires, PJ...) ; `dim: true` = gris,
    // lu par le rendu des cellules (cf. cells.forEach()/cellsDefs) pour
    // marquer visuellement que ce n'est pas un champ éditable.
    // v2.53 (retour direct : "je ne vois pas la fleche de tri sur le numero
    // d'écriture") — élargie (80 -> 110px) pour que "N° écriture" + la
    // flèche de tri tiennent sur une seule ligne dans l'en-tête (même souci
    // que "Jour" ci-dessus).
    { label: 'N° écriture', width: 110, align: 'center', mono: true, dim: true },
  ];

  function formatMoney(v) {
    // Pas de signe € (demande explicite) — juste le nombre formaté, aligné à
    // droite via COLUMNS[i].align dans renderTable().
    if (v === undefined || v === null) return '';
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function dayFromDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? m[3] : '';
  }

  // NOUVEAU (2026-08-02, v2.13) : "si l'écriture n'est pas équilibrée à la 2e
  // ligne, ouvre une 3e ligne, etc." — l'écriture en cours n'est plus limitée
  // à 2 lignes fixes. blankDraftLine()/addDraftLine() permettent d'ajouter
  // des lignes à la volée (cf. gestion Tab/Entrée sur le dernier champ dans
  // renderTable()). Chaque ligne porte en plus 3 drapeaux "*Touched" : dès
  // que l'utilisateur modifie directement l'Intitulé/Pièce 1/Pièce 2 d'UNE
  // ligne (autre que la première), cette ligne ne reçoit plus les valeurs
  // par défaut recopiées depuis la ligne 1 (cf. demande explicite : "dans 2e
  // ligne et après, ça reprend par défaut l'intitulé de la 1ère ligne, idem
  // pour pièce 1 et pièce 2" — mais un utilisateur qui la corrige à la main
  // doit voir sa correction respectée, pas écrasée par la frappe suivante en
  // ligne 1).
  function blankDraftLine() {
    return {
      day: '',
      account: '',
      label: '',
      debit: '',
      credit: '',
      piece1: '',
      piece2: '',
      labelTouched: false,
      piece1Touched: false,
      piece2Touched: false,
    };
  }

  function blankDraft() {
    return [blankDraftLine(), blankDraftLine()];
  }
  let draft = blankDraft();
  let draftError = '';

  // NOUVEAU (v2.32, demande explicite : "j'aimerai aussi pouvoir rentrer sur
  // une ectriture déjà saisi et la modifier en direct") — AUCUNE route de
  // modification directe d'écriture n'a été trouvée (ni sniffée, ni dans la
  // doc Partenaires) : "Modifier" charge l'écriture dans la zone de
  // brouillon, et à la validation on fait SUPPRIMER (deleteEntry) PUIS
  // RECRÉER (createEntry) avec les nouvelles valeurs — PAS une vraie mise à
  // jour serveur. Conséquence assumée et annoncée à Nicolas AVANT de
  // démarrer l'édition (cf. startEditEntry()) : la nouvelle écriture aura un
  // NOUVEL entry_id, donc les commentaires/pièces jointes déjà liés à
  // l'ancienne écriture ne suivent PAS (ils restent attachés à un entry_id
  // qui vient d'être supprimé). editingEntryId !== null pendant toute
  // l'édition ; remis à null après succès/annulation.
  let editingEntryId = null;

  function cancelEditEntry() {
    editingEntryId = null;
    draft = blankDraft();
    draftExtras = blankDraftExtras();
    editCarryOver = null;
    clearEditTimeout();
    draftError = '';
    renderTable();
  }

  // BUG CORRIGÉ (2026-08-04, v2.40, diagnostiqué en direct via logs
  // [DEBUG] : "window blur" suivi 1 à 4s plus tard de "window focus", avec le
  // focusin réussi tombant EXACTEMENT à la ms du "window focus") —
  // window.confirm()/window.alert() sont des dialogues NATIFS bloquants ;
  // sous Electron, leur fermeture fait perdre le focus OS à la fenêtre
  // pendant 1 à 4s avant qu'elle ne le regagne, et tant que la fenêtre n'a
  // pas le focus OS, cliquer dans un champ ne fait que refocaliser la
  // fenêtre sans jamais atteindre le champ visé — d'où l'attente constatée
  // juste après avoir validé "Continuer ?" pour passer en édition. Remplacé
  // par une popup 100% custom (comme tous les autres popups de ce script),
  // qui n'a aucun effet sur le focus de la fenêtre.
  let confirmPopupEl = null;
  function closeConfirmPopup() {
    if (confirmPopupEl) {
      confirmPopupEl.remove();
      confirmPopupEl = null;
    }
  }
  function openConfirmPopup(message, onConfirm) {
    closeConfirmPopup();
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.25);z-index:100000;' +
      'display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText =
      'background:#fff;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.3);' +
      'padding:18px 20px;max-width:460px;font-size:13px;line-height:1.5;white-space:pre-wrap;';
    box.textContent = message;
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'margin-top:16px;display:flex;justify-content:flex-end;gap:8px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Annuler';
    cancelBtn.style.cssText = 'padding:6px 14px;cursor:pointer;border:1px solid #bbb;border-radius:3px;background:#fff;';
    cancelBtn.addEventListener('click', closeConfirmPopup);
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Continuer';
    okBtn.style.cssText = 'padding:6px 14px;cursor:pointer;border:none;border-radius:3px;background:#1a73e8;color:#fff;';
    okBtn.addEventListener('click', () => {
      closeConfirmPopup();
      onConfirm();
    });
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    confirmPopupEl = overlay;
  }

  // NOUVEAU (2026-08-04, demande explicite : "regarde si possible de garder
  // temporairement la référence de la piece jointe et du commentaire pour
  // l'intégrer dans l'écriture modifiée") — comme il n'existe aucune route
  // de modification directe (cf. plus haut), une "modification" est en
  // réalité une SUPPRESSION + RECRÉATION avec un NOUVEL entry_id, donc les
  // commentaires/PJ de l'ancienne écriture ne suivent pas automatiquement
  // côté serveur. On récupère ici tout ce qu'on PEUT récupérer AVANT la
  // suppression, pour le rejouer sur la nouvelle écriture juste après sa
  // création (cf. submitDraft()) :
  //  - Commentaires : GET /comments?entry_id=<ancien id> (route CONFIRMÉE,
  //    cf. fetchComments()) donne le texte complet (champ .body) — repris
  //    intégralement, aucune limite.
  //  - Pièces jointes : AUCUNE route "lister les PJ d'une écriture" n'existe
  //    côté serveur (ni sniffée, ni dans la doc Partenaires — cf. commentaire
  //    sur pjCounts plus haut) : on ne peut donc reprendre QUE les PJ dont
  //    Saisie Premium a lui-même connaissance localement pour CETTE session
  //    (pjDocs, alimenté à l'upload). Les PJ ajoutées via l'appli standard ou
  //    lors d'une session précédente resteront attachées à l'ancien entry_id
  //    supprimé — limite annoncée explicitement à Nicolas dans le message de
  //    confirmation ci-dessous, jamais fabriquée en silence.
  let editCarryOver = null;
  // NOUVEAU (2026-08-04, retour direct : "ne met plus de confirmation apres
  // le double clic, on sait que ca modifie") — la popup de confirmation
  // (suppression+recréation, cf. commentaire ci-dessus) est retirée : passer
  // en édition (double-clic ou clic droit > Modifier) est désormais
  // immédiat, sans clic supplémentaire.
  //
  // NOUVEAU (2026-08-04, demande explicite : "On met peut etre une timeout
  // sur l'écriture modifié ? par ex si pas de validation au bout de 1 min,
  // ca annule automatiquement la modification pour eviter des problèmes de
  // desynchro ?") — EDIT_TIMEOUT_MS après le passage en édition, si
  // l'écriture n'a toujours pas été validée (ni annulée manuellement), on
  // annule automatiquement (cancelEditEntry()) pour éviter qu'une édition
  // oubliée en cours (ex. fenêtre laissée ouverte, changement d'onglet) ne
  // finisse par supprimer+recréer une écriture sur la base de données
  // potentiellement obsolètes.
  const EDIT_TIMEOUT_MS = 60000;
  let editTimeoutHandle = null;
  function clearEditTimeout() {
    if (editTimeoutHandle) {
      clearTimeout(editTimeoutHandle);
      editTimeoutHandle = null;
    }
  }
  function startEditEntry(entry, entryId) {
    if (entryId === undefined || entryId === null) {
      draftError = "Impossible de modifier : identifiant d'écriture introuvable dans la réponse serveur (à vérifier avec Nicolas).";
      renderTable();
      return;
    }
    const lines = Array.isArray(entry.entry_list) ? entry.entry_list : [];
    if (!lines.length) return;
    const knownAttachments = pjDocs.get(entryId) || [];
    const day = dayFromDate(entry.date_piece);
    draft = lines.map((line, i) => {
      const l = blankDraftLine();
      l.day = day;
      l.account = (line.account && line.account.account_number) || '';
      l.label = line.label || '';
      l.debit = line.debit !== undefined && line.debit !== null ? formatMoney(line.debit) : '';
      l.credit = line.credit !== undefined && line.credit !== null ? formatMoney(line.credit) : '';
      l.piece1 = line.piece || '';
      l.piece2 = line.piece2 || '';
      // Évite que les listeners "reprise depuis la ligne 1" n'écrasent ces
      // valeurs déjà réelles pendant l'édition (cf. makeInput()/touchKey).
      if (i > 0) {
        l.labelTouched = true;
        l.piece1Touched = true;
        l.piece2Touched = true;
      }
      return l;
    });
    editingEntryId = entryId;
    draftError = '';
    // BUG CORRIGÉ (2026-08-04, v2.44, retour direct : "ecriture indique 1
    // piece jointe (alors que 0)") — draftExtras (commentaire/PJ mis en
    // attente sur la ligne de saisie tout en bas, cf. blankDraftExtras())
    // n'était JAMAIS remis à zéro en entrant en édition. Si un fichier ou
    // un commentaire restait en attente d'une saisie précédente non
    // validée, il s'attachait silencieusement à l'écriture éditée au
    // moment de submitDraft() (qui envoie TOUJOURS extras.files/extras.
    // comment, en plus du carryOver). Remise à zéro systématique ici.
    draftExtras = blankDraftExtras();
    editCarryOver = { comments: [], attachments: knownAttachments.slice() };
    // Récupération asynchrone du texte des commentaires — non bloquant
    // pour l'affichage de l'édition ; si editingEntryId a déjà changé
    // (annulation/autre écriture) au moment où la réponse arrive, on
    // l'ignore pour ne pas mélanger deux écritures différentes.
    fetchComments(entryId)
      .then((comments) => {
        if (editCarryOver && editingEntryId === entryId) editCarryOver.comments = comments;
      })
      .catch(() => {
        /* échec silencieux : les commentaires ne seront simplement pas repris */
      });
    clearEditTimeout();
    editTimeoutHandle = setTimeout(() => {
      if (editingEntryId === entryId) {
        cancelEditEntry();
        draftError =
          "Modification annulée automatiquement (aucune validation au bout d'1 minute) pour éviter tout problème de désynchronisation.";
        renderTable();
      }
    }, EDIT_TIMEOUT_MS);
    renderTable();
    focusFirstDraftCell();
  }

  // NOUVEAU (2026-08-04, demande explicite : "je veux pouvoir mettre une
  // piece jointe ou un commentaire sur une écriture que je saisis, pas
  // uniquement sur une écriture existante") — l'API pièce jointe/commentaire
  // exige un entry_id réel, qui n'existe qu'APRÈS l'enregistrement côté
  // serveur (createEntry()). On "met en attente" côté client le commentaire
  // et/ou les fichiers choisis pendant la saisie, puis on les envoie
  // automatiquement juste après la création réussie de l'écriture (cf.
  // submitDraft()), avec le entry_id fraîchement reçu.
  function blankDraftExtras() {
    return { comment: '', files: [] };
  }
  let draftExtras = blankDraftExtras();

  // NOUVEAU (v2.17) : sélection multi-écritures via les cases à cocher
  // (demande explicite). Stocke les entry_id cochés — jamais les objets
  // écriture eux-mêmes, pour rester cohérent après un renderTable().
  const selectedEntryIds = new Set();
  // NOUVEAU (2026-08-04, demande explicite : "rajoute une option pour trier
  // par date ... tri par id specique") — 'date-asc' (défaut, comportement
  // déjà en place depuis la demande précédente), 'date-desc', 'id-asc',
  // 'id-desc'. Pilotée par le <select> #tmbc-sp-sort (cf. ensureCustomRoot()).
  let sortMode = 'date-asc';
  // v2.32 (demande explicite : "je clic sur une premiere case à cocher, je
  // fais shift et clic sur la derniere et ca prendre les ecritures entre les
  // 2") — index (dans l'ordre d'affichage courant) de la dernière case
  // cliquée normalement, pour calculer la plage lors d'un Shift+clic.
  // visibleEntryIdsOrder est reconstruit à chaque renderTable().
  let lastClickedEntryIndex = null;
  let visibleEntryIdsOrder = [];

  // v2.32 (demande explicite : "si ecriture sélectionné, si j'appuie sur la
  // touche suppr du clavier, ca propose la suppression") — écouteur global
  // installé UNE SEULE FOIS (le root peut être recréé, mais document, lui,
  // ne change jamais). Ignoré si le focus est dans un champ de saisie
  // (input/textarea), pour ne pas interférer avec une frappe normale.
  if (!window.__tmbcDeleteKeyInstalled) {
    window.__tmbcDeleteKeyInstalled = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Delete') return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (selectedEntryIds.size === 0) return;
      if (!document.getElementById(CUSTOM_ROOT_ID)) return;
      e.preventDefault();
      confirmAndDeleteEntry(null, undefined);
    });
  }

  // Ajoute une nouvelle ligne de brouillon, en reprenant par défaut le Jour,
  // l'Intitulé, Pièce 1 et Pièce 2 de la ligne 1 (demande explicite) — le
  // N° Compte/Débit/Crédit restent vierges (propres à chaque ligne).
  function addDraftLine() {
    const first = draft[0] || blankDraftLine();
    const line = blankDraftLine();
    line.day = first.day || '';
    line.label = first.label || '';
    line.piece1 = first.piece1 || '';
    line.piece2 = first.piece2 || '';
    draft.push(line);
    renderTable();
    const el = document.querySelector('[data-draft="' + (draft.length - 1) + '-account"]');
    if (el) el.focus();
  }

  // NOUVEAU (2026-08-02, v2.15, demande explicite) : "il faut forcer un
  // chiffre dans la colonne Jour (entre 1 et 31, 30 ou 28/29 selon la
  // période)". Calcule le nombre de jours réel du mois/année actuellement
  // sélectionnés (currentFilterPeriod, format "mm/aaaa") — jamais deviné,
  // recalculé à partir du vrai calendrier (new Date(year, month, 0)).
  function daysInSelectedPeriod() {
    const m = /^(\d{2})\/(\d{4})$/.exec(currentFilterPeriod || '');
    if (!m) return 31;
    return new Date(parseInt(m[2], 10), parseInt(m[1], 10), 0).getDate();
  }

  function draftBalance() {
    const totalDebit = draft.reduce((s, l) => s + (parseAmount(l.debit) || 0), 0);
    const totalCredit = draft.reduce((s, l) => s + (parseAmount(l.credit) || 0), 0);
    return { totalDebit, totalCredit, balanced: totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005 };
  }

  // NOUVEAU (v2.13) : navigation clavier Tab/Shift+Tab/Entrée/Shift+Entrée
  // logique, champ par champ, de gauche à droite (demande explicite : "je
  // dois pouvoir me déplacer simplement d'un champ à un autre, de manière
  // logique"). Tab/Shift+Tab utilisent déjà l'ordre naturel du DOM (rien à
  // faire) ; Entrée ne déplaçait le focus nulle part par défaut dans un
  // <input> hors <form> — on lui donne donc le même comportement que Tab
  // (Entrée = suivant, Shift+Entrée = précédent), en ignorant les champs en
  // lecture seule (Jour des lignes 2+, toujours aligné sur la ligne 1).
  function getDraftFocusableInputs() {
    return Array.from(document.querySelectorAll('#tmbc-sp-tbody input[data-draft]')).filter(
      (el) => !el.readOnly && !el.disabled
    );
  }

  function focusDraftStep(currentInput, delta) {
    const inputs = getDraftFocusableInputs();
    const idx = inputs.indexOf(currentInput);
    if (idx === -1) return;
    const next = inputs[idx + delta];
    if (next) {
      next.focus();
      if (typeof next.select === 'function') next.select();
    }
  }

  // Déclenché sur "blur" des champs Débit/Crédit : si l'écriture est déjà
  // équilibrée ET que les comptes + le jour sont renseignés, on valide tout
  // de suite sans attendre que l'utilisateur tabule jusqu'à Pièce 2 (demande
  // explicite : "quand j'ai saisi 100 au débit et 100 au crédit, ça devrait
  // se valider automatiquement"). Le déclencheur Tab/Enter sur Pièce 2 reste
  // en place comme filet de sécurité (montants collés sans passer par blur,
  // etc.).
  let submitInProgress = false;
  function attemptAutoSubmit() {
    if (submitInProgress) return;
    // BUG CORRIGÉ (v2.34, retour direct : "ca buge sur les modif, je ne
    // peux pas changer facilement un libelle ou un montant") — en mode
    // édition (cf. startEditEntry()), l'écriture chargée dans le brouillon
    // est DÉJÀ équilibrée, avec tous les comptes déjà renseignés : le
    // moindre blur d'un champ Débit/Crédit (même juste pour passer au champ
    // suivant) déclenchait donc une soumission immédiate (suppression +
    // recréation, cf. v2.32/v2.33) AVANT que l'utilisateur ait pu modifier
    // le libellé ou un autre champ. L'auto-soumission au blur n'a de sens
    // que pour la SAISIE d'une écriture neuve (2 lignes vierges au départ,
    // "y'a plus qu'à taper les 2 montants") — désactivée en mode édition ;
    // la validation s'y fait alors UNIQUEMENT via Tab/Entrée sur le dernier
    // champ (Pièce 2 de la dernière ligne), comme documenté.
    if (editingEntryId !== null) return;
    const { balanced } = draftBalance();
    if (!balanced) return;
    const day = (draft[0].day || draft[1].day || '').trim();
    if (!day) return;
    if (draft.some((l) => !l.account.trim())) return;
    submitDraft();
  }

  async function submitDraft() {
    if (submitInProgress) return;
    const { balanced } = draftBalance();
    if (!balanced) {
      draftError = 'Débit ≠ Crédit (ou montant nul) — écriture non équilibrée.';
      renderTable();
      return;
    }
    submitInProgress = true;
    try {
      if (!currentFilterJournalCode || !currentFilterPeriod) {
        draftError = 'Sélectionne un Journal et une Période avant de saisir.';
        renderTable();
        return;
      }
      const resolvedLines = [];
      for (const line of draft) {
        const acc = resolveAccount(line.account.trim());
        if (!acc) {
          draftError =
            'Compte "' + line.account + '" non résolu — ouvre-le au moins une fois via une lecture (change de journal/période pour le faire apparaître) avant de pouvoir saisir dessus en Saisie Premium.';
          renderTable();
          return;
        }
        resolvedLines.push({
          accountId: acc.account_id,
          accountNumber: line.account.trim(),
          label: line.label.trim() || acc.label,
          debit: parseAmount(line.debit),
          credit: parseAmount(line.credit),
          piece: line.piece1.trim(),
          piece2: line.piece2.trim(),
        });
      }
      const day = (draft[0].day || draft[1].day || '').trim().padStart(2, '0');
      const m = /^(\d{2})\/(\d{4})$/.exec(currentFilterPeriod);
      if (!day || !/^\d{2}$/.test(day) || !m) {
        draftError = 'Jour invalide.';
        renderTable();
        return;
      }
      // Garde-fou ajouté (2026-08-02) : un jour hors bornes pour le mois
      // choisi (ex. 31 pour un mois de 30 jours) passait silencieusement le
      // test regex ci-dessus et produisait une date_piece invalide côté
      // serveur (suspecté comme cause possible du 500 constaté en test réel).
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(m[1], 10);
      const yearNum = parseInt(m[2], 10);
      const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
      if (dayNum < 1 || dayNum > daysInMonth) {
        draftError = 'Jour invalide pour ' + m[1] + '/' + m[2] + ' (max ' + daysInMonth + ').';
        renderTable();
        return;
      }
      const datePieceIso = m[2] + '-' + m[1] + '-' + day;

      const diaryId = await resolveDiaryId(currentFilterJournalCode + ' - ');
      // resolveDiaryId cherche par CODE (déjà extrait), le libellé complet
      // n'est utile qu'en repli pour widenCacheSearch/commitNativeJournal —
      // ici on a déjà le code exact, donc on interroge le cache directement.
      const diaryIdFromCache = diaryCache.get(currentFilterJournalCode) || diaryId;
      if (!diaryIdFromCache) {
        draftError = 'Journal non résolu (aucune écriture connue pour retrouver son identifiant interne).';
        renderTable();
        return;
      }

      // v2.32 : mode édition (cf. startEditEntry()) — supprime l'ancienne
      // écriture AVANT de recréer, faute de route de modification directe.
      // Si la suppression échoue, on N'ESSAIE PAS de créer (éviterait un
      // doublon) : erreur affichée, editingEntryId conservé pour permettre
      // de réessayer.
      const wasEditing = editingEntryId;
      if (wasEditing !== null) {
        // Validation en cours : plus besoin du filet de sécurité "1 minute
        // sans validation" (cf. startEditEntry()) — évite qu'il se déclenche
        // pendant que la suppression+recréation est en train de se dérouler.
        clearEditTimeout();
        draftError = 'Suppression de l\'ancienne écriture avant recréation...';
        renderTable();
        try {
          const delOk = await deleteEntry(wasEditing);
          if (!delOk) throw new Error('réponse inattendue du serveur');
          if (lastEntriesResponse && Array.isArray(lastEntriesResponse.entry_array)) {
            lastEntriesResponse.entry_array = lastEntriesResponse.entry_array.filter(
              (e) => (e.entry_id !== undefined ? e.entry_id : e.id) !== wasEditing
            );
          }
        } catch (e) {
          draftError = "Échec de la suppression de l'ancienne écriture — modification annulée, rien n'a été recréé (" + e.message + ').';
          renderTable();
          return;
        }
      }

      draftError = 'Enregistrement...';
      renderTable();
      try {
        const createResponse = await createEntry(diaryIdFromCache, datePieceIso, resolvedLines);
        draft = blankDraft();
        editingEntryId = null;
        // v2.41 : commentaires/PJ récupérés AVANT la suppression de
        // l'ancienne écriture (cf. startEditEntry()), à rejouer ci-dessous
        // sur le NOUVEL entry_id si on était bien en train de modifier.
        const carryOver = wasEditing !== null ? editCarryOver : null;
        editCarryOver = null;
        draftError = '';
        // NOUVEAU (2026-08-04) : envoi du commentaire/pièces jointes mis en
        // attente pendant la saisie (draftExtras), maintenant que l'écriture
        // a un vrai entry_id. La réponse de POST /entry suit le même format
        // que GET /entries (entry_array[].entry_id, jamais deviné — même
        // lecture que celle déjà utilisée partout ailleurs dans ce fichier,
        // cf. absorbEntriesIntoCache()). Si la lecture du entry_id échoue ou
        // qu'un envoi échoue, ce n'est PAS bloquant pour l'écriture déjà
        // enregistrée : message d'erreur dédié, écriture conservée.
        const newEntry =
          createResponse && Array.isArray(createResponse.entry_array) ? createResponse.entry_array[0] : null;
        const newEntryId = newEntry ? (newEntry.entry_id !== undefined ? newEntry.entry_id : newEntry.id) : undefined;
        const extras = draftExtras;
        draftExtras = blankDraftExtras();
        if (newEntryId !== undefined && newEntryId !== null) {
          const extrasErrors = [];
          if (extras.comment && extras.comment.trim()) {
            try {
              await postComment(newEntryId, '<p>' + extras.comment.trim().replace(/</g, '&lt;') + '</p>');
              commentCounts.set(newEntryId, (commentCounts.get(newEntryId) || 0) + 1);
            } catch (e) {
              extrasErrors.push('commentaire : ' + e.message);
            }
          }
          for (const file of extras.files) {
            try {
              const data = await uploadAttachment(newEntryId, file);
              pjCounts.set(newEntryId, (pjCounts.get(newEntryId) || 0) + 1);
              // BUG CORRIGÉ (2026-08-04, v2.46, retour direct : "le fichier
              // disparait (l'icone tromboner indique bien 1 piece jointe,
              // mais elle n'est plus la)") — pjCounts (compteur du badge)
              // était bien mis à jour, mais PAS pjDocs (la vraie liste lue
              // par openPjPopup()/showPjHoverPreview() pour afficher le
              // détail/l'aperçu) — même structure que pickFileAndUpload().
              const list = pjDocs.get(newEntryId) || [];
              list.push({
                name: (data && data.name) || file.name,
                previewLink: data && data.link,
                downloadLink: data && data.download,
                thumbnail: data && data.thumbnail,
              });
              pjDocs.set(newEntryId, list);
            } catch (e) {
              extrasErrors.push('pièce jointe "' + file.name + '" : ' + e.message);
            }
          }
          // v2.41 (demande explicite : "regarde si possible de garder
          // temporairement la référence de la piece jointe et du commentaire
          // pour l'intégrer dans l'écriture modifié") — rejeu des
          // commentaires/PJ de l'ANCIENNE écriture (récupérés avant sa
          // suppression, cf. startEditEntry()) sur la nouvelle.
          if (carryOver) {
            for (const c of carryOver.comments) {
              try {
                await postComment(newEntryId, c.body);
                commentCounts.set(newEntryId, (commentCounts.get(newEntryId) || 0) + 1);
              } catch (e) {
                extrasErrors.push('commentaire repris : ' + e.message);
              }
            }
            // BUG CORRIGÉ (2026-08-04, v2.45, retour direct : "il m'affiche
            // toujours une piece jointe, mais pas de detail, pas de
            // visualisation et en fait pas de pdf dans le détail") — cause :
            // sans credentials (cf. fix v2.44 pour le CORS wildcard), le
            // token seul dans l'URL de téléchargement ne suffit visiblement
            // pas toujours ; le serveur peut alors répondre 200 OK avec une
            // page HTML (erreur/connexion) au lieu du vrai fichier — res.ok
            // reste vrai, donc l'ancien code l'uploadait tel quel comme "PJ"
            // valide (badge "1" sans contenu réel derrière). Cette fonction
            // essaie fetch() SANS credentials (satisfait la règle CORS
            // wildcard, cf. v2.44), vérifie que le contenu récupéré n'est ni
            // vide ni du HTML, et bascule sur le repli <img>/canvas (v2.43,
            // directive img-src) pour les images dans TOUS les cas d'échec
            // (réseau OU contenu invalide) avant d'abandonner.
            async function fetchAttachmentBlob(downloadLink, name) {
              let networkError = null;
              try {
                const res = await fetch(downloadLink, { credentials: 'omit' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const contentType = (res.headers.get('content-type') || '').toLowerCase();
                const blob = await res.blob();
                if (contentType.includes('text/html') || blob.size === 0) {
                  console.error(
                    '[Saisie Premium] contenu suspect pour la PJ à reprendre — URL:', downloadLink,
                    '— content-type:', contentType, '— taille:', blob.size, 'octets'
                  );
                  networkError = new Error(
                    "le fichier récupéré n'était pas valide (probablement une page d'erreur/connexion renvoyée par le serveur plutôt que le fichier réel, content-type \"" +
                      (contentType || '?') + '")'
                  );
                } else {
                  return blob;
                }
              } catch (e) {
                networkError = e;
              }
              if (isLikelyImageFilename(name)) {
                console.warn(
                  '[Saisie Premium] fetch() invalide/échoué pour', downloadLink,
                  '— tentative de repli via <img> (image détectée) —', networkError && networkError.message
                );
                return await fetchImageBlobViaImgTag(downloadLink);
              }
              throw networkError || new Error('échec inconnu');
            }
            for (const doc of carryOver.attachments) {
              try {
                if (!doc.downloadLink) throw new Error('lien de téléchargement introuvable');
                const blob = await fetchAttachmentBlob(doc.downloadLink, doc.name);
                const file = new File([blob], doc.name || 'piece-jointe', { type: blob.type });
                const data = await uploadAttachment(newEntryId, file);
                pjCounts.set(newEntryId, (pjCounts.get(newEntryId) || 0) + 1);
                // v2.46 : même correctif que pour extras.files ci-dessus —
                // pjDocs (pas seulement pjCounts) doit être alimenté pour que
                // le détail/l'aperçu affiche réellement la PJ reprise.
                const list = pjDocs.get(newEntryId) || [];
                list.push({
                  name: (data && data.name) || doc.name,
                  previewLink: data && data.link,
                  downloadLink: data && data.download,
                  thumbnail: data && data.thumbnail,
                });
                pjDocs.set(newEntryId, list);
              } catch (e) {
                extrasErrors.push('pièce jointe "' + (doc.name || '?') + '" reprise : ' + e.message);
              }
            }
          }
          if (extrasErrors.length) {
            draftError =
              "Écriture enregistrée, mais échec sur : " + extrasErrors.join(' / ');
          }
        } else if (extras.comment.trim() || extras.files.length || (carryOver && (carryOver.comments.length || carryOver.attachments.length))) {
          draftError =
            "Écriture enregistrée, mais entry_id introuvable dans la réponse serveur — commentaire(s)/pièce(s) jointe(s) NON envoyés (à vérifier avec Nicolas).";
        }
        // Rafraîchit l'affichage à partir de la vraie réponse native (pas de
        // rejeu d'appel — on redéclenche simplement le même mécanisme de
        // lecture déjà utilisé pour afficher l'historique).
        const journalField = findLabelInput('Journal');
        if (journalField) await applyNativeHistoryFilters(journalField.input.value.trim(), currentFilterPeriod);
        renderTable();
        focusFirstDraftCell();
      } catch (e) {
        draftError = "Échec de l'enregistrement (" + e.message + ').';
        renderTable();
      }
    } finally {
      // Toujours relâcher la garde, y compris sur un retour anticipé
      // (validation échouée) — sinon plus aucune saisie ne se déclenche.
      submitInProgress = false;
    }
  }

  function focusFirstDraftCell() {
    const el = document.querySelector('#' + CUSTOM_ROOT_ID + ' [data-draft="0-day"]');
    if (el) el.focus();
  }

  // Alimente le <datalist> natif du champ N°Compte à partir du cache
  // accountCache (constitué uniquement de comptes réellement vus dans une
  // réponse "/entries/v2" — jamais deviné). Le <datalist> déclenche la liste
  // déroulante native du navigateur dès la première frappe (demande
  // explicite : "je veux voir la liste des comptes proposés").
  let lastDatalistSize = -1;
  function rebuildAccountDatalist() {
    const datalist = document.getElementById('tmbc-sp-accounts-datalist');
    if (!datalist) return;
    // BUG CORRIGÉ (v2.30, retour direct : "j'ai créé une ecriture, j'essaie
    // d'en faire une 2e. il ne m'affiche plus la liste déroulante au niveaux
    // des n° de compte") — le garde-fou "accountCache.size === lastDatalistSize
    // -> ne rien refaire" supposait que LE MÊME <datalist> DOM restait en
    // place entre deux rendus. Or après la création d'une écriture,
    // applyNativeHistoryFilters() pilote des champs natifs qui peuvent
    // provoquer un re-render React englobant, démontant notre root
    // (ensureCustomRoot() en recrée alors un TOUT NEUF, avec un <datalist>
    // vide) — accountCache.size n'a lui pas changé, donc l'ancien garde-fou
    // laissait ce nouveau datalist vide indéfiniment. On ne saute
    // maintenant le rebuild que si la taille N'A PAS changé ET que le
    // datalist actuel a déjà des options (donc n'est pas un remplaçant vide).
    if (accountCache.size === lastDatalistSize && datalist.childElementCount > 0) return;
    lastDatalistSize = accountCache.size;
    const rows = [];
    accountCache.forEach((info, number) => {
      rows.push('<option value="' + number.replace(/"/g, '&quot;') + '">' + (info.label || '').replace(/</g, '&lt;') + '</option>');
    });
    datalist.innerHTML = rows.join('');
  }

  // NOUVEAU (2026-08-02, v2.17, demande explicite) : "rajoute les coches
  // devant, je veux pouvoir saisir une ecriture, la modifier ou la supprimer
  // (clic droit > modifier ou clic droit > supprimer)". Menu contextuel léger
  // (même style que openLookupPopup) sur clic droit d'une écriture historique
  // — "Modifier" reste affiché mais désactivé (nécessite de sniffer l'appel
  // de mise à jour, pas encore fait, jamais deviné) ; seul "Supprimer" est
  // câblé, vers deleteEntry() (DELETE /entry sniffé en direct plus haut).
  let historyMenuEl = null;
  let historyMenuCloseHandler = null;
  function closeHistoryContextMenu() {
    if (historyMenuEl) {
      historyMenuEl.remove();
      historyMenuEl = null;
    }
    if (historyMenuCloseHandler) {
      document.removeEventListener('mousedown', historyMenuCloseHandler, true);
      historyMenuCloseHandler = null;
    }
  }
  function openHistoryContextMenu(x, y, entry, entryId) {
    closeHistoryContextMenu();
    const menu = document.createElement('div');
    menu.style.cssText =
      'position:fixed;left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px;' +
      'min-width:160px;background:#fff;border:1px solid #999;border-radius:4px;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.18);z-index:99999;font-size:13px;padding:4px 0;';

    const addItem = (label, disabled, onClick) => {
      const row = document.createElement('div');
      row.textContent = label;
      row.style.cssText =
        'padding:6px 14px;white-space:nowrap;' + (disabled ? 'color:#bbb;cursor:default;' : 'cursor:pointer;color:#222;');
      if (!disabled) {
        row.addEventListener('mouseenter', () => {
          row.style.background = '#eef4ff';
        });
        row.addEventListener('mouseleave', () => {
          row.style.background = '';
        });
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          closeHistoryContextMenu();
          onClick();
        });
      }
      menu.appendChild(row);
    };

    // v2.32 (demande explicite : "j'aimerai aussi pouvoir rentrer sur une
    // ectriture déjà saisi et la modifier en direct") — cf. startEditEntry()
    // pour le détail (et l'avertissement) sur le mécanisme réel utilisé
    // (suppression + recréation, aucune route de modification trouvée).
    addItem('Modifier', entryId === undefined || entryId === null, () => startEditEntry(entry, entryId));
    // v2.31 : le libellé reflète la sélection multiple en cours (cases à
    // cocher), pas seulement l'écriture sous le curseur — cf.
    // confirmAndDeleteEntry() pour la logique de suppression groupée.
    const deleteLabel =
      selectedEntryIds.size > 1 ? 'Supprimer (' + selectedEntryIds.size + ' sélectionnées)' : 'Supprimer';
    addItem(
      deleteLabel,
      selectedEntryIds.size === 0 && (entryId === undefined || entryId === null),
      () => confirmAndDeleteEntry(entry, entryId)
    );

    document.body.appendChild(menu);
    historyMenuEl = menu;
    historyMenuCloseHandler = (e) => {
      if (!menu.contains(e.target)) closeHistoryContextMenu();
    };
    document.addEventListener('mousedown', historyMenuCloseHandler, true);
  }

  // NOUVEAU (2026-08-04, demande explicite : "rajoute la possibilité de
  // rajouter un commentaire sur une ligne") — petit panneau flottant (même
  // style que le menu contextuel ci-dessus) ouvert au clic sur l'icône
  // "Comm." de la 1ère ligne d'un lot d'écriture historique : liste les
  // commentaires déjà existants (fetchComments) et permet d'en ajouter un
  // nouveau (postComment), cf. commentaires détaillés sur ces deux fonctions
  // plus haut pour l'API sniffée en direct.
  let commentsPopupEl = null;
  let commentsPopupCloseHandler = null;
  function closeCommentsPopup() {
    if (commentsPopupEl) {
      commentsPopupEl.remove();
      commentsPopupEl = null;
    }
    if (commentsPopupCloseHandler) {
      document.removeEventListener('mousedown', commentsPopupCloseHandler, true);
      commentsPopupCloseHandler = null;
    }
  }
  function openCommentsPopup(x, y, entryId) {
    closeCommentsPopup();
    closeHistoryContextMenu();
    if (entryId === undefined || entryId === null) return;

    const popup = document.createElement('div');
    popup.style.cssText =
      'position:fixed;left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px;' +
      'width:320px;max-height:420px;overflow-y:auto;background:#fff;border:1px solid #999;' +
      'border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.18);z-index:99999;font-size:12px;padding:10px;';
    popup.innerHTML =
      '<div style="font-weight:600;margin-bottom:6px;">Commentaires</div>' +
      '<div id="tmbc-comments-list" style="margin-bottom:8px;color:#666;"><em>Chargement…</em></div>' +
      '<textarea id="tmbc-comments-input" rows="2" placeholder="Ajouter un commentaire…" ' +
      'style="width:100%;box-sizing:border-box;font-family:inherit;font-size:12px;padding:4px;border:1px solid #ccc;border-radius:3px;"></textarea>' +
      '<div style="text-align:right;margin-top:6px;">' +
      '<button id="tmbc-comments-send" style="font-size:12px;padding:3px 10px;cursor:pointer;">Envoyer</button></div>';
    document.body.appendChild(popup);
    commentsPopupEl = popup;

    commentsPopupCloseHandler = (e) => {
      if (!popup.contains(e.target)) closeCommentsPopup();
    };
    // setTimeout : évite que le mousedown qui vient d'ouvrir ce popup (sur
    // l'icône Comm.) ne le referme immédiatement via ce même listener.
    setTimeout(() => document.addEventListener('mousedown', commentsPopupCloseHandler, true), 0);

    const listEl = popup.querySelector('#tmbc-comments-list');
    async function reload() {
      listEl.innerHTML = '<em>Chargement…</em>';
      try {
        const comments = await fetchComments(entryId);
        listEl.innerHTML = comments.length
          ? comments
              .map(
                (c) =>
                  '<div style="border-top:1px solid #eee;padding:5px 0;display:flex;justify-content:space-between;gap:6px;">' +
                  '<div style="flex:1;min-width:0;">' +
                  '<div style="font-weight:600;color:#222;">' + (c.name || '') + '</div>' +
                  '<div style="color:#999;font-size:11px;">' + (c.date || '') + '</div>' +
                  '<div style="color:#333;">' + (c.body || '') + '</div>' +
                  '</div>' +
                  // v2.29 (demande explicite : "je veux pouvoir supprimer un
                  // commentaire") — cf. deleteComment() plus haut, NON
                  // confirmé en direct : l'échec (le cas échéant) s'affiche
                  // clairement au lieu d'échouer silencieusement.
                  '<span data-comment-del="' + c.id + '" title="Supprimer" ' +
                  'style="cursor:pointer;color:#c62828;flex-shrink:0;">🗑</span>' +
                  '</div>'
              )
              .join('')
          : '<em>Aucun commentaire.</em>';
        listEl.querySelectorAll('[data-comment-del]').forEach((el) => {
          el.addEventListener('click', () => {
            const commentId = el.dataset.commentDel;
            // v2.40 : window.confirm() -> openConfirmPopup() (cf. startEditEntry()).
            openConfirmPopup('Supprimer ce commentaire ?', async () => {
              try {
                await deleteComment(commentId);
                commentCounts.set(entryId, Math.max(0, (commentCounts.get(entryId) || 1) - 1));
                const badgeBtn = document.querySelector('[data-tmbc-comment-btn="' + entryId + '"]');
                if (badgeBtn) badgeBtn.textContent = renderCommentBadge(entryId);
                await reload();
              } catch (e) {
                listEl.insertAdjacentHTML(
                  'beforeend',
                  '<div style="color:#c62828;">Échec de la suppression (' + e.message + ').</div>'
                );
              }
            });
          });
        });
      } catch (e) {
        listEl.textContent = 'Erreur de chargement (' + e.message + ').';
      }
    }
    reload();

    popup.querySelector('#tmbc-comments-send').addEventListener('click', async () => {
      const textarea = popup.querySelector('#tmbc-comments-input');
      const val = textarea.value.trim();
      if (!val) return;
      const btn = popup.querySelector('#tmbc-comments-send');
      btn.disabled = true;
      try {
        await postComment(entryId, '<p>' + val.replace(/</g, '&lt;') + '</p>');
        textarea.value = '';
        await reload();
      } catch (e) {
        listEl.insertAdjacentHTML('beforeend', '<div style="color:#c62828;">Échec de l\'envoi (' + e.message + ').</div>');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Confirmation calquée sur le texte natif observé en direct ("Voulez-vous
  // vraiment supprimer l'écriture : 471000 ?") avant d'appeler deleteEntry().
  // Après un `true` confirmé par le serveur, on retire l'écriture du cache
  // local (lastEntriesResponse) plutôt que de redéclencher tout le pilotage
  // fragile des filtres natifs (cf. commentaires sur applyNativeHistoryFilters).
  //
  // v2.31 (demande explicite : "si je selectionne plusieurs écritures avec
  // la case à cocher et que je fais supprimer, il faut supprimer les
  // ecritures cochés, pas seulement une") — si des cases sont cochées
  // (selectedEntryIds non vide) au moment du clic droit > Supprimer, TOUTES
  // les écritures cochées sont supprimées en un seul appel (deleteEntries(),
  // même corps API que le simple, juste avec plusieurs entry_id) — pas
  // seulement l'écriture sous le curseur. Sans case cochée, comportement
  // inchangé (une seule écriture, celle du clic droit).
  function confirmAndDeleteEntry(entry, entryId) {
    const bulk = selectedEntryIds.size > 0;
    const idsToDelete = bulk ? Array.from(selectedEntryIds) : [entryId];

    if (!bulk && (entryId === undefined || entryId === null)) {
      draftError = "Impossible de supprimer : identifiant d'écriture introuvable dans la réponse serveur (à vérifier avec Nicolas).";
      renderTable();
      return;
    }

    let confirmLabel;
    if (bulk) {
      confirmLabel = idsToDelete.length + ' écriture(s) sélectionnée(s)';
    } else {
      const firstLine = (entry.entry_list || [])[0];
      confirmLabel = (firstLine && firstLine.account && firstLine.account.account_number) || '';
    }
    // v2.40 : window.confirm() -> openConfirmPopup() (cf. commentaire détaillé
    // sur startEditEntry() plus haut — même souci de perte de focus fenêtre
    // après un dialogue natif Electron).
    openConfirmPopup('Voulez-vous vraiment supprimer l\'écriture : ' + confirmLabel + ' ?', async () => {
      try {
        draftError = 'Suppression...';
        renderTable();
        const success = bulk ? await deleteEntries(idsToDelete) : await deleteEntry(entryId);
        if (!success) throw new Error('réponse inattendue du serveur');
        if (lastEntriesResponse && Array.isArray(lastEntriesResponse.entry_array)) {
          const idsSet = new Set(idsToDelete);
          lastEntriesResponse.entry_array = lastEntriesResponse.entry_array.filter(
            (e) => !idsSet.has(e.entry_id !== undefined ? e.entry_id : e.id)
          );
        }
        idsToDelete.forEach((id) => selectedEntryIds.delete(id));
        draftError = '';
        renderTable();
      } catch (e) {
        draftError = 'Échec de la suppression (' + e.message + ').';
        renderTable();
      }
    });
  }

  function renderTable() {
    const tbody = document.getElementById('tmbc-sp-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // NOUVEAU (2026-08-04, demande explicite : "rajoute une fleche de tri
    // sur la colonne jour et N° Ecriture") — met à jour les flèches ▲/▼ dans
    // les en-têtes cliquables (cf. ensureCustomRoot()) pour refléter
    // sortMode à chaque rendu.
    const dayArrowEl = document.getElementById('tmbc-sp-th-day-arrow');
    const idArrowEl = document.getElementById('tmbc-sp-th-id-arrow');
    if (dayArrowEl) dayArrowEl.textContent = sortMode === 'date-asc' ? ' ▲' : sortMode === 'date-desc' ? ' ▼' : '';
    if (idArrowEl) idArrowEl.textContent = sortMode === 'id-asc' ? ' ▲' : sortMode === 'id-desc' ? ' ▼' : '';

    // NOUVEAU (2026-08-04, demande explicite : "j'aimerai inverser l'ordre
    // d'affichage des ecritures [...]" puis "rajoute une option pour trier
    // par date (plus ancien à plus récent, plus récent à plus ancien), tri
    // par id specique") — tri piloté par sortMode (cf. en-têtes cliquables
    // "Jour"/"N° écriture" dans ensureCustomRoot()) : date_piece (format ISO
    // "AAAA-MM-JJ", comparaison de chaînes suffisante) ou entry_id, chacun
    // croissant ou décroissant. Départage par entry_id croissant pour les
    // tris par date (écritures du même jour). .slice() AVANT de trier pour
    // ne jamais muter lastEntriesResponse.entry_array lui-même (relu/filtré
    // ailleurs, cf. deleteEntry()/submitDraft()).
    const entries = (
      (lastEntriesResponse && Array.isArray(lastEntriesResponse.entry_array)) ? lastEntriesResponse.entry_array : []
    )
      .slice()
      .sort((a, b) => {
        const ia = (a.entry_id !== undefined ? a.entry_id : a.id) || 0;
        const ib = (b.entry_id !== undefined ? b.entry_id : b.id) || 0;
        if (sortMode === 'id-asc') return ia - ib;
        if (sortMode === 'id-desc') return ib - ia;
        const da = a.date_piece || '';
        const db = b.date_piece || '';
        if (da !== db) return sortMode === 'date-desc' ? (da < db ? 1 : -1) : (da < db ? -1 : 1);
        return sortMode === 'date-desc' ? ib - ia : ia - ib;
      });
    // v2.32 : ordre d'affichage courant des entry_id, pour calculer la plage
    // d'un Shift+clic sur les cases à cocher (cf. plus bas).
    visibleEntryIdsOrder = entries.map((entry) => (entry.entry_id !== undefined ? entry.entry_id : entry.id));
    entries.forEach((entry, entryIndex) => {
      // NOUVEAU (v2.17, demande explicite : "rajoute les coches devant, je
      // veux pouvoir saisir une ecriture, la modifier ou la supprimer (clic
      // droit > modifier ou clic droit > supprimer)") — id d'écriture lu tel
      // quel depuis la vraie réponse "/entries" (jamais deviné) : entry_id
      // est le nom de champ confirmé côté SERVEUR par sniffing direct du
      // DELETE natif (cf. deleteEntry()) ; on suppose ici que la même clé est
      // exposée en LECTURE sur chaque entrée de entry_array (cohérent avec
      // account_id/diary.id, déjà vus côté lecture) — à confirmer au premier
      // test réel : si absent, le clic droit > Supprimer affichera une erreur
      // explicite plutôt que d'échouer silencieusement (cf. wireHistoryRow()).
      const entryId = entry.entry_id !== undefined ? entry.entry_id : entry.id;

      // BUG CORRIGÉ (2026-08-04, v2.52, retour direct : "j'ai par ex la
      // facture FOGLIA du 24/07 qui a un commentaire et une piece jointe,
      // mais je ne vois pas la piece jointe ajouté sur cette vue (je la
      // voie dans consultation !)") — root cause trouvée en sniffant le
      // réseau EN DIRECT (Network, DevTools) pendant l'ouverture de la PJ
      // FOGLIA depuis la Saisie standard native : la réponse de
      // https://prod-ws.myunisoft.fr/entries/v2?type=e&RO=1&limit=100 (déjà
      // chargée par ce script, cf. installEntriesSniffer()) contient EN
      // RÉALITÉ un champ "pj_list" par écriture, jamais lu jusqu'ici :
      //   "pj_list": [{ "name": "...", "thumbnail": "https://app.myunisoft.
      //     fr/api/ged/ged/document/<id>/preview?x=90&y=120", "link":
      //     "https://app.myunisoft.fr/api/ged/ged/document/<id>",
      //     "document_id": <int> }]
      // pjCounts/pjDocs (jusqu'ici alimentés UNIQUEMENT localement, à
      // l'upload fait DANS la session en cours — cf. commentaire historique
      // sur pjCounts plus haut) sont donc maintenant synchronisés à CHAQUE
      // rendu avec les vraies données serveur, y compris pour les PJ
      // ajoutées via l'appli standard ou une session précédente (jusqu'ici
      // invisibles). Pas de "downloadLink" séparé dans pj_list (contrairement
      // à la réponse d'upload) : "link" est réutilisé pour les deux — à
      // vérifier si un jour la reprise (carryOver, cf. startEditEntry()) est
      // testée sur une PJ pré-existante plutôt qu'uploadée cette session.
      if (entryId !== undefined && entryId !== null && Array.isArray(entry.pj_list)) {
        pjDocs.set(
          entryId,
          entry.pj_list.map((d) => ({
            name: d.name,
            previewLink: d.link,
            downloadLink: d.link,
            thumbnail: d.thumbnail,
            document_id: d.document_id,
          }))
        );
        pjCounts.set(entryId, entry.pj_list.length);
      }

      // v2.33 (demande explicite : "j'aimerai pouvoir la modifier en direct,
      // sans qu'elle passe en bas de la page") — si CETTE écriture est en
      // cours d'édition (cf. startEditEntry()), on affiche ICI, à sa place
      // exacte dans le tableau, les lignes éditables du brouillon
      // (buildDraftRows() — même mécanisme/navigation clavier que la saisie
      // d'une nouvelle écriture, cf. plus bas) au lieu de son rendu
      // historique statique habituel. buildDraftRows() est une déclaration
      // de fonction (hoisted) définie plus bas dans ce même renderTable() —
      // valide même appelée ici, avant sa position textuelle.
      if (editingEntryId !== null && entryId === editingEntryId) {
        buildDraftRows().forEach((tr) => tbody.appendChild(tr));
        return;
      }

      const lines = Array.isArray(entry.entry_list) ? entry.entry_list : [];
      const groupRows = [];
      lines.forEach((line, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.tmbcEntryId = entryId !== undefined && entryId !== null ? String(entryId) : '';
        // Séparateur en gras (une seule ligne épaisse, PAS double — retour
        // explicite : "met une ligne en gras plutot que double ligne")
        // entre chaque LOT d'écriture.
        tr.style.borderTop = idx === 0 ? '3px solid #333' : 'none';
        // NOUVEAU (2026-08-04, demande explicite : "quand je coche une
        // ecriture, mets toutes les lignes de l'écriture en surbrillance")
        // — appliqué ici pour l'état initial/après un renderTable() complet
        // (ex. Shift+clic) ; le clic simple (cf. plus bas) met à jour le DOM
        // directement sans passer par renderTable(), pour rester cohérent
        // avec le choix déjà fait de ne pas re-render à chaque coche.
        if (entryId !== undefined && entryId !== null && selectedEntryIds.has(entryId)) {
          tr.style.background = '#fff3cd';
        }
        const cells = [
          '',
          // NOUVEAU (2026-08-04, demande explicite) : "affiche le jour sur
          // les lignes en dessous des lignes principales" — le Jour est
          // désormais répété sur CHAQUE ligne de l'écriture (plus seulement
          // la première), colonne rétrécie en conséquence (cf. COLUMNS).
          dayFromDate(entry.date_piece),
          (line.account && line.account.account_number) || '',
          line.label || '',
          line.debit !== undefined && line.debit !== null ? formatMoney(line.debit) : '',
          line.credit !== undefined && line.credit !== null ? formatMoney(line.credit) : '',
          line.piece || '',
          line.piece2 || '',
          // Comm., Pj., Contrepartie, Echéance : inchangé (cases spéciales
          // ou vides). Début, Fin (v2.57) : placeholders vides, remplis en
          // arrière-plan par resolveCutoffPeriod() (cf. i===12/13 plus bas).
          // Dernière case vide : colonne "Annuler la modification".
          '', '', '', '', '', '', '',
          // NOUVEAU (2026-08-04) : entry_id affiché sur CHAQUE ligne du lot
          // (comme le Jour), même valeur pour toutes les lignes d'une même
          // écriture — déplacé en toute fin de tableau (demande explicite :
          // "met le numero d'écriture à la fin du tableau, en gris").
          // v2.53 (retour direct : "ne met pas de séparateur de millier sur
          // cette colonne") — .replace() défensif : entryId est déjà un
          // entier propre (jamais formaté), mais on force explicitement
          // l'absence de tout espace/séparateur au cas où un espace
          // insécable se serait glissé via une source amont.
          entryId !== undefined && entryId !== null ? String(entryId).replace(/[^\d-]/g, '') : '',
        ];
        cells.forEach((val, i) => {
          const td = document.createElement('td');
          const col = COLUMNS[i];
          if (col.dim) {
            td.style.color = '#999';
            td.style.whiteSpace = 'nowrap';
            td.style.letterSpacing = 'normal';
          }
          if (i === 0 && idx === 0) {
            // Case à cocher UNIQUEMENT sur la 1ère ligne du lot (comme Jour) —
            // sélection multi-écritures, cf. selectedEntryIds.
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = entryId !== undefined && selectedEntryIds.has(entryId);
            // v2.32 (demande explicite : "je clic sur une premiere case à
            // cocher, je fais shift et clic sur la derniere et ca prendre
            // les ecritures entre les 2") — écoute 'click' (contrairement à
            // 'change', un MouseEvent porte shiftKey). Un Shift+clic
            // sélectionne toute la plage entre la dernière case cliquée
            // normalement et celle-ci (comportement classique type
            // gestionnaire de fichiers) SANS basculer l'état des cases hors
            // plage ; on annule le toggle natif de CETTE case (preventDefault)
            // pour piloter nous-mêmes tout l'état via renderTable().
            cb.addEventListener('click', (e) => {
              if (entryId === undefined || entryId === null) return;
              if (e.shiftKey && lastClickedEntryIndex !== null) {
                e.preventDefault();
                const lo = Math.min(lastClickedEntryIndex, entryIndex);
                const hi = Math.max(lastClickedEntryIndex, entryIndex);
                for (let i = lo; i <= hi; i++) {
                  const id = visibleEntryIdsOrder[i];
                  if (id !== undefined && id !== null) selectedEntryIds.add(id);
                }
                renderTable();
                return;
              }
              lastClickedEntryIndex = entryIndex;
              // Clic normal (sans Shift) : le navigateur a déjà basculé
              // cb.checked AVANT que ce listener 'click' ne s'exécute.
              if (cb.checked) selectedEntryIds.add(entryId);
              else selectedEntryIds.delete(entryId);
              // Surbrillance de TOUTES les lignes du lot, sans renderTable()
              // complet (mise à jour DOM directe, cf. commentaire plus haut).
              const highlight = cb.checked ? '#fff3cd' : '';
              groupRows.forEach((r) => {
                r.style.background = highlight;
              });
            });
            td.appendChild(cb);
          } else if (i === 8 && idx === 0) {
            // NOUVEAU (2026-08-04, demande explicite) : icône "Comm."
            // cliquable UNIQUEMENT sur la 1ère ligne du lot (comme la
            // Saisie standard native, confirmé en direct : le clic sur les
            // lignes suivantes du même lot ne fait rien côté natif non
            // plus — un seul fil de commentaires par écriture entière).
            // v2.27 : affiche le nombre de commentaires connus (rempli en
            // arrière-plan par prefetchCommentCounts(), jamais bloquant pour
            // le rendu du tableau).
            const btn = document.createElement('span');
            btn.dataset.tmbcCommentBtn = entryId !== undefined && entryId !== null ? String(entryId) : '';
            btn.textContent = renderCommentBadge(entryId);
            btn.title = 'Commentaires';
            btn.style.cssText = 'cursor:pointer;';
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              openCommentsPopup(e.clientX, e.clientY, entryId);
            });
            td.appendChild(btn);
          } else if (i === 9 && idx === 0) {
            // NOUVEAU (v2.27, demande explicite : "regarde pour rajouter le
            // trombone + au niveau de la colonne piece jointe ... et la
            // fonctionnalité pour rajouter réellement cette piece jointe")
            // — cf. uploadAttachment() plus haut pour le détail de l'API
            // (POST /document/add_all_types, confirmé en direct par Nicolas
            // avec test1.txt : fichier réellement persisté, relu ensuite
            // depuis Consultation de compte).
            // v2.29 (demande explicite : "je veux aussi voir si pj déjà lié
            // à une écriture (et visualisation eventuelle)") — le clic ouvre
            // désormais un popup listant les PJ connues (cf. openPjPopup())
            // au lieu d'aller direct au sélecteur de fichier.
            const btn = document.createElement('span');
            btn.dataset.tmbcPjBtn = entryId !== undefined && entryId !== null ? String(entryId) : '';
            btn.textContent = renderPjBadge(entryId);
            btn.title = 'Pièces jointes';
            btn.style.cssText = 'cursor:pointer;';
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              hidePjHoverPreview();
              openPjPopup(e.clientX, e.clientY, entryId);
            });
            // v2.32 : aperçu au survol, cf. showPjHoverPreview() plus haut.
            // v2.53 : panneau fixe dans l'espace vide à droite du tableau —
            // ne suit plus le curseur (mousemove retiré).
            btn.addEventListener('mouseenter', () => showPjHoverPreview(entryId));
            btn.addEventListener('mouseleave', hidePjHoverPreview);
            td.appendChild(btn);
          } else if (i === 12 || i === 13) {
            // v2.57 : Début (12) / Fin (13) — période de cut-off CCA/PCA
            // (cf. changelog en tête de fichier + resolveCutoffPeriod()).
            // Sur CHAQUE ligne (contrairement à Comm./Pj., le flag est posé
            // par ligne, pas par écriture entière). cacheKey partagé entre
            // les 2 cellules (Début et Fin d'une même ligne se remplissent
            // ensemble). Case vide + pas d'appel réseau si la ligne n'a pas
            // le flag CCA/PCA (resolveCutoffPeriod() sort tout de suite).
            const cacheKey = entryId + '|' + idx;
            const cached = cutoffPeriodCache.get(cacheKey);
            if (cached !== undefined) {
              td.textContent = cached ? formatDateFr(i === 12 ? cached.start : cached.end) : '';
            } else {
              td.dataset[i === 12 ? 'tmbcCutoffStart' : 'tmbcCutoffEnd'] = cacheKey;
              if (Array.isArray(line.flags) && (line.flags.includes('CCA') || line.flags.includes('PCA'))) {
                resolveCutoffPeriod(entry, line, entryId, idx);
              }
            }
          } else {
            td.textContent = val;
          }
          if (col.mono) td.style.fontFamily = MONO_FONT_STACK;
          if (col.align) td.style.textAlign = col.align;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
        groupRows.push(tr);
      });
      // Clic droit n'importe où sur le lot -> menu Modifier/Supprimer (comme
      // la Saisie standard native, clic droit confirmé par Nicolas).
      groupRows.forEach((tr) => {
        tr.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          openHistoryContextMenu(e.clientX, e.clientY, entry, entryId);
        });
        // NOUVEAU (2026-08-04, demande explicite : "j'aimerai pouvoir
        // modifier une ecriture simplement en double cliquant dessus") —
        // même point d'entrée que le clic droit > Modifier (cf.
        // startEditEntry()), juste un raccourci en plus.
        tr.addEventListener('dblclick', (e) => {
          e.preventDefault();
          startEditEntry(entry, entryId);
        });
      });
    });

    // v2.27 : lance en tâche de fond la récupération du nombre de
    // commentaires par écriture visible (non bloquant, cf.
    // prefetchCommentCounts() ; volontairement pas attendu ici).
    prefetchCommentCounts(entries.map((entry) => (entry.entry_id !== undefined ? entry.entry_id : entry.id)));

    rebuildAccountDatalist();

    // --- Ligne(s) éditable(s) ---
    // v2.33 : ce bloc NE fait plus tbody.appendChild() lui-même — il
    // retourne un tableau de <tr>, appelable depuis DEUX endroits : ici même
    // (nouvelle écriture, ajoutée en bas comme avant) OU depuis
    // entries.forEach plus haut (édition en place d'une écriture existante,
    // cf. startEditEntry()). Déclaration de fonction (hoisted), donc son
    // appel plus haut dans entries.forEach est valide malgré sa position
    // textuelle après.
    function buildDraftRows() {
      const rows = [];
      draft.forEach((line, rowIdx) => {
      const tr = document.createElement('tr');
      // BUG CORRIGÉ (2026-08-04, v2.41, retour direct avec capture d'écran :
      // "rajoute une ligne horitontale entre [la dernière écriture] et
      // intitulé comme au dessus") — même séparateur épais que celui déjà
      // utilisé ENTRE chaque lot d'écriture historique (idx===0 plus haut
      // dans entries.forEach : '3px solid #333'), pour bien marquer la
      // frontière entre la dernière écriture existante et la ligne de
      // saisie (nouvelle écriture EN BAS, ou écriture en cours d'édition
      // affichée en place). Avant : liseré bleu fin (2px), insuffisant pour
      // voir clairement la coupure.
      tr.style.borderTop = rowIdx === 0 ? '3px solid #333' : 'none';
      tr.style.background = '#eef4ff';

      const makeInput = (field, placeholder, width, mono, touchKey) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = line[field];
        input.placeholder = placeholder || '';
        input.setAttribute('data-draft', rowIdx + '-' + field);
        input.style.cssText =
          'width:100%;box-sizing:border-box;border:none;background:transparent;padding:2px 4px;' +
          (mono ? 'font-family:' + MONO_FONT_STACK + ';' : '');
        input.addEventListener('input', () => {
          draft[rowIdx][field] = input.value;
          // v2.13 : taper directement dans l'Intitulé/Pièce 1/Pièce 2 d'une
          // ligne 2+ signale que l'utilisateur a corrigé la valeur reprise
          // par défaut depuis la ligne 1 — on ne l'écrase plus ensuite.
          if (touchKey) draft[rowIdx][touchKey] = true;
        });
        input.addEventListener('keydown', (e) => {
          // NOUVEAU (2026-08-04, demande explicite) : "idem pour alt tab ou
          // echap qui permet de revenir en arrière" — Echap se comporte
          // comme Maj+Tab (recule d'un champ), sans jamais soumettre ni
          // ajouter de ligne, quel que soit le champ où on se trouve.
          if (e.key === 'Escape') {
            e.preventDefault();
            focusDraftStep(input, -1);
            return;
          }
          if (e.key !== 'Enter' && e.key !== 'Tab') return;
          // BUG CORRIGÉ (2026-08-02, v2.15) : constaté en direct sur le champ
          // N° Compte — quand la complétion auto-single-match (v2.13) vient
          // de remplir le champ, laisser le Tab natif du navigateur avancer
          // le focus ne fonctionnait pas de façon fiable (la liste de
          // suggestions native <input list=...> semble parfois "consommer"
          // ce Tab pour se fermer sans laisser le focus avancer). Fix radical
          // : on ne dépend plus JAMAIS du Tab natif pour avancer — Tab ET
          // Entrée sont désormais gérés explicitement ici, de façon identique
          // (avancer/reculer nous-mêmes via focusDraftStep), quel que soit le
          // champ. Un focus() direct sur le champ suivant ferme de toute
          // façon la liste de suggestions au passage (blur implicite).
          e.preventDefault();
          const movingBack = e.shiftKey;
          // NOUVEAU (2026-08-04, demande explicite) : "force la saisie d'un
          // jour, avant de pouvoir passer au champ n° de compte" — on
          // bloque l'avancement (Tab/Entrée) depuis le champ Jour de la
          // ligne 1 tant qu'aucun chiffre n'y a été tapé. Pas de
          // renderTable() ici (garderait/perdrait le focus inutilement) —
          // juste un retour visuel (contour rouge + message de statut).
          if (!movingBack && field === 'day' && rowIdx === 0) {
            const rawDay = input.value.trim();
            if (!rawDay) {
              const statusEl = document.querySelector('#tmbc-sp-status');
              if (statusEl) {
                statusEl.textContent = 'Jour requis avant de continuer.';
                statusEl.style.color = '#c62828';
              }
              input.style.outline = '1px solid #c62828';
              return;
            }
            input.style.outline = '';
          }
          const isLastField = rowIdx === draft.length - 1 && field === 'piece2';
          if (isLastField && !movingBack) {
            const { balanced } = draftBalance();
            if (balanced) submitDraft();
            else addDraftLine(); // écriture pas encore équilibrée -> ligne suivante
          } else if (movingBack) {
            focusDraftStep(input, -1);
          } else {
            focusDraftStep(input, 1);
          }
        });
        return input;
      };

      const cellsDefs = [
        () => document.createElement('td'),
        () => {
          const td = document.createElement('td');
          const input = makeInput('day', 'jj', 40, true);
          if (rowIdx === 0) {
            // Le jour de la ligne 0 fait foi pour toute l'écriture (une
            // seule date_piece par écriture) — on le propage en direct dans
            // les lignes suivantes SANS re-rendre tout le tableau, pour ne
            // pas perdre le focus pendant la frappe.
            input.addEventListener('input', () => {
              // v2.15 : seuls des chiffres, 2 caractères max pendant la
              // frappe (le clamp complet 1..fin de mois se fait au blur, pour
              // ne pas gêner la saisie progressive "1" -> "12").
              const digitsOnly = input.value.replace(/\D/g, '').slice(0, 2);
              if (digitsOnly !== input.value) input.value = digitsOnly;
              draft[rowIdx].day = digitsOnly;
              for (let i = 1; i < draft.length; i++) {
                draft[i].day = digitsOnly;
                const otherEl = document.querySelector('[data-draft="' + i + '-day"]');
                if (otherEl) otherEl.value = digitsOnly;
              }
              // Efface le contour rouge / message "Jour requis" (cf. garde
              // dans le keydown ci-dessus) dès qu'un chiffre est tapé.
              if (digitsOnly) {
                input.style.outline = '';
                const statusEl = document.querySelector('#tmbc-sp-status');
                if (statusEl && statusEl.textContent === 'Jour requis avant de continuer.') {
                  statusEl.textContent = '';
                }
              }
            });
            input.addEventListener('blur', () => {
              // v2.15 (demande explicite) : "forcer un chiffre dans la
              // colonne Jour (entre 1 et 31, 30 ou 28/29 selon la période)" —
              // clamp au vrai nombre de jours du mois/année sélectionnés.
              const raw = input.value.trim();
              if (!raw) return;
              let day = parseInt(raw, 10);
              if (isNaN(day) || day < 1) day = 1;
              const maxDay = daysInSelectedPeriod();
              if (day > maxDay) day = maxDay;
              const formatted = String(day).padStart(2, '0');
              input.value = formatted;
              draft[rowIdx].day = formatted;
              for (let i = 1; i < draft.length; i++) {
                draft[i].day = formatted;
                const otherEl = document.querySelector('[data-draft="' + i + '-day"]');
                if (otherEl) otherEl.value = formatted;
              }
            });
          } else {
            // Lignes 2+ : jour lecture seule, toujours aligné sur la ligne 0
            // (demande explicite : "les lignes 2 et postérieures doivent
            // avoir le même jour que la première ligne"). tabIndex=-1 (v2.13)
            // pour que Tab ET Entrée le sautent tous les deux de la même
            // façon (getDraftFocusableInputs l'exclut déjà via .readOnly,
            // mais Tab natif s'arrêterait dessus sans ce tabIndex).
            input.readOnly = true;
            input.tabIndex = -1;
            input.style.color = '#888';
          }
          td.appendChild(input);
          return td;
        },
        () => {
          const td = document.createElement('td');
          const input = makeInput('account', 'n° compte', 90, true);
          input.setAttribute('list', 'tmbc-sp-accounts-datalist');
          // NOUVEAU (v2.13, demande explicite) : "quand on commence à taper
          // un numéro de compte, si y en a qu'un seul qui s'affiche avec la
          // sélection, il sera automatiquement sélectionné" — dès qu'un seul
          // compte du plan comptable (accountCache, jamais deviné) commence
          // par ce qui est tapé, on complète directement le champ avec son
          // numéro complet. Si le compte tapé n'existe pas du tout dans le
          // plan comptable, on ne bloque rien : Tab/Entrée fonctionnent quand
          // même pour passer au champ suivant (aucun preventDefault ici).
          input.addEventListener('input', (e) => {
            const typed = input.value.trim();
            if (!typed) return;
            let match = null;
            let matchCount = 0;
            accountCache.forEach((info, number) => {
              if (number.indexOf(typed) === 0) {
                matchCount++;
                match = number;
              }
            });
            if (matchCount === 1 && match !== typed) {
              input.value = match;
              draft[rowIdx].account = match;
            }
            // BUG CORRIGÉ (2026-08-04, demande explicite) : "quand je saisie
            // le debut du compte et que je valide le choix dans la liste
            // déroulante avec entrée, il ne passe pas au champ intitulé" —
            // le popup natif <input list=...> (datalist) intercepte ce
            // Entrée pour valider la suggestion : la valeur change bien,
            // mais l'événement keydown correspondant n'arrive jamais
            // jusqu'à notre listener (donc focusDraftStep n'est jamais
            // appelé). Chromium/Electron expose ce cas précis via
            // event.inputType === "insertReplacementText" sur l'événement
            // "input" — c'est notre seul signal fiable qu'une suggestion
            // vient d'être choisie (clic ou clavier) plutôt qu'une frappe
            // normale, donc on avance nous-mêmes au champ suivant ici.
            if (e && e.inputType === 'insertReplacementText') {
              focusDraftStep(input, 1);
            }
          });
          input.addEventListener('focus', () => {
            // Filet de sécurité supplémentaire (v2.10) : si le plan
            // comptable n'est toujours pas chargé au moment où l'utilisateur
            // clique dans ce champ, on retente une dernière fois ici, sans
            // attendre le throttle. On ne rappelle QUE rebuildAccountDatalist
            // (pas renderTable) pour ne pas reconstruire le tableau et faire
            // perdre le focus qu'on vient de donner à ce champ.
            if (!chartOfAccountsLoaded) {
              lastChartAttemptAt = 0;
              if (absorbFullChartOfAccounts()) rebuildAccountDatalist();
            }
          });
          input.addEventListener('blur', () => {
            // BUG CORRIGÉ (2026-08-04, v2.35, retour direct : "ca se met bien
            // en mode edition, mais seulement au bout de 2/3 secondes sans
            // bouger") — ce blur appelait renderTable() COMPLET (tout le
            // tableau reconstruit : tous les <input>, tout le <datalist>
            // natif recréés) pile au moment où le focus se déplace vers le
            // champ suivant (souvent Intitulé) après avoir tapé/choisi un
            // compte. Le clic suivant de Nicolas arrivait donc parfois sur un
            // nœud DOM en cours de remplacement, et le popup natif
            // <input list=...> (datalist) doit finir de se refermer avant que
            // le nouveau champ redevienne réellement interactif — d'où
            // l'attente perçue "sans bouger la souris". Comme pour le champ
            // Jour juste au-dessus (déjà commenté "SANS re-rendre tout le
            // tableau, pour ne pas perdre le focus"), on se contente
            // maintenant de mettre à jour l'input Intitulé DIRECTEMENT en
            // place, sans jamais reconstruire le tableau.
            const acc = resolveAccount(input.value.trim());
            if (acc && !draft[rowIdx].label) {
              draft[rowIdx].label = acc.label;
              const labelEl = document.querySelector('[data-draft="' + rowIdx + '-label"]');
              if (labelEl) labelEl.value = acc.label;
            }
          });
          td.appendChild(input);
          return td;
        },
        () => {
          const td = document.createElement('td');
          const input = makeInput('label', 'intitulé', null, false, 'labelTouched');
          if (rowIdx === 0) {
            // NOUVEAU (v2.13, demande explicite) : "dans 2e ligne et après,
            // ça reprend par défaut l'intitulé de la 1ère ligne" — propagé en
            // direct comme le Jour, mais seulement vers les lignes que
            // l'utilisateur n'a pas corrigées à la main (labelTouched).
            input.addEventListener('input', () => {
              for (let i = 1; i < draft.length; i++) {
                if (draft[i].labelTouched) continue;
                draft[i].label = input.value;
                const otherEl = document.querySelector('[data-draft="' + i + '-label"]');
                if (otherEl) otherEl.value = input.value;
              }
            });
          }
          td.appendChild(input);
          return td;
        },
        () => {
          const td = document.createElement('td');
          const input = makeInput('debit', '0,00', 90, true);
          input.style.textAlign = 'right';
          input.addEventListener('blur', () => attemptAutoSubmit());
          td.appendChild(input);
          return td;
        },
        () => {
          const td = document.createElement('td');
          const input = makeInput('credit', '0,00', 90, true);
          input.style.textAlign = 'right';
          input.addEventListener('blur', () => attemptAutoSubmit());
          td.appendChild(input);
          return td;
        },
        () => {
          const td = document.createElement('td');
          const input = makeInput('piece1', '', null, false, 'piece1Touched');
          if (rowIdx === 0) {
            // idem Intitulé (v2.13) : Pièce 1 de la ligne 1 reprise par
            // défaut sur les lignes suivantes non corrigées.
            input.addEventListener('input', () => {
              for (let i = 1; i < draft.length; i++) {
                if (draft[i].piece1Touched) continue;
                draft[i].piece1 = input.value;
                const otherEl = document.querySelector('[data-draft="' + i + '-piece1"]');
                if (otherEl) otherEl.value = input.value;
              }
            });
          }
          td.appendChild(input);
          return td;
        },
        () => {
          const td = document.createElement('td');
          const input = makeInput('piece2', '', null, false, 'piece2Touched');
          if (rowIdx === 0) {
            // idem Intitulé/Pièce 1 (v2.13) : Pièce 2 de la ligne 1 reprise
            // par défaut sur les lignes suivantes non corrigées.
            input.addEventListener('input', () => {
              for (let i = 1; i < draft.length; i++) {
                if (draft[i].piece2Touched) continue;
                draft[i].piece2 = input.value;
                const otherEl = document.querySelector('[data-draft="' + i + '-piece2"]');
                if (otherEl) otherEl.value = input.value;
              }
            });
          }
          td.appendChild(input);
          return td;
        },
        () => {
          // v2.27 (demande explicite : "je veux pouvoir mettre une piece
          // jointe ou un commentaire sur une écriture que je saisis, pas
          // uniquement sur une écriture existante") — l'écriture n'a pas
          // encore d'entry_id tant qu'elle n'est pas enregistrée : on
          // "empile" ici le commentaire localement (draftExtras.comment),
          // envoyé automatiquement juste après la création réussie (cf.
          // submitDraft()). Bouton visible uniquement sur la 1ère ligne
          // (comme côté historique — un seul fil par écriture entière).
          const td = document.createElement('td');
          if (rowIdx !== 0) {
            td.title = 'Un seul commentaire par écriture (voir 1ère ligne)';
            td.style.color = '#bbb';
            td.textContent = '—';
            return td;
          }
          const btn = document.createElement('span');
          btn.textContent = draftExtras.comment.trim() ? '💬1' : '💬';
          btn.title = 'Commentaire (en attente, envoyé après validation)';
          btn.style.cssText = 'cursor:pointer;';
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = window.prompt('Commentaire (envoyé après validation de l\'écriture) :', draftExtras.comment);
            if (val === null) return;
            draftExtras.comment = val;
            renderTable();
          });
          td.appendChild(btn);
          return td;
        },
        () => {
          // v2.27 : idem pour la pièce jointe — le(s) fichier(s) choisis sont
          // uploadés (uploadAttachment()) juste après la création de
          // l'écriture, avec le entry_id réel reçu du serveur.
          const td = document.createElement('td');
          if (rowIdx !== 0) {
            td.title = 'Une seule liste de pièces jointes par écriture (voir 1ère ligne)';
            td.style.color = '#bbb';
            td.textContent = '—';
            return td;
          }
          const btn = document.createElement('span');
          btn.textContent = draftExtras.files.length ? '📎' + draftExtras.files.length : '📎';
          btn.title = 'Pièce(s) jointe(s) (en attente, envoyée(s) après validation)';
          btn.style.cssText = 'cursor:pointer;';
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.style.display = 'none';
            document.body.appendChild(input);
            input.addEventListener('change', () => {
              const files = input.files ? Array.from(input.files) : [];
              document.body.removeChild(input);
              if (!files.length) return;
              draftExtras.files = draftExtras.files.concat(files);
              renderTable();
            });
            input.click();
          });
          td.appendChild(btn);
          return td;
        },
        () => {
          const td = document.createElement('td');
          td.title = 'Non disponible en saisie directe (hors du schéma API sniffé)';
          td.style.color = '#bbb';
          td.textContent = '—';
          return td;
        },
        () => {
          const td = document.createElement('td');
          td.title = 'Non disponible en saisie directe (hors du schéma API sniffé)';
          td.style.color = '#bbb';
          td.textContent = '—';
          return td;
        },
        () => {
          // v2.57 : Début — pas de saisie/modification de la période de
          // cut-off depuis Saisie Premium pour l'instant (lecture seule sur
          // les lignes historiques uniquement, cf. resolveCutoffPeriod()).
          const td = document.createElement('td');
          td.title = 'Non disponible en saisie directe (lecture seule pour l’instant)';
          td.style.color = '#bbb';
          td.textContent = '—';
          return td;
        },
        () => {
          // v2.57 : Fin — idem Début.
          const td = document.createElement('td');
          td.title = 'Non disponible en saisie directe (lecture seule pour l’instant)';
          td.style.color = '#bbb';
          td.textContent = '—';
          return td;
        },
        () => {
          // NOUVEAU (2026-08-04, demande explicite : "rajoute le bouton
          // 'annuler la modification' à droite de l'écriture (apres la
          // colonne echeance)") — visible uniquement en mode édition
          // (editingEntryId !== null), sur la 1ère ligne du brouillon,
          // comme le bouton équivalent de la barre de contrôles en haut
          // (cf. cancelEditEntry()).
          const td = document.createElement('td');
          if (rowIdx === 0 && editingEntryId !== null) {
            const btn = document.createElement('button');
            btn.textContent = 'Annuler la modification';
            btn.style.cssText = 'font-size:11px;padding:2px 8px;cursor:pointer;white-space:nowrap;';
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              cancelEditEntry();
            });
            td.appendChild(btn);
          }
          return td;
        },
        () => {
          // NOUVEAU (2026-08-04, demande explicite : "est ce que chaque
          // ecriture est lié à une id spécifique. si oui possible de
          // l'afficher ?" puis "met le numero d'écriture à la fin du
          // tableau, en gris (pour montrer que c'est pas modifiable)") —
          // sur une écriture en cours d'ÉDITION (editingEntryId !== null),
          // affiche l'entry_id réel de l'écriture éditée (utile pour la
          // retrouver/la comparer) ; sur une NOUVELLE écriture pas encore
          // enregistrée, aucun entry_id n'existe encore côté serveur
          // (attribué uniquement par createEntry(), cf. submitDraft()) —
          // case vide.
          const td = document.createElement('td');
          if (rowIdx === 0 && editingEntryId !== null) {
            td.textContent = String(editingEntryId).replace(/[^\d-]/g, '');
            td.style.color = '#999';
            td.style.fontFamily = MONO_FONT_STACK;
            td.style.textAlign = 'center';
            td.style.whiteSpace = 'nowrap';
            td.style.letterSpacing = 'normal';
          }
          return td;
        },
      ];
      cellsDefs.forEach((make) => tr.appendChild(make()));
        rows.push(tr);
      });
      return rows;
    }

    // v2.33 : en mode édition, buildDraftRows() a déjà été appelé et inséré
    // EN PLACE depuis entries.forEach plus haut — on ne le rappelle donc PAS
    // ici (créerait un doublon). Hors édition, comportement inchangé :
    // ligne(s) de saisie d'une nouvelle écriture ajoutée(s) en bas.
    if (editingEntryId === null) {
      buildDraftRows().forEach((tr) => tbody.appendChild(tr));
    }

    const statusEl = document.getElementById('tmbc-sp-status');
    if (statusEl) {
      const { totalDebit, totalCredit } = draftBalance();
      statusEl.textContent =
        draftError ||
        (editingEntryId !== null
          ? 'Modification de l\'écriture ' + editingEntryId + ' : ' + formatMoney(totalDebit) + ' / ' + formatMoney(totalCredit)
          : totalDebit || totalCredit
          ? 'Brouillon : ' + formatMoney(totalDebit) + ' / ' + formatMoney(totalCredit)
          : '');
      statusEl.style.color = draftError && draftError.indexOf('Enregistrement') === -1 && draftError.indexOf('Suppression') === -1 ? '#c62828' : '#555';
    }
    // v2.32 : bouton "Annuler la modification" visible uniquement en mode
    // édition (cf. startEditEntry()/cancelEditEntry()).
    const cancelEditBtn = document.getElementById('tmbc-sp-cancel-edit');
    if (cancelEditBtn) cancelEditBtn.style.display = editingEntryId !== null ? 'inline-block' : 'none';
  }

  // --- Panneau custom (Journal + Période + tableau) -----------------------

  function ensureCustomRoot(nodes) {
    let root = document.getElementById(CUSTOM_ROOT_ID);
    if (root && root.isConnected) return root;

    root = document.createElement('div');
    root.id = CUSTOM_ROOT_ID;
    // BUG CORRIGÉ (2026-08-04, retour direct avec capture d'écran annotée :
    // "Laisse un peu de place là ou j'ai mis le trait rouge") — trop peu
    // d'espace entre la barre d'onglets native (Accueil/MANO/+) et le début
    // du panneau Saisie Premium (label "Journal"). Padding-top augmenté (12
    // -> 24px), les autres côtés inchangés.
    root.style.cssText = 'padding:24px 16px 12px 16px;background:#fff;font-family:inherit;';
    root.innerHTML =
      '<div id="tmbc-sp-controls" style="display:flex;align-items:center;gap:16px;padding-bottom:8px;">' +
      '  <strong style="font-size:14px;">Saisie Premium</strong>' +
      '  <label style="font-size:13px;color:#555;">Journal' +
      '    <input id="tmbc-sp-journal" type="text" placeholder="ex : 02" disabled' +
      '      style="margin-left:6px;padding:3px 6px;border:1px solid #bbb;border-radius:3px;width:50px;font-family:' + MONO_FONT_STACK + ';" />' +
      '    <span id="tmbc-sp-journal-name" style="margin-left:6px;color:#555;font-size:12px;"></span>' +
      '  </label>' +
      '  <label style="font-size:13px;color:#555;">Période' +
      '    <input id="tmbc-sp-periode" type="text" placeholder="mm/aaaa" disabled' +
      '      style="margin-left:6px;padding:3px 6px;border:1px solid #bbb;border-radius:3px;width:80px;font-family:' + MONO_FONT_STACK + ';" />' +
      '  </label>' +
      '  <span id="tmbc-sp-spinner" style="display:none;width:13px;height:13px;border:2px solid #ccc;border-top-color:#1565c0;border-radius:50%;animation:tmbc-sp-spin 0.7s linear infinite;"></span>' +
      '  <span id="tmbc-sp-status" style="font-size:12px;"></span>' +
      // v2.32 : bouton visible uniquement en mode édition (cf.
      // startEditEntry()/cancelEditEntry()/renderTable() pour l'affichage).
      '  <button id="tmbc-sp-cancel-edit" style="display:none;font-size:11px;padding:2px 8px;cursor:pointer;">Annuler la modification</button>' +
      '</div>' +
      '<datalist id="tmbc-sp-accounts-datalist"></datalist>' +
      // v2.28 : Intitulé n'est plus "flex" (cf. COLUMNS plus haut) — le
      // tableau n'a donc plus de colonne extensible pour absorber l'espace
      // restant. width:auto (au lieu de 100%) + overflow-x:auto sur le
      // conteneur de scroll évitent un étirement proportionnel indésirable
      // de TOUTES les colonnes (qui aurait cassé les largeurs fixes
      // demandées un peu partout dans ce fichier).
      '<div id="tmbc-sp-scroll" style="overflow-y:auto;overflow-x:auto;">' +
      '  <table id="tmbc-sp-table" style="width:auto;border-collapse:collapse;font-size:13px;table-layout:fixed;">' +
      '    <colgroup>' + COLUMNS.map((c) => '<col style="width:' + c.width + 'px;">').join('') + '</colgroup>' +
      // NOUVEAU (2026-08-04, demande explicite : "rajoute une fleche de tri
      // sur la colonne jour et N° Ecriture, en cliquant dessus, ca trie la
      // colonne (soit date, soit numero écriture) et enleve le champ de
      // l'option") — remplace le <select> "Trier par" (retiré) : en-têtes
      // "Jour" et "N° écriture" cliquables, avec une flèche (▲/▼) mise à
      // jour à chaque renderTable() pour refléter sortMode (cf. plus bas,
      // juste après la création de root — écouteurs de clic dédiés).
      '    <thead><tr>' + COLUMNS.map((c) => {
        if (c.label === 'Jour') {
          return '<th id="tmbc-sp-th-day" style="cursor:pointer;user-select:none;white-space:nowrap;" title="Cliquer pour trier par date">Jour<span id="tmbc-sp-th-day-arrow"></span></th>';
        }
        if (c.label === 'N° écriture') {
          return '<th id="tmbc-sp-th-id" style="cursor:pointer;user-select:none;white-space:nowrap;" title="Cliquer pour trier par N° écriture">N° écriture<span id="tmbc-sp-th-id-arrow"></span></th>';
        }
        return '<th>' + c.label + '</th>';
      }).join('') + '</tr></thead>' +
      '    <tbody id="tmbc-sp-tbody"></tbody>' +
      '  </table>' +
      '</div>';

    nodes.wrapper.insertBefore(root, nodes.topPaper);

    root.querySelector('#tmbc-sp-cancel-edit').addEventListener('click', cancelEditEntry);
    root.querySelector('#tmbc-sp-th-day').addEventListener('click', () => {
      sortMode = sortMode === 'date-asc' ? 'date-desc' : 'date-asc';
      renderTable();
    });
    root.querySelector('#tmbc-sp-th-id').addEventListener('click', () => {
      sortMode = sortMode === 'id-asc' ? 'id-desc' : 'id-asc';
      renderTable();
    });

    // BUG CORRIGÉ (2026-08-02) : "toute la partie haute doit être figée, pas
    // que l'en-tête de colonnes et Journal/Période" — un position:sticky
    // relatif à un ancêtre de scroll AMBIGU (la page entière, dont on ne
    // maîtrise pas la chaîne d'overflow) ne gelait que le bandeau + l'en-tête
    // de colonnes, pas le bandeau natif tout en haut (Accueil/société/icônes),
    // qui défilait quand même avec le reste puisqu'il fait partie du MÊME
    // contexte de scroll que notre contenu. Fix radical : on ne laisse plus
    // JAMAIS la page défiler à cause de nous — seul le <tbody> défile, dans
    // un conteneur à NOUS (#tmbc-sp-scroll, overflow-y:auto, hauteur bornée
    // au viewport restant) ; tout ce qui est au-dessus (bandeau natif +
    // Journal/Période + en-tête de colonnes, ce dernier sticky top:0 mais
    // cette fois relatif à CE conteneur précis, sans ambiguïté) reste donc
    // simplement immobile, puisqu'il n'a plus jamais besoin de défiler.
    const scrollDiv = root.querySelector('#tmbc-sp-scroll');
    const theadRow = root.querySelector('thead tr');
    Array.from(theadRow.children).forEach((th) => {
      th.style.position = 'sticky';
      th.style.top = '0';
      th.style.background = '#fff';
      th.style.zIndex = '2';
    });

    function resizeScrollArea() {
      const top = scrollDiv.getBoundingClientRect().top;
      scrollDiv.style.maxHeight = 'calc(100vh - ' + Math.ceil(top + 16) + 'px)';
    }
    resizeScrollArea();
    window.addEventListener('resize', resizeScrollArea);

    const style = document.createElement('style');
    style.textContent =
      '#' + CUSTOM_ROOT_ID + ' table th, #' + CUSTOM_ROOT_ID + ' table td { padding: 3px 6px; text-align: left; border-bottom: 1px solid #f0f0f0; }' +
      '#' + CUSTOM_ROOT_ID + ' table thead th { border-bottom: 2px solid #ccc; font-weight: 600; color: #444; }' +
      '#' + CUSTOM_ROOT_ID + ' table tbody tr:hover { background: #f7f9ff; }' +
      '@keyframes tmbc-sp-spin { to { transform: rotate(360deg); } }';
    root.appendChild(style);

    return root;
  }

  let lastSyncedKey = null;
  let syncInProgress = false;
  let optionsPopulating = false;
  // NOUVEAU (2026-08-02, v2.14) : Journal/Période sont désormais des champs
  // texte libres (demande explicite) au lieu de <select> — les listes
  // fetchées depuis les composants natifs sont conservées ici en mémoire
  // pour l'affichage du nom du journal et la validation de la période, au
  // lieu d'être converties en <option>.
  let journalOptionsCache = [];
  let periodOptionsCache = [];

  // Résout ce qui a été tapé dans le champ Journal (un CODE seul, ex. "02",
  // ou le libellé complet) contre les journaux réellement proposés par le
  // champ natif (jamais deviné) : correspondance exacte sur le code d'abord,
  // sinon le premier libellé qui commence par ce qui est tapé.
  function findJournalOption(typed) {
    const t = (typed || '').trim().toLowerCase();
    if (!t) return null;
    return (
      journalOptionsCache.find((o) => o.split(/\s*-\s*/)[0].trim().toLowerCase() === t) ||
      journalOptionsCache.find((o) => o.toLowerCase().startsWith(t)) ||
      null
    );
  }

  // Une période n'est acceptée que si elle fait partie de celles réellement
  // proposées par les champs natifs Année/Mois pour CE dossier (periodOptionsCache,
  // jamais devinée) — demande explicite : "tu vérifieras que la période
  // saisie est une des périodes existantes".
  function isValidPeriod(monthYear) {
    return periodOptionsCache.some((o) => o.value === monthYear);
  }

  // NOUVEAU (2026-08-04) : petite roue de chargement CSS affichée pendant
  // toute phase où on interroge les champs natifs Journal/Année/Mois
  // (montage initial + retries refreshJournalOptionsCache/
  // refreshPeriodOptionsCache) — demande explicite : "tu peux mettre une roue
  // de la mort le temps du chargement des journaux et périodes".
  function showLoadingSpinner() {
    const el = document.getElementById('tmbc-sp-spinner');
    if (el) el.style.display = 'inline-block';
  }
  function hideLoadingSpinner() {
    const el = document.getElementById('tmbc-sp-spinner');
    if (el) el.style.display = 'none';
  }

  async function populateCustomFields(root) {
    if (optionsPopulating || root.dataset.tmbcPopulated) return;
    optionsPopulating = true;
    const statusEl = root.querySelector('#tmbc-sp-status');
    const journalInput = root.querySelector('#tmbc-sp-journal');
    const periodeInput = root.querySelector('#tmbc-sp-periode');
    showLoadingSpinner();
    try {
      statusEl.textContent = 'Chargement des journaux/périodes…';
      const journalField = findLabelInput('Journal');
      journalOptionsCache = journalField ? await fetchNativeOptions(journalField.input) : [];
      periodOptionsCache = await buildPeriodOptions();

      journalInput.disabled = false;
      periodeInput.disabled = false;
      statusEl.textContent = '';
      root.dataset.tmbcPopulated = '1';
      console.debug('[Saisie Premium] journalOptionsCache peuplé:', journalOptionsCache.length, 'entrées —', journalOptionsCache);
    } catch (e) {
      statusEl.textContent = 'Erreur de chargement des listes — réessaie.';
    } finally {
      optionsPopulating = false;
      hideLoadingSpinner();
    }
  }

  // Rappel manuel pour diagnostic en direct depuis les DevTools de l'appli
  // (Ctrl+Shift+I) : "Journal inconnu" constaté en direct sur un journal/une
  // période pourtant existants (Nicolas, 2026-08-04, dossier CHAPI 1, "AC" +
  // 07/2026) — `window.tmbcDebugJournals()` réaffiche l'état courant du cache
  // sans attendre un nouveau montage de page.
  window.tmbcDebugJournals = function () {
    console.log('[Saisie Premium] journalOptionsCache =', journalOptionsCache);
    console.log('[Saisie Premium] periodOptionsCache =', periodOptionsCache);
    console.log('[Saisie Premium] contient "AC" ?', journalOptionsCache.some((o) => o.split(/\s*-\s*/)[0].trim().toLowerCase() === 'ac'));
    return { journalOptionsCache, periodOptionsCache };
  };

  // Rappel manuel diagnostic (v2.20) : teste commitNativeJournal() /
  // findLabelInput('Journal') isolément, sans passer par tout tryTrigger(),
  // pour distinguer un souci de cache (journalOptionsCache) d'un souci de
  // pilotage du champ natif lui-même (listbox introuvable / mauvais champ
  // trouvé / timeout). `window.tmbcTestJournal("AC - ACHATS")` depuis les
  // DevTools.
  window.tmbcTestJournal = async function (typedText) {
    const field = findLabelInput('Journal');
    console.log('[Saisie Premium] findLabelInput("Journal") =', field, '— input trouvé ?', !!(field && field.input));
    if (field && field.input) {
      console.log('[Saisie Premium] valeur actuelle du champ natif Journal =', JSON.stringify(field.input.value));
    }
    const result = await commitNativeJournal(typedText);
    console.log('[Saisie Premium] commitNativeJournal(', JSON.stringify(typedText), ') =', result);
    return result;
  };

  // BUG CORRIGÉ (2026-08-04, v2.18) : constaté en direct par Nicolas — sur le
  // tout premier montage de Saisie Premium d'une session (dossier CHAPI 1,
  // "AC" + "07/2026", tous deux réellement existants), le champ affichait
  // "Journal inconnu" ; en retapant ensuite un AUTRE journal ("BECM", qui a
  // fonctionné) puis en revenant à "AC", tout se résolvait correctement. Même
  // race déjà rencontrée et corrigée pour le plan comptable
  // (absorbFullChartOfAccounts, cf. commentaire v2.10 plus haut) : le prop
  // React `options` du champ natif Journal/Année/Mois se peuple de façon
  // ASYNCHRONE après le montage de la page, et le tout premier
  // fetchNativeOptions() de populateCustomFields() (déclenché dès l'arrivée
  // sur la page) peut arriver trop tôt et lire une liste incomplète, mise en
  // cache une seule fois pour toute la session. Reproduit en direct sur une
  // toute NOUVELLE navigation Tenue > Saisie Premium (pas un onglet réutilisé) :
  // le tout premier essai échoue, un second essai sur le même journal réussit.
  // Fix : si la résolution échoue, on retente UNE fois un rafraîchissement
  // réel (même fonction sniffée fetchNativeOptions/buildPeriodOptions, jamais
  // une nouvelle source) avant de conclure à un vrai "Journal inconnu" /
  // "Période inexistante" — cf. tryTrigger().
  async function refreshJournalOptionsCache() {
    const journalField = findLabelInput('Journal');
    if (!journalField) return false;
    showLoadingSpinner();
    try {
      journalOptionsCache = await fetchNativeOptions(journalField.input);
      console.debug('[Saisie Premium] journalOptionsCache RAFRAÎCHI (retry) :', journalOptionsCache.length, 'entrées —', journalOptionsCache);
      return journalOptionsCache.length > 0;
    } finally {
      hideLoadingSpinner();
    }
  }

  async function refreshPeriodOptionsCache() {
    showLoadingSpinner();
    try {
      periodOptionsCache = await buildPeriodOptions();
      console.debug('[Saisie Premium] periodOptionsCache RAFRAÎCHI (retry) :', periodOptionsCache.length, 'entrées —', periodOptionsCache);
      return periodOptionsCache.length > 0;
    } finally {
      hideLoadingSpinner();
    }
  }

  // NOUVEAU (2026-08-02, v2.15, demande explicite) : "si je suis sur le champ
  // journal, et que je fais touche F4, il doit m'ouvrir une liste des codes
  // journaux dispos (avec l'intitulé en description). Sur le champ période,
  // idem". Petite liste déroulante maison ancrée sous le champ — construite
  // à partir des mêmes listes déjà fetchées depuis les composants natifs
  // (journalOptionsCache / periodOptionsCache), jamais devinée.
  let lookupPopupEl = null;
  let lookupPopupCloseHandler = null;
  let lookupItems = [];
  let lookupRows = [];
  let lookupSelectedIndex = -1;
  let lookupOnSelect = null;

  // NOUVEAU (2026-08-02, v2.16, demande explicite) : "quand la liste est
  // ouverte, si je commence à taper le début du journal ou de la période, il
  // doit aller dessus, pour que j'ai juste à taper Entrée ou tab pour le
  // selectionner" — surbrillance qui suit la frappe dans le champ ancre,
  // navigation flèches, sélection par Entrée/Tab.
  function lookupSetSelected(i) {
    if (lookupSelectedIndex >= 0 && lookupRows[lookupSelectedIndex]) {
      lookupRows[lookupSelectedIndex].style.background = '';
    }
    lookupSelectedIndex = i;
    if (i >= 0 && lookupRows[i]) {
      lookupRows[i].style.background = '#d7e6ff';
      lookupRows[i].scrollIntoView({ block: 'nearest' });
    }
  }

  // Cherche le premier item dont le code (value) ou le libellé (label)
  // commence par ce qui est tapé, et le met en surbrillance. Jamais deviné :
  // ne compare qu'aux items réellement fournis (journalOptionsCache /
  // periodOptionsCache, eux-mêmes issus des composants natifs).
  function lookupJumpToTyped(typedRaw) {
    const typed = (typedRaw || '').trim().toLowerCase();
    if (!typed) {
      lookupSetSelected(-1);
      return;
    }
    const idx = lookupItems.findIndex(
      (it) => it.value.toLowerCase().indexOf(typed) === 0 || it.label.toLowerCase().indexOf(typed) === 0
    );
    lookupSetSelected(idx);
  }

  function lookupConfirmSelection() {
    if (lookupSelectedIndex < 0 || !lookupItems[lookupSelectedIndex]) {
      closeLookupPopup();
      return;
    }
    const item = lookupItems[lookupSelectedIndex];
    const cb = lookupOnSelect;
    closeLookupPopup();
    if (cb) cb(item);
  }

  function closeLookupPopup() {
    if (lookupPopupEl) {
      lookupPopupEl.remove();
      lookupPopupEl = null;
    }
    if (lookupPopupCloseHandler) {
      document.removeEventListener('mousedown', lookupPopupCloseHandler, true);
      lookupPopupCloseHandler = null;
    }
    lookupItems = [];
    lookupRows = [];
    lookupSelectedIndex = -1;
    lookupOnSelect = null;
  }

  function openLookupPopup(anchorInput, items, onSelect) {
    closeLookupPopup();
    lookupItems = items;
    lookupOnSelect = onSelect;
    const rect = anchorInput.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.style.cssText =
      'position:fixed;left:' + Math.round(rect.left) + 'px;top:' + Math.round(rect.bottom + 2) + 'px;' +
      'min-width:' + Math.max(Math.round(rect.width), 220) + 'px;max-height:260px;overflow-y:auto;' +
      'background:#fff;border:1px solid #999;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.18);' +
      'z-index:99999;font-size:13px;';
    lookupRows = items.map((item) => {
      const row = document.createElement('div');
      row.textContent = item.label;
      row.style.cssText = 'padding:4px 8px;cursor:pointer;white-space:nowrap;';
      row.addEventListener('mouseenter', () => {
        lookupSetSelected(lookupRows.indexOf(row));
      });
      row.addEventListener('mouseleave', () => {
        if (lookupRows[lookupSelectedIndex] === row) row.style.background = '';
      });
      // mousedown (pas click) : agit AVANT que le blur du champ ne referme
      // le popup, sinon le clic sur une ligne n'atteint jamais son handler.
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        lookupSetSelected(lookupRows.indexOf(row));
        lookupConfirmSelection();
      });
      popup.appendChild(row);
      return row;
    });
    document.body.appendChild(popup);
    lookupPopupEl = popup;
    lookupPopupCloseHandler = (e) => {
      if (!popup.contains(e.target) && e.target !== anchorInput) closeLookupPopup();
    };
    document.addEventListener('mousedown', lookupPopupCloseHandler, true);
    // Surbrillance initiale sur ce qui est déjà tapé dans le champ au moment
    // où F4 est pressé (ex. l'utilisateur avait déjà tapé "02" avant F4).
    lookupJumpToTyped(anchorInput.value);
  }

  function wireCustomInputs(root) {
    const journalInput = root.querySelector('#tmbc-sp-journal');
    const periodeInput = root.querySelector('#tmbc-sp-periode');
    const journalNameEl = root.querySelector('#tmbc-sp-journal-name');
    const statusEl = root.querySelector('#tmbc-sp-status');

    populateCustomFields(root);

    if (journalInput.dataset.tmbcWired) return;
    journalInput.dataset.tmbcWired = '1';
    periodeInput.dataset.tmbcWired = '1';

    // Affiche le nom du journal résolu À CÔTÉ du champ (hors du champ,
    // demande explicite), mis à jour à chaque frappe.
    journalInput.addEventListener('input', () => {
      const typed = journalInput.value.trim();
      if (!typed) {
        journalNameEl.textContent = '';
        return;
      }
      const match = findJournalOption(typed);
      journalNameEl.textContent = match ? match.split(/\s*-\s*/).slice(1).join(' - ').trim() : 'Journal inconnu';
      journalNameEl.style.color = match ? '#555' : '#c62828';
    });

    async function tryTrigger() {
      const journalTyped = journalInput.value.trim();
      const periodTyped = periodeInput.value.trim();
      if (!journalTyped || !periodTyped) return;

      let journalMatch = findJournalOption(journalTyped);
      if (!journalMatch) {
        // v2.18 : 1er essai de la session parfois trop tôt (cf. commentaire
        // sur refreshJournalOptionsCache()) — un seul retry réel avant de
        // conclure à un vrai échec.
        const refreshed = await refreshJournalOptionsCache();
        journalMatch = refreshed ? findJournalOption(journalTyped) : null;
        if (!journalMatch) {
          statusEl.textContent = 'Journal inconnu.';
          return;
        }
        // Le retry a réussi : corrige l'affichage instantané à côté du champ
        // (posé par le listener 'input' synchrone, qui avait conclu trop tôt
        // à "Journal inconnu" avant ce retry).
        journalNameEl.textContent = journalMatch.split(/\s*-\s*/).slice(1).join(' - ').trim();
        journalNameEl.style.color = '#555';
      }

      const parsedPeriod = parsePeriodInput(periodTyped);
      if (!parsedPeriod) {
        statusEl.textContent = 'Période invalide (ex. 06/2025, 0625 ou 062025).';
        return;
      }
      // NOUVEAU (v2.14) : mise en forme immédiate dans le champ dès que le
      // format saisi est reconnu (0626 / 022026 / 06/26 / 06/2026 -> mm/aaaa),
      // demande explicite "tu mettras en forme directement".
      const formattedPeriod = String(parsedPeriod.month).padStart(2, '0') + '/' + parsedPeriod.year;
      periodeInput.value = formattedPeriod;
      if (!isValidPeriod(formattedPeriod)) {
        // v2.18 : même retry que pour le journal (cf. plus haut).
        const refreshed = await refreshPeriodOptionsCache();
        if (!refreshed || !isValidPeriod(formattedPeriod)) {
          statusEl.textContent = 'Période ' + formattedPeriod + ' inexistante pour ce dossier.';
          return;
        }
      }

      const key = journalMatch + '|' + formattedPeriod;
      if (key === lastSyncedKey || syncInProgress) return;

      syncInProgress = true;
      statusEl.textContent = 'Chargement...';
      try {
        const resolvedJournal = await commitNativeJournal(journalMatch);
        if (!resolvedJournal) {
          statusEl.textContent = 'Journal inconnu.';
          return;
        }
        const periodOk = await commitNativePeriod(parsedPeriod);
        if (!periodOk) {
          statusEl.textContent = 'Année/mois indisponible dans ce dossier.';
          return;
        }
        const periodDisplay = currentNativePeriodDisplay();
        currentFilterJournalCode = resolvedJournal.split(/\s*-\s*/)[0].trim();
        currentFilterPeriod = periodDisplay;
        draft = blankDraft();
        draftExtras = blankDraftExtras();
        editingEntryId = null;
        draftError = '';
        const ok = await applyNativeHistoryFilters(resolvedJournal, periodDisplay);
        if (ok) {
          statusEl.textContent = '';
          lastSyncedKey = key;
          renderTable();
          focusFirstDraftCell();
          // BUG CORRIGÉ (2026-08-02, v2.10) : le prop React `options` du champ
          // natif N°Compte se peuple de façon ASYNCHRONE après le montage de
          // la page — le tout premier essai automatique (au chargement) arrive
          // souvent trop tôt et échoue légitimement (constaté en usage réel :
          // "34 <input> scannés, meilleur = null"), et le nouvel essai
          // périodique ne revenait ensuite jamais (scanSaisiePremium cesse de
          // retrouver locateLayoutNodes() de façon fiable une fois qu'un
          // journal/période est déjà sélectionné). Plutôt que de dépendre du
          // scan périodique, on retente EXPLICITEMENT ici, juste après un
          // chargement d'historique réussi — un moment où l'on sait que la
          // page est complètement montée (vérifié en direct : la même
          // recherche réussit à coup sûr à ce stade, 513 comptes trouvés).
          if (!chartOfAccountsLoaded) {
            lastChartAttemptAt = 0; // force un essai immédiat, sans attendre le throttle de 3s
            if (absorbFullChartOfAccounts()) renderTable();
          }
        } else {
          statusEl.textContent = "Impossible de charger l'historique.";
        }
      } finally {
        syncInProgress = false;
      }
    }

    // NOUVEAU (v2.14) : champs texte au lieu de <select> — on déclenche sur
    // Entrée (validation explicite) et sur blur (l'utilisateur quitte le
    // champ), plutôt que sur 'change' qui n'existe plus de la même façon.
    [journalInput, periodeInput].forEach((inp) => {
      inp.addEventListener('blur', () => setTimeout(tryTrigger, 0));
      // NOUVEAU (v2.16, demande explicite) : quand le popup F4 est ouvert,
      // ce champ ne déclenche plus tryTrigger()/le comportement Tab normal —
      // les flèches déplacent la surbrillance, et Entrée/Tab valident
      // l'item en surbrillance dans la liste au lieu de leur usage habituel.
      inp.addEventListener('keydown', (e) => {
        if (lookupPopupEl) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            lookupSetSelected(Math.min(lookupItems.length - 1, lookupSelectedIndex + 1));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            lookupSetSelected(Math.max(0, lookupSelectedIndex - 1));
            return;
          }
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            lookupConfirmSelection();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            closeLookupPopup();
            return;
          }
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          tryTrigger();
        }
      });
      // Type-ahead : tant que le popup F4 est ouvert, chaque frappe dans le
      // champ met à jour la surbrillance sur l'item correspondant.
      inp.addEventListener('input', () => {
        if (lookupPopupEl) lookupJumpToTyped(inp.value);
      });
    });

    // NOUVEAU (v2.15, demande explicite) : F4 = liste des valeurs possibles.
    journalInput.addEventListener('keydown', (e) => {
      if (e.key !== 'F4') return;
      e.preventDefault();
      const items = journalOptionsCache.map((o) => ({ value: o.split(/\s*-\s*/)[0].trim(), label: o }));
      openLookupPopup(journalInput, items, (item) => {
        journalInput.value = item.value;
        journalInput.dispatchEvent(new Event('input', { bubbles: true }));
        tryTrigger();
      });
    });
    periodeInput.addEventListener('keydown', (e) => {
      if (e.key !== 'F4') return;
      e.preventDefault();
      openLookupPopup(periodeInput, periodOptionsCache, (item) => {
        periodeInput.value = item.value;
        tryTrigger();
      });
    });
  }

  // --- Boucle principale ---------------------------------------------------

  let currentNodes = null;

  function applyPremiumLayout(nodes) {
    installEntriesSniffer();
    currentNodes = nodes;
    hideKeepingOffsetParent(nodes.headerContainer);
    hideKeepingOffsetParent(nodes.filtersBlock);
    hideCompletely(nodes.historicalPaperNative);
    // Toute la grille de nouvelle écriture native + ses actions (2e/3e
    // enfants de topPaper) : plus jamais pilotée en v2.0 (écriture directe
    // via l'API), masquage complet.
    Array.from(nodes.topPaper.children).forEach((child, i) => {
      if (i > 0) hideCompletely(child);
    });
    hideLegacyPeriodOverlay();
    const root = ensureCustomRoot(nodes);
    wireCustomInputs(root);
    // Tenté à chaque passage tant que non réussi (les champs "N° Compte"
    // native peuvent ne pas être montés dès le tout premier tick) ; devient
    // un no-op une fois le plan comptable complet absorbé (chartOfAccountsLoaded).
    // v2.37 : même précaution que pour installEntriesSniffer() ci-dessus —
    // ne jamais reconstruire le tableau pendant une édition en cours, même
    // pour ce chargement (normalement unique) du plan comptable.
    if (!chartOfAccountsLoaded && absorbFullChartOfAccounts() && editingEntryId === null) {
      renderTable();
    }
  }

  // BUG CORRIGÉ (2026-08-02) : diaryCache/accountCache sont des Maps GLOBALES
  // au module, jamais vidées — l'appli garde plusieurs onglets de société
  // montés simultanément dans la MÊME fenêtre (ex. "TLAJ GEMEHL" à côté de
  // "CHAPI 1", déjà documenté comme source de contamination croisée pour
  // l'affichage en v1.7, cf. responseMatchesCurrentFilter) et le patch XHR
  // global intercepte les réponses "/entries" de N'IMPORTE QUEL onglet, actif
  // ou non. absorbEntriesIntoCache()/absorbFullChartOfAccounts() n'avaient
  // AUCUNE protection équivalente : un diary_id ou account_id résolu pouvait
  // donc appartenir à un AUTRE dossier que celui réellement affiché,
  // provoquant un rejet serveur générique ("GBL1 - Une erreur est survenue
  // lors du traitement", constaté en test réel) au moment du POST /entry.
  // Fix : on vide les deux caches (+ le flag chartOfAccountsLoaded) dès que
  // l'etablissement_id courant (segment /tab/<id>/ de l'URL) change.
  let lastEtablissementId = null;
  function guardAgainstDossierSwitch() {
    const id = currentEtablissementId();
    if (id !== null && id !== lastEtablissementId) {
      console.debug('[Saisie Premium] changement de dossier détecté (', lastEtablissementId, '->', id, ') — caches vidés.');
      diaryCache.clear();
      accountCache.clear();
      chartOfAccountsLoaded = false;
      // BUG CORRIGÉ (2026-08-04, v2.19) : constaté en direct par Nicolas —
      // "j'ai été mis dessus [MANO]. y a déjà des écritures affichées avant
      // que je mette le journal... je met AC et 07/2026, ça me met journal
      // inexistant ! alors qu'il existe" : le panneau custom (racine
      // CUSTOM_ROOT_ID) est un singleton réutilisé tel quel d'un onglet/
      // dossier à l'autre par ensureCustomRoot() (il n'est jamais recréé tant
      // qu'un nœud avec cet id existe déjà dans le DOM) — journalOptionsCache/
      // periodOptionsCache/lastEntriesResponse et même le TEXTE tapé dans
      // Journal/Période restaient donc ceux du dossier PRÉCÉDENT (ex. "AC" de
      // CHAPI 1, absent des journaux de MANO) au lieu d'être vidés comme
      // diaryCache/accountCache l'étaient déjà. Fix : on retire complètement
      // la racine custom (nœud À NOUS, jamais natif — retrait autorisé, cf.
      // removePremiumRoot un peu plus haut) dès qu'un changement de dossier
      // est détecté, pour forcer ensureCustomRoot()/populateCustomFields() à
      // tout reconstruire proprement pour le NOUVEAU dossier au prochain scan.
      const staleRoot = document.getElementById(CUSTOM_ROOT_ID);
      if (staleRoot) staleRoot.remove();
      journalOptionsCache = [];
      periodOptionsCache = [];
      lastEntriesResponse = null;
      currentFilterJournalCode = null;
      currentFilterPeriod = null;
      lastSyncedKey = null;
      selectedEntryIds.clear();
      lastEtablissementId = id;
    }
  }

  function scanSaisiePremium() {
    if (isDisabled()) {
      restoreNativeSaisieLayout();
      removePremiumMenuItem();
      return;
    }

    ensurePremiumMenuItem();
    wireNativeSaisieLiClearsPremiumFlag();

    if (!isSaisiePage() || !isPremiumModeOn()) {
      restoreNativeSaisieLayout();
      return;
    }

    guardAgainstDossierSwitch();

    const nodes = locateLayoutNodes();
    if (!nodes) return;

    try {
      applyPremiumLayout(nodes);
    } catch (e) {
      // défensif : un re-rendu React en cours peut invalider un nœud entre
      // deux lectures — on ne casse jamais le reste du scan pour ça.
    }
  }

  registerScan(scanSaisiePremium);
})();
