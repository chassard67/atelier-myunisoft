// ==UserScript==
// @name         MyUnisoft - Saisie (nouvelle écriture)
// @namespace    https://nicolas.chassard/myunisoft
// @version      2.26-ext
// @description  v2.26 (2026-11-12) : PORTAGE EXTENSION CHROME « Atelier MyUnisoft » — aucun changement fonctionnel, le module tourne désormais dans l'extension (même contexte de page que le preload).
//               v2.22 (2026-08-01) : deux demandes de Nicolas. (1) Synchronisation automatique du
//               panneau de filtres "Ecriture" (partie basse : Du, Au, Journaux) après validation
//               d'une écriture — "ça fausse l'affichage" sinon. Confirmé en direct (Claude in
//               Chrome) que le désalignement existe dès qu'on change le Journal en haut, sans même
//               valider. onValiderClicked() capture Journal + Période (formatPeriodDisplay, déjà
//               existant) au moment du clic, attend la confirmation visuelle d'enregistrement
//               (bouton Valider redevenu disabled ET Total écriture Débit/Crédit revenus à
//               "0,00 €" — les 2 ensemble pour ne pas confondre avec le bref instant où le bouton
//               est déjà désactivé PENDANT l'enregistrement), puis syncBottomFiltersWithHeader()
//               calcule Du/Au (01/MM/AAAA -> dernier jour du mois via new Date(year, month,
//               0).getDate(), qui gère nativement les fins de mois à 28/29/30/31 et les années
//               bissextiles sans table de correspondance) et pilote le champ "Journaux" du bas
//               (retrait de toute puce existante + sélection du nouveau journal en tapant son
//               libellé dans l'Autocomplete, vérifié en direct — plus fiable que ArrowDown seul
//               sur une liste potentiellement longue), puis clique "Appliquer les filtres".
//               setNativeValue (Du/Au) porté depuis autofill.js, seul autre endroit du projet à
//               devoir écrire dans un <input> contrôlé par React. (2) Le champ Période flottant
//               (z-index 2147483647, volontairement au-dessus de tout) restait visible PAR-DESSUS
//               le popover natif "Ouvrir une société" (clic sur le "+" à droite des onglets
//               société, capture jointe) — isBlockingPopoverOpen() étend le masquage déjà en place
//               pour les méga-menus plein écran (isFullScreenMenuOverlayOpen). Détection non
//               triviale, affinée par 2 vérifications en direct : offsetParent est inutilisable
//               sur .MuiPopover-root lui-même (position:fixed, donc TOUJOURS offsetParent===null,
//               ouvert ou pas) ; et la seule présence de .MuiPopover-root dans le DOM n'est pas non
//               plus fiable seule (peut y rester après fermeture selon le chemin emprunté) — la
//               taille réellement rendue (getBoundingClientRect) du .MuiPopover-paper ENFANT
//               (pas en position:fixed, lui) s'est avérée être le seul signal fiable sur les 3
//               états testés (fermé/ouvert/après fermeture). Confirmé que les dropdowns Journal/
//               Mois/Année de ce script utilisent un wrapper différent (.MuiAutocomplete-popper),
//               aucun risque de se masquer soi-même en pleine utilisation d'un de ces champs.
//               v2.21 (2026-07-31) : Retour de Nicolas : "si j'ouvre 2 sociétés avec la partie
//               saisie, les champs Période ne doivent pas se mélanger" — confirmé : l'app garde
//               plusieurs onglets de société montés en même temps dans le même document (un seul
//               visible à la fois, les autres cachés plutôt que démontés). findLabeledField()
//               (utilisé pour Journal/Devise/Année/Mois/Solde/N° de compte) et
//               findEcritureAccordionSummary() prenaient le PREMIER élément du DOM correspondant
//               au texte recherché, sans se soucier de sa visibilité — un onglet société INACTIF
//               placé avant l'onglet actif dans l'ordre du DOM pouvait donc être ciblé par erreur,
//               et le cache restait bloqué dessus tant qu'il reste connecté (ce qui est justement
//               le cas d'un onglet cachÉ, pas démonté). Fix : ajout d'un filtre de visibilité
//               (offsetParent non nul, qui exclut tout display:none — y compris un ancêtre
//               d'onglet société caché) sur ces deux fonctions ET sur findGridColumnByColumnKey
//               (premium.js, fonction partagée par tous les modules, même risque pour les
//               grilles). Vérifié via un scénario simulé à 2 "sociétés" (2 champs "Journal"
//               identiques dans le DOM, un caché un visible) : le code retrouve désormais
//               systématiquement le bon.
//               v2.20 (2026-07-31) : Retour de Nicolas (capture "Tenue... Saisie/Consultation") :
//               "quand je clique sur un menu, il affiche par erreur les champs qu'on a rajouté
//               dans la saisie" — root cause : les méga-menus de navigation (ex. "Tenue",
//               "Déclarations") s'affichent en overlay (.MuiDialog-paperFullScreen) PAR-DESSUS la
//               page Saisie sans changer l'URL, donc isSaisiePage() restait vrai pendant qu'un tel
//               menu était ouvert, et notre champ Période / Mois-Année repositionnés (ajoutés à
//               document.body ou en position:fixed, donc au-dessus de tout) continuaient de
//               s'afficher par-dessus le menu. Fix : détection de cet overlay (même sélecteur que
//               celui déjà utilisé dans premium.js pour l'exclure du recentrage 60vw) ; en plus de
//               retirer notre propre champ flottant, les champs NATIFS Mois/Année sont maintenant
//               aussi remis en visibility:hidden tant que l'overlay est ouvert (ils restaient
//               visibles avec notre position:fixed actif, la page Saisie restant montée dessous) —
//               retrouvés via un cache rempli par ensurePeriodField (leur libellé "Mois" étant
//               renommé, on ne peut plus les retrouver par findLabeledField('Mois')).
//               v2.19 (2026-07-31) : Retours de Nicolas (capture "Modèle Automatique/Annuler/
//               Valider... Ecriture... Contrepartie") : (1) "marche pas pour la colonne
//               Contrepartie" (en-tête encore sur 2 lignes malgré le +30px de la v2.18) — plutôt
//               que retenter une nouvelle valeur de compensation au pifomètre, imposé un plancher
//               de largeur généreux (130px, "Contrepartie" fait 12 caractères ≈ 96px + padding)
//               qui garantit qu'elle ne wrappe plus jamais, quel que soit le delta calculé ; la
//               compensation prise sur Règlement s'ajuste automatiquement pour correspondre au
//               gain RÉEL de Contrepartie (peut dépasser 30px si le plancher a dû relever la
//               cible) — vérifié par le calcul sur plusieurs largeurs natives hypothétiques
//               (100/150/200/406px). (2) "par défaut la partie Ecritures doit être réduite à
//               l'ouverture de la page" (régression) — root cause : le drapeau
//               ecritureAccordionHandled était verrouillé À TORT dans la même passe que l'appel à
//               .click(), sans jamais revérifier que le clic avait réellement replié le panneau ;
//               si le clic n'aboutissait pas du premier coup (timing React au tout premier scan),
//               le drapeau restait verrouillé pour de bon et le panneau ne se repliait jamais.
//               Fix : on ne verrouille désormais QUE lorsqu'on constate que le panneau est
//               replié, on retente sinon à chaque scan (avec un court délai anti-double-clic).
//               v2.18 (2026-07-31) : Retour de Nicolas (capture "Contrepartie/Echéance/Date
//               Saisie/Règlement") : "élargis un tout petit peu la colonne Contrepartie pour
//               éviter le problème d'en-tête sur 2 lignes, et réduit la partie Règlement pour
//               compenser" — Contrepartie récupère +30px (donc -50px net par rapport à sa largeur
//               native au lieu de -80px), et ces 30px sont retranchés à la colonne Règlement
//               (payment_type), avec la même logique de mesure native mise en cache une seule
//               fois (jamais de valeur absolue codée en dur).
//               v2.17 (2026-07-31) : Retour de Nicolas : "t'as merdé sur la partie basse, le
//               journal est à moitié masqué, plus de séparateur entre Param IB et Contrepartie...
//               reprend la version d'avant, refais l'élargissement de l'intitulé et la réduction
//               de la contrepartie" — root cause : la v2.16 fixait Intitulé/Contrepartie à des
//               largeurs ABSOLUES codées en dur, déduites d'une mesure prise dans un onglet
//               Chrome déconnecté de l'application réelle (n'exécute pas ce script) — rien ne
//               garantissait que cette mesure de Contrepartie (406px) correspondait à sa largeur
//               RÉELLE chez Nicolas, d'où la casse (colonnes suivantes écrasées). Fix : Intitulé/
//               Contrepartie ne sont plus fixées à des valeurs absolues ; leur largeur NATIVE
//               réelle est mesurée une seule fois (mise en cache au tout premier scan après
//               rechargement de la page, avant toute modification), puis le delta demandé
//               (+10/-10 caractères, soit ±80px) est appliqué à cette valeur réellement observée
//               — le résultat s'adapte donc à la vraie largeur de la session en cours au lieu de
//               l'écraser avec une valeur potentiellement fausse.
//               v2.16 (2026-07-31) : Retours de Nicolas : (1) "quand je suis sur Journal et que je
//               fais Entrée, il passe à Devise au lieu de passer par Période" — même interception
//               que Tab ajoutée sur Entrée (garde-fou aria-expanded pour ne pas casser la
//               validation d'une option surlignée dans le menu Journal) ; l'ancien gestionnaire
//               dédié "Entrée -> field.blur()" sur le champ Période est retiré, remplacé par le
//               même écouteur unifié que Tab (Entrée y prend toujours la branche "avant" vers
//               Devise, e.shiftKey étant toujours faux pour Entrée) — testé via simulation
//               d'événements clavier (Entrée sur Journal -> focus Période, garde-fou respecté).
//               (2) "dans la 2e partie, agrandis encore la colonne Intitulé de 10 car. et réduit
//               de 10 car. la colonne Contrepartie" — Intitulé (grille historique) +80px de plus
//               (181+80+80=341), repris cette fois sur Contrepartie (406px natif mesuré en
//               direct) -80px = 326px.
//               v2.15 (2026-07-31) : Retour de Nicolas : "quand je change de type de journal, les
//               champs Mois et Année se retrouvent tout en bas à gauche... fixe-les une fois pour
//               toute à gauche de l'icône (capture jointe)" — root cause trouvée : l'ancrage
//               utilisait le rect du champ Solde, qui devient momentanément invalide (largeur 0)
//               pendant le re-rendu déclenché par un changement de journal, faisant tomber le
//               code sur son repli d'origine (coin bas-gauche de la fenêtre — le bug observé).
//               Fix à deux niveaux, vérifié en direct sur les 2 boutons-icônes identifiés à droite
//               de Solde (button[class*="noPadding-noPadding-marginRight"]) : (1) ancrage
//               désormais sur ces icônes (plus stables) au lieu de Solde, positionnement à leur
//               GAUCHE plutôt qu'à droite de Solde comme avant ; (2) surtout, le repli "coin de la
//               fenêtre" est supprimé purement et simplement — le dernier rect d'ancrage VALIDE
//               (icônes, ou Solde en second repli) est mis en cache et réutilisé tant qu'aucune
//               mesure valide n'est disponible, ce qui élimine ce repli visible une fois pour
//               toutes, quelle que soit la cause d'une éventuelle prochaine invalidité.
//               v2.14 (2026-07-31) : Retours de Nicolas : (1) "la touche Entrée a la même
//               fonctionnalité que la touche Tab, réorganise-la aussi pour Débit/Crédit/Pièce 1/
//               Pièce 2, puis après Pièce 2 ça doit aller sur Type Règlement" — même handler
//               keydown désormais partagé entre Tab et Entrée (avant uniquement, pas de
//               Maj+Entrée), séquence étendue à Type Règlement (dernier maillon : aucun
//               nextInput, donc comportement natif inchangé au-delà — c'est l'application qui
//               valide alors la ligne, hors de portée de ce script) ; garde-fou ajouté pour
//               Entrée uniquement (absent sur Tab) : si le champ est un Autocomplete dont le menu
//               est ouvert (aria-expanded="true"), Entrée sert à valider l'option surlignée et
//               n'est pas détournée. Testé via simulation d'événements clavier : chaîne Entrée
//               complète, arrêt correct sur le dernier champ, garde-fou respecté. (2) "AGRANDIS
//               ENCORE la largeur de la colonne Intitulé (partie basse), +10 caractères" — +80px,
//               cette fois sans reprendre sur N° Compte (pas de contrepartie demandée).
//               v2.13 (2026-07-31) : Retours de Nicolas : (1) "l'ordre de tabulation fonctionne
//               pas, ça passe de Intitulé à Pièce 1 directement au lieu de Débit/Crédit/Pièce 1
//               (idem en arrière)" — root cause : la ligne de saisie est CONTRÔLÉE et se re-rend
//               à chaque frappe, remettant Pièce 1/2 à leur position d'origine dans le DOM ; le
//               tick de scan ne les replaçait qu'ENSUITE, laissant une fenêtre où Tab utilisait
//               encore l'ordre natif si l'appui arrivait entre un re-rendu et le tick suivant.
//               Fix : indépendamment du réordonnancement visuel (conservé), interception
//               explicite de Tab/Maj+Tab sur Intitulé/Débit/Crédit/Pièce 1/Pièce 2 forçant la
//               séquence quel que soit l'ordre réel du DOM au moment de l'appui — vérifié via un
//               test simulant les événements clavier (chaîne avant ET arrière correctes). (2)
//               "élargis la colonne N° compte en bas de 3 caractères" — +24px (police monospace,
//               ~8px/caractère), repris sur Intitulé pour garder la somme constante.
//               v2.12 (2026-07-31) : Retours de Nicolas : (1) "ok pour la liste déroulante des
//               journaux, laisse le tiret de séparation" — le retrait du tiret (v2.9) ne
//               s'applique désormais qu'à la liste N° de compte, plus à Journal (paramètre
//               removeDash ajouté à styleAndTruncateDropdownOptions). (2) "l'ordre de tabulation
//               normal doit être Jour > N° Compte > Intitulé > Débit > Crédit > Pièce 1 > Pièce 2
//               > Type Règlement" — vérifié en direct que ces champs ont tous tabIndex=0 (donc
//               Tab suit l'ORDRE DU DOM) ; déjà satisfait par le réordonnancement Pièce 1/2 après
//               Crédit fait en v2.11, aucun code supplémentaire nécessaire. (3) "réduis la largeur
//               de N° Compte dans la partie basse (grille historique), l'espace gagné pour
//               Intitulé" — la v2.11 ne redimensionnait que la grille du haut ; ajouté le même
//               traitement pour la grille historique (account_number 100->70px, account_label
//               175->205px, mesuré en direct). (4) "enlève la flèche qui signale une liste
//               déroulante, c'est pas beau" — fonctionnalité de la v2.11 retirée ; ne reste qu'un
//               nettoyage de sécurité qui efface tout repère résiduel déjà injecté par une
//               version précédente du script.
//               v2.11 (2026-07-31) : Retours de Nicolas (4 points) : (1) "met une bordure noire
//               (ombre) autour des listes déroulantes" — ajouté border+box-shadow sur le Paper
//               MUI du popper (.MuiAutocomplete-popper .MuiPaper-root), dans la même feuille CSS
//               scopée Saisie que la police. (2) "même taille de police pour la période que pour
//               les autres champs" — la taille était codée en dur (13px) ; remplacée par la
//               taille RÉELLE du champ voisin utilisé comme référence d'alignement (Journal/
//               Devise/N° de compte/Solde), recopiée à chaque repositionnement. (3) "réduire la
//               largeur de N° Compte, agrandir Intitulé, mettre Pièce 1/2 après Crédit (haut ET
//               bas)" — vérifié en direct que les cellules de chaque ligne sont de simples <div>
//               en display:inline-block positionnées uniquement par leur ORDRE dans le DOM (pas
//               de flex/order) ; réordonnées avec insertBefore entre frères du même parent (sans
//               risque vis-à-vis du bug insertBefore déjà rencontré, qui venait d'un nœud pas
//               enfant direct du parent ciblé) sur l'en-tête + chaque ligne + le pied de page, des
//               deux grilles (nouvelle écriture ET historique) ; largeurs de N° Compte/Intitulé
//               redistribuées à somme constante (-70px/+70px). (4) "petite flèche sur les
//               cellules avec liste déroulante (N° Compte, Type Règlement)" — ces cellules n'ont
//               ni <svg> ni <button> propre (juste un <input>) ; ajouté un repère flottant ▾ en
//               hors-flux sur les cellules contenant réellement un <input> (exclut naturellement
//               les cellules d'en-tête/pied de page).
//               v2.10 (2026-07-31) : Retours de Nicolas (capture "Journal BBE-BECM / Période
//               07/2026 / Devise EUR") : (1) "c'est encore pas aligné, le texte Période doit
//               être sur la même ligne que Journal/Devise, le champ 07/2026 sur la même ligne
//               que BBE ou EUR" — root cause trouvée : une fois moisFieldWrapper passé en
//               position:fixed, le conteneur natif de Mois n'a plus que son libellé pour
//               contribuer à sa hauteur et s'affaisse, ce qui (rangée d'en-tête centrée
//               verticalement) recentre le libellé "Période" plus bas que ses voisins — corrigé
//               en rejouant sa hauteur d'origine (mesurée avant modification) en min-height à
//               chaque scan. (2) "la police de la liste des journaux prend du temps à charger" —
//               la police à chasse fixe était posée en JS au tick SUIVANT l'ouverture du menu,
//               d'où un flash visible ; remplacé par une feuille de style CSS scopée à la page
//               Saisie (ajoutée/retirée avec elle), appliquée dès le montage du DOM avant le
//               premier paint. (3) "le shift tab ne fonctionne pas entre Période et Journal" —
//               ajouté un écouteur de secours sur document (capture, le tout premier maillon
//               possible), actif uniquement quand le champ Période a le focus, au cas où un
//               ancêtre (ex. focus-trap MUI d'une Dialog) intercepterait l'événement avant notre
//               propre écouteur.
//               v2.9 (2026-07-31) : Retours de Nicolas : (1) "fais la même logique pour la
//               liste déroulante du journal" — factorisé styleCompteDropdownMonospace() en
//               styleAndTruncateDropdownOptions(listbox) (police à chasse fixe + troncature +
//               retrait du tiret, réutilisable) + findOpenListboxFor(active) (résolution via
//               aria-controls) ; appliqué désormais au champ Journal en plus de la colonne
//               N° de compte. (2) "la période est à nouveau décalée" : le calcul du top
//               dépendait uniquement du rect de Devise, fragile si ce champ est momentanément
//               invalide (ex. pendant une sélection en cours dessus) ; remplacé par une liste de
//               champs de repli (Journal, Devise, N° de compte, Solde), on retient le premier
//               rect valide (hauteur > 0). (3) "le shift-tab doit aller de Devise à Période puis
//               Journal, sans passer par Mois/Année" : les écouteurs Tab n'étaient posés que sur
//               les <input> de Journal/Devise ; or ces champs Autocomplete exposent aussi un
//               bouton flèche focusable qui pouvait recevoir le focus en Shift+Tab et contourner
//               l'écouteur — déplacé l'écoute sur le conteneur entier de chaque champ (capture
//               phase) pour intercepter Tab/Shift+Tab quel que soit l'élément focus réellement
//               ciblé à l'intérieur.
//               v2.8 (2026-07-31) : Retours de Nicolas : (1) "encore un petit problème
//               d'alignement du texte (période mm/aaaa)" — vérifié en direct : le libellé natif
//               "Mois" a une largeur fixe de 120px avec retour à la ligne, ce qui convenait au mot
//               "Mois" mais pouvait faire passer "Période (mm/aaaa)" sur 2 lignes selon la largeur
//               de fenêtre, chevauchant visuellement le champ en dessous ; forcé nowrap + largeur
//               automatique sur ce libellé, et ajouté un garde-fou qui ne positionne jamais le
//               champ au-dessus du bas réel du libellé (quel que soit son nombre de lignes).
//               (2) "quand je fais tab sur période, ca va sur mois et année, il faut que ca aille
//               direct sur devise" — durci l'interception Tab (écoute en phase de capture +
//               stopPropagation, testé mécaniquement) et ajouté un filet de sécurité : si le focus
//               atterrit malgré tout sur un élément interne de Mois/Année, il est renvoyé aussitôt
//               vers Devise.
//               v2.7 (2026-07-31) : Retours de Nicolas (capture annotée) : (1) "enlève le tiret
//               entre le n° de compte et l'intitulé" dans la liste déroulante — retiré (premier
//               tiret uniquement, celui du séparateur). (2) "la période est toujours pas alignée"
//               : le calcul précédent (label.bottom + hauteur en cache) était approximatif ;
//               remplacé par une copie directe du rect RÉEL du champ Devise (voisin non modifié)
//               pour le top/la hauteur — alignement garanti avec le reste de la ligne. (3) "le tab
//               s'arrête sur Mois/Année" : tabIndex=-1 ne suffisait pas sur l'<input> seul —
//               vérifié en direct que le composant Autocomplete expose 2 éléments focusables
//               (input + bouton flèche du menu) ; corrigé en neutralisant tous les éléments
//               focusables du bloc déplacé (input, button, [tabindex]). (4) "il manque le libellé
//               Mois au-dessus" : ajouté un libellé flottant "Mois" (hors arbre React, comme le
//               champ Période), avec le même style que le libellé natif "Année" voisin.
//               v2.6 (2026-07-31) : Retours de Nicolas : (1) "c pas aligné !" — le champ Mois
//               relogé (v2.5) n'a plus son propre libellé (renommé "Période", resté près de
//               Journal), donc aligner son haut sur le haut du conteneur Solde le plaçait au
//               niveau du LIBELLÉ "Solde" plutôt que de sa zone de saisie ; décalé vers le bas de
//               la hauteur du libellé "Année" (voisin, structure identique conservée) pour aligner
//               les zones de saisie entre elles. (2) "possible de limiter la longueur du texte" :
//               les intitulés de compte trop longs dans la liste déroulante ne passent plus à la
//               ligne (tronqués avec "...", texte complet affiché au survol après ~1s via title
//               natif, uniquement si effectivement tronqué). Vérifié en direct (dossier fourni par
//               Nicolas, compte 10180000) : .MuiAutocomplete-option est display:flex, son <p>
//               enfant a donc par défaut min-width:auto (piège flexbox connu) qui empêchait tout
//               rétrécissement — corrigé en forçant min-width:0 en plus du nowrap/ellipsis.
//               v2.5 (2026-07-31) : Retours de Nicolas (capture annotée) : (1) champ Période
//               réaligné pour ressembler au style natif (soulignement seul, sans cadre plein ni
//               fond blanc) et le title (tooltip au survol) retiré ; (2) champs Mois/Année
//               déplacés dans la zone vide de la barre d'en-tête (à droite de Solde, "cadre
//               rouge" de sa capture) au lieu du bord de la fenêtre, ancrés sur le rect du champ
//               Solde (stable) plutôt que des coordonnées de fenêtre fixes ; tabIndex=-1 posé
//               explicitement dessus pour qu'ils ne soient jamais atteignables au Tab ; (3) BUG
//               TROUVÉ ET CORRIGÉ (police fixe de la liste déroulante N° de compte toujours
//               inactive) : inspection en direct du DOM réel de la liste ouverte — le texte de
//               chaque option est imbriqué dans un <p class="MuiTypography-body1"> qui porte sa
//               PROPRE règle de police (système de typographie MUI, pas une simple valeur
//               héritée), donc appliquer la police au <ul>/<li> seuls ne changeait jamais
//               l'affichage réel ; corrigé en ciblant tous les descendants du menu déroulant.
//               Utilise aussi désormais aria-controls (vérifié en direct) pour cibler précisément
//               LE bon menu déroulant plutôt que le premier trouvé dans la page.
//               v2.4 (2026-07-31) : Retours de Nicolas après confirmation que le champ Période
//               fonctionne ("ok ca marche") : (1) Tab depuis Journal sautait directement à
//               Devise sans s'arrêter sur Période — notre champ, ajouté à document.body, n'est
//               pas à sa place naturelle dans l'ordre de tabulation du DOM ; on intercepte
//               désormais manuellement Tab/Maj+Tab sur Journal, Période et Devise pour forcer
//               l'ordre Journal -> Période -> Devise (wirePeriodFieldTabOrder) ; (2) un flash
//               visible des changements de Mois/Année apparaissait lors de la validation d'une
//               période — la version précédente masquait le conteneur Année avec en plus
//               height:0/overflow:hidden/margin:0/padding:0, ce qui collapse sa géométrie réelle
//               et empêche MUI de positionner correctement son menu déroulant lors de la
//               sélection automatique (ArrowDown + clic) ; retiré, ne reste que visibility:hidden
//               (comme pour Mois), qui conserve la géométrie d'origine pour un ancrage de menu
//               cohérent — au prix d'un espace vide résiduel à la place d'Année.
//               v2.3 (2026-07-31) : Retour de Nicolas ("le champ Période n'est toujours pas
//               visible !!") après la correction v2.2 de l'exception insertBefore : le champ
//               restait invisible malgré la correction structurelle, probable réconciliation
//               React qui écarte silencieusement un nœud étranger inséré dans un conteneur
//               qu'elle gère. Solution définitive : ensurePeriodField() n'insère plus RIEN dans
//               l'arbre React — le champ période est désormais un élément flottant ajouté à
//               document.body (même technique déjà éprouvée dans ce projet pour le widget
//               Météo), repositionné à chaque scan par-dessus l'emplacement réel du champ Mois
//               natif (masqué en visibility:hidden plutôt que hors-écran, pour un rect toujours
//               mesurable). Nettoyage (removePeriodField) si on quitte la page Saisie ou
//               désactive Premium, pour ne pas laisser un champ flottant orphelin ailleurs.
//               Annulé à la demande de Nicolas : le bouton "Aa" / bascule de police
//               BasierCircle -> DM Sans ajouté en v2.2 (core + effet Saisie), entièrement
//               retiré.
//               v2.2 (2026-07-31) : BUG CRITIQUE CORRIGÉ, signalé par Nicolas (champ période
//               invisible + colonne Date/TOTAUX/accordéon/séparateurs tous disparus en même
//               temps) : ensurePeriodField() appelait container.insertBefore(field,
//               moisInput.parentElement) alors que moisInput.parentElement n'est PAS un enfant
//               direct de ce conteneur (input imbriqué plusieurs niveaux sous le composant MUI
//               Autocomplete) — l'exception native "insertBefore... not a child of this node"
//               (non rattrapée localement) faisait avorter tout le reste de scanSaisie() à
//               chaque scan. Corrigé en ciblant le vrai enfant direct du conteneur (wrapper
//               .MuiAutocomplete-root). Ajout : parsePeriodInput accepte aussi les formats sans
//               séparateur (012026, 0126).
//               v2.1 (2026-07-31) : Retours de Nicolas après premier test du champ période :
//               (1) formats sans séparateur acceptés (ex. "012026", "0126"), mois toujours sur
//               2 chiffres dans ce cas pour éviter l'ambiguïté ; (2) bug corrigé — le titre
//               natif "Année" restait visible (seule sa zone de saisie était masquée, pas son
//               conteneur complet) : masqué en entier désormais, et le titre natif "Mois" est
//               renommé "Période (mm/aaaa)" au lieu d'être laissé tel quel ; (3) police fixe de
//               la liste déroulante N° de compte rendue indépendante de la grille (détection
//               via document.activeElement + closest, couvre grille de saisie ET grille
//               historique) ; (4) bug corrigé — le repli par défaut du panneau "Ecriture" ne
//               fonctionnait pas (mauvais critère de détection du titre) : détection refaite
//               via le texte unique "Flux manuel" + aria-expanded/Mui-expanded ; (5) la bande
//               grise/blanche alternée native de la grille historique est neutralisée (fond
//               blanc uniforme forcé), seule la ligne de séparation entre écritures est
//               conservée comme demandé ("enlève les colorisations, garde juste les lignes
//               séparatrices").
//               v2.0 (2026-07-31) : Nouveau champ "période" (MM/AAAA) qui remplace
//               visuellement Mois+Année (masqués hors-écran, jamais display:none) et pilote
//               réellement les deux MuiAutocomplete natifs via ArrowDown (ouverture) + .click()
//               sur l'option rendue (jamais de mutation directe de .value) — saisie flexible
//               (séparateur /, - ou espace ; mois 1-2 chiffres ; année 2 ou 4 chiffres) avec
//               rejet (bordure rouge + tooltip, aucune modification) si l'année demandée n'est
//               pas dans le menu déroulant Année du dossier. Ajout police à chasse fixe sur la
//               liste déroulante d'autocomplétion du N° de compte (uniquement quand ce champ a
//               le focus, le portail MUI étant partagé par tous les champs autocomplete de la
//               page). Correction (retour de Nicolas "les entêtes ne sont jamais en police à
//               chasse fixe" + "idem pour Total écriture/Totaux, on garde la police d'origine") :
//               styleNewEntryGridMonospace et styleSaisieHistoryFooterMonospace ne touchent plus
//               que .vtBody (lignes) et .vtFooter debit/credit (montants), jamais l'en-tête ni
//               les cellules de libellé (piece2/counterpart) qui portent le même data-column-key.
//               Le panneau "Ecriture" est désormais réduit par défaut (une seule fois par
//               chargement, clic natif sur le MuiAccordionSummary). Une ligne de séparation est
//               ajoutée dans la grille historique à chaque changement de bande even/odd
//               (= à chaque nouvelle écriture).
//               v1.2 (2026-07-31) : Blocage "Chargement en cours" toujours signalé par
//               Nicolas après le fix v1.1 — désactivation temporaire de l'affichage du mois
//               en chiffres (revertSaisieMoisField, retire tout calque/style résiduel) pour
//               isoler si cette fonctionnalité précise est en cause. Le reste (polices fixes,
//               largeur colonne Date, TOTAUX) reste actif pour le nouveau test de Nicolas.
//               v1.1 (2026-07-31) : BUG CORRIGÉ, signalé par Nicolas ("le module Saisie est
//               planté, chargement en cours") : findLabeledFieldInput() faisait un
//               document.querySelectorAll('body *') (parcours de la page ENTIÈRE) à chaque
//               appel, appelée 4x par scan() (Mois/Année/N° de compte/Solde) — or scan()
//               tourne à chaque mutation du DOM, et la grille historique de Saisie charge en
//               continu de nombreuses lignes, redéclenchant scan() à chaque ligne. Le cumul
//               de parcours complets de page bloquait le thread principal assez longtemps
//               pour empêcher l'appli native de terminer son propre chargement. Fix : mise en
//               cache de l'<input> trouvé par libellé (labeledFieldInputCache), le parcours
//               coûteux ne se refait plus que si la référence en cache quitte le document.
//               v1.0 (2026-07-31) : Module extrait de premium.js 3.31 lors de la scission
//               en modules demandée par Nicolas (cf. premium.js core pour le détail de la
//               scission et TMBC_TOOLKIT_CONTRACT.md pour le contrat commun entre modules).
//               Contient : police à chasse fixe sur les champs identifiants/montants du formulaire
//               "Saisie" (en-tête Année/N° de compte/Solde + grille Jour/N°Compte/Pièce 1-2/
//               Débit/Crédit/Contrepartie/Echéance), affichage du mois en chiffres (calque
//               visuel, ne modifie jamais la valeur réelle du champ natif), alignement de la
//               largeur de la colonne "Date" sur "Date Saisie" et police fixe sur la ligne
//               TOTAUX de la grille historique.
//               Copie verbatim du code correspondant dans premium.js 3.31 (cf.
//               CHANGELOG-premium-legacy.txt pour l'historique complet des versions
//               antérieures de ces fonctionnalités) — aucun changement de comportement visé
//               par cette extraction, seule son organisation en fichier séparé change.
// @author       Nicolas
// @match        https://connect.lgassocies.com/*
// @match        https://*.myunisoft.fr/*
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // Utilitaires partagés (cf. premium.js core + TMBC_TOOLKIT_CONTRACT.md).
  // Déstructuration volontairement large (tout le kit commun, même si ce
  // module n'utilise pas chaque entrée) pour que chaque module ait exactement
  // la même ligne d'import et reste facile à comparer/maintenir.
  const {
    isDisabled,
    isWideModeActive,
    isConsultWindow,
    detectMenuColor,
    readableTextOn,
    isMenuColorDarkNeutral,
    getSidebar,
    stripAccents,
    normalizeColumnName,
    columnCategoryFor,
    classifyCellValue,
    formatThousands,
    findGridColumnByColumnKey,
    MONO_FONT_STACK,
    getApiHeaders,
    registerScan,
    extendDebugHook,
  } = window.TMBC;


  const NEW_ENTRY_GRID_MONO_KEYS = [
    'day',
    'account_id',
    'piece',
    'piece2',
    'debit',
    'credit',
    'counterpart',
    'deadline',
  ];

  const MONTH_NAME_TO_NUM = {
    janvier: '01',
    fevrier: '02',
    février: '02',
    mars: '03',
    avril: '04',
    mai: '05',
    juin: '06',
    juillet: '07',
    aout: '08',
    août: '08',
    septembre: '09',
    octobre: '10',
    novembre: '11',
    decembre: '12',
    décembre: '12',
  };


  function isSaisiePage() {
    return location.pathname.includes('/accounting/newEntry');
  }

  // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "quand je clique sur un
  // menu, il affiche par erreur les champs qu'on a rajouté dans la
  // saisie") : les méga-menus de navigation (ex. "Déclarations", "Tenue")
  // s'affichent en OVERLAY (.MuiDialog-paperFullScreen) PAR-DESSUS la page
  // Saisie, sans changer l'URL — isSaisiePage() reste donc vrai pendant
  // qu'un tel menu est ouvert, et notre champ Période / Mois-Année
  // repositionnés (ajoutés à document.body, donc au-dessus de tout, cf.
  // ensurePeriodField) continuaient de s'afficher par-dessus le menu.
  // Fix : on détecte cet overlay (même sélecteur que celui déjà utilisé
  // dans premium.js pour exclure ces méga-menus du recentrage 60vw) et on
  // masque nos éléments injectés tant qu'il est ouvert, comme si on avait
  // quitté la page Saisie.
  function isFullScreenMenuOverlayOpen() {
    return !!document.querySelector('.MuiDialog-paperFullScreen');
  }

  // BUG CORRIGÉ (2026-08-01, retour de Nicolas, capture jointe : le champ
  // Période flottant reste visible PAR-DESSUS le popover "Ouvrir une
  // société", ouvert via le "+" à droite des onglets société) : ce popover
  // s'affiche lui aussi en portail (ajouté à document.body, hors de l'arbre
  // React de la page), avec un z-index natif (1300, vérifié en direct) très
  // inférieur au champ Période (2147483647, volontairement énorme pour
  // rester au-dessus de tout le reste de la page — cf. ensurePeriodField).
  // Détecté via .MuiPopover-root > .MuiPopover-paper, le wrapper natif MUI
  // de ce popover (confirmé en direct) — vérifié également en direct que
  // les menus déroulants Journal/Mois/Année de CE script utilisent un
  // wrapper complètement différent (.MuiAutocomplete-popper), donc ce
  // masquage ne risque jamais de se déclencher pendant qu'on est justement
  // en train d'utiliser un de ces champs.
  // ⚠ DEUX PIÈGES évités grâce à une vérification en direct (avant/pendant/
  // après ouverture réelle du popover, pas seulement en théorie) :
  // (1) .MuiPopover-root lui-même est en position:fixed — un élément
  // position:fixed a TOUJOURS offsetParent === null par spec DOM, qu'il soit
  // affiché ou non ; le filtre de visibilité isElementVisible (utilisé
  // partout ailleurs dans ce fichier) est donc inutilisable ICI, il aurait
  // fait considérer le popover comme "fermé" même grand ouvert.
  // (2) Inversement, un simple querySelector('.MuiPopover-root') sans le
  // '.MuiPopover-paper' à l'intérieur peut rester dans le DOM après
  // fermeture selon le chemin de fermeture emprunté (constaté en direct) —
  // se fier à sa seule présence aurait pu, à l'inverse, laisser le champ
  // Période caché en permanence après une simple ouverture/fermeture.
  // Fix retenu, vérifié en direct sur les 3 états (fermé / ouvert / après
  // fermeture) : on lit la taille RÉELLEMENT RENDUE (getBoundingClientRect)
  // du .MuiPopover-paper enfant — ce nœud n'est PAS en position:fixed, son
  // rect reflète fidèlement sa présence visuelle réelle, indépendamment de
  // l'état de son wrapper.
  function isBlockingPopoverOpen() {
    return Array.from(document.querySelectorAll('.MuiPopover-root .MuiPopover-paper')).some((paper) => {
      const r = paper.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }


  // Trouve l'<input> d'un champ du formulaire d'en-tête (Mois/Année/N° de
  // compte/Solde) via son libellé <p> voisin — aucune classe stable
  // identifiée pour ces champs individuellement, mais chacun est un
  // conteneur direct [label, input].
  //
  // BUG CORRIGÉ (2026-07-31, signalé par Nicolas : la page Saisie restait
  // bloquée sur "Chargement en cours...") : cette fonction faisait un
  // document.querySelectorAll('body *') — un parcours de la PAGE ENTIÈRE —
  // à CHAQUE appel, et elle est appelée 4 fois par scan() (Mois/Année/N° de
  // compte/Solde). Or scan() tourne à chaque mutation du DOM (MutationObserver
  // subtree:true sur tout document.body), et la grille historique de Saisie
  // peut charger des dizaines/centaines de lignes en continu — chaque ligne
  // ajoutée redéclenchait scan(), donc 4 parcours complets de la page à
  // chaque ligne. Ce cumul bloquait le thread principal assez longtemps pour
  // empêcher l'appli native de terminer son propre chargement (JS
  // mono-thread : notre code synchrone lourd retardait tout le reste,
  // d'où le "Chargement en cours..." qui ne se terminait jamais).
  // Fix : on met en cache l'<input> trouvé pour chaque libellé — le
  // parcours coûteux ne se refait que si la référence en cache n'est plus
  // dans le document (ex. changement de page), sinon un simple
  // .isConnected (quasi gratuit) suffit à chaque appel suivant.
  // (2026-07-31) Cache étendu : on garde aussi le libellé <p> et son
  // conteneur (pas seulement l'<input>), nécessaire pour renommer/masquer le
  // TITRE d'un champ (ex. renommer "Mois" en "Période (mm/aaaa)", masquer
  // entièrement "Année" titre+zone de saisie) — précédemment seul
  // moisInput.parentElement était masqué, ce qui ne cachait QUE la petite
  // zone de saisie, pas le libellé lui-même (bug signalé par Nicolas :
  // "le titre du champ Année est toujours visible").
  const labeledFieldCache = new Map();

  // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "si j'ouvre 2 sociétés avec
  // la partie saisie, les champs Période ne doivent pas se mélanger, j'ai
  // l'impression que c'est le cas") : l'app garde apparemment plusieurs
  // onglets de sociétés MONTÉS en même temps dans le même document (un seul
  // visible à la fois, les autres cachés plutôt que démontés) — confirmé par
  // la présence de boutons d'onglets société dans la barre du haut. Or
  // `.find(...)` ci-dessous prenait le PREMIER élément du DOM dont le texte
  // correspond, sans se soucier de sa visibilité : si un onglet caché (autre
  // société) apparaît avant l'onglet actif dans l'ordre du DOM, on se
  // retrouvait à piloter/mesurer les champs de la MAUVAISE société — et le
  // cache (labeledFieldCache) restait bloqué dessus tant que l'élément reste
  // connecté au DOM (ce qui est justement le cas d'un onglet caché, pas
  // démonté). Fix : on ne retient qu'un candidat RÉELLEMENT VISIBLE
  // (offsetParent non nul — cette vérification retourne null pour
  // display:none ou tout ancêtre caché, donc y compris un onglet société
  // inactif), et on invalide le cache dès que l'entrée cachée n'est plus
  // visible (onglet caché entre-temps), pas seulement si elle est déconnectée
  // du DOM.
  function isElementVisible(el) {
    return !!el && el.offsetParent !== null;
  }

  function findLabeledField(labelText) {
    const cached = labeledFieldCache.get(labelText);
    if (cached && cached.input.isConnected && isElementVisible(cached.input)) return cached;

    const label = Array.from(document.querySelectorAll('body *')).find(
      (el) => el.children.length === 0 && el.textContent.trim() === labelText && isElementVisible(el)
    );
    const container = label ? label.parentElement : null;
    const input = container ? container.querySelector('input') : null;

    if (!input) {
      labeledFieldCache.delete(labelText);
      return null;
    }
    const entry = { label, container, input };
    labeledFieldCache.set(labelText, entry);
    return entry;
  }

  function findLabeledFieldInput(labelText) {
    const field = findLabeledField(labelText);
    return field ? field.input : null;
  }


  function styleSaisieHeaderFieldsMonospace() {
    ['Année', 'N° de compte', 'Solde'].forEach((label) => {
      const input = findLabeledFieldInput(label);
      if (input) input.style.setProperty('font-family', MONO_FONT_STACK, 'important');
    });
  }


  // (2026-07-31, retour de Nicolas) "les entêtes ne sont jamais en police à
  // chasse fixe" + "idem pour les textes Total écriture ou Totaux" : le
  // sélecteur précédent ("[data-column-key=X] input, [data-column-key=X]"
  // SANS scope .vtBody/.vtFooter) attrapait AUSSI la cellule d'EN-TÊTE
  // (qui porte le même data-column-key que les cellules de corps) et, en
  // pied de page, la cellule "Total écriture"/"Solde" (label texte posé sur
  // les clés piece2/counterpart, vérifié en direct) — d'où la police fixe
  // appliquée à tort sur des libellés. Corrigé : uniquement .vtBody (lignes
  // de saisie) pour toutes les clés, et .vtFooter UNIQUEMENT pour
  // debit/credit (les 2 seuls montants numériques du pied de page).
  function styleNewEntryGridMonospace() {
    const gridCol = findGridColumnByColumnKey('day');
    if (!gridCol) return;
    NEW_ENTRY_GRID_MONO_KEYS.forEach((key) => {
      gridCol
        .querySelectorAll('.vtBody [data-column-key="' + key + '"] input, .vtBody [data-column-key="' + key + '"]')
        .forEach((el) => {
          el.style.setProperty('font-family', MONO_FONT_STACK, 'important');
        });
    });
    ['debit', 'credit'].forEach((key) => {
      gridCol.querySelectorAll('.vtFooter [data-column-key="' + key + '"]').forEach((el) => {
        el.style.setProperty('font-family', MONO_FONT_STACK, 'important');
      });
    });
  }


  // (2026-07-31, demandé par Nicolas) Quand on édite une cellule "N° Compte"
  // (grille de saisie EN COURS ou grille HISTORIQUE en dessous — les deux
  // permettent de cliquer/éditer une valeur de compte), la liste déroulante
  // d'autocomplétion native (portail MUI ".MuiAutocomplete-listbox", partagé
  // par TOUS les champs autocomplete de la page — Mois/Année/Compte/
  // Contrepartie/...) doit passer en police à chasse fixe.
  //
  // CORRIGÉ (2026-07-31, "vérifie" demandé par Nicolas) : la version
  // précédente cherchait uniquement dans le gridCol de la grille de SAISIE
  // (findGridColumnByColumnKey('account_id')), ratant donc le cas où c'est
  // la cellule N° Compte de la grille HISTORIQUE qui est éditée. Plus
  // robuste : on regarde directement l'élément actuellement focus
  // (document.activeElement) et on vérifie qu'il appartient bien à UNE
  // cellule "account_id" (peu importe la grille), via closest().
  // BUG TROUVÉ ET CORRIGÉ (2026-07-31, retour de Nicolas : "ça ne marche
  // toujours pas... inspecte le fonctionnement") : inspection en direct du
  // DOM réel de la liste ouverte — le texte de chaque option n'est PAS
  // porté directement par le <li> (.MuiAutocomplete-option), il est
  // imbriqué dans un <p class="MuiTypography-root MuiTypography-body1">
  // enfant, qui porte sa PROPRE règle de police (déclarée par le système de
  // typographie MUI, pas simplement héritée) — donc appliquer la police sur
  // le <ul>/<li> seuls ne changeait jamais ce que l'utilisateur voit
  // vraiment, cette règle plus spécifique sur le <p> prenant le dessus.
  // Fix : on cible tous les descendants du menu déroulant (listbox.
  // querySelectorAll('*')), pas seulement les <li> eux-mêmes.
  // (2026-07-31, demandé par Nicolas) "possible de limiter la longueur du
  // texte, je ne veux pas de retour à la ligne sur les comptes trop
  // longs" : tronque avec "..." (au lieu du retour à la ligne natif) le
  // texte de chaque option — porté par le <p> imbriqué, cf. plus haut —
  // et affiche le texte complet au survol (title natif du navigateur,
  // apparaît après ~1s, comportement natif du navigateur) UNIQUEMENT
  // quand le texte est effectivement tronqué (scrollWidth > clientWidth),
  // pour ne pas ajouter un survol inutile sur les intitulés déjà courts.
  //
  // Vérifié en direct : .MuiAutocomplete-option (<li>) est en
  // display:flex, et son <p> enfant a donc par défaut min-width:auto —
  // un piège flexbox classique qui EMPÊCHE le <p> de rétrécir sous la
  // largeur de son propre contenu, donc l'ellipsis ne s'applique jamais
  // sans forcer explicitement min-width:0 dessus en plus.
  //
  // (2026-07-31, demandé par Nicolas) "fais la même logique pour la liste
  // déroulante du journal" : logique factorisée pour être appliquée aussi
  // bien au menu N° de compte qu'au menu Journal (même structure MUI
  // Autocomplete, même traitement voulu : police fixe, pas de retour à la
  // ligne + tooltip si tronqué, tiret retiré).
  function styleAndTruncateDropdownOptions(listbox, removeDash) {
    if (!listbox) return;
    listbox.style.setProperty('font-family', MONO_FONT_STACK, 'important');
    listbox.querySelectorAll('*').forEach((el) => {
      el.style.setProperty('font-family', MONO_FONT_STACK, 'important');
    });
    listbox.querySelectorAll('li').forEach((li) => {
      const textEl = li.querySelector('p') || li;
      // (2026-07-31, demandé par Nicolas) "enlève juste le tiret entre le
      // numéro de compte et l'intitulé" — uniquement pour la liste N° de
      // compte. RETOUR (2026-07-31, capture "Ecriture/Flux manuel...") :
      // "ok pour la liste déroulante des journaux, laisse le tiret de
      // séparation entre le code et le libellé" — le retrait ne doit donc
      // PLUS s'appliquer à la liste Journal (uniquement le premier tiret
      // entouré d'espaces en début de texte, jamais un tiret qui ferait
      // partie de l'intitulé lui-même, quand il s'applique).
      if (removeDash) {
        const original = textEl.textContent;
        const cleaned = original.replace(/^(\S+)\s*-\s*/, '$1 ');
        if (cleaned !== original) textEl.textContent = cleaned;
      }

      textEl.style.setProperty('min-width', '0', 'important');
      textEl.style.setProperty('white-space', 'nowrap', 'important');
      textEl.style.setProperty('overflow', 'hidden', 'important');
      textEl.style.setProperty('text-overflow', 'ellipsis', 'important');
      if (textEl.scrollWidth > textEl.clientWidth) {
        li.title = textEl.textContent.trim();
      } else {
        li.removeAttribute('title');
      }
    });
  }

  function findOpenListboxFor(active) {
    // aria-controls référence l'id du menu déroulant lié à ce champ précis
    // (vérifié en direct) — plus fiable que de prendre le premier
    // ".MuiAutocomplete-listbox" trouvé dans la page (l'id n'étant pas
    // forcément unique par colonne dans cette grille virtualisée, un menu
    // résiduel d'un autre champ pourrait sinon être ciblé par erreur).
    const listboxId = active.getAttribute('aria-controls');
    return (listboxId && document.getElementById(listboxId)) || document.querySelector('.MuiAutocomplete-listbox');
  }

  function styleCompteDropdownMonospace() {
    const active = document.activeElement;
    if (!active || typeof active.closest !== 'function') return;

    // Cellule "N° Compte" (grille de saisie ou grille historique) : tiret
    // retiré (removeDash = true).
    const compteCell = active.closest('[data-column-key="account_id"]');
    if (compteCell) {
      styleAndTruncateDropdownOptions(findOpenListboxFor(active), true);
      return;
    }

    // ...ou champ d'en-tête "Journal" : tiret CONSERVÉ (removeDash = false,
    // cf. commentaire dans styleAndTruncateDropdownOptions).
    const journalField = findLabeledField('Journal');
    if (journalField && journalField.container.contains(active)) {
      styleAndTruncateDropdownOptions(findOpenListboxFor(active), false);
    }
  }


  // (2026-07-31, demandé par Nicolas) Remplace l'ancien calque en lecture
  // seule par un vrai champ "période" (MM/AAAA) qui PILOTE réellement les
  // champs natifs Mois et Année (masqués), plutôt que de simplement les
  // recouvrir visuellement. Vérifié en direct (Claude in Chrome) avant
  // d'implémenter, pour respecter la règle du projet ("jamais muter
  // input.value sur un champ contrôlé par React") :
  // - Mois/Année sont des MuiAutocomplete (pas des <select>) : ouvrir le
  //   menu déroulant se fait en envoyant un KeyboardEvent 'ArrowDown' au
  //   champ focus (fonctionne même en synthétique, PAS besoin d'un
  //   événement "de confiance" du système — contrairement au drag-and-drop
  //   de colonnes de Suivi/Semaine qui lui l'exige et reste donc
  //   impossible à automatiser).
  // - Sélectionner une option se fait avec un vrai .click() sur l'élément
  //   [role="option"] de la liste ouverte (".MuiAutocomplete-listbox",
  //   portail MUI) : testé en direct, ça met bien à jour la vraie valeur
  //   de l'input (React confirme le changement), sans jamais toucher
  //   input.value directement.
  // - L'année n'accepte que les valeurs proposées par le menu déroulant du
  //   dossier (ex. 2025/2026 seulement) — si l'année demandée n'y figure
  //   pas, on annule et on affiche une bordure rouge, SANS RIEN modifier
  //   (ni l'année ni le mois).
  const PERIOD_FIELD_ID = 'tmbc-saisie-period-field';
  const MOIS_RELOCATED_LABEL_ID = 'tmbc-saisie-mois-relocated-label';
  const PERIOD_ERROR_TITLE =
    "Valeur invalide ou année non disponible dans ce dossier — remis sur la valeur actuelle.";
  const PERIOD_HINT_TITLE =
    'Période (mois/année) — formats acceptés : 07/2026, 7/26, 07-2026, 7 26, 072026, 0726, etc.';

  const MONTH_NUM_TO_NAME = {
    1: 'Janvier',
    2: 'Février',
    3: 'Mars',
    4: 'Avril',
    5: 'Mai',
    6: 'Juin',
    7: 'Juillet',
    8: 'Août',
    9: 'Septembre',
    10: 'Octobre',
    11: 'Novembre',
    12: 'Décembre',
  };

  // Accepte séparateur "/", "-" ou espace ; mois 1-2 chiffres ; année 2 ou
  // 4 chiffres (2 chiffres -> préfixée "20", cf. demande de Nicolas).
  // (2026-07-31, demandé par Nicolas : "je veux aussi pouvoir saisir 012026
  // ou 0126") : forme SANS séparateur également acceptée — dans ce cas le
  // mois est OBLIGATOIREMENT sur 2 chiffres (sinon ambiguïté avec le début
  // de l'année, ex. "1026" = janvier 2026 ou octobre 26 ?), suivi de
  // l'année sur 2 ou 4 chiffres (chaîne totale de 4 ou 6 chiffres).
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

  function formatPeriodDisplay() {
    const moisInput = findLabeledFieldInput('Mois');
    const anneeInput = findLabeledFieldInput('Année');
    if (!moisInput || !anneeInput) return null;
    const num = MONTH_NAME_TO_NUM[(moisInput.value || '').trim().toLowerCase()];
    const year = (anneeInput.value || '').trim();
    if (!num || !year) return null;
    return num + '/' + year;
  }

  // Ouvre le menu déroulant d'un champ MuiAutocomplete (ArrowDown) et
  // clique l'option dont le texte correspond exactement — retourne false
  // sans rien modifier si l'option n'existe pas (ex. année indisponible).
  async function selectAutocompleteOption(input, matchText) {
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
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
    await new Promise((r) => setTimeout(r, 200));
    return true;
  }

  let periodCommitInProgress = false;

  async function commitPeriodFieldValue(field) {
    const parsed = parsePeriodInput(field.value);
    if (!parsed) {
      markPeriodFieldError(field, true);
      return;
    }
    const anneeInput = findLabeledFieldInput('Année');
    const moisInput = findLabeledFieldInput('Mois');
    if (!anneeInput || !moisInput) return;

    periodCommitInProgress = true;
    try {
      const yearOk = await selectAutocompleteOption(anneeInput, parsed.year);
      if (!yearOk) {
        markPeriodFieldError(field, true);
        return;
      }
      const monthOk = await selectAutocompleteOption(moisInput, MONTH_NUM_TO_NAME[parsed.month]);
      markPeriodFieldError(field, !monthOk);
    } finally {
      periodCommitInProgress = false;
      const display = formatPeriodDisplay();
      if (display) field.value = display;
    }
  }

  // (2026-07-31, retour de Nicolas : "enlève le mouseover que t'as fait
  // dessus") : plus de title (tooltip natif au survol) — l'indication
  // visuelle en cas d'erreur reste la bordure rouge, sans texte au survol.
  function markPeriodFieldError(field, hasError) {
    if (hasError) {
      field.style.setProperty('border-bottom-color', '#dc2626', 'important');
    } else {
      field.style.removeProperty('border-bottom-color');
    }
  }

  // BUG CORRIGÉ #1 (2026-07-31, retour de Nicolas : "le titre du champ
  // Année est toujours visible, il faut le masquer") : la version
  // précédente masquait moisInput.parentElement / anneeInput.parentElement,
  // qui ne sont que la PETITE zone de saisie — pas le conteneur [libellé +
  // zone de saisie] complet. Fix : pour Année, on masque le conteneur
  // ENTIER. Pour Mois, on garde le libellé natif visible mais on le
  // RENOMME en "Période (mm/aaaa)" (demandé par Nicolas).
  //
  // BUG CORRIGÉ #2 (2026-07-31, retour de Nicolas : "le champ Période ne
  // s'affiche pas" + tout le reste de scanSaisie() disparu en même temps) :
  // container.insertBefore(field, moisInput.parentElement) levait
  // l'exception native "insertBefore... not a child of this node" (l'input
  // réel est imbriqué plusieurs niveaux sous le conteneur, pas un enfant
  // direct) — corrigé en ciblant le bon enfant direct.
  //
  // BUG CORRIGÉ #3 — DÉFINITIF (2026-07-31, retour de Nicolas : "le champ
  // Période n'est toujours pas visible !!", même après le fix #2 qui
  // supprimait pourtant l'exception) : même une fois l'insertBefore
  // structurellement correct, insérer un nœud ÉTRANGER (que React ne
  // connaît pas) DANS un conteneur que React gère reste risqué — la
  // moindre réconciliation de ce composant (ex. la moindre interaction sur
  // le champ Mois/Année ou un simple re-render du formulaire) peut écarter
  // silencieusement notre nœud sans lever d'erreur, le rendant invisible
  // sans que scanSaisie() ne plante. Fix définitif : on abandonne toute
  // insertion dans l'arbre React — le champ période est désormais un
  // élément FLOTTANT, ajouté à document.body (donc totalement extérieur au
  // DOM géré par React, aucun risque de réconciliation), repositionné à
  // chaque scan par-dessus l'emplacement exact du champ Mois natif masqué
  // via getBoundingClientRect() — exactement la même technique déjà
  // éprouvée et fonctionnelle dans ce projet pour le widget Météo (cf.
  // toggleMeteoModal dans premium.js).
  //
  // Les champs natifs Mois/Année sont masqués en visibility:hidden (plutôt
  // que position:absolute + coordonnées hors-écran) : contrairement à
  // display:none, visibility:hidden conserve EXACTEMENT la même
  // géométrie/position qu'un élément normal — ce qui satisfait toujours le
  // besoin de MUI (getBoundingClientRect non-nul pour positionner son menu
  // déroulant) tout en nous donnant un rect stable et directement
  // exploitable pour positionner notre champ flottant par-dessus, sans
  // avoir à le mesurer avant de le masquer.
  // (2026-07-31, retour de Nicolas : "quand je clique sur un menu, il
  // affiche par erreur les champs qu'on a rajouté dans la saisie") : en plus
  // de retirer notre propre champ flottant, il faut aussi RE-MASQUER les
  // champs NATIFS Mois/Année eux-mêmes — ils restent dans le DOM (page
  // Saisie toujours montée sous l'overlay du menu) avec notre position:fixed
  // toujours actif, donc visibles par-dessus le menu si on ne fait que
  // retirer nos propres éléments. Références retrouvées via le cache rempli
  // par ensurePeriodField (leur libellé "Mois" étant renommé, on ne peut
  // plus les retrouver par findLabeledField('Mois')).
  let cachedMoisFieldWrapperEl = null;
  let cachedAnneeFieldContainerEl = null;

  function removePeriodField() {
    const field = document.getElementById(PERIOD_FIELD_ID);
    if (field) field.remove();
    const moisLabel = document.getElementById(MOIS_RELOCATED_LABEL_ID);
    if (moisLabel) moisLabel.remove();
    removeDropdownFontStyleTag();
    [cachedMoisFieldWrapperEl, cachedAnneeFieldContainerEl].forEach((el) => {
      if (el && el.isConnected) el.style.setProperty('visibility', 'hidden', 'important');
    });
  }

  const DROPDOWN_FONT_STYLE_ID = 'tmbc-saisie-dropdown-font-style';

  // (2026-07-31, retour de Nicolas : "la police modifiée de la liste des
  // journaux prend du temps à charger, possible de la modifier avant
  // chargement de la liste ?") : jusqu'ici, la police à chasse fixe était
  // posée en JS (styleAndTruncateDropdownOptions) au tick de scan SUIVANT
  // l'ouverture du menu déroulant — d'où un flash visible de la police
  // d'origine le temps de ce tick. Fix : une règle CSS globale (mais
  // scopée à la page Saisie, ajoutée/retirée avec elle) s'applique dès le
  // montage du DOM par le moteur de rendu, avant même le premier paint —
  // aucun délai JS possible. La troncature + suppression du tiret restent
  // en JS (manipulation de texte impossible en CSS pur), posées par
  // styleAndTruncateDropdownOptions comme avant.
  function ensureDropdownFontStyleTag() {
    if (document.getElementById(DROPDOWN_FONT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = DROPDOWN_FONT_STYLE_ID;
    // (2026-07-31, retour de Nicolas : "met une bordure noire (ombre) autour
    // des listes déroulantes") : ajouté en même temps que la police, dans la
    // même feuille scopée/gérée avec le même cycle de vie — le popper MUI
    // (.MuiAutocomplete-popper) englobe un Paper (.MuiPaper-root/
    // .MuiAutocomplete-paper) qui porte l'ombre MUI par défaut, ici renforcée
    // avec une bordure + ombre plus marquées pour bien détacher la liste du
    // reste de la page.
    style.textContent =
      '.MuiAutocomplete-listbox, .MuiAutocomplete-listbox * { font-family: ' + MONO_FONT_STACK + ' !important; }' +
      '.MuiAutocomplete-popper .MuiPaper-root, .MuiAutocomplete-paper {' +
      ' border: 1px solid rgba(0,0,0,0.65) !important;' +
      ' box-shadow: 0 4px 14px rgba(0,0,0,0.35) !important;' +
      ' }';
    document.head.appendChild(style);
  }

  function removeDropdownFontStyleTag() {
    const style = document.getElementById(DROPDOWN_FONT_STYLE_ID);
    if (style) style.remove();
  }

  // Cache de la hauteur d'origine du CONTENEUR de Mois (libellé + zone de
  // saisie), mesurée une seule fois avant de faire passer moisFieldWrapper
  // en position:fixed. Cf. commentaire dans ensurePeriodField() : une fois
  // ce descendant retiré du flux normal, moisField.container n'a plus que
  // le libellé pour contribuer à sa hauteur et s'affaisse — ce qui, dans un
  // parent flex avec centrage vertical, décale le libellé (et donc, en
  // cascade, notre champ Période) plus bas que Journal/Devise. On rejoue
  // cette hauteur d'origine en min-height à chaque scan pour empêcher cet
  // affaissement.
  let cachedMoisContainerHeight = null;

  // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "quand je change de type de
  // journal, les champs Mois et Année se retrouvent tout en bas à gauche")
  // : root cause — l'ancrage utilisait le rect du champ Solde, qui devient
  // momentanément invalide (largeur 0) pendant le re-rendu déclenché par un
  // changement de journal ; le code tombait alors sur le repli d'origine
  // (coin bas-gauche de la fenêtre), très visible. Fix à deux niveaux : (1)
  // ancrage désormais sur les 2 icônes fixes à droite de Solde (élément
  // encore plus stable, jamais vide) au lieu de Solde lui-même ; (2) SURTOUT,
  // on ne retombe plus JAMAIS sur le coin de la fenêtre — le dernier rect
  // d'ancrage VALIDE est mis en cache et réutilisé tel quel tant qu'aucune
  // mesure valide n'est disponible, éliminant ce repli visible une fois pour
  // toutes, quelle que soit la cause d'une éventuelle prochaine invalidité.
  let cachedMoisAnchorRect = null;


  // (2026-07-31, demandé par Nicolas : "quand je suis sur le champ Journal,
  // quand je fais tab, je passe tout de suite à Devise, je dois m'arrêter
  // sur le champ Période") : notre champ Période, ajouté à document.body
  // (hors de l'arbre React, cf. plus haut), n'est PAS à sa place naturelle
  // dans l'ordre de tabulation du navigateur (qui suit l'ordre du DOM) — il
  // se retrouve tabulable tout à la fin de la page. Fix : on intercepte
  // manuellement la touche Tab sur les champs Journal/Devise et sur notre
  // champ Période lui-même, pour forcer l'ordre Journal -> Période ->
  // Devise (et l'inverse avec Maj+Tab), en gardant les autres touches et
  // comportements natifs intacts. Marqué via un attribut pour ne câbler
  // chaque champ qu'une seule fois (scan() tourne en continu).
  const TAB_WIRED_ATTR = 'data-tmbc-period-tab-wired';

  // (2026-07-31, retour de Nicolas : "quand je suis sur période et que je
  // fais tab, il va sur mois et année, il faut que ca aille directement sur
  // le champ devise") : durci la version précédente — écoute en phase de
  // CAPTURE (avant tout autre gestionnaire, au cas où un composant MUI
  // intercepterait l'événement en premier) + stopPropagation, et sécurité
  // supplémentaire : si jamais le focus atterrit malgré tout sur Mois/Année
  // (ne devrait plus arriver avec tabIndex=-1 sur leurs éléments focusables,
  // cf. ensurePeriodField, mais au cas où), un écouteur "focus" dessus
  // renvoie IMMÉDIATEMENT le focus vers Devise plutôt que de le laisser s'y
  // arrêter.
  // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "le shift tab... doit
  // aller de Devise à Période puis Journal, sans passer par mois et
  // année") : le Tab AVANT fonctionne maintenant, mais Maj+Tab DEPUIS
  // Devise ne s'arrêtait pas sur Période — vérifié en direct (comme pour
  // Année) qu'un champ MuiAutocomplete expose PLUSIEURS éléments
  // focusables (l'input ET le bouton flèche du menu) : l'écouteur posé
  // uniquement sur l'<input> de Journal/Devise ratait donc Maj+Tab quand
  // c'est le BOUTON (pas l'input) qui avait le focus. Fix : écouteur posé
  // sur le CONTENEUR entier de Journal/Devise (capture, donc intercepté
  // quel que soit l'élément interne réellement focus au moment du Tab).
  function wirePeriodFieldTabOrder(field, moisFieldWrapper, anneeFieldContainer) {
    const journalField = findLabeledField('Journal');
    const deviseField = findLabeledField('Devise');

    if (journalField && !journalField.container.hasAttribute(TAB_WIRED_ATTR)) {
      journalField.container.setAttribute(TAB_WIRED_ATTR, '1');
      journalField.container.addEventListener(
        'keydown',
        (e) => {
          // (2026-07-31, retour de Nicolas : "quand je suis sur Journal et
          // que je fais entrée, il passe à Devise au lieu de passer par
          // Période" — "la touche Entrée a la même fonctionnalité que la
          // touche Tab") : même interception que Tab, avec un garde-fou
          // (absent sur Tab) : si le menu déroulant de Journal est ouvert
          // (aria-expanded="true"), Entrée sert nativement à valider
          // l'option surlignée et ne doit pas être détournée.
          if (e.key === 'Enter' && journalField.input.getAttribute('aria-expanded') === 'true') return;
          if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            field.focus();
            field.select();
          }
        },
        true
      );
    }

    if (deviseField && !deviseField.container.hasAttribute(TAB_WIRED_ATTR)) {
      deviseField.container.setAttribute(TAB_WIRED_ATTR, '1');
      deviseField.container.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            field.focus();
            field.select();
          }
        },
        true
      );
    }

    if (!field.hasAttribute(TAB_WIRED_ATTR)) {
      field.setAttribute(TAB_WIRED_ATTR, '1');
      // Recherche à nouveau (fraîche) au moment de l'appui plutôt que de
      // capturer journalInput/deviseInput dans la fermeture : ce
      // gestionnaire n'est câblé qu'une fois, mais les champs natifs
      // pourraient en théorie être recréés par React entre-temps.
      field.addEventListener(
        'keydown',
        (e) => {
          if (e.key !== 'Tab' && e.key !== 'Enter') return;
          e.preventDefault();
          e.stopPropagation();
          // Entrée n'a pas d'équivalent Maj+Entrée ici : e.shiftKey n'est
          // jamais vrai pour 'Enter', donc Entrée prend toujours la branche
          // "avant" (Devise), cohérent avec Tab (retour de Nicolas : "la
          // touche Entrée a la même fonctionnalité que la touche Tab").
          if (e.key === 'Tab' && e.shiftKey) {
            const j = findLabeledFieldInput('Journal');
            if (j) j.focus();
          } else {
            const d = findLabeledFieldInput('Devise');
            if (d) d.focus();
          }
        },
        true
      );
    }

    // Filet de sécurité : si le focus atterrit quand même sur un élément
    // interne de Mois/Année, on le renvoie aussitôt vers Devise.
    [moisFieldWrapper, anneeFieldContainer].forEach((el) => {
      if (!el || el.hasAttribute(TAB_WIRED_ATTR)) return;
      el.setAttribute(TAB_WIRED_ATTR, '1');
      el.addEventListener(
        'focusin',
        () => {
          const d = findLabeledFieldInput('Devise');
          if (d) d.focus();
        },
        true
      );
    });

    wireGlobalPeriodShiftTabFallback(field);
  }

  // (2026-07-31, retour de Nicolas : "le shift tab fonctionne pas entre
  // Période et Journal") : le champ Période est ajouté à document.body,
  // donc en phase de capture, tout ancêtre entre document et lui (par ex.
  // un focus-trap MUI si le formulaire est rendu dans une Dialog) est
  // consulté AVANT le propre écouteur du champ — si un tel ancêtre appelle
  // stopPropagation en premier, notre écouteur sur `field` ne s'exécute
  // jamais, silencieusement. Fix : un écouteur de secours posé directement
  // sur `document` en phase de capture (le tout premier maillon possible de
  // la chaîne, avant n'importe quel autre ancêtre), qui ne fait rien SAUF
  // si le champ Période est l'élément focus au moment du Maj+Tab — pour
  // rester strictement scopé à ce cas précis plutôt que d'intercepter Tab
  // globalement sur toute la page.
  let globalShiftTabFallbackWired = false;
  function wireGlobalPeriodShiftTabFallback(field) {
    if (globalShiftTabFallbackWired) return;
    globalShiftTabFallbackWired = true;
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Tab' || !e.shiftKey) return;
        if (document.activeElement !== field) return;
        e.preventDefault();
        e.stopPropagation();
        const j = findLabeledFieldInput('Journal');
        if (j) j.focus();
      },
      true
    );
  }

  function ensurePeriodField() {
    const moisField = findLabeledField('Mois');
    const anneeField = findLabeledField('Année');
    if (!moisField || !anneeField) return;

    if (moisField.label.textContent.trim() !== 'Période (mm/aaaa)') {
      moisField.label.textContent = 'Période (mm/aaaa)';
    }
    // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "encore un petit problème
    // d'alignement du texte (période mm/aaaa)") : vérifié en direct — le
    // libellé natif "Mois" a une largeur FIXE de 120px avec white-space:
    // normal (repli à la ligne), ce qui convenait au mot "Mois" (4
    // caractères) mais fait passer "Période (mm/aaaa)" sur 2 lignes,
    // décalant sa propre hauteur et créant un chevauchement visuel avec le
    // champ en dessous. Fix : on force nowrap et une largeur automatique
    // sur CE libellé renommé, pour qu'il tienne sur une seule ligne comme
    // les autres.
    moisField.label.style.setProperty('white-space', 'nowrap', 'important');
    moisField.label.style.setProperty('width', 'auto', 'important');

    const moisFieldWrapper = Array.from(moisField.container.children).find((c) => c !== moisField.label);
    if (!moisFieldWrapper) return;

    // Hauteur d'origine du champ Mois, mesurée UNE SEULE FOIS avant de
    // déplacer moisFieldWrapper hors du flux (position:fixed, cf. plus
    // bas) — indispensable : une fois déplacé, son propre rect ne reflète
    // plus sa taille d'origine dans le formulaire, et moisField.container
    // lui-même s'affaisse (un enfant position:fixed ne contribue plus à la
    // hauteur de son parent), donc aucun des deux ne peut plus servir à
    // mesurer la hauteur après coup.
    if (cachedMoisContainerHeight === null) {
      const containerRectBeforeMove = moisField.container.getBoundingClientRect();
      if (containerRectBeforeMove.height > 0) cachedMoisContainerHeight = containerRectBeforeMove.height;
    }
    // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "c'est encore pas aligné,
    // le texte Période doit être sur la même ligne que Journal et Devise, le
    // champ 07/2026 doit être sur la même ligne que BBE ou EUR") : une fois
    // moisFieldWrapper passé en position:fixed (ci-dessous), il ne
    // contribue plus à la hauteur de moisField.container, qui s'affaisse
    // pour ne garder que la hauteur du libellé. Dans la rangée d'en-tête
    // (flex avec centrage vertical des colonnes Journal/Période/Devise),
    // cet affaissement recentre le conteneur — et donc le libellé "Période"
    // — plus bas que ses voisins, décalage qui se répercute ensuite sur le
    // champ (positionné par rapport au libellé). Fix : on rejoue la hauteur
    // d'origine du conteneur en min-height à chaque scan, pour qu'il occupe
    // toujours le même espace que Journal/Devise et que son libellé reste
    // pile à la même hauteur que les leurs.
    if (cachedMoisContainerHeight !== null) {
      moisField.container.style.setProperty('min-height', Math.round(cachedMoisContainerHeight) + 'px', 'important');
    }

    // (2026-07-31, retour de Nicolas, capture annotée) : les deux zones de
    // saisie natives sont déplacées dans une zone vide de la barre d'en-tête
    // plutôt que masquées, pour garder une géométrie propre non-nulle
    // (ancrage du menu déroulant MUI). Toujours position:fixed.
    //
    // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "quand je change de type
    // de journal, les champs Mois et Année se retrouvent tout en bas à
    // gauche") : l'ancrage précédent (rect du champ Solde) devenait
    // momentanément invalide pendant le re-rendu déclenché par un
    // changement de journal, faisant tomber le code sur son repli d'origine
    // (coin bas-gauche de la fenêtre — très visible). Fix : (1) ancrage
    // désormais sur les 2 icônes fixes juste à droite de Solde (capture
    // jointe), plus stables ; on se positionne à leur GAUCHE plutôt qu'à
    // droite de Solde comme avant. (2) le repli "coin de la fenêtre" est
    // supprimé purement et simplement — le dernier rect d'ancrage VALIDE est
    // mis en cache et réutilisé tant qu'aucune mesure valide n'est
    // disponible, ce qui élimine ce repli visible une fois pour toutes.
    const iconButtons = Array.from(document.querySelectorAll('button[class*="noPadding-noPadding-marginRight"]'));
    let iconAnchorRect = null;
    if (iconButtons.length) {
      // Le premier bouton (le plus à GAUCHE des deux) sert de référence :
      // c'est sa bordure gauche que Mois/Année ne doivent jamais dépasser.
      // (2026-10-22, retour de Nicolas : Année/Mois chevauchent Journal/Période) :
      // d'autres boutons de même classe existent ailleurs dans la page (leur
      // plus à gauche faussait l'ancre). On ne garde que ceux de la rangée
      // d'en-tête, à DROITE du champ Devise.
      const deviseF = findLabeledField('Devise');
      const deviseR = deviseF ? deviseF.container.getBoundingClientRect() : null;
      const journalF = findLabeledField('Journal');
      const journalR = journalF ? journalF.container.getBoundingClientRect() : null;
      const rects = iconButtons.map((b) => b.getBoundingClientRect()).filter((r) => {
        if (r.width <= 0) return false;
        if (deviseR && r.left < deviseR.right) return false;
        if (journalR && Math.abs(r.top - journalR.top) > 80) return false;
        return true;
      });
      if (rects.length) {
        iconAnchorRect = rects.reduce((leftmost, r) => (r.left < leftmost.left ? r : leftmost));
      }
    }
    if (!iconAnchorRect) {
      // Repli n°1 si les icônes sont introuvables/invalides : champ Solde
      // (ancrage historique), toujours utile comme deuxième source.
      const soldeField = findLabeledField('Solde');
      const soldeRect = soldeField ? soldeField.container.getBoundingClientRect() : null;
      if (soldeRect && soldeRect.width > 0) iconAnchorRect = soldeRect;
    }
    if (iconAnchorRect && iconAnchorRect.width > 0) {
      cachedMoisAnchorRect = iconAnchorRect;
    }
    // Repli n°2 (et dernier) : le dernier rect valide connu, quelle que soit
    // sa source d'origine — jamais le coin de la fenêtre.
    let anchorRect = cachedMoisAnchorRect;
    // (2026-10-22) Aucune ancre valide (icônes/Solde introuvables) : sans cela
    // les champs restaient à leur place native, PAR-DESSUS Journal/Période.
    // Ancre de secours : juste à droite de Devise (même rangée).
    if (!(anchorRect && anchorRect.width > 0)) {
      const dvF0 = findLabeledField('Devise');
      const dvR0 = dvF0 ? dvF0.container.getBoundingClientRect() : null;
      if (dvR0 && dvR0.width > 0) {
        anchorRect = { left: dvR0.right + 30 + 340, top: dvR0.top, width: 1 };
      }
    }
    // (2026-07-31, retour de Nicolas : "c pas aligné !") : anneeField.container
    // garde son propre libellé "Année" au-dessus de sa zone de saisie — sa
    // structure interne (libellé puis zone de saisie) est donc identique à
    // celle de Solde/Journal/Devise, et aligner le HAUT de son conteneur sur
    // le haut du conteneur Solde suffit à aligner libellés ET zones de
    // saisie ensemble. moisFieldWrapper, lui, N'A PAS de libellé propre ici
    // (le libellé de Mois a été renommé "Période" et reste près de Journal,
    // cf. plus haut) — aligner directement son haut sur le haut du
    // CONTENEUR Solde le plaçait donc au niveau du LIBELLÉ "Solde", trop
    // haut par rapport à la zone de saisie "472 652,81" elle-même. Fix : on
    // décale moisFieldWrapper vers le bas de la hauteur du libellé "Année"
    // (juste à côté, donc représentatif), pour aligner sa zone de saisie
    // avec les zones de saisie voisines plutôt qu'avec leurs libellés.
    const labelHeight = anneeField.label.getBoundingClientRect().height || 20;
    // Références mises en cache (au niveau module) pour que removePeriodField
    // puisse les retrouver et les masquer même quand cette fonction ne
    // tourne plus (page quittée, ou menu plein écran ouvert par-dessus —
    // cf. commentaire sur isFullScreenMenuOverlayOpen).
    cachedMoisFieldWrapperEl = moisFieldWrapper;
    cachedAnneeFieldContainerEl = anneeField.container;
    [moisFieldWrapper, anneeField.container].forEach((el, i) => {
      el.style.setProperty('position', 'fixed', 'important');
      el.style.setProperty('bottom', 'auto', 'important');
      el.style.setProperty('right', 'auto', 'important');
      // Toujours réaffiché ici : au cas où un tick précédent (menu plein
      // écran ouvert entre-temps) les aurait masqués via removePeriodField.
      el.style.setProperty('visibility', 'visible', 'important');
      if (anchorRect && anchorRect.width > 0) {
        const top = i === 0 ? anchorRect.top + labelHeight : anchorRect.top;
        el.style.setProperty('top', Math.round(top) + 'px', 'important');
        // À GAUCHE de l'ancre (icônes ou Solde), pas à droite : deux champs
        // de ~150px chacun, avec une marge de 40px avant l'ancre et 10px
        // entre les deux champs.
        let left = anchorRect.left - 40 - (2 - i) * 150 - (1 - i) * 10;
        // (2026-10-22) Fenêtre étroite : pas la place à gauche des icônes ->
        // on se cale juste à droite de Devise (jamais par-dessus Journal/Période).
        const dvF = findLabeledField('Devise');
        const dvR = dvF ? dvF.container.getBoundingClientRect() : null;
        if (dvR && dvR.width > 0 && left < dvR.right + 10) {
          left = dvR.right + 30 + i * 160;
        }
        el.style.setProperty('left', Math.round(left) + 'px', 'important');
      }
      // (2026-07-31, retour de Nicolas : "quand je fais tab, ca s'arrete
      // sur les champs Mois et Année") : tabIndex=-1 posé UNIQUEMENT sur
      // l'<input> ne suffisait pas — le composant Autocomplete peut aussi
      // exposer d'autres éléments focusables (bouton de la flèche du menu
      // déroulant, etc.). On neutralise TOUS les éléments focusables du
      // bloc déplacé, pas seulement l'input.
      el.querySelectorAll('input, button, [tabindex]').forEach((focusable) => {
        focusable.tabIndex = -1;
      });
    });

    // (2026-07-31, retour de Nicolas : "il manque aussi le libellé Mois au
    // dessus") : puisque le libellé natif de Mois a été renommé "Période"
    // et reste près de Journal (cf. plus haut), le champ Mois relogé ici
    // n'a plus aucun libellé visible — on en ajoute un flottant (comme le
    // champ Période, hors de l'arbre React), positionné juste au-dessus,
    // avec le même style visuel que le libellé natif "Année" juste à côté
    // (couleur/taille/police copiées dynamiquement pour rester cohérent
    // avec le thème).
    let moisLabelEl = document.getElementById(MOIS_RELOCATED_LABEL_ID);
    if (!moisLabelEl) {
      moisLabelEl = document.createElement('p');
      moisLabelEl.id = MOIS_RELOCATED_LABEL_ID;
      moisLabelEl.textContent = 'Mois';
      moisLabelEl.style.position = 'fixed';
      moisLabelEl.style.margin = '0';
      moisLabelEl.style.pointerEvents = 'none';
      moisLabelEl.style.zIndex = '2147483647';
      document.body.appendChild(moisLabelEl);
    }
    const anneeLabelCS = getComputedStyle(anneeField.label);
    moisLabelEl.style.color = anneeLabelCS.color;
    moisLabelEl.style.fontSize = anneeLabelCS.fontSize;
    moisLabelEl.style.fontFamily = anneeLabelCS.fontFamily;
    moisLabelEl.style.fontWeight = anneeLabelCS.fontWeight;
    const anneeLabelRect = anneeField.label.getBoundingClientRect();
    const moisWrapperRectAfterMove = moisFieldWrapper.getBoundingClientRect();
    moisLabelEl.style.left = Math.round(moisWrapperRectAfterMove.left) + 'px';
    moisLabelEl.style.top = Math.round(anneeLabelRect.top) + 'px';

    let field = document.getElementById(PERIOD_FIELD_ID);
    if (!field) {
      field = document.createElement('input');
      field.id = PERIOD_FIELD_ID;
      field.type = 'text';
      field.placeholder = 'MM/AAAA';
      // (2026-07-31, retour de Nicolas : "realigne le champ, enlève le
      // mouseover que t'as fait dessus") : pas de title (tooltip natif au
      // survol) ; style repensé pour ressembler aux champs voisins natifs
      // (soulignement seul, sans cadre plein ni fond blanc) plutôt qu'un
      // encart avec bordure complète qui détonnait visuellement.
      field.style.position = 'fixed';
      field.style.zIndex = '2147483647';
      field.style.fontFamily = MONO_FONT_STACK;
      field.style.boxSizing = 'border-box';
      field.style.border = 'none';
      field.style.borderBottom = '1px solid rgba(0,0,0,0.42)';
      field.style.borderRadius = '0';
      field.style.padding = '4px 0';
      // (2026-07-31, retour de Nicolas : "met la même taille de police pour
      // la période que pour les autres champs") : 13px était une valeur
      // arbitraire ; remplacé plus bas (à chaque repositionnement) par la
      // taille RÉELLE d'un champ voisin natif, pour rester cohérent même si
      // le thème/zoom change. Valeur de repli ici le temps du tout premier
      // rendu, avant le premier passage de repositionnement.
      field.style.fontSize = '14px';
      field.style.background = 'transparent';
      // (2026-07-31, retour de Nicolas : "la touche Entrée a la même
      // fonctionnalité que la touche Tab") : l'ancien gestionnaire dédié
      // (Entrée -> field.blur()) est retiré ici — Entrée est désormais géré
      // avec Tab dans le même écouteur unifié (wirePeriodFieldTabOrder,
      // TAB_WIRED_ATTR ci-dessous), qui fait avancer le focus vers Devise ;
      // quitter le champ déclenche de toute façon son 'blur' (écouteur
      // conservé juste en dessous), donc la validation de la période a
      // toujours lieu.
      field.addEventListener('blur', () => commitPeriodFieldValue(field));
      // Ajouté à document.body : complètement hors de l'arbre React, aucun
      // risque de réconciliation qui l'écarterait silencieusement.
      document.body.appendChild(field);
    }

    // Repositionné à chaque scan à l'emplacement visuel du champ Mois
    // d'origine — calculé à partir de moisField.container/label (qui, eux,
    // restent dans le flux normal du formulaire, jamais déplacés) plutôt
    // que depuis moisFieldWrapper (désormais relogé en bas de fenêtre,
    // cf. plus haut — utiliser son rect ici positionnerait notre champ
    // visible au mauvais endroit, en bas de la fenêtre, au lieu du
    // formulaire).
    // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "la période est toujours
    // pas aligné !!!! je veux que ca soit aligner avec le reste de la
    // ligne") : la tentative précédente reconstruisait le "top" à partir de
    // labelRect.bottom + une hauteur mise en cache — un calcul approximatif
    // qui ne correspondait pas forcément exactement à la ligne de base
    // réelle des AUTRES champs (Journal/Devise/N° de compte/Solde). Fix :
    // au lieu de recalculer, on copie directement le rect RÉEL d'un champ
    // voisin non modifié (Devise, juste à côté) pour le top/la hauteur —
    // garantit un alignement pixel-perfect avec le reste de la ligne,
    // quels que soient les détails de mise en page natifs.
    const containerRect = moisField.container.getBoundingClientRect();
    // BUG RÉCURRENT (2026-07-31, 2e retour de Nicolas : "la période est à
    // nouveau décalé, alors que ca marchait juste avant") : se baser
    // uniquement sur le rect de Devise s'est révélé fragile — si ce champ
    // est lui-même momentanément caché/redimensionné (ex. pendant une
    // sélection en cours dessus), son rect devient invalide (hauteur 0 ou
    // position résiduelle) et notre champ Période hérite du mauvais top,
    // sans qu'aucune erreur ne soit levée. Fix : on essaie plusieurs champs
    // voisins non modifiés dans l'ordre (Journal, Devise, N° de compte,
    // Solde) et on retient le premier dont le rect est réellement valide
    // (hauteur > 0), au lieu de dépendre d'un seul champ fixe.
    const refCandidates = ['Journal', 'Devise', 'N° de compte', 'Solde'];
    let refRect = null;
    let refInput = null;
    for (const label of refCandidates) {
      const input = findLabeledFieldInput(label);
      if (!input) continue;
      const rect = input.getBoundingClientRect();
      if (rect.height > 0) {
        refRect = rect;
        refInput = input;
        break;
      }
    }
    if (containerRect.width > 0 && refRect && refRect.height > 0) {
      // Garde-fou supplémentaire : ne jamais positionner le champ AU-DESSUS
      // du bas réel du libellé "Période (mm/aaaa)" (au cas où il occuperait
      // malgré tout plus d'une ligne dans certaines largeurs de fenêtre),
      // sinon chevauchement visuel entre libellé et champ.
      const labelBottom = moisField.label.getBoundingClientRect().bottom;
      const top = Math.max(refRect.top, labelBottom);
      field.style.left = Math.round(containerRect.left) + 'px';
      field.style.top = Math.round(top) + 'px';
      field.style.width = Math.round(containerRect.width) + 'px';
      field.style.height = Math.round(refRect.height) + 'px';
      // (2026-07-31, retour de Nicolas : "met la même taille de police pour
      // la période que pour les autres champs") : copie la taille RÉELLE du
      // champ voisin utilisé comme référence (déjà mesuré ci-dessus pour la
      // position), plutôt qu'une valeur codée en dur — reste cohérent avec
      // le reste de la ligne quel que soit le thème/zoom.
      if (refInput) {
        const refFontSize = getComputedStyle(refInput).fontSize;
        if (refFontSize) field.style.fontSize = refFontSize;
      }
    }

    wirePeriodFieldTabOrder(field, moisFieldWrapper, anneeField.container);

    if (!periodCommitInProgress && document.activeElement !== field) {
      const display = formatPeriodDisplay();
      if (display && field.value !== display) field.value = display;
    }
  }


  // Grille HISTORIQUE (en dessous) : largeur de la colonne "date" alignée
  // sur "entry_date" (Date Saisie) — chaque cellule porte sa propre largeur
  // en style inline (px), donc on l'applique à TOUTES les cellules "date"
  // (header + chaque ligne + footer), pas seulement au header.
  function equalizeSaisieHistoryDateColumnWidth() {
    const gridCol = findGridColumnByColumnKey('entry_date');
    if (!gridCol) return;
    const headerEntryDate = gridCol.querySelector('.vtHeader [data-column-key="entry_date"]');
    if (!headerEntryDate) return;
    const targetWidth = Math.round(headerEntryDate.getBoundingClientRect().width);
    if (!targetWidth) return;
    gridCol.querySelectorAll('[data-column-key="date"]').forEach((cell) => {
      cell.style.setProperty('width', targetWidth + 'px', 'important');
      cell.style.setProperty('min-width', targetWidth + 'px', 'important');
      cell.style.setProperty('max-width', targetWidth + 'px', 'important');
      cell.style.setProperty('flex', '0 0 ' + targetWidth + 'px', 'important');
    });
  }


  // Ligne TOTAUX (.vtFooter) de la grille historique : police à chasse fixe
  // UNIQUEMENT sur les 2 montants (debit/credit) — jamais sur "TOTAUX" lui-
  // même (retour de Nicolas : "idem pour les textes Total écritures ou
  // Totaux par ex. on garde la police d'origine"), posé sur la cellule
  // piece2 (texte pur, vérifié en direct), donc déjà exclue en ne ciblant
  // que debit/credit.
  function styleSaisieHistoryFooterMonospace() {
    const gridCol = findGridColumnByColumnKey('entry_date');
    if (!gridCol) return;
    const footer = gridCol.querySelector('.vtFooter');
    if (!footer) return;
    ['debit', 'credit'].forEach((key) => {
      const cell = footer.querySelector('[data-column-key="' + key + '"]');
      if (cell) cell.style.setProperty('font-family', MONO_FONT_STACK, 'important');
    });
  }


  // (2026-07-31, demandé par Nicolas) "Par défaut, on réduit la partie
  // Ecritures (flèche vers le bas)" : le panneau "Ecriture" (Flux
  // manuel/Facture(s) en attente/...) est un MuiAccordion natif, ouvert par
  // défaut. On ne le replie qu'UNE SEULE FOIS par chargement de page (le
  // drapeau ecritureAccordionHandled empêche de le reforcer si l'utilisateur
  // le rouvre ensuite lui-même) — un simple .click() natif sur le bouton
  // natif MUI, pas de manipulation de son état interne.
  //
  // BUG CORRIGÉ (2026-07-31, capture d'écran de Nicolas : le panneau reste
  // ouvert) : la détection cherchait un <h6> dont le texte exact est
  // "Ecriture" — or "Ecriture" est AUSSI le libellé du premier bouton radio
  // du groupe (Ecriture / Flux manuel / Facture(s) en attente / ...), donc
  // soit la mauvaise balise était visée, soit aucune balise <h6> exacte
  // n'existe réellement pour ce titre (nom de balise/structure MUI non
  // vérifiable sans accès direct à l'appli). Fix plus robuste : on repère le
  // ".MuiAccordionSummary-root" dont le texte contient "Flux manuel" — ce
  // libellé est unique à cette section (aucun risque de confusion avec le
  // radio "Ecriture" seul) — puis on vérifie l'état ouvert via la classe
  // Mui-expanded OU l'attribut aria-expanded="true" (l'un des deux existe
  // forcément sur un bouton d'accordéon MUI).
  let ecritureAccordionHandled = false;

  function findEcritureAccordionSummary() {
    // Même précaution multi-société que findLabeledField ci-dessus : ne
    // cible que l'onglet RÉELLEMENT visible, pas un onglet d'une autre
    // société resté monté en arrière-plan.
    return Array.from(document.querySelectorAll('.MuiAccordionSummary-root')).find(
      (el) => el.textContent.includes('Flux manuel') && isElementVisible(el)
    );
  }

  // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "par défaut la partie
  // Ecritures doit être réduite à l'ouverture de la page" — régression, ça
  // fonctionnait avant) : root cause probable — ecritureAccordionHandled
  // était verrouillé à `true` DANS LA MÊME PASSE que l'appel à .click(),
  // sans jamais revérifier que le clic avait réellement eu l'effet
  // attendu. Si le clic n'a pas fonctionné du premier coup (timing React,
  // accordéon pas encore complètement hydraté au tout premier scan après
  // chargement de page, etc.), le drapeau restait verrouillé pour de bon et
  // le panneau ne se repliait jamais. Fix : on ne verrouille désormais QUE
  // lorsqu'on a CONSTATÉ que le panneau est replié (soit déjà replié
  // nativement, soit après un clic qui a effectivement fonctionné) ; tant
  // que ce n'est pas le cas, on retente à chaque scan, avec un court délai
  // entre deux clics (le temps que React traite le précédent) pour éviter
  // un double-clic qui rouvrirait le panneau qu'on vient de refermer.
  let ecritureAccordionLastClickAt = 0;

  function collapseEcritureAccordionByDefault() {
    if (ecritureAccordionHandled) return;
    const summaryBtn = findEcritureAccordionSummary();
    if (!summaryBtn) return; // pas encore rendu, on retente au prochain scan
    const isExpanded =
      summaryBtn.classList.contains('Mui-expanded') || summaryBtn.getAttribute('aria-expanded') === 'true';
    if (!isExpanded) {
      // Déjà replié (nativement, ou suite à un clic précédent qui a
      // fonctionné) : on verrouille, plus jamais retouché tant que la page
      // n'est pas rechargée — respecte une réouverture manuelle ultérieure
      // par l'utilisateur.
      ecritureAccordionHandled = true;
      return;
    }
    const now = Date.now();
    if (now - ecritureAccordionLastClickAt < 500) return;
    ecritureAccordionLastClickAt = now;
    summaryBtn.click();
  }


  // (2026-07-31, demandé par Nicolas) Ligne de séparation entre chaque
  // écriture de la grille historique — les lignes d'une même écriture
  // partagent la même bande de couleur (classe "even"/"odd" du bodyRow,
  // vérifié en direct : 2 lignes "even" puis 2 lignes "odd", etc., peu
  // importe le nombre réel de lignes par écriture), donc un changement de
  // classe par rapport à la ligne précédente marque le début d'une
  // nouvelle écriture.
  //
  // (2026-07-31, retour de Nicolas : "ca a bien mis les lignes séparatrice.
  // enlève les colorisations, garde juste les lignes séparatrices") : la
  // bande grise/blanche native alternée (posée par la classe même/odd elle-
  // même) est neutralisée ici en forçant un fond blanc uniforme sur TOUTES
  // les lignes de cette grille — seule la ligne de séparation ajoutée reste
  // comme indicateur visuel de changement d'écriture.
  function markEcritureGroupBoundaries() {
    const gridCol = findGridColumnByColumnKey('entry_date');
    if (!gridCol) return;
    const rows = gridCol.querySelectorAll('.vtBody .bodyRow');
    let prevIsEven = null;
    rows.forEach((row) => {
      row.style.setProperty('background-color', '#fff', 'important');
      const isEven = row.classList.contains('even');
      if (prevIsEven !== null && isEven !== prevIsEven) {
        row.style.setProperty('border-top', '1px solid #9ca3af', 'important');
      } else {
        row.style.removeProperty('border-top');
      }
      prevIsEven = isEven;
    });
  }


  // (2026-07-31, retour de Nicolas : "réduire la largeur de la colonne
  // N° Compte et agrandir la colonne Intitulé" sur la grille de saisie
  // (partie haute, nouvelle écriture)) : uniquement cette grille (identifiée
  // via la clé "account_id", propre à la partie haute — la grille historique
  // utilise "account_number") ; largeurs redistribuées à somme constante
  // (-70px / +70px) pour ne pas décaler les colonnes suivantes ni faire
  // déborder la ligne.
  function resizeGridColumnWidths(gridColKey, widths) {
    const gridCol = findGridColumnByColumnKey(gridColKey);
    if (!gridCol) return;
    Object.keys(widths).forEach((key) => {
      const width = widths[key];
      gridCol.querySelectorAll('[data-column-key="' + key + '"]').forEach((cell) => {
        cell.style.setProperty('width', width + 'px', 'important');
        cell.style.setProperty('min-width', width + 'px', 'important');
        cell.style.setProperty('max-width', width + 'px', 'important');
        cell.style.setProperty('flex', '0 0 ' + width + 'px', 'important');
      });
    });
  }

  const NEW_ENTRY_ACCOUNT_ID_WIDTH = 130;
  const NEW_ENTRY_ACCOUNT_LABEL_WIDTH = 320;
  // (2026-07-31, retour de Nicolas, capture "Ecriture/Jal/Date/N° Compte...")
  // : "dans la partie basse, réduit la largeur de la colonne N° compte...
  // l'espace gagné sera utilisé par la colonne Intitulé" — vérifié en direct
  // les largeurs natives de cette grille (historique) : N° Compte ("account_
  // number") à 100px, Intitulé ("account_label") à 175px ; redistribuées à
  // somme constante comme pour la grille du haut (70px/205px). Puis retour
  // "élargis la colonne N° compte en bas de 3 car." : +3 caractères en
  // police monospace (~8px/caractère à cette taille) = +24px, repris sur
  // Intitulé pour garder la somme constante (94px/181px).
  const HISTORY_ACCOUNT_NUMBER_WIDTH = 94;

  // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "t'as merdé sur la partie
  // basse... le journal est à moitié masqué, plus de séparateur entre Param
  // IB et Contrepartie... reprend la version d'avant, refais l'élargissement
  // de l'intitulé et la réduction de la contrepartie") : la tentative
  // précédente fixait Intitulé/Contrepartie à des largeurs ABSOLUES codées en
  // dur (341px/326px), déduites d'une mesure prise dans un onglet Chrome
  // DÉCONNECTÉ de l'application réelle (qui n'exécute pas ce script — cf.
  // limitation documentée ailleurs dans ce fichier) : rien ne garantit que
  // cette mesure correspondait à la largeur RÉELLE de la colonne Contrepartie
  // dans la session de Nicolas, d'où la casse observée (colonnes suivantes
  // écrasées). Fix : au lieu de largeurs absolues, on mesure la largeur
  // NATIVE réelle de chaque colonne une seule fois (mise en cache au tout
  // premier scan après un rechargement de page, donc AVANT toute
  // modification), puis on ajoute/retranche le delta demandé (+10/-10
  // caractères) à cette valeur réellement observée dans SA session — le
  // résultat s'adapte donc à la vraie largeur, quelle qu'elle soit, au lieu
  // de l'écraser avec une valeur potentiellement fausse.
  const HISTORY_LABEL_COUNTERPART_ADJUST_PX = 80; // 10 caractères à ~8px/caractère (police monospace)
  // (2026-07-31, retour de Nicolas, capture "Contrepartie/Echéance/Date
  // Saisie/Règlement") : "élargis un tout petit peu la colonne Contrepartie
  // pour éviter le problème d'en-tête sur 2 lignes, et réduit la partie
  // Règlement pour compenser" — le rétrécissement net de Contrepartie
  // (-80px, ci-dessus) faisait passer son libellé d'en-tête "Contrepartie"
  // sur 2 lignes. RETOUR (2026-07-31, "MARCHE PAS") : le +30px accordé la
  // fois précédente ne suffisait toujours pas — "Contrepartie" fait 12
  // caractères, soit environ 96px de texte en police monospace, plus le
  // padding de la cellule d'en-tête. Plutôt que de retenter au pifomètre
  // une nouvelle valeur de compensation, on impose un PLANCHER de largeur
  // généreux (130px) qui garantit de ne plus jamais wrapper sur 2 lignes,
  // quel que soit le delta calculé par ailleurs — le calcul par delta reste
  // la cible visée, ce plancher n'intervient que si le résultat tombait en
  // dessous.
  const HISTORY_COUNTERPART_HEADER_FIX_PX = 30;
  const HISTORY_COUNTERPART_MIN_WIDTH = 130;
  let cachedHistoryAccountLabelNativeWidth = null;
  let cachedHistoryCounterpartNativeWidth = null;
  let cachedHistoryPaymentTypeNativeWidth = null;

  function resizeHistoryLabelAndCounterpart(gridCol) {
    if (cachedHistoryAccountLabelNativeWidth === null) {
      const headerLabel = gridCol.querySelector('.vtHeader [data-column-key="account_label"]');
      const w = headerLabel ? headerLabel.getBoundingClientRect().width : 0;
      if (w > 0) cachedHistoryAccountLabelNativeWidth = w;
    }
    if (cachedHistoryCounterpartNativeWidth === null) {
      const headerCounterpart = gridCol.querySelector('.vtHeader [data-column-key="counterpart"]');
      const w = headerCounterpart ? headerCounterpart.getBoundingClientRect().width : 0;
      if (w > 0) cachedHistoryCounterpartNativeWidth = w;
    }
    if (cachedHistoryPaymentTypeNativeWidth === null) {
      const headerPaymentType = gridCol.querySelector('.vtHeader [data-column-key="payment_type"]');
      const w = headerPaymentType ? headerPaymentType.getBoundingClientRect().width : 0;
      if (w > 0) cachedHistoryPaymentTypeNativeWidth = w;
    }
    if (
      cachedHistoryAccountLabelNativeWidth === null ||
      cachedHistoryCounterpartNativeWidth === null ||
      cachedHistoryPaymentTypeNativeWidth === null
    ) {
      return;
    }
    const labelWidth = cachedHistoryAccountLabelNativeWidth + HISTORY_LABEL_COUNTERPART_ADJUST_PX;
    // Garde-fou : plancher généreux (130px, cf. commentaire ci-dessus) qui
    // garantit que le libellé d'en-tête "Contrepartie" (12 caractères) ne
    // repasse plus jamais sur 2 lignes, quel que soit le résultat du calcul
    // par delta.
    const counterpartTarget =
      cachedHistoryCounterpartNativeWidth - HISTORY_LABEL_COUNTERPART_ADJUST_PX + HISTORY_COUNTERPART_HEADER_FIX_PX;
    const counterpartWidth = Math.max(HISTORY_COUNTERPART_MIN_WIDTH, counterpartTarget);
    // La compensation prise sur Règlement doit correspondre à ce que
    // Contrepartie gagne RÉELLEMENT (utile si le plancher ci-dessus a dû
    // relever la cible au-delà du delta d'origine).
    const counterpartGain = counterpartWidth - (cachedHistoryCounterpartNativeWidth - HISTORY_LABEL_COUNTERPART_ADJUST_PX);
    const paymentTypeWidth = Math.max(80, cachedHistoryPaymentTypeNativeWidth - counterpartGain);
    resizeGridColumnWidths('entry_date', {
      account_label: labelWidth,
      counterpart: counterpartWidth,
      payment_type: paymentTypeWidth,
    });
  }

  function resizeSaisieAccountColumns() {
    resizeGridColumnWidths('account_id', {
      account_id: NEW_ENTRY_ACCOUNT_ID_WIDTH,
      account_label: NEW_ENTRY_ACCOUNT_LABEL_WIDTH,
    });
    resizeGridColumnWidths('entry_date', {
      account_number: HISTORY_ACCOUNT_NUMBER_WIDTH,
    });
    const historyGridCol = findGridColumnByColumnKey('entry_date');
    if (historyGridCol) resizeHistoryLabelAndCounterpart(historyGridCol);
  }

  // (2026-07-31, retour de Nicolas : "met Pièce 1 et Pièce 2 après la colonne
  // Crédit", partie haute ET partie basse) : les cellules de chaque ligne
  // sont de simples <div> en display:inline-block, positionnées uniquement
  // par leur ORDRE dans le DOM (pas de flex/order ici, vérifié en direct) —
  // les déplacer avec insertBefore ENTRE FRÈRES DU MÊME PARENT (jamais vers
  // un autre conteneur) est sans risque vis-à-vis du bug insertBefore déjà
  // rencontré ailleurs (qui venait d'un nœud pas enfant direct du parent
  // ciblé). Comme pour les autres ajustements de cette grille virtualisée,
  // React peut re-rendre et remettre les cellules dans son propre ordre —
  // rejoué à chaque tick de scan comme le reste des correctifs de ce fichier.
  function moveColumnsAfter(row, keysToMove, afterKey) {
    const anchor = row.querySelector('[data-column-key="' + afterKey + '"]');
    if (!anchor) return;
    let ref = anchor;
    keysToMove.forEach((key) => {
      const cell = row.querySelector('[data-column-key="' + key + '"]');
      if (!cell) return;
      if (ref.nextSibling !== cell) {
        row.insertBefore(cell, ref.nextSibling);
      }
      ref = cell;
    });
  }

  function reorderPieceColumnsAfterCredit(gridColKey) {
    const gridCol = findGridColumnByColumnKey(gridColKey);
    if (!gridCol) return;
    const rows = [];
    const header = gridCol.querySelector('.vtHeader');
    if (header) rows.push(header);
    gridCol.querySelectorAll('.bodyRow').forEach((row) => rows.push(row));
    const footer = gridCol.querySelector('.vtFooter');
    if (footer) rows.push(footer);
    rows.forEach((row) => moveColumnsAfter(row, ['piece', 'piece2'], 'credit'));
  }

  // BUG CORRIGÉ (2026-07-31, retour de Nicolas : "l'ordre de tabulation
  // fonctionne pas, il passe de Intitulé à Pièce 1 directement, alors qu'il
  // devrait faire Débit, Crédit puis Pièce 1 (idem en arrière)") : le
  // réordonnancement DOM ci-dessus (moveColumnsAfter) suffit pour l'AFFICHAGE
  // visuel, mais cette grille est une ligne CONTRÔLÉE qui se re-rend à
  // chaque frappe — React remet les cellules (piece/piece2) à leur position
  // d'origine dans le DOM à chaque re-rendu, et notre tick de scan ne les
  // replace qu'ensuite. Si l'utilisateur appuie sur Tab dans la fenêtre
  // (courte mais réelle) entre un re-rendu et le prochain tick, l'ordre du
  // DOM — et donc la tabulation native — n'est pas encore corrigé. Fix :
  // indépendamment du réordonnancement visuel, on intercepte explicitement
  // Tab/Maj+Tab sur les <input> Intitulé/Débit/Crédit/Pièce 1/Pièce 2/Type
  // Règlement pour forcer la séquence Intitulé -> Débit -> Crédit -> Pièce 1
  // -> Pièce 2 -> Type Règlement (et l'inverse), quel que soit l'ordre RÉEL
  // du DOM au moment de l'appui — même technique déjà utilisée pour Journal/
  // Période/Devise plus haut.
  //
  // (2026-07-31, retour de Nicolas : "la touche Entrée a la même
  // fonctionnalité que la touche Tab, réorganise également la touche Entrée
  // pour Débit/Crédit/Pièce 1/Pièce 2, après Pièce 2 ça doit aller sur Type
  // Règlement") : même logique appliquée à Entrée qu'à Tab (avant, pas de
  // Maj+Entrée demandé) — un seul et même handler gère les deux touches.
  // "Type Règlement" (payment_type) est le dernier maillon de la séquence :
  // aucun nextInput n'est défini pour lui, donc Tab/Entrée à partir de ce
  // champ ne sont PAS interceptés et suivent le comportement natif de
  // l'application — qui, d'après Nicolas, valide alors la ligne d'écriture
  // (comportement natif, hors de portée de ce script : rien à coder de plus
  // ici, seulement s'assurer que le focus atteint bien ce champ).
  //
  // Garde-fou ajouté pour Entrée (absent sur Tab, qui n'a pas cette
  // sémantique) : si le champ est un Autocomplete MUI dont le menu est
  // ouvert (aria-expanded="true"), Entrée sert nativement à VALIDER l'option
  // surlignée dans la liste — on ne doit pas la détourner dans ce cas, sinon
  // la sélection ne se ferait jamais.
  const ROW_TAB_WIRED_ATTR = 'data-tmbc-row-tab-wired';
  function wireNewEntryRowTabOrder(gridColKey) {
    const gridCol = findGridColumnByColumnKey(gridColKey);
    if (!gridCol) return;
    gridCol.querySelectorAll('.bodyRow').forEach((row) => {
      const sequenceKeys = ['account_label', 'debit', 'credit', 'piece', 'piece2', 'payment_type'];
      const inputs = sequenceKeys.map((key) => {
        const cell = row.querySelector('[data-column-key="' + key + '"]');
        return cell ? cell.querySelector('input') : null;
      });
      inputs.forEach((input, i) => {
        if (!input || input.hasAttribute(ROW_TAB_WIRED_ATTR)) return;
        input.setAttribute(ROW_TAB_WIRED_ATTR, '1');
        const prevInput = inputs[i - 1];
        const nextInput = inputs[i + 1];
        input.addEventListener(
          'keydown',
          (e) => {
            if (e.key !== 'Tab' && e.key !== 'Enter') return;
            if (e.key === 'Enter' && input.getAttribute('aria-expanded') === 'true') return;
            const isBackward = e.key === 'Tab' && e.shiftKey;
            if (!isBackward && nextInput) {
              e.preventDefault();
              e.stopPropagation();
              nextInput.focus();
              nextInput.select && nextInput.select();
            } else if (isBackward && prevInput) {
              e.preventDefault();
              e.stopPropagation();
              prevInput.focus();
              prevInput.select && prevInput.select();
            }
            // Sans voisin dans la séquence (ex. Tab/Entrée en avant depuis
            // Type Règlement, ou Maj+Tab en arrière depuis Intitulé) :
            // comportement natif inchangé, pas d'interception.
          },
          true
        );
      });
    });
  }

  // (2026-07-31, retour de Nicolas : "enlève la flèche qui signale une liste
  // déroulante, c'est pas beau") : fonctionnalité ajoutée puis retirée dans
  // la même journée — ne reste ici qu'un nettoyage de sécurité qui retire
  // tout repère résiduel encore présent dans le DOM (au cas où une version
  // précédente du script aurait déjà injecté les span avant ce retrait, le
  // rechargement du fichier seul ne les efface pas rétroactivement).
  const DROPDOWN_ARROW_CLASS = 'tmbc-dropdown-arrow';
  function removeDropdownArrowIcons() {
    document.querySelectorAll('.' + DROPDOWN_ARROW_CLASS).forEach((el) => el.remove());
  }

  // -----------------------------------------------------------------------
  // Synchronisation Du/Au/Journaux (panneau de filtres "Ecriture", partie
  // basse) après validation d'une écriture (2026-08-01, demande explicite de
  // Nicolas : "une fois qu'on valide une écriture, il faut mettre à jour la
  // partie basse en corrigeant les filtres... Du, Au et Journaux en fonction
  // de ce qui a été mis en haut"). Confirmé en direct (Claude in Chrome,
  // avant d'implémenter) que ce désalignement existe dès qu'on change le
  // Journal du haut, sans même valider : le filtre "Journaux" du bas garde
  // l'ancien journal, Du/Au ne bougent jamais tout seuls.
  //
  // sleep/waitFor : même pattern déjà éprouvé dans balance.js/revision.js
  // (attente d'un re-rendu React précis via polling, plutôt qu'un délai fixe
  // deviné). setNativeValue : porté tel quel depuis autofill.js (seul autre
  // endroit du projet qui doit déjà écrire dans un <input> contrôlé par
  // React — même contrainte ici sur Du/Au).
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitFor(predicate, timeoutMs, stepMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const v = predicate();
      if (v) return v;
      await sleep(stepMs || 100);
    }
    return null;
  }

  function setNativeValue(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Même garde de visibilité que findLabeledField (isElementVisible) : évite
  // de cibler le champ d'un onglet société caché quand plusieurs sociétés
  // restent montées en même temps dans le DOM (cf. bug v2.21 plus haut).
  function findButtonByText(text) {
    return (
      Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.trim() === text && isElementVisible(b)
      ) || null
    );
  }

  function findVisibleInputByName(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]`)).find(isElementVisible) || null;
  }

  // Lit les 2 totaux ("Total écriture : Débit ... Crédit ... Solde ...") en
  // repartant du libellé "Total écriture" plutôt que d'un sélecteur de
  // classe (aucune classe stable identifiée sur ces cellules) — sert
  // uniquement de signal de confirmation "écriture bien enregistrée" (voir
  // onValiderClicked), jamais pour une valeur métier.
  function readEntryTotals() {
    const nodes = Array.from(document.querySelectorAll('body *'));
    let target = null;
    for (const el of nodes) {
      if (
        el.children.length === 0 &&
        el.textContent &&
        el.textContent.trim() === 'Total écriture' &&
        isElementVisible(el)
      ) {
        target = el;
        break;
      }
    }
    if (!target) return null;
    let row = target;
    for (let i = 0; i < 4 && row; i++) row = row.parentElement;
    if (!row) return null;
    const texts = Array.from(row.querySelectorAll('*'))
      .filter((e) => e.children.length === 0)
      .map((e) => e.textContent.trim())
      .filter(Boolean);
    const idx = texts.indexOf('Total écriture');
    if (idx === -1) return null;
    return { debit: texts[idx + 1], credit: texts[idx + 2] };
  }

  // Ouvre le menu déroulant d'un champ MuiAutocomplete EN TAPANT le texte
  // recherché (plutôt que ArrowDown comme selectAutocompleteOption
  // ci-dessus, utilisé pour Mois/Année) : le champ "Journaux" du bas peut
  // avoir une longue liste de journaux, ArrowDown seul ouvrirait le menu
  // sans garantir que l'option voulue soit rendue (liste potentiellement
  // virtualisée) — taper filtre la liste jusqu'à l'option exacte, comme
  // vérifié en direct (Claude in Chrome) avant d'implémenter.
  async function selectAutocompleteOptionByTyping(input, matchText) {
    input.focus();
    setNativeValue(input, matchText);
    const option = await waitFor(() => {
      const listbox = document.querySelector('.MuiAutocomplete-listbox');
      if (!listbox) return null;
      return (
        Array.from(listbox.querySelectorAll('[role="option"], li')).find(
          (o) => o.textContent.trim() === matchText
        ) || null
      );
    }, 2000, 100);
    if (!option) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      return false;
    }
    option.click();
    await sleep(150);
    return true;
  }

  // Retire toute(s) puce(s) déjà présente(s) dans "Journaux" (peu importe
  // combien : le filtre doit refléter EXACTEMENT le journal utilisé en haut,
  // pas s'y ajouter) puis sélectionne le journal demandé. Suppression de
  // puce testée en direct : un simple .click() sur l'icône suffit (pas un
  // MuiPopover/menu à ouvrir, juste un bouton de suppression classique).
  async function setJournauxFilterToJournal(journalLabel) {
    const field = findLabeledField('Journaux');
    if (!field) return false;
    const { container, input } = field;

    let guard = 0;
    while (guard < 10) {
      const deleteIcon = container.querySelector('.MuiChip-deleteIcon');
      if (!deleteIcon) break;
      deleteIcon.click();
      await sleep(80);
      guard++;
    }

    return selectAutocompleteOptionByTyping(input, journalLabel);
  }

  // Calcule Du/Au ("01/MM/AAAA" -> dernier jour du mois) à partir de la
  // Période (mm/aaaa) affichée en haut — new Date(year, month, 0).getDate()
  // donne le dernier jour du mois `month` (1-indexé) automatiquement juste
  // (28/29/30/31, années bissextiles comprises pour février : le moteur JS
  // gère ça nativement, aucune table de correspondance à maintenir).
  async function syncBottomFiltersWithHeader(journalLabel, period) {
    const m = /^(\d{2})\/(\d{4})$/.exec(period || '');
    if (!m) return;
    const mm = m[1];
    const aaaa = m[2];
    const month = parseInt(mm, 10);
    const year = parseInt(aaaa, 10);
    const lastDay = new Date(year, month, 0).getDate();
    const du = '01/' + mm + '/' + aaaa;
    const au = String(lastDay).padStart(2, '0') + '/' + mm + '/' + aaaa;

    const duInput = findVisibleInputByName('start_date');
    const auInput = findVisibleInputByName('end_date');
    if (duInput) setNativeValue(duInput, du);
    if (auInput) setNativeValue(auInput, au);

    await setJournauxFilterToJournal(journalLabel);

    const applyBtn = findButtonByText('Appliquer les filtres');
    if (applyBtn && !applyBtn.disabled) applyBtn.click();
  }

  // Capture Journal/Période dès le clic (avant que le formulaire ne se
  // réinitialise après l'enregistrement), puis attend la confirmation
  // visuelle que l'écriture a bien été enregistrée : le bouton Valider
  // redevient désactivé ET les totaux Débit/Crédit repassent à 0,00 €.
  // Les deux conditions ensemble évitent un faux positif pendant le bref
  // aller-retour réseau de l'enregistrement lui-même (le bouton peut déjà
  // être désactivé à ce moment-là, mais les totaux affichent encore le
  // montant qui vient d'être saisi — seul le retour à 0,00 € confirme que
  // le formulaire a réellement été réinitialisé après un succès).
  async function onValiderClicked() {
    const journalInput = findLabeledFieldInput('Journal');
    const journalLabel = journalInput ? journalInput.value.trim() : '';
    const period = formatPeriodDisplay();
    if (!journalLabel || !period) return;

    const confirmed = await waitFor(() => {
      const btn = findButtonByText('Valider');
      const totals = readEntryTotals();
      if (!btn || !totals) return false;
      return btn.disabled && totals.debit === '0,00 €' && totals.credit === '0,00 €';
    }, 8000, 200);
    if (!confirmed) return; // pas de confirmation dans le délai : on ne devine rien, on ne touche à rien

    await syncBottomFiltersWithHeader(journalLabel, period);
  }

  // Réattaché uniquement quand le nœud <button> "Valider" change (React
  // recrée régulièrement ce bouton) — jamais deux fois sur le même nœud.
  let validerWiredBtn = null;
  function wireValiderSync() {
    const btn = findButtonByText('Valider');
    if (!btn || btn === validerWiredBtn) return;
    validerWiredBtn = btn;
    btn.addEventListener('click', onValiderClicked);
  }

  function scanSaisie() {
    if (isDisabled() || !isSaisiePage() || isFullScreenMenuOverlayOpen() || isBlockingPopoverOpen()) {
      removePeriodField();
      return;
    }
    ensureDropdownFontStyleTag();
    styleSaisieHeaderFieldsMonospace();
    styleNewEntryGridMonospace();
    styleCompteDropdownMonospace();
    ensurePeriodField();
    equalizeSaisieHistoryDateColumnWidth();
    styleSaisieHistoryFooterMonospace();
    collapseEcritureAccordionByDefault();
    markEcritureGroupBoundaries();
    resizeSaisieAccountColumns();
    reorderPieceColumnsAfterCredit('account_id');
    reorderPieceColumnsAfterCredit('entry_date');
    wireNewEntryRowTabOrder('account_id');
    removeDropdownArrowIcons();
    wireValiderSync();
  }

  registerScan(scanSaisie);
})();
