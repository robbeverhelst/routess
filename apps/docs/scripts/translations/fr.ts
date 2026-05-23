import type { Page } from "./types";

export const fr: Page[] = [
	{
		path: "index.mdx",
		content: `---
title: Bienvenue sur routess
description: Un apercu rapide de routess et du guide utilisateur.
translationStatus: machine-draft
---

routess est une application de planification d'itineraires. Elle permet de placer plusieurs arrets sur une carte, d'ajuster le trajet et de le conserver pour plus tard.

> Emplacement de capture d'ecran : vue d'accueil avec un itineraire enregistre.

## Ce que vous pouvez faire

- Vous connecter avec Google
- Ajouter, deplacer, supprimer et reorganiser des points de passage
- Consulter la distance, la duree et les details de l'itineraire
- Enregistrer vos itineraires sur votre compte
- Changer la langue et le style de carte

Commencez par [vous connecter](/fr/guide/getting-started/sign-in) ou creez [votre premier itineraire](/fr/guide/getting-started/your-first-route).
`,
	},
	{
		path: "getting-started/sign-in.mdx",
		content: `---
title: Se connecter avec Google
description: Utilisez votre compte Google pour acceder a routess.
translationStatus: machine-draft
---

routess utilise Google pour l'authentification. Vous n'avez pas de mot de passe routess distinct a gerer.

## Etapes

1. Ouvrez routess et cliquez sur **Se connecter avec Google**.
2. Choisissez le compte Google a utiliser.
3. Acceptez les autorisations demandees.
4. Vous revenez sur la carte avec votre profil actif.

> Emplacement de capture d'ecran : bouton de connexion Google.

## En cas de probleme

Autorisez les pop-ups pour le domaine routess et verifiez que vous etes connecte a accounts.google.com.
`,
	},
	{
		path: "getting-started/your-first-route.mdx",
		content: `---
title: Votre premier itineraire
description: Planifiez un itineraire en moins de trois minutes.
translationStatus: machine-draft
---

Suivez ce parcours rapide pour apprendre les bases.

> Emplacement de capture d'ecran : carte vide apres connexion.

## 1. Choisir le depart

Cliquez sur la carte. Un premier point de passage apparait.

## 2. Ajouter des arrets

Cliquez ailleurs sur la carte pour ajouter des arrets. routess trace le trajet au fur et a mesure.

## 3. Ajuster

Faites glisser un point pour le deplacer. Utilisez le panneau lateral pour verifier l'ordre.

## 4. Enregistrer

Une fois connecte, routess enregistre automatiquement vos modifications.
`,
	},
	{
		path: "getting-started/interface-tour.mdx",
		content: `---
title: Tour de l'interface
description: Decouvrez les zones principales de routess.
translationStatus: machine-draft
---

> Emplacement de capture d'ecran : interface complete avec reperes.

## La carte

La carte occupe la majeure partie de l'ecran. Deplacez-la par glisser-deposer et zoomez avec la molette, le geste de pincement ou les boutons.

## Le panneau d'itineraire

Il affiche les points de passage, l'ordre, la distance et la duree.

## Le menu du compte

Le menu en haut a droite donne acces au profil, a la langue et aux actions de compte.

## Les controles de carte

Ils servent a zoomer, afficher votre position et changer le style de carte.
`,
	},
	{
		path: "routes/creating-routes.mdx",
		content: `---
title: Creer des itineraires
description: Ajoutez des points de passage et construisez un trajet sur la carte.
translationStatus: machine-draft
---

Un itineraire est une liste de points de passage. Cliquez sur la carte pour en ajouter un.

> Emplacement de capture d'ecran : ajout d'un point sur la carte.

- Le premier clic definit le depart.
- Les clics suivants ajoutent des arrets.
- routess trace la liaison entre les points.
- Le panneau lateral se met a jour immediatement.

## Conseil

Zoomez d'abord sur la zone a planifier, posez les grands points, puis affinez en les deplacant.
`,
	},
	{
		path: "routes/editing-routes.mdx",
		content: `---
title: Modifier des itineraires
description: Deplacez, reorganisez, supprimez, annulez et modifiez les itineraires enregistres.
translationStatus: machine-draft
---

> Emplacement de capture d'ecran : deplacement d'un point avec l'indicateur de modifications non enregistrees.

## Deplacer

Faites glisser un point sur la carte. Le trajet est recalcule lorsque vous le deposez.

## Supprimer

Clic droit (ou appui long) sur un point pour le retirer. Le trajet est recalcule autour de la lacune.

## Synchronisation au survol entre le panneau et la carte

Survolez un point dans le panneau lateral pour le mettre en evidence sur la carte, et inversement. Utile sur des itineraires longs avec beaucoup d'arrets.

## Annuler et retablir

- **Annuler :** bouton annuler ou \`Ctrl/Cmd + Z\`
- **Retablir :** bouton retablir ou \`Ctrl/Cmd + Shift + Z\`

routess conserve l'historique complet des modifications pour la session en cours.

## Modifier un itineraire enregistre directement

Ouvrez un itineraire depuis votre bibliotheque et modifiez son nom, sa description, sa visibilite ou ses points directement. Un indicateur "Modifications non enregistrees" apparait a cote du titre tant qu'il reste des changements en attente. Cliquez sur **Enregistrer** pour valider, ou **Annuler** pour revenir a la derniere version enregistree. Si vous quittez avec des modifications non enregistrees, routess vous le demande d'abord.

## Reinitialiser

Cliquez sur **Reinitialiser** pour effacer entierement l'itineraire en cours. L'operation est annulable immediatement.
`,
	},
	{
		path: "routes/saving-routes.mdx",
		content: `---
title: Enregistrer des itineraires
description: Comment routess conserve vos itineraires.
translationStatus: machine-draft
---

Lorsque vous etes connecte, routess enregistre automatiquement votre itineraire.

Votre itineraire reste disponible apres :

- Le rechargement de la page
- La fermeture puis reouverture du navigateur
- Une connexion sur un autre appareil

Il n'y a pas de bouton d'enregistrement distinct. Les changements sont sauvegardes pendant que vous travaillez.

## Sans compte

Sans connexion, vous pouvez planifier, mais l'itineraire reste uniquement dans votre navigateur.
`,
	},
	{
		path: "routes/route-info.mdx",
		content: `---
title: Informations d'itineraire
description: Distance, duree, denivele et revetement.
translationStatus: machine-draft
---

Le panneau lateral affiche les informations en direct pendant la creation.

> Emplacement de capture d'ecran : panneau avec distance, duree, denivele et graphique de revetement.

## Totaux

- **Distance** — somme de toutes les sections, en km ou mi (defini dans votre compte)
- **Duree** — temps de trajet estime pour le sport selectionne
- **Denivele positif** — total des montees sur l'itineraire complet

## Statistiques par section

Cliquez sur un point dans le panneau lateral pour le developper. Vous voyez la distance et la duree de la section menant a ce point.

## Graphique denivele et revetement

Sous les totaux, un graphique unique montre le profil altimetrique avec le revetement superpose sous forme de bandes colorees. Survolez le graphique pour voir le denivele, la distance et le revetement a ce point. Le point correspondant sur la carte est mis en evidence.

La ligne d'itineraire sur la carte utilise aussi des motifs de tirets pour indiquer le revetement : continu pour goudronne, tirets pour non goudronne, points pour les sentiers. Le graphique et la carte partagent la meme echelle de couleurs.

## Calcul des estimations

La duree utilise votre allure par sport definie dans **Parametres → Sports**. Chaque sport (marche, course, velo, voiture) a son allure par defaut ; ajustez-la si elle ne correspond pas a votre rythme reel. Le denivele provient de Mapbox Terrain-RGB ; le revetement vient du moteur de routage.
`,
	},
	{
		path: "routes/sharing-routes.mdx",
		content: `---
title: Partager des itineraires
description: Partagez un itineraire avec un lien ou via les cibles de partage du systeme.
translationStatus: machine-draft
---

Ouvrez un itineraire enregistre et cliquez sur **Partager** pour ouvrir la boite de dialogue.

> Emplacement de capture d'ecran : boite de dialogue avec lien, copie et partage natif.

## Contenu de la boite

- **Copier le lien** — copie l'URL publique de l'itineraire dans le presse-papiers.
- **Partage natif** — sur mobile, ouvre la feuille de partage du systeme (WhatsApp, Messages, Mail, ...).
- **Apercu** — une vignette et les statistiques, pour que le destinataire sache ce qu'il recoit.

## Public ou prive

Partager un itineraire necessite qu'il soit **public**. S'il est prive, la boite demande d'abord de basculer la visibilite et previent que le lien devient consultable par tous. Vous pouvez repasser en prive depuis **Modifier → Visibilite**.

## Ce que voit le destinataire

Toute personne avec le lien voit l'itineraire sur la carte, les statistiques, le graphique denivele et revetement, et un bouton pour telecharger en GPX. Aucun compte n'est requis pour consulter. Une connexion est necessaire pour enregistrer une copie dans sa propre bibliotheque.
`,
	},
	{
		path: "map/navigation.mdx",
		content: `---
title: Navigation sur la carte
description: Deplacez, zoomez et orientez la carte.
translationStatus: machine-draft
---

> Emplacement de capture d'ecran : controles de carte.

## Deplacer

Cliquez et faites glisser pour vous deplacer. Sur mobile, glissez avec un doigt.

## Zoomer

Utilisez la molette, le pincement tactile ou les boutons de zoom.

## Orienter

Si la rotation est activee, utilisez les gestes de votre appareil. Revenez au nord pour retrouver une vue plus lisible.
`,
	},
	{
		path: "map/styles.mdx",
		content: `---
title: Styles de carte
description: Changez l'apparence de la carte.
translationStatus: machine-draft
---

routess propose plusieurs styles pour adapter la carte a votre usage.

> Emplacement de capture d'ecran : menu des styles.

## Styles disponibles

- **Rues** pour la planification courante
- **Satellite** pour reconnaitre le terrain
- **Sombre** pour une utilisation en faible luminosite

Le style choisi est conserve dans votre navigateur.
`,
	},
	{
		path: "map/your-location.mdx",
		content: `---
title: Votre position
description: Affichez votre position actuelle sur la carte.
translationStatus: machine-draft
---

routess peut afficher votre position si votre navigateur y est autorise.

> Emplacement de capture d'ecran : point de localisation sur la carte.

## Activer la position

Cliquez sur **Ma position** puis choisissez **Autoriser** lorsque le navigateur le demande.

## Confidentialite

L'autorisation est geree par votre navigateur. Vous pouvez la retirer dans les reglages du navigateur ou de l'appareil.
`,
	},
	{
		path: "account/profile.mdx",
		content: `---
title: Votre profil
description: Consultez et mettez a jour votre profil et vos reglages par sport.
translationStatus: machine-draft
---

Ouvrez le menu en haut a droite et cliquez sur votre avatar.

> Emplacement de capture d'ecran : ecran de profil avec les reglages par sport.

## Ce que vous pouvez modifier

- Nom affiche
- Unite de distance (kilometres ou miles)
- Style de carte par defaut
- **Sports** — les sports que vous pratiquez (marche, course, velo, voiture) et une allure par defaut pour chacun

Votre adresse e-mail vient de votre compte Google et ne peut pas etre modifiee dans routess.

## Sports et allure

Choisissez un ou plusieurs sports lors de l'onboarding, ou modifiez-les ensuite dans **Parametres → Sports**. Le sport selectionne pilote l'estimation de la duree de vos itineraires. Chaque sport a son allure par defaut ; ajustez-la si elle ne correspond pas a votre rythme reel. Le changement est applique au prochain recalcul de l'itineraire.
`,
	},
	{
		path: "account/language.mdx",
		content: `---
title: Langue
description: Changez la langue de l'application.
translationStatus: machine-draft
---

routess est disponible en :

- English
- Nederlands
- Francais
- Deutsch

## Changer de langue

Ouvrez le menu du compte et choisissez la langue souhaitee. L'interface se met a jour immediatement.

## Pour les developpeurs

Pour ajouter une langue ou ameliorer les traductions, consultez la documentation du paquet i18n.
`,
	},
	{
		path: "account/deleting-account.mdx",
		content: `---
title: Supprimer votre compte
description: Supprimez definitivement votre compte routess et vos itineraires.
translationStatus: machine-draft
---

Vous pouvez supprimer votre compte routess a tout moment. Cette action est definitive.

## Ce qui est supprime

- Votre profil
- Tous vos itineraires enregistres
- Le lien avec votre connexion Google

Avant de supprimer le compte, verifiez que vous n'avez plus besoin de vos itineraires.
`,
	},
	{
		path: "troubleshooting.mdx",
		content: `---
title: Depannage
description: Solutions aux problemes courants.
translationStatus: machine-draft
---

## Probleme de connexion

- **La pop-up Google est bloquee.** Autorisez les pop-ups pour le domaine routess.
- **Aucun compte ne s'affiche.** Connectez-vous d'abord sur accounts.google.com.
- **Chargement bloque.** Rechargez la page puis reessayez.

## La carte ne se charge pas

Verifiez votre connexion et assurez-vous que les scripts routess sont autorises.

## La position ne fonctionne pas

Verifiez l'autorisation de localisation dans le navigateur et sur l'appareil.
`,
	},
	{
		path: "faq.mdx",
		content: `---
title: FAQ
description: Reponses rapides aux questions frequentes.
translationStatus: machine-draft
---

## routess est-il gratuit ?

Oui. routess est open source. La version publique sur routess.com est prevue pour etre gratuite.

## Faut-il un compte ?

Vous pouvez planifier sans compte, mais la connexion est necessaire pour conserver vos itineraires entre appareils.

## Puis-je partager mes itineraires ?

Le partage fait partie du flux prevu. En attendant, les itineraires restent dans votre compte.

## Quelles langues sont prises en charge ?

English, Nederlands, Francais et Deutsch.
`,
	},
];
