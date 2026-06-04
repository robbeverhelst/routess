import type { Page } from "./types";

export const fr: Page[] = [
	{
		path: "index.mdx",
		content: `---
title: Bienvenue sur routess
description: Un aperçu rapide de ce que fait routess et de l'organisation du guide utilisateur.
translationStatus: machine-draft
---

routess est une application de planification d'itinéraires qui vous permet de tracer un itinéraire sur une carte, point de passage par point de passage, et de l'enregistrer pour plus tard. Ce guide s'adresse aux **personnes qui utilisent l'application routess** : aucune connaissance en programmation n'est requise.

> _Emplacement de capture d'écran : vue d'accueil avec un itinéraire enregistré._

## Ce que vous pouvez faire

- Vous connecter avec Google ou par e-mail et commencer à planifier des itinéraires en quelques secondes
- Cliquer sur la carte pour déposer des points de passage, les faire glisser pour les réorganiser, annuler si vous changez d'avis
- Voir la distance totale et la durée estimée se mettre à jour en direct pendant que vous modifiez
- Enregistrer vos itinéraires sur votre compte pour qu'ils survivent aux rechargements de page et changent d'appareil
- Basculer l'application en anglais, néerlandais, français ou allemand

## Comment ce guide est organisé

- **[Premiers pas](/fr/guide/getting-started/sign-in)** : connectez-vous et planifiez votre premier itinéraire en 3 minutes
- **[Itinéraires](/fr/guide/routes/creating-routes)** : créez, modifiez, enregistrez et partagez des itinéraires
- **[Carte](/fr/guide/map/navigation)** : déplacez-vous, zoomez, changez de style, suivez votre position
- **[Compte](/fr/guide/account/profile)** : profil, langue et suppression de compte
- **[Dépannage](/fr/guide/troubleshooting)** : solutions aux problèmes courants
- **[FAQ](/fr/guide/faq)** : réponses rapides

Vous cherchez plutôt la documentation technique ? Rendez-vous sur la [documentation développeur](/docs).
`,
	},
	{
		path: "getting-started/sign-in.mdx",
		content: `---
title: Se connecter
description: Connectez-vous à routess avec Google ou avec une adresse e-mail et un mot de passe.
translationStatus: machine-draft
---

Vous pouvez vous connecter à routess avec votre compte Google ou avec une adresse e-mail et un mot de passe.

## Se connecter avec Google

1. Ouvrez routess et cliquez sur **Se connecter avec Google** en haut à droite.
2. Une fenêtre pop-up Google apparaît. Choisissez le compte que vous souhaitez utiliser.
3. Acceptez les autorisations demandées.
4. Vous revenez sur routess, connecté.

> _Emplacement de capture d'écran : fenêtre pop-up de connexion._

### Ce que routess peut voir

- Votre nom et votre photo de profil
- Votre adresse e-mail (pour identifier votre compte)

C'est tout. routess ne lit jamais votre Gmail, votre Drive ni votre agenda.

## Se connecter par e-mail

1. Cliquez sur **Se connecter par e-mail** sur l'écran de connexion.
2. Pour créer un compte, choisissez **Créer un compte**, saisissez votre adresse e-mail et un mot de passe, puis confirmez le lien de vérification que routess vous envoie par e-mail.
3. Pour vous reconnecter plus tard, saisissez la même adresse e-mail et le même mot de passe.

Mot de passe oublié ? Utilisez **Envoyer un lien de réinitialisation** sur l'écran de connexion et suivez l'e-mail.

Si vous vous êtes inscrit avec Google, vous pouvez ajouter un mot de passe plus tard dans les paramètres de votre profil, afin que les deux méthodes fonctionnent pour le même compte.

## Se déconnecter

Ouvrez le menu en haut à droite et cliquez sur **Se déconnecter**. Vos itinéraires restent enregistrés sur le serveur et réapparaissent à votre prochaine connexion.

## Problème de connexion ?

Consultez [Dépannage → Problèmes de connexion](/fr/guide/troubleshooting).
`,
	},
	{
		path: "getting-started/your-first-route.mdx",
		content: `---
title: Votre premier itinéraire
description: Planifiez votre premier itinéraire en moins de 3 minutes.
translationStatus: machine-draft
---

Planifions ensemble un itinéraire rapide à partir de zéro.

> _Emplacement de capture d'écran : carte vide après connexion._

## 1. Cliquez sur votre point de départ

Cliquez n'importe où sur la carte. Un point de passage apparaît : c'est votre point de départ. Le premier point de passage est affiché en vert.

## 2. Ajoutez des points de passage

Cliquez à nouveau pour ajouter le point de passage suivant. routess relie vos points de passage par une ligne et affiche la distance et la durée totales dans le panneau latéral.

> _Emplacement de capture d'écran : 3 points de passage reliés par une ligne d'itinéraire._

## 3. Réorganisez par glisser-déposer

Faites glisser n'importe quel point de passage pour le réorganiser. L'itinéraire se met à jour instantanément.

## 4. Annulez une erreur

Un clic au mauvais endroit ? Appuyez sur **Annuler** (ou \`Ctrl/Cmd + Z\`). Vous pouvez revenir en arrière sur chacune de vos modifications.

## 5. Enregistrez votre itinéraire

Les itinéraires sont enregistrés automatiquement une fois que vous êtes connecté. Rechargez la page et votre itinéraire est toujours là.

## Étapes suivantes

- Découvrez les outils d'édition dans **[Itinéraires → Modifier des itinéraires](/fr/guide/routes/editing-routes)**
- Personnalisez l'apparence dans **[Carte → Styles](/fr/guide/map/styles)**
`,
	},
	{
		path: "getting-started/interface-tour.mdx",
		content: `---
title: Tour de l'interface
description: Un tour rapide de l'interface de routess.
translationStatus: machine-draft
---

> _Emplacement de capture d'écran : capture de l'application complète avec des repères numérotés._

## La carte

Elle occupe la majeure partie de l'écran. Déplacez-vous en faisant glisser, zoomez avec la molette ou les boutons \`+\` / \`-\` en bas à droite.

## Le panneau latéral d'itinéraire

Il affiche votre itinéraire actuel : chaque point de passage, la distance entre les points de passage et les statistiques totales de l'itinéraire. Cliquez sur un point de passage pour centrer la carte dessus.

## La barre supérieure

- **Logo routess** : retour à la vue d'accueil
- **Recherche** : trouvez un lieu et déplacez la carte vers lui
- **Sélecteur de langue** : basculez en en/nl/fr/de
- **Menu du profil** : votre compte, se déconnecter

## Les contrôles

- **Annuler / Rétablir** : parcourez vos modifications
- **Réinitialiser** : effacez l'itinéraire actuel
- **Ma position** : centrez la carte sur vous (demande l'autorisation la première fois)

Poursuivez avec [créer des itinéraires](/fr/guide/routes/creating-routes).
`,
	},
	{
		path: "getting-started/keyboard-shortcuts.mdx",
		content: `---
title: Raccourcis clavier
description: Tous les raccourcis clavier de routess.
translationStatus: machine-draft
---

Tous les raccourcis utilisent \`Ctrl\` sur Windows et Linux, \`Cmd\` sur macOS.

| Raccourci | Action |
| --- | --- |
| \`Ctrl/Cmd + Z\` | Annuler la dernière modification d'itinéraire |
| \`Ctrl/Cmd + Shift + Z\` | Rétablir |
| \`Ctrl/Cmd + K\` | Ouvrir la palette de commandes |
| \`Ctrl/Cmd + D\` | Basculer le mode sombre |
| \`Esc\` | Fermer la fenêtre modale ouverte |

La palette de commandes est le moyen le plus rapide d'accéder aux actions sans toucher la souris : ouvrez-la et commencez à taper.
`,
	},
	{
		path: "routes/creating-routes.mdx",
		content: `---
title: Créer des itinéraires
description: Comment ajouter des points de passage et construire un itinéraire sur la carte.
translationStatus: machine-draft
---

> _Emplacement de capture d'écran : clic sur la carte pour déposer un point de passage._

Un itinéraire n'est qu'une liste de points de passage. Pour en créer un, cliquez n'importe où sur la carte.

- Le premier clic définit votre **point de départ** (marqueur vert).
- Chaque clic ajoute un point de passage (marqueur numéroté).
- routess trace une ligne de liaison entre eux au fur et à mesure.

## Astuces

- **Maintenez et faites glisser** lors du placement d'un marqueur pour des ajustements fins.
- **Clic droit** (ou appui long sur écran tactile) pour supprimer un point de passage.
- **Cliquez dans une zone vide entre deux points de passage** pour insérer un point de passage au milieu.

Continuez avec [Modifier des itinéraires](/fr/guide/routes/editing-routes).
`,
	},
	{
		path: "routes/editing-routes.mdx",
		content: `---
title: Modifier des itinéraires
description: Faites glisser, réorganisez, supprimez, annulez, rétablissez et modifiez les métadonnées des itinéraires enregistrés.
translationStatus: machine-draft
---

> _Emplacement de capture d'écran : réorganisation par glisser-déposer en action avec l'indicateur de modifications non enregistrées._

## Réorganiser

Faites glisser un marqueur de point de passage sur la carte. L'itinéraire se met à jour lorsque vous le déposez.

## Supprimer

Clic droit (ou appui long) sur un point de passage pour le retirer. L'itinéraire est recalculé autour de l'espace vide.

## Synchronisation au survol entre le panneau latéral et la carte

Survolez un point de passage dans le panneau latéral pour le mettre en évidence sur la carte, et survolez un marqueur sur la carte pour mettre en évidence sa ligne dans le panneau latéral. Cela fonctionne dans les deux sens, ce qui est pratique lorsqu'un long itinéraire comporte de nombreux points de passage.

## Annuler / Rétablir

- **Annuler :** cliquez sur le bouton annuler ou appuyez sur \`Ctrl/Cmd + Z\`
- **Rétablir :** bouton rétablir ou \`Ctrl/Cmd + Shift + Z\`

routess conserve l'historique complet de vos modifications pour la session en cours.

## Modifier un itinéraire enregistré directement

Ouvrez un itinéraire depuis votre bibliothèque et modifiez son nom, sa description, sa visibilité ou ses points de passage directement. Un indicateur « Modifications non enregistrées » apparaît à côté du titre tant que vous avez des modifications en attente. Cliquez sur **Enregistrer** pour valider, ou **Abandonner** pour revenir à la dernière version enregistrée. Si vous quittez la page avec des modifications non enregistrées, routess vous le demande d'abord.

## Réinitialiser

Cliquez sur **Réinitialiser** pour effacer entièrement l'itinéraire actuel. Cette action est annulable immédiatement, ce qui est utile si vous avez effacé par accident.
`,
	},
	{
		path: "routes/saving-routes.mdx",
		content: `---
title: Enregistrer des itinéraires
description: Comment routess conserve vos itinéraires entre les sessions.
translationStatus: machine-draft
---

Une fois que vous êtes connecté, votre itinéraire actuel est enregistré automatiquement et survit à :

- Aux rechargements de page
- À la fermeture puis à la réouverture du navigateur
- À une connexion sur un autre appareil

Il n'y a pas de bouton **Enregistrer** ; routess écrit les changements au fur et à mesure que vous les faites.

> _Emplacement de capture d'écran : itinéraire présent après un rechargement de page._

## Et si je ne suis pas connecté ?

Les itinéraires anonymes vivent uniquement dans votre navigateur. Connectez-vous (avec Google) pour les conserver.

## Supprimer un itinéraire enregistré

Cliquez sur **Réinitialiser** pour effacer l'itinéraire de la carte. Le prochain enregistrement remplace le précédent.
`,
	},
	{
		path: "routes/route-info.mdx",
		content: `---
title: Informations d'itinéraire
description: Distance, durée, dénivelé et revêtement.
translationStatus: machine-draft
---

Le panneau latéral affiche des statistiques en direct pour votre itinéraire au fur et à mesure que vous le construisez.

> _Emplacement de capture d'écran : panneau latéral avec distance, durée, dénivelé et graphique de revêtement._

## Statistiques totales

- **Distance** : somme de toutes les sections, en km ou mi (défini dans votre compte)
- **Durée** : temps de trajet estimé pour le sport que vous avez sélectionné
- **Dénivelé positif** : total des montées sur l'ensemble de l'itinéraire

## Statistiques par section

Cliquez sur un point de passage dans le panneau latéral pour le développer. Vous verrez la distance et la durée de la section menant à ce point de passage.

## Graphique de dénivelé et de revêtement

Sous les statistiques, un graphique unique montre le profil altimétrique de votre itinéraire avec le type de revêtement superposé sous forme de bandes colorées. Survolez le graphique pour voir le dénivelé, la distance et le revêtement à ce point de l'itinéraire. Le point correspondant sur la carte est mis en évidence au fur et à mesure que vous vous déplacez.

La ligne d'itinéraire sur la carte utilise aussi des motifs de tirets pour suggérer le revêtement : continu pour goudronné, tirets pour non goudronné, pointillés pour les sentiers. Le graphique et la carte partagent la même échelle de couleurs, ce qui vous permet de faire correspondre l'un à l'autre d'un coup d'œil.

## Comment les estimations sont calculées

La durée utilise votre allure par sport définie dans **Paramètres → Sports**. Chaque sport (marche, course, vélo, voiture) a sa propre allure par défaut ; remplacez la valeur par défaut si elle ne correspond pas à votre vitesse réelle. Le dénivelé positif provient de Mapbox Terrain-RGB ; le revêtement provient du moteur de routage.
`,
	},
	{
		path: "routes/sharing-routes.mdx",
		content: `---
title: Partager des itinéraires
description: Partagez un itinéraire avec un lien ou via les cibles de partage natives.
translationStatus: machine-draft
---

Cliquez sur **Partager** dans le panneau latéral de l'itinéraire, ou ouvrez un itinéraire enregistré et cliquez sur son bouton de partage, pour afficher la fenêtre de partage.

> _Emplacement de capture d'écran : fenêtre de partage avec lien, copie et options de partage natives._

## Ce que contient la fenêtre

- **Copier le lien** : copie un lien dans votre presse-papiers. L'itinéraire lui-même est encodé dans le lien, il reflète donc toujours l'itinéraire tel qu'il était au moment où vous l'avez copié.
- **Partage natif** : sur mobile, cela ouvre la feuille de partage de votre téléphone (WhatsApp, Messages, Mail, etc.).
- **Cibles de partage** : envoyez l'itinéraire directement par e-mail, WhatsApp, Facebook ou X.
- **Exporter en GPX** : téléchargez l'itinéraire sous forme de fichier GPX au lieu de partager un lien.
- **Aperçu** : une vignette de carte et les statistiques de l'itinéraire, pour que la personne à qui vous l'envoyez sache ce qu'elle reçoit.

## Ce que voit le destinataire

Toute personne qui ouvre le lien voit l'itinéraire chargé dans le planificateur : le tracé sur la carte, les statistiques et le graphique de dénivelé et de revêtement. Elle n'a pas besoin de compte pour le consulter, et elle peut l'exporter en GPX. Pour enregistrer une copie dans sa propre bibliothèque, elle devra se connecter.

## Visibilité : privé, non répertorié, public

Les itinéraires enregistrés ont un réglage de visibilité, choisi au moment de l'enregistrement et modifiable ensuite :

- **Privé** : vous seul pouvez le voir dans votre bibliothèque.
- **Non répertorié** : toute personne disposant du lien peut le consulter.
- **Public** : visible par tout le monde.

Vous pouvez définir une valeur par défaut pour les nouveaux itinéraires dans **Paramètres → Valeurs par défaut de routage → Visibilité par défaut**. Partager un lien depuis la fenêtre de partage ne change pas la visibilité d'un itinéraire, car le lien transporte les données de l'itinéraire lui-même.
`,
	},
	{
		path: "map/navigation.mdx",
		content: `---
title: Navigation sur la carte
description: Déplacez, zoomez et faites pivoter la carte.
translationStatus: machine-draft
---

> _Emplacement de capture d'écran : contrôles de carte en bas à droite._

## Déplacer

Cliquez et faites glisser pour vous déplacer. Sur les appareils tactiles, faites glisser avec un doigt.

## Zoomer

- Faites défiler vers le haut pour zoomer, vers le bas pour dézoomer
- Double-cliquez pour zoomer
- Pincez avec deux doigts sur les appareils tactiles
- Utilisez les boutons \`+\` / \`-\` en bas à droite

## Pivoter et incliner

Maintenez \`Ctrl\` (ou clic droit) et faites glisser pour pivoter. Maintenez \`Ctrl + Shift\` pour incliner la carte vers une perspective 3D.

## Recentrer

Cliquez sur le bouton **Ma position** pour recentrer sur votre position actuelle (le navigateur demandera l'autorisation la première fois).
`,
	},
	{
		path: "map/styles.mdx",
		content: `---
title: Styles de carte
description: Basculez entre les apparences de carte.
translationStatus: machine-draft
---

routess propose quelques styles de carte intégrés entre lesquels vous pouvez basculer.

> _Emplacement de capture d'écran : menu du sélecteur de style._

## Styles disponibles

- **Rues** : vue de rue détaillée par défaut
- **Plein air** : courbes de niveau et détail des sentiers, utile pour la randonnée
- **Satellite** : imagerie aérienne
- **Sombre** : adapté à une faible luminosité

Le style sélectionné est mémorisé d'une session à l'autre.
`,
	},
	{
		path: "map/your-location.mdx",
		content: `---
title: Votre position
description: Affichez votre position en direct sur la carte.
translationStatus: machine-draft
---

routess peut afficher votre position sur la carte et vous suivre au fur et à mesure de vos déplacements.

> _Emplacement de capture d'écran : point de localisation sur la carte._

## Activer la localisation

Cliquez sur le bouton **Ma position** dans les contrôles. Votre navigateur demandera l'autorisation la première fois ; choisissez **Autoriser**.

Un point bleu apparaît sur la carte à votre position actuelle.

## Confidentialité

Votre position reste dans votre navigateur. routess n'envoie pas votre position en direct à ses serveurs.

## Un problème ?

- Assurez-vous que votre navigateur est autorisé à utiliser la localisation pour ce site
- Le HTTPS est requis ; la localisation ne fonctionne pas en HTTP simple
- Certains VPN et réseaux d'entreprise bloquent la géolocalisation
`,
	},
	{
		path: "account/profile.mdx",
		content: `---
title: Votre profil
description: Consultez et mettez à jour votre profil et vos réglages par sport.
translationStatus: machine-draft
---

Ouvrez le menu en haut à droite et cliquez sur votre avatar pour voir votre profil.

> _Emplacement de capture d'écran : écran de profil avec les réglages par sport._

## Ce que vous pouvez modifier

- Nom affiché
- Unité de distance (kilomètres ou miles)
- Style de carte par défaut
- **Sports** : les sports pour lesquels vous planifiez (marche, course, vélo, voiture) et une allure par défaut pour chacun

L'adresse e-mail est lue depuis votre compte Google et ne peut pas être modifiée dans routess.

## Sports et allure

Choisissez un ou plusieurs sports lors de l'intégration, ou modifiez-les ensuite dans **Paramètres → Sports**. Le sport actuellement sélectionné pilote les estimations de durée de vos itinéraires. Chaque sport a sa propre allure par défaut ; remplacez-la si elle ne correspond pas à votre vitesse réelle. Le changement s'applique au prochain recalcul de l'itinéraire.
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
- Français
- Deutsch

> _Emplacement de capture d'écran : sélecteur de langue dans la barre supérieure._

Cliquez sur le sélecteur de langue dans la barre supérieure pour changer. Le choix est mémorisé lors de votre prochaine visite.

## Vous voulez une langue que nous n'avons pas ?

routess est open source et les contributions sont les bienvenues. Consultez [Documentation développeur → Packages → i18n](/docs/packages/i18n) pour savoir comment ajouter une langue.
`,
	},
	{
		path: "account/deleting-account.mdx",
		content: `---
title: Supprimer votre compte
description: Supprimez définitivement votre compte routess et tous vos itinéraires.
translationStatus: machine-draft
---

Vous pouvez supprimer votre compte routess à tout moment. Cette action est **permanente et irréversible**.

## Ce qui est supprimé

- Votre profil
- Tous vos itinéraires enregistrés
- L'association de votre connexion avec Google

## Comment supprimer

1. Ouvrez le menu → **Profil**
2. Faites défiler jusqu'à **Zone de danger**
3. Cliquez sur **Supprimer le compte** et confirmez

> _Emplacement de capture d'écran : boîte de dialogue de confirmation de suppression de compte._

Après la suppression, vous reconnecter avec Google crée un nouveau compte sans historique.
`,
	},
	{
		path: "troubleshooting.mdx",
		content: `---
title: Dépannage
description: Solutions aux problèmes courants.
translationStatus: machine-draft
---

## Problèmes de connexion

- **La fenêtre pop-up Google est bloquée.** Autorisez les pop-ups pour le domaine routess et réessayez.
- **« Ce compte n'est pas autorisé. »** routess utilise votre identité Google principale ; essayez de vous connecter d'abord depuis \`accounts.google.com\`.
- **Bloqué sur un indicateur de chargement après la connexion.** Rechargez la page. Si cela persiste, effacez les cookies pour le domaine routess.

## La carte ne se charge pas

- Vérifiez votre connexion Internet
- Désactivez les bloqueurs de publicité et les extensions de confidentialité pour le domaine routess ; les tuiles Mapbox sont parfois bloquées
- Essayez un autre navigateur pour écarter un problème d'extension

## Mon itinéraire a disparu

Si vous n'étiez pas connecté, les itinéraires vivent uniquement dans votre navigateur et ont pu être effacés. Connectez-vous la prochaine fois pour les conserver.

## La localisation ne fonctionne pas

Consultez [Carte → Votre position](/fr/guide/map/your-location).

Toujours bloqué ? [Ouvrez un ticket sur GitHub](https://github.com/robbeverhelst/routess/issues).
`,
	},
	{
		path: "faq.mdx",
		content: `---
title: FAQ
description: Réponses rapides aux questions courantes.
translationStatus: machine-draft
---

## routess est-il gratuit ?

Oui. routess est open source et auto-hébergé. La version hébergée sur routess.com est également gratuite.

## Ai-je besoin d'un compte ?

Vous pouvez planifier un itinéraire sans vous connecter, mais les itinéraires enregistrés alors que vous êtes déconnecté vivent uniquement dans votre navigateur. Connectez-vous pour les conserver d'une session et d'un appareil à l'autre.

## Quelles données routess stocke-t-il ?

- Votre nom et votre adresse e-mail (depuis la connexion Google ou l'inscription par e-mail)
- Vos itinéraires enregistrés (points de passage + métadonnées)

routess collecte des événements d'usage anonymes sur une instance d'analyse auto-hébergée afin de comprendre quelles fonctionnalités sont utilisées. Ces événements n'incluent jamais votre adresse e-mail, les noms de vos itinéraires ni votre identifiant de compte brut. Il n'y a aucun traceur tiers.

## Puis-je exporter mes itinéraires ?

Oui. Ouvrez un itinéraire et utilisez **Enregistrer en GPX** dans le panneau latéral pour le télécharger. Vous pouvez aussi importer des fichiers GPX dans le planificateur. Les imports TCX, FIT et KML sont prévus.

## Puis-je faire tourner ma propre copie ?

Oui, routess est open source. Consultez **[Documentation développeur → Opérations](/docs/operations/self-host)**.

## Où signaler un bug ?

[GitHub Issues](https://github.com/robbeverhelst/routess/issues).
`,
	},
	{
		path: "support.mdx",
		content: `---
title: Assistance
description: Où obtenir de l'aide, signaler des bugs et demander des fonctionnalités.
translationStatus: machine-draft
---

## Vous avez trouvé un bug ?

Ouvrez un ticket sur [GitHub Issues](https://github.com/robbeverhelst/routess/issues). Indiquez :

- Ce que vous avez fait, ce que vous attendiez et ce qui s'est passé à la place
- Votre navigateur et votre système d'exploitation
- Une capture d'écran si le problème est visuel

## Vous voulez une fonctionnalité ?

Les demandes de fonctionnalités passent aussi par [GitHub Issues](https://github.com/robbeverhelst/routess/issues). Décrivez le problème que vous essayez de résoudre, pas seulement la solution que vous avez en tête.

## Questions sur vos données

- **Tout exporter** : les paramètres de votre profil incluent un export complet du compte (un ZIP avec vos données et un fichier GPX par itinéraire).
- **Supprimer votre compte** : consultez [Supprimer votre compte](/fr/guide/account/deleting-account). La suppression dispose d'un délai de grâce de 30 jours pendant lequel vous pouvez changer d'avis en vous reconnectant.
- **Confidentialité** : consultez [Confidentialité](/fr/guide/privacy).

## Problèmes courants

Consultez d'abord le [Dépannage](/fr/guide/troubleshooting) ; les problèmes de connexion et de carte les plus fréquents y sont traités.
`,
	},
	{
		path: "privacy.mdx",
		content: `---
title: Confidentialité
description: Quelles données routess stocke et comment les contrôler.
translationStatus: machine-draft
---

routess est open source et conçu pour que vos données restent les vôtres. La politique de confidentialité complète se trouve sur [routess.com/privacy](https://routess.com/privacy) ; cette page en est la version courte pour les utilisateurs de l'application.

## Ce que routess stocke

- Votre nom et votre adresse e-mail (depuis la connexion Google ou l'inscription par e-mail)
- Vos itinéraires enregistrés (points de passage et métadonnées telles que le nom, l'activité et la visibilité)

## Analyse d'usage

routess utilise Umami, un outil d'analyse respectueux de la vie privée et sans cookies, auto-hébergé sur l'infrastructure de routess. Les événements d'usage sont anonymes : ils n'incluent jamais votre adresse e-mail, les noms de vos itinéraires ni votre identifiant de compte brut. Il n'y a aucun traceur tiers ni profil publicitaire.

## Vos contrôles

- **Export** : téléchargez une copie complète de votre compte (JSON + GPX par itinéraire) depuis les paramètres de votre profil.
- **Visibilité** : chaque itinéraire est privé par défaut. Vous décidez, itinéraire par itinéraire, s'il est privé, non répertorié ou public.
- **Suppression** : supprimer votre compte retire vos itinéraires et votre profil après un délai de grâce de 30 jours. Consultez [Supprimer votre compte](/fr/guide/account/deleting-account).

## Auto-hébergement

Si vous faites tourner votre propre instance routess, vos données restent sur votre infrastructure. Aucun renvoi d'informations n'est intégré.
`,
	},
	{
		path: "whats-new.mdx",
		content: `---
title: Nouveautés
description: Où suivre les versions et les changements de routess.
translationStatus: machine-draft
---

routess est livré en continu : chaque amélioration fusionnée est publiée automatiquement avec un numéro de version et des notes de version.

- **Notes de version** : la [page des versions GitHub](https://github.com/robbeverhelst/routess/releases) liste chaque version avec ses changements.
- **Suivez le projet** : surveillez le [dépôt GitHub](https://github.com/robbeverhelst/routess) pour être notifié des nouvelles versions.

Vous auto-hébergez ? Épinglez une version précise avec la variable \`ROUTESS_TAG\` ; consultez [Documentation développeur → Auto-hébergement](/docs/operations/self-host).
`,
	},
];
