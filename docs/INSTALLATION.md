# Installer l'extension Atelier MyUnisoft

Durée : 3 minutes. Chrome à jour (version 120 minimum).

## 1. Télécharger

1. Télécharger **atelier-myunisoft-extension.zip** depuis
   https://chassard67.github.io/atelier-myunisoft/
2. Créer le dossier `C:\AtelierMyUnisoft\extension` et y **extraire** le zip.
   Garder toujours ce même dossier : les mises à jour de l'extension s'y feront.

## 2. Installer dans Chrome

1. Ouvrir `chrome://extensions` dans la barre d'adresse.
2. Activer **Mode développeur** (interrupteur en haut à droite).
3. Cliquer **Charger l'extension non empaquetée** et choisir `C:\AtelierMyUnisoft\extension`.
4. Sur la carte « Atelier MyUnisoft », cliquer **Détails**, puis activer
   **Autoriser les scripts utilisateur**. *(Indispensable : sans ça, aucun module ne s'exécute.)*
5. Cliquer sur l'icône puzzle 🧩 de Chrome et **épingler** Atelier MyUnisoft.
6. Cliquer sur l'icône Atelier, saisir la **clé de licence** reçue (`ATM-XXXX-XXXX-XXXX`) puis
   **Valider la clé**.

## 3. Vérifier

1. Cliquer sur l'icône Atelier : la liste des modules doit apparaître, sans pastille rouge.
2. Ouvrir (ou recharger) MyUnisoft.

| Pastille sur l'icône | Signification |
|---|---|
| *(aucune)* | Tout fonctionne. |
| **!** rouge | « Autoriser les scripts utilisateur » n'est pas activé (étape 2.4). |
| **LIC** rouge | Clé de licence absente, non reconnue ou suspendue. |
| **?** orange | Les modules n'ont pas pu être téléchargés (réseau / VPN) — réessayer « Vérifier les mises à jour ». |
| **EXT** orange | Une nouvelle version de l'extension elle-même est nécessaire — voir ci-dessous. |

## Mises à jour

- **Modules** : automatiques (au démarrage de Chrome, puis toutes les 30 min). Pour forcer :
  icône Atelier → **Vérifier les mises à jour** → **Recharger les onglets MyUnisoft**.
- **Extension** (rare, pastille **EXT**) : retélécharger le zip, l'extraire **par-dessus**
  `C:\AtelierMyUnisoft\extension`, puis dans `chrome://extensions` cliquer ↻ sur la carte.

## Activer / désactiver une fonctionnalité

Icône Atelier → interrupteur à côté de la fonctionnalité → recharger l'onglet.
« Avancé » → « Réglages par défaut » revient aux réglages recommandés.

## Après une mise à jour

Une fenêtre « Atelier MyUnisoft — mise à jour activée » s'ouvre une fois dans MyUnisoft
et résume les nouveautés.

## Remarque

Au démarrage, Chrome peut afficher « Désactiver les extensions en mode développeur ».
Cliquer sur la croix (ne pas désactiver).
