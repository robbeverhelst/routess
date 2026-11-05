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

![Le planificateur routess avec un itinéraire à travers Gand](/guide/route-overview.jpg)

## Ce que vous pouvez faire

- Vous connecter avec Google ou par e-mail et commencer à planifier des itinéraires en quelques secondes
- Cliquer sur la carte pour déposer des points de passage, les faire glisser pour les réorganiser, annuler si vous changez d'avis
- Voir la distance totale et la durée estimée se mettre à jour en direct pendant que vous modifiez
- Enregistrer vos itinéraires dans votre bibliothèque, les organiser avec des tags et des collections
- Suivre des amis, voir ce qu'ils publient et vous envoyer des itinéraires les uns aux autres
- Importer et exporter du GPX, ou installer routess comme une application et l'utiliser hors ligne
- Basculer l'application en anglais, néerlandais, français ou allemand

## Comment ce guide est organisé

- **[Premiers pas](/fr/guide/getting-started/sign-in)** : connectez-vous et planifiez votre premier itinéraire en 3 minutes
- **[Itinéraires](/fr/guide/routes/creating-routes)** : créez, modifiez, enregistrez et partagez des itinéraires
- **[Bibliothèque](/fr/guide/library/your-library)** : vos itinéraires enregistrés, tags, favoris et collections
- **[Social](/fr/guide/social/profiles)** : profils, abonnements, le fil et votre boîte de réception
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

![L'écran de connexion de routess avec les options Google, e-mail et anonyme](/guide/welcome.jpg)

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

![Le planificateur vide, prêt pour un premier point de passage](/guide/planner-empty.jpg)

## 1. Cliquez sur votre point de départ

Cliquez n'importe où sur la carte. Un point de passage apparaît : c'est votre point de départ. Le premier point de passage est affiché en vert.

## 2. Ajoutez des points de passage

Cliquez à nouveau pour ajouter le point de passage suivant. routess relie vos points de passage par une ligne et affiche la distance et la durée totales dans le panneau latéral.

![Trois points de passage reliés par une ligne d'itinéraire à travers Gand](/guide/route-overview.jpg)

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

![Le planificateur routess avec un itinéraire actif](/guide/route-overview.jpg)

## La carte

Elle occupe la majeure partie de l'écran. Déplacez-vous en faisant glisser, zoomez avec la molette ou les boutons \`+\` / \`-\` de la barre d'outils de la carte.

## La barre latérale de gauche

La colonne d'icônes tout à gauche permet de basculer entre les panneaux :

- **Planifier** : l'itinéraire que vous construisez
- **Bibliothèque** : vos [itinéraires enregistrés et collections](/fr/guide/library/your-library)
- **Découvrir** : [itinéraires publics de la communauté](/fr/guide/discover) pour la zone que vous consultez
- **Social** : votre [fil, votre boîte de réception et les personnes que vous suivez](/fr/guide/social/follow-and-feed)
- **Paramètres** : sports, unités, langue, carte et options de confidentialité

En bas de la barre latérale : les [notifications](/fr/guide/social/notifications), le bouton de mode sombre et votre compte.

## Le panneau de planification

Il affiche votre itinéraire actuel : les onglets d'activité (Course, Vélo, Marche), les points de **Départ** et d'**Arrivée** avec leurs noms de lieux, les points de passage numérotés entre les deux, les statistiques totales de l'itinéraire ainsi que le graphique de dénivelé et de revêtement. Cliquez sur un point de passage pour centrer la carte dessus. Les boutons **Enregistrer**, de partage et d'import se trouvent en bas.

## La barre d'outils de la carte

En haut de la carte :

- **Recherche** : trouvez un lieu et déplacez la carte vers lui
- **Générer une boucle** : [suggestions d'allers-retours](/fr/guide/routes/generating-loops) à partir d'un point de départ et d'une distance
- **Ma position** : centrez la carte sur votre position (demande l'autorisation la première fois)
- **Annuler / Rétablir** : parcourez vos modifications
- **Supprimer l'itinéraire** : effacez l'itinéraire actuel
- **Style de carte**, **Verrouiller la carte**, **Centrer sur l'itinéraire**, et le zoom \`+\` / \`-\`

![La recherche de lieu avec ses résultats](/guide/search.jpg)

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

![La palette de commandes avec les entrées de navigation, d'action et d'itinéraires récents](/guide/command-palette.jpg)

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

![Le premier point de passage déposé sur la carte](/guide/first-waypoint.jpg)

Un itinéraire n'est qu'une liste de points de passage. Pour en créer un, cliquez n'importe où sur la carte.

- Le premier clic définit votre **point de départ** (marqueur vert).
- Chaque clic ajoute un point de passage (marqueur numéroté).
- routess trace une ligne de liaison entre eux au fur et à mesure.

## Astuces

- **Maintenez et faites glisser** lors du placement d'un marqueur pour des ajustements fins.
- **Clic droit** (ou appui long sur écran tactile) pour supprimer un point de passage.
- **Cliquez dans une zone vide entre deux points de passage** pour insérer un point de passage au milieu.

Aucune idée d'où aller ? Laissez plutôt routess [générer une boucle](/fr/guide/routes/generating-loops) pour vous.

Continuez avec [Modifier des itinéraires](/fr/guide/routes/editing-routes).
`,
	},
	{
		path: "routes/editing-routes.mdx",
		content: `---
title: Modifier des itinéraires
description: Points de départ et d'arrivée, points de passage numérotés, réorganisation, suppression, etc.
translationStatus: machine-draft
---

![La liste des points de passage dans le panneau latéral avec les poignées de glissement](/guide/editing-routes.png)

## Points de départ et d'arrivée

Le panneau latéral commence par les lignes **Départ** et **Arrivée**, affichées sous forme de noms de lieux plutôt que de coordonnées. Cliquez sur l'une ou l'autre pour la remplacer via la recherche, et utilisez le bouton d'échange entre les deux pour inverser le sens de tout l'itinéraire.

Lorsque votre itinéraire commence et se termine au même endroit, les deux lignes se regroupent en une seule ligne **Boucle depuis …**. Pas encore une boucle ? **Retour au départ** ajoute une dernière section de retour en un clic.

## Points de passage numérotés

Les points de passage entre le départ et l'arrivée sont numérotés, et les mêmes numéros apparaissent sur les marqueurs de la carte, pour que la liste et la carte correspondent toujours. Chaque ligne indique la distance le long de l'itinéraire jusqu'à ce point.

## Réorganiser

Faites glisser un marqueur de point de passage sur la carte, ou faites glisser une ligne par sa poignée dans le panneau latéral. L'itinéraire se met à jour lorsque vous le déposez.

## Supprimer

Clic droit sur un point de passage sur la carte (ou appuyez dessus sur écran tactile) pour le retirer. L'itinéraire est recalculé autour de l'espace vide. Les actions de ligne dans le panneau latéral apparaissent lorsque vous survolez une ligne.

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

La modification sur un téléphone fonctionne différemment ; voir [routess sur votre téléphone](/fr/guide/mobile).
`,
	},
	{
		path: "routes/saving-routes.mdx",
		content: `---
title: Enregistrer des itinéraires
description: Comment routess conserve vos itinéraires entre les sessions.
translationStatus: machine-draft
---

L'itinéraire sur lequel vous travaillez est conservé automatiquement dans votre navigateur : rechargez la page et il est toujours là, même lorsque vous n'êtes pas connecté.

![L'itinéraire toujours présent après un rechargement de page](/guide/route-after-refresh.jpg)

## Enregistrer dans votre bibliothèque

Cliquez sur **Enregistrer** dans le panneau latéral pour stocker l'itinéraire dans votre bibliothèque avec un nom et une visibilité (privé, non répertorié ou public). Les itinéraires enregistrés sont stockés dans votre compte et synchronisés entre vos appareils.

Une fois enregistrés, les itinéraires se retrouvent dans [votre bibliothèque](/fr/guide/library/your-library), où vous pouvez les étiqueter, les ajouter aux favoris et les regrouper en collections.

## Enregistrer une copie

Vous travaillez à partir d'un itinéraire enregistré mais souhaitez conserver l'original ? Utilisez **Enregistrer une copie** dans le panneau de planification pour stocker vos modifications dans un nouvel itinéraire et laisser l'original intact.

## Et si je ne suis pas connecté ?

Vous pouvez quand même cliquer sur **Enregistrer** : l'itinéraire est enregistré dans ce navigateur sur cet appareil, avec un nom et des tags, et apparaît dans votre bibliothèque sous **Your routes on this device**. De là, vous pouvez l'ouvrir dans le planificateur, l'exporter en GPX ou le supprimer. Enregistrer à nouveau après en avoir ouvert un le met à jour au lieu de créer une copie.

Les itinéraires enregistrés sur l'appareil restent privés. Ils ne vous suivront pas sur un autre appareil et sont perdus si vous effacez les données du navigateur. Publier ou partager un itinéraire nécessite un compte gratuit. Lorsque vous vous connectez (ou créez un compte) sur cet appareil, les itinéraires enregistrés ici sont transférés dans votre compte en tant qu'itinéraires privés et quittent l'appareil. Si votre offre n'a pas de place pour tous (l'offre gratuite enregistre jusqu'à 5 itinéraires), les autres restent listés sous **On this device** dans votre bibliothèque et seront transférés à votre prochaine connexion avec assez de place.

## Supprimer un itinéraire

Cliquez sur **Réinitialiser** (l'icône de corbeille) pour effacer l'itinéraire actuel de la carte. Pour supprimer un itinéraire enregistré, ouvrez-le depuis votre bibliothèque et utilisez son action de suppression.
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

![Le panneau latéral avec le graphique de dénivelé, la répartition du revêtement, les statistiques et la liste des points de passage](/guide/route-info.png)

## Statistiques totales

La ligne de statistiques se trouve au-dessus du graphique de dénivelé :

- **Distance** : somme de toutes les sections, en km ou mi (défini dans votre compte)
- **Durée** : temps de trajet estimé pour le sport que vous avez sélectionné, en heures et minutes
- **Dénivelé positif** : total des montées sur l'ensemble de l'itinéraire
- **Vitesse ou allure** : vitesse moyenne (km/h ou mph) à vélo, allure (min/km ou min/mi) en course ou en marche

Chaque ligne de point de passage dans la liste indique aussi la distance le long de l'itinéraire jusqu'à ce point.

## Graphique de dénivelé et de revêtement

Un graphique unique montre le profil altimétrique de votre itinéraire avec le type de revêtement superposé sous forme de bandes colorées. Survolez le graphique pour qu'un encart en dessous affiche le dénivelé, la distance et le revêtement à ce point de l'itinéraire. Le point correspondant sur la carte est mis en évidence au fur et à mesure que vous vous déplacez.

La ligne d'itinéraire sur la carte utilise aussi des motifs de tirets pour suggérer le revêtement : continu pour goudronné, tirets pour non goudronné, pointillés pour les sentiers. Le graphique et la carte partagent la même échelle de couleurs, ce qui vous permet de faire correspondre l'un à l'autre d'un coup d'œil.

## Comment les estimations sont calculées

La durée utilise votre allure par sport définie dans **Paramètres → Sports et allure**. Chaque sport (marche, course, vélo) a sa propre allure par défaut ; remplacez la valeur par défaut si elle ne correspond pas à votre vitesse réelle. Le dénivelé positif provient de Mapbox Terrain-RGB ; le revêtement provient du moteur de routage.
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

![La fenêtre de partage avec aperçu de carte, lien de partage, cibles de partage et export GPX](/guide/share-modal.jpg)

## Ce que contient la fenêtre

- **Copier le lien** : copie un lien dans votre presse-papiers. L'itinéraire lui-même est encodé dans le lien, il reflète donc toujours l'itinéraire tel qu'il était au moment où vous l'avez copié.
- **Partage natif** : sur mobile, cela ouvre la feuille de partage de votre téléphone (WhatsApp, Messages, Mail, etc.).
- **Cibles de partage** : envoyez l'itinéraire directement par e-mail, WhatsApp, Facebook ou X.
- **Exporter en GPX** : téléchargez l'itinéraire sous forme de fichier GPX au lieu de partager un lien.
- **Aperçu** : une vignette de carte et les statistiques de l'itinéraire, pour que la personne à qui vous l'envoyez sache ce qu'elle reçoit.

## Ce que voit le destinataire

Toute personne qui ouvre le lien voit l'itinéraire chargé dans le planificateur : le tracé sur la carte, les statistiques et le graphique de dénivelé et de revêtement. Elle n'a pas besoin de compte pour le consulter, et elle peut l'exporter en GPX. Pour enregistrer une copie dans sa propre bibliothèque, elle devra se connecter.

## Envoyer un itinéraire à une personne

Si le destinataire est sur routess, vous pouvez vous passer du lien et envoyer un itinéraire enregistré directement dans sa boîte de réception, dans le panneau Social : choisissez **Envoyer à une personne**, recherchez-la par nom ou par identifiant, et ajoutez un message facultatif. Voir [Envoyer des itinéraires à des personnes](/fr/guide/social/inbox).

## Pages d'itinéraire publiques

Les itinéraires enregistrés non répertoriés ou publics disposent aussi d'une page web autonome avec la carte, les statistiques et un téléchargement GPX : c'est elle que pointent les aperçus de liens dans les applications de messagerie. Les itinéraires publics peuvent en plus apparaître sur votre [profil](/fr/guide/social/profiles), dans [Découvrir](/fr/guide/discover) et dans les moteurs de recherche ; les itinéraires non répertoriés restent accessibles uniquement via le lien.

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

![La barre d'outils de la carte avec recherche, annuler/rétablir, style, verrouillage et contrôles de zoom](/guide/map-controls.png)

## Déplacer

Cliquez et faites glisser pour vous déplacer. Sur les appareils tactiles, faites glisser avec un doigt.

## Zoomer

- Faites défiler vers le haut pour zoomer, vers le bas pour dézoomer
- Double-cliquez pour zoomer
- Pincez avec deux doigts sur les appareils tactiles
- Utilisez les boutons \`+\` / \`-\` dans la barre d'outils de la carte

## Pivoter et incliner

Maintenez \`Ctrl\` (ou clic droit) et faites glisser pour pivoter. Maintenez \`Ctrl + Shift\` pour incliner la carte vers une perspective 3D.

## Recentrer

Cliquez sur le bouton **Ma position** dans la barre d'outils de la carte pour recentrer sur votre position actuelle (le navigateur demandera l'autorisation la première fois).

## Recherche

Cliquez sur **Rechercher un lieu** dans la barre d'outils de la carte (ou ouvrez-la depuis la palette de commandes) et saisissez le nom d'un lieu ou une adresse ; choisir un résultat déplace la carte vers cet endroit. Vos recherches récentes apparaissent en dessous pour une réutilisation rapide. L'historique de recherche est stocké uniquement sur votre appareil, jamais sur le serveur.
`,
	},
	{
		path: "map/styles.mdx",
		content: `---
title: Styles de carte
description: Basculez entre les apparences de carte.
translationStatus: machine-draft
---

routess propose trois styles de carte intégrés. Ouvrez le bouton **Style de carte** dans la barre d'outils de la carte pour basculer entre eux.

![Le sélecteur de style de carte avec Rues, Plein air et Satellite](/guide/map-styles.jpg)

## Styles disponibles

- **Rues** : vue de rue détaillée par défaut
- **Plein air** : courbes de niveau et détail des sentiers, utile pour la randonnée
- **Satellite** : imagerie aérienne

Le style sélectionné est mémorisé d'une session à l'autre.

Vous cherchez une carte sombre ? Le mode sombre est un thème, pas un style de carte : activez-le depuis la barre latérale de gauche ou avec \`Ctrl/Cmd + D\`.
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

![Le point de localisation bleu sur la carte](/guide/your-location.jpg)

## Activer la localisation

Cliquez sur le bouton **Ma position** dans la barre d'outils de la carte. Votre navigateur demandera l'autorisation la première fois ; choisissez **Autoriser**.

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

Ouvrez **Paramètres** depuis la barre latérale de gauche pour gérer votre profil et vos préférences.

![Le panneau des paramètres avec les réglages rapides et les sections](/guide/settings.jpg)

## Ce que vous pouvez modifier

- **Thème et unités** : clair ou sombre, métrique ou impérial (réglages rapides en haut)
- **Sports et allure** : les sports pour lesquels vous planifiez (marche, course, vélo) et une allure par défaut pour chacun
- **Carte et affichage** : style de carte, langue, couleur d'accentuation et comportement de la carte
- **Confidentialité et partage** : visibilité par défaut des nouveaux itinéraires

Votre nom affiché se trouve sous votre compte ; l'adresse e-mail est lue depuis votre méthode de connexion et ne peut pas être modifiée dans routess.

## Votre profil public

Votre compte dispose aussi d'une page de profil public à l'adresse \`/u/votre-identifiant\`, qui répertorie vos itinéraires publics. L'identifiant peut être modifié dans les Paramètres ; voir [Profils et identifiants](/fr/guide/social/profiles).

## Sports et allure

Choisissez un ou plusieurs sports sous **Sports et allure** et désignez-en un comme sport par défaut pour les nouveaux itinéraires. Le sport actuellement sélectionné pilote les estimations de durée de vos itinéraires. Chaque sport a sa propre allure par défaut ; remplacez-la si elle ne correspond pas à votre vitesse réelle. Le changement s'applique au prochain recalcul de l'itinéraire.
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

![Le sélecteur de langue dans Paramètres, Carte et affichage](/guide/language.jpg)

Ouvrez **Paramètres** depuis la barre latérale de gauche, puis **Carte et affichage**. Le sélecteur de **Langue** se trouve sous Apparence. Le choix est mémorisé lors de votre prochaine visite.

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

![La confirmation de suppression de compte dans la zone de danger du compte](/guide/delete-account.jpg)

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

Oui. routess est open source et auto-hébergé, et une instance auto-hébergée a toutes les fonctionnalités débloquées. La version hébergée sur routess.com est gratuite pour la planification, l'import et l'export GPX, 3 itinéraires générés par jour une fois connecté et jusqu'à 5 itinéraires enregistrés. Pro, un pass annuel à paiement unique, ajoute 50 itinéraires générés par jour, les itinéraires enregistrés illimités, la génération d'itinéraires par points-nœuds, la navigation guidée, les collections et les tokens d'API pour le CLI et les agents.

## Ai-je besoin d'un compte ?

Non. Vous pouvez planifier, enregistrer et exporter des itinéraires sans compte : les itinéraires enregistrés alors que vous êtes déconnecté vivent dans ce navigateur sur cet appareil. Créez un compte gratuit (ou connectez-vous) et ils y sont transférés, pour les retrouver sur chaque appareil où vous vous connectez. La publication, les fonctions sociales et la synchronisation nécessitent un compte.

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

routess est open source et conçu pour que vos données restent les vôtres. Cette page en est la version courte pour les utilisateurs de l'application. La politique complète, avec les bases légales, les destinataires et les durées de conservation, se trouve sur [routess.com/privacy](https://routess.com/privacy).

## Ce que routess stocke

- Votre nom et votre adresse e-mail (depuis la connexion Google ou l'inscription par e-mail)
- Votre handle et votre avatar, le visage public de votre profil
- Vos itinéraires et collections enregistrés (points de passage, géométrie, et métadonnées telles que le nom, l'activité, les tags et la visibilité)
- Vos sessions, dont l'adresse IP et le navigateur utilisés pour vous connecter, conservées 7 jours
- Uniquement si vous activez les suggestions d'itinéraires hebdomadaires : la date de votre inscription et les itinéraires déjà envoyés. Désactivez-les dans les Paramètres ou avec le lien de désinscription de ces e-mails, et les deux sont supprimés

## Analyse d'usage

routess utilise Umami, un outil d'analyse sans cookies, auto-hébergé sur l'infrastructure de routess. Aucun tiers ne le reçoit et il n'est jamais utilisé à des fins publicitaires.

Outre les pages vues, l'application enregistre des événements produit nommés, comme la création d'un itinéraire ou l'import d'un fichier GPX, avec un contexte tel que la distance, le nombre de points de passage et la visibilité choisie. Les événements des utilisateurs connectés portent un identifiant **pseudonyme** : un hachage salé de votre identifiant de compte, calculé côté serveur. Ce n'est pas votre identifiant brut et il ne peut pas être inversé depuis le navigateur, mais il relie vos sessions entre elles, d'où le terme pseudonyme plutôt qu'anonyme.

Chaque événement porte aussi un identifiant d'appareil aléatoire conservé dans le stockage local de votre navigateur, pour savoir si quelqu'un qui a planifié un itinéraire sans compte est revenu. Dès que vous vous connectez sur un appareil, ses événements antérieurs sont liés à votre compte et effacés avec lui. Se déconnecter ou désactiver les statistiques supprime l'identifiant d'appareil.

Les termes de recherche ne sont enregistrés que sous forme de catégorie de longueur, jamais comme le texte que vous avez saisi.

**Pour désactiver** : Paramètres → Confidentialité et partage → Statistiques d'utilisation. Plus rien n'est envoyé ensuite, pages vues comprises. Le réglage Do Not Track de votre navigateur est respecté automatiquement.

## Rapports d'erreur

Les rapports de plantage vont vers un GlitchTip auto-hébergé. Ils contiennent l'erreur, la page, et la forme de ce que vous éditiez (nombre de points de passage, distances), mais jamais vos coordonnées, votre e-mail ni votre nom.

## Accès des administrateurs

Les administrateurs peuvent rechercher des comptes par nom ou adresse e-mail, voir vos sessions actives et leurs adresses IP, et ouvrir n'importe quel itinéraire, y compris privé. C'est pour le support et le traitement des abus, et chaque action est journalisée. Privé signifie privé vis-à-vis des autres utilisateurs, pas chiffré vis-à-vis de nous. L'auto-hébergement est la réponse si cela compte pour vous.

## Vos contrôles

- **Export** : téléchargez une copie complète de votre compte (JSON + GPX par itinéraire) depuis les paramètres de votre profil.
- **Visibilité** : chaque itinéraire est privé par défaut. Vous décidez, itinéraire par itinéraire, s'il est privé, non répertorié ou public. Un itinéraire public révèle où vous êtes passé, envisagez donc de rogner le début et la fin.
- **Suppression** : supprimer votre compte retire vos itinéraires, votre profil et vos événements d'analyse après un délai de grâce de 30 jours. Consultez [Supprimer votre compte](/fr/guide/account/deleting-account).

## Auto-hébergement

Si vous faites tourner votre propre instance routess, vos données restent sur votre infrastructure. Aucun renvoi d'informations n'est intégré, et l'analyse comme les rapports d'erreur sont désactivés tant que vous ne les configurez pas.
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
	{
		path: "account/api-tokens.mdx",
		content: `---
title: Jetons d'API
description: Créez des jetons pour les scripts, les agents et la CLI de routess.
translationStatus: machine-draft
---

Les jetons d'API permettent aux scripts et aux outils d'accéder à votre bibliothèque d'itinéraires sans votre mot de passe. Gérez-les sous **Paramètres → Jetons d'API** (visible lorsque vous êtes connecté).

![La section Jetons d'API sous Paramètres, Avancé, listant les jetons et leurs portées](/guide/api-tokens.jpg)

## Créer un jeton

1. Cliquez sur **Créer un jeton**.
2. Donnez-lui un **libellé** que vous reconnaîtrez plus tard, par exemple \`script de sauvegarde (portable)\`.
3. Choisissez une **portée** :
   - **Lecture** : lister et inspecter les itinéraires
   - **Écriture** : lecture, plus renommer, changer la visibilité et supprimer
4. Définissez éventuellement une **date d'expiration**. Vide signifie qu'il n'expire jamais.

Le jeton n'est affiché qu'**une seule fois**. Copiez-le et conservez-le en lieu sûr ; si vous le perdez, révoquez-le et créez-en un nouveau.

## L'utiliser

Envoyez le jeton comme jeton bearer :

\`\`\`sh
curl -H "Authorization: Bearer <votre-jeton>" https://api.routess.com/api/v1/routes
\`\`\`

Consultez la [référence de l'API](https://docs.routess.com/api) pour chaque point de terminaison.

## Révoquer un jeton

Chaque jeton indique quand il a été créé et utilisé pour la dernière fois. **Révoquer** le désactive immédiatement ; tout ce qui l'utilise encore cesse de fonctionner.

Faites tourner les jetons que vous ne reconnaissez plus, et préférez un jeton par outil afin qu'en révoquer un ne casse pas les autres.
`,
	},
	{
		path: "account/security.mdx",
		content: `---
title: Sécurité du compte
description: Mots de passe, sessions et déconnexion de partout.
translationStatus: machine-draft
---

Ouvrez la page de votre compte depuis l'avatar en bas de la barre latérale de gauche.

![La page du compte avec mot de passe, sessions et déconnexion partout](/guide/account-security.jpg)

## Mot de passe

Si vous vous êtes inscrit avec Google, vous pouvez tout de même **définir un mot de passe**, afin que l'e-mail et le mot de passe constituent un second moyen d'accès. Si vous en avez déjà un, **modifiez-le** au même endroit. Les mots de passe doivent comporter au moins 12 caractères.

Vous l'avez oublié ? Utilisez **Mot de passe oublié ?** sur l'écran de connexion ; le lien de réinitialisation arrive par e-mail.

## Sessions

La section **Sessions** affiche cet appareil. Se déconnecter depuis le menu met fin uniquement à la session en cours.

## Se déconnecter de tous les appareils

Sous **Sécurité**, **Se déconnecter de tous les appareils** révoque toutes les sessions actives, y compris celle que vous utilisez. Utilisez-la si vous vous êtes connecté sur un ordinateur partagé ou si vous soupçonnez que quelqu'un d'autre y a accès. Vous devrez vous reconnecter ensuite.

Pour un accès par script ou par un tiers à votre bibliothèque, utilisez des [jetons d'API](/fr/guide/account/api-tokens) plutôt que votre mot de passe.
`,
	},
	{
		path: "discover.mdx",
		content: `---
title: Découvrir
description: Parcourez les itinéraires publics de la communauté sur la carte.
translationStatus: machine-draft
---

**Découvrir** affiche les itinéraires publics de la communauté pour la partie de la carte que vous consultez. Ouvrez-le depuis la barre latérale de gauche (ou la barre d'onglets en bas sur mobile). La consultation fonctionne sans compte.

![Découvrir avec les cartes d'itinéraires de la communauté pour la zone visible](/guide/discover.jpg)

## La carte est la recherche

Déplacez-vous ou zoomez n'importe où et la liste se rafraîchit avec les itinéraires visibles, les plus récents en premier, jusqu'à 50 à la fois. Il n'y a pas de bouton de recherche : déplacer la carte, c'est lancer la requête.

Deux filtres affinent la liste :

- **Activité** : Tout, Vélo, Course ou Marche
- **Distance** : n'importe quelle distance, ou une tranche (moins de 5 km, 5 à 15 km, 15 à 50 km, plus de 50 km)

Un compteur indique combien d'itinéraires sont visibles.

## Cartes d'itinéraire

Chaque résultat affiche le nom de l'itinéraire, l'activité, la distance, le dénivelé positif, une vignette de carte, l'auteur et l'endroit où l'itinéraire commence (ville et région, déduits automatiquement du point de départ). Survoler une carte sur ordinateur met cet itinéraire en évidence sur la carte.

Cliquer sur une carte ouvre la [page publique](/fr/guide/routes/sharing-routes) de l'itinéraire avec la carte complète, les statistiques et un téléchargement GPX. Connectez-vous là pour enregistrer une copie dans votre propre bibliothèque.

## Faire apparaître vos itinéraires dans Découvrir

Découvrir liste les itinéraires dont la visibilité est **publique**. Rendez un itinéraire public depuis son panneau de détails dans votre [bibliothèque](/fr/guide/library/your-library) et il apparaît pour quiconque parcourt cette zone. Voir [partager des itinéraires](/fr/guide/routes/sharing-routes) pour comprendre le fonctionnement de la visibilité ; les itinéraires non répertoriés restent en dehors de Découvrir.
`,
	},
	{
		path: "getting-started/onboarding.mdx",
		content: `---
title: Configuration initiale
description: Ce que l'écran de bienvenue vous demande, et pourquoi.
translationStatus: machine-draft
---

![L'écran de bienvenue de routess](/guide/welcome.jpg)

La première fois que vous ouvrez routess, l'application vous guide à travers une courte configuration. Chaque réponse peut être modifiée ultérieurement dans les **Paramètres**.

1. **Choisissez votre/vos sport(s) par défaut** : marche, course ou vélo. Le sport par défaut détermine les nouveaux itinéraires.
2. **Choisissez vos unités** : métriques ou impériales, appliquées à toutes les distances, dénivelés et allures que vous verrez.
3. **Votre allure moyenne** : une vitesse typique par sport, utilisée pour estimer la durée des itinéraires.
4. **Choisissez votre style de carte** : Rues, Plein air ou Satellite (voir [Styles de carte](/fr/guide/map/styles)).
5. **Autoriser l'accès à la localisation ?** : facultatif ; utilisé pour centrer la carte sur vous. Voir [Votre position](/fr/guide/map/your-location).

Vous pouvez vous connecter immédiatement ou **continuer sans compte** ; la planification et [l'enregistrement](/fr/guide/routes/saving-routes) fonctionnent dans les deux cas, et les itinéraires enregistrés sur l'appareil sont transférés dans votre compte lorsque vous vous connectez.
`,
	},
	{
		path: "library/collections.mdx",
		content: `---
title: Collections
description: Regroupez des itinéraires en voyages, blocs d'entraînement ou listes de souhaits.
translationStatus: machine-draft
---

Les collections regroupent des itinéraires enregistrés en listes ordonnées : des vacances à vélo, un bloc d'entraînement, une liste de souhaits « à parcourir ». Un itinéraire peut figurer dans n'importe quel nombre de collections, et une collection ne fait que référencer des itinéraires, donc retirer un itinéraire d'une collection ne supprime jamais l'itinéraire lui-même.

![L'onglet Collections affichant les collections et leur nombre d'itinéraires](/guide/collections.jpg)

## Créer une collection

Ouvrez l'onglet **Collections** dans votre bibliothèque et cliquez sur **Nouvelle collection**. Saisissez un nom et appuyez sur Entrée.

## Ajouter et organiser des itinéraires

Ouvrez une collection et utilisez **Ajouter des itinéraires** pour choisir dans votre bibliothèque, ou utilisez **Ajouter à une collection** dans le menu d'une carte d'itinéraire depuis l'onglet Itinéraires. Faites glisser la poignée d'une ligne pour la réorganiser ; sur un téléphone, maintenez la poignée, puis faites glisser.

## Partager une collection

Utilisez l'action de partage de la collection pour copier un lien. Le partage rend la collection **non répertoriée** : toute personne disposant du lien peut la consulter, y compris sans compte, mais elle n'est répertoriée nulle part publiquement. Le lien affiche les itinéraires de la collection ; les itinéraires privés qu'elle contient restent masqués pour les autres.

## Supprimer une collection

Utilisez l'action de suppression et cliquez de nouveau pour confirmer. Les itinéraires qu'elle contient restent dans votre bibliothèque.
`,
	},
	{
		path: "library/route-details.mdx",
		content: `---
title: Détails d'un itinéraire
description: Le panneau de détails d'un itinéraire enregistré, du renommage à l'export GPX.
translationStatus: machine-draft
---

Cliquez sur n'importe quelle carte de votre [bibliothèque](/fr/guide/library/your-library) pour ouvrir le panneau de détails de l'itinéraire. L'aperçu cartographique reste en arrière-plan, pour que vous voyiez l'itinéraire pendant que vous travaillez.

![Le panneau de détails d'un itinéraire enregistré avec statistiques, profil d'altitude, propriétés et actions](/guide/route-details.jpg)

## En haut

- **Nom** : cliquez sur le titre pour le renommer sur place.
- **Bande de statistiques** : distance, durée, dénivelé positif et vitesse moyenne (vélo) ou allure (course et marche).
- **Graphique de dénivelé** : le même profil altimétrique et la même répartition du revêtement que dans le planificateur.
- L'en-tête contient aussi les **favoris** et **Enregistrer une copie** (dupliquer).

## Propriétés

- **Activité** : course, vélo ou marche ; en changer recalcule la durée estimée.
- **Visibilité** : privé, non répertorié ou public. Voir [Partager des itinéraires](/fr/guide/routes/sharing-routes) pour la signification de chacune.
- **Tags** : ajoutez ou retirez des tags ; ils alimentent le filtre par tags de la bibliothèque.

## Actions du pied de page

- **Modifier l'itinéraire** : ouvre l'itinéraire dans le planificateur pour changer les points de passage.
- **Partager** : liens, envoi à une personne et cibles sociales.
- **Télécharger le GPX** : exporte l'itinéraire sous forme de fichier GPX.
- **Supprimer** : retire l'itinéraire définitivement.

Modifier les points de passage se fait toujours dans le planificateur ; tout le reste d'un itinéraire peut être modifié directement ici.
`,
	},
	{
		path: "library/your-library.mdx",
		content: `---
title: Votre bibliothèque
description: Parcourez, recherchez, filtrez et triez vos itinéraires enregistrés.
translationStatus: machine-draft
---

Ouvrez **Bibliothèque** depuis la barre latérale de gauche (ou la barre d'onglets du bas sur un téléphone) pour voir tout ce que vous avez enregistré. Déconnecté, la bibliothèque liste les [itinéraires enregistrés sur cet appareil](/fr/guide/routes/saving-routes#et-si-je-ne-suis-pas-connecté-), ou une invite de connexion s'il n'y en a pas encore.

![L'onglet Itinéraires de la bibliothèque avec cartes d'itinéraires, puces d'activité et filtres](/guide/library.jpg)

Le panneau comporte deux onglets : **Itinéraires** pour les itinéraires individuels et **[Collections](/fr/guide/library/collections)** pour les regrouper.

## Cartes d'itinéraire

Chaque itinéraire enregistré est une carte avec un aperçu cartographique, son nom, son activité et ses statistiques clés. Cliquez sur une carte pour ouvrir ses [détails](/fr/guide/library/route-details). Le cœur sur la carte active ou désactive les **favoris**, et la suppression se trouve juste à côté. Le menu de la carte contient le reste :

- **Modifier dans le planificateur** : charge l'itinéraire dans le panneau de planification pour modifier les points de passage
- **Renommer**
- **Ajouter à une collection**
- **Modifier les tags**
- **Exporter en GPX**

## Recherche et filtres

- **Recherche** : correspond aux noms d'itinéraires au fur et à mesure que vous tapez.
- **Puces d'activité** : restreignent à Vélo, Course ou Marche ; la puce en forme de cœur affiche uniquement les favoris.
- **Filtres** : ajoute des plages de distance (de courte à épique), la visibilité (privé, non répertorié, public) et les tags.
- **Tri** : trie par mise à jour récente, nom, distance ou dénivelé positif.

## Tags

Les tags sont des étiquettes libres (jusqu'à 10 par itinéraire) et l'outil d'organisation principal de la bibliothèque : \`trajet\`, \`gravel\`, \`vacances-2026\`, tout ce que vous voulez. Ajoutez-les depuis le menu de la carte ou le panneau de détails de l'itinéraire, puis filtrez dessus depuis le menu **Filtres**.

## Bien démarrer

Une bibliothèque vide propose les trois façons d'obtenir un premier itinéraire : **Planifier un itinéraire**, **Générer une boucle** ou **Importer un GPX**.
`,
	},
	{
		path: "map/display-options.mdx",
		content: `---
title: Options d'affichage
description: Les réglages de carte et d'affichage qui changent ce que vous voyez.
translationStatus: machine-draft
---

Ouvrez **Paramètres** depuis la barre latérale de gauche et faites défiler jusqu'à **Carte et affichage**.

![Les réglages de carte et d'affichage](/guide/map-display.jpg)

## Comportement de la carte

- **Style de carte** : Rues, Plein air ou Satellite (voir [Styles de carte](/fr/guide/map/styles))
- **Aligner automatiquement sur les routes** : les points de passage que vous déposez ou faites glisser s'alignent sur la route la plus proche
- **Ligne guide hors trace** : affiche une ligne pointillée vers le point le plus proche de votre itinéraire lorsque vous vous en écartez
- **Cône de cap** : dessine un cône sur votre marqueur de position indiquant la direction dans laquelle vous êtes orienté

## Apparence

- **Thème** : clair ou sombre, également basculé avec \`Ctrl/Cmd + D\`
- **Couleur d'accentuation** : violet, cobalt, forêt ou braise

## Expérimental

Sous **Avancé**, vous trouverez des options expérimentales :

- **Superpositions de réseaux de nœuds** : affichent sur la carte les réseaux de nœuds numérotés pour le vélo et la randonnée. Courants en Belgique et aux Pays-Bas ; utiles pour planifier des circuits de nœud en nœud.

Les fonctionnalités expérimentales peuvent changer ou disparaître d'une version à l'autre.
`,
	},
	{
		path: "mobile.mdx",
		content: `---
title: routess sur votre téléphone
description: Comment fonctionne l'interface sur les petits écrans.
translationStatus: machine-draft
---

Sur un téléphone, la carte reste en plein écran et le panneau latéral de bureau devient une feuille du bas.

![Le planificateur sur un téléphone avec la barre d'onglets du bas](/guide/mobile-planner.jpg)

## Barre du haut

La barre en haut de l'écran contient la recherche, les notifications, le bouton de mode sombre et votre compte.

## Barre d'onglets du bas

Les onglets en bas de l'écran permettent de basculer entre **Planifier**, **Bibliothèque**, **Découvrir**, **Social** et **Paramètres**, les mêmes panneaux que la barre latérale de gauche sur ordinateur. Appuyez à nouveau sur l'onglet actif pour replier sa feuille et retrouver la carte en plein écran.

## La feuille du bas

Les panneaux s'ouvrent comme une feuille par-dessus la carte. Faites-la glisser vers le haut pour afficher le panneau complet (points de passage, dénivelé, statistiques) ou vers le bas pour n'en garder qu'un aperçu pendant que la carte occupe l'écran.

![Le panneau de planification ouvert comme une feuille du bas](/guide/mobile-drawer.jpg)

## Gestes de modification

La modification d'itinéraire sur écran tactile a sa propre grammaire de gestes, conçue pour que la carte ne saisisse jamais un point de passage que vous ne vouliez pas toucher :

- **Appuyez sur une zone vide de la carte** : ajoute un point de passage
- **Appuyez sur un point de passage** : ouvre sa fenêtre, avec la suppression
- **Appuyez longuement sur un point de passage** : le soulève (le marqueur grossit), puis faites-le glisser à un nouvel endroit
- **Appuyez longuement sur la ligne de l'itinéraire** : insère un nouveau point de passage à cet endroit et le fait glisser aussitôt
- **Appuyez longuement sur une zone vide de la carte** : ajoute un point de passage direct (en ligne droite)
- **Faites glisser un point de passage soulevé vers la zone de corbeille** en bas de la carte pour le supprimer

Bouger le doigt immédiatement déplace toujours la carte ; **pincez** pour zoomer et **tournez avec deux doigts** pour pivoter. Pour réorganiser les points de passage dans la feuille de planification, maintenez la poignée d'une ligne, puis faites glisser.

Pour utiliser routess sur le terrain avec une connexion instable, voir [Hors ligne et installation de l'application](/fr/guide/offline).
`,
	},
	{
		path: "offline.mdx",
		content: `---
title: Hors ligne et installation de l'application
description: Installez routess comme une application et utilisez-la avec une mauvaise connexion.
translationStatus: machine-draft
---

routess est une application web progressive (PWA) : vous pouvez l'installer depuis le navigateur et elle continue de fonctionner lorsque votre connexion tombe, c'est-à-dire précisément quand vous êtes sur un sentier.

## L'installer

Le plus simple est de le faire depuis routess : ouvrez **Paramètres** et utilisez **Installer l'application**. Sur la plupart des navigateurs, cela déclenche directement l'invite d'installation ; sur iOS, cela vous guide à travers les étapes **Partager → Sur l'écran d'accueil** de Safari.

Installer depuis le navigateur lui-même fonctionne aussi :

- **Chrome / Edge (ordinateur et Android)** : ouvrez le menu du navigateur et choisissez **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
- **Safari (iOS)** : appuyez sur **Partager**, puis sur **Sur l'écran d'accueil**.

L'application installée s'ouvre dans sa propre fenêtre, sans l'habillage du navigateur.

## Ce qui fonctionne hors ligne

Après votre première visite, routess met en cache :

- l'application elle-même, pour qu'elle se charge instantanément même sans connexion
- les tuiles de carte, les styles et les polices que vous avez déjà consultés
- les calculs d'itinéraires et les recherches de lieux récents

Les zones que vous avez déjà planifiées restent consultables, et les itinéraires que vous avez ouverts restent disponibles hors ligne même après les mises à jour de l'application. Tout ce qui est nouveau (zones de carte non visitées, nouveaux calculs d'itinéraires, enregistrement dans votre bibliothèque) nécessite une connexion ; si un enregistrement ne peut pas atteindre le serveur, routess vous le signale plutôt que de faire comme si tout s'était bien passé.

## Mises à jour

L'application se met à jour d'elle-même en arrière-plan. Lorsqu'une nouvelle version est prête, une notification propose **Recharger** ; la mise à jour s'applique lorsque vous confirmez ou au prochain démarrage à neuf, jamais en pleine modification.
`,
	},
	{
		path: "routes/generating-loops.mdx",
		content: `---
title: Générer des boucles
description: Générez des suggestions d'itinéraires en boucle à partir d'un point de départ et d'une distance.
translationStatus: machine-draft
---

En panne d'inspiration ? **Générer une boucle** construit pour vous des allers-retours : depuis votre point de départ, jusqu'à votre point de départ. Cela fonctionne sans compte.

![La boîte de dialogue Générer une boucle avec point de départ, distance, direction et surface](/guide/generate-loop.jpg)

## Générer

1. Cliquez sur le bouton boussole dans la barre d'outils de la carte.
2. Choisissez un point de départ : **Centre de la carte**, **Ma position** ou **Choisir sur la carte**.
3. Définissez la **Distance cible** avec le curseur (1 à 100 km).
4. Orientez éventuellement la **Direction** (Indifférente, Nord, Est, Sud, Ouest) et le **Revêtement** (Mixte, Asphalté, Non asphalté).
5. Cliquez sur **Générer**.

Les boucles sont générées pour l'activité que vous avez sélectionnée (Course, Vélo, Marche) et suivent vos [préférences de routage](/fr/guide/routes/routing-preferences).

## Choisir une boucle

Après quelques instants, jusqu'à trois boucles apparaissent sur la carte, chacune avec une carte indiquant la distance, la durée, le dénivelé positif et la répartition des revêtements. Une boucle qui emprunte en grande partie les mêmes routes reçoit un avertissement « routes répétées » sur sa carte.

- Cliquez sur une carte, ou sur une boucle estompée sur la carte, pour la prévisualiser.
- **Utiliser cet itinéraire** charge la boucle dans la planification, où vous pouvez la [modifier](/fr/guide/routes/editing-routes) et l'[enregistrer](/fr/guide/routes/saving-routes) comme n'importe quel autre itinéraire.
- **Afficher d'autres boucles** régénère des formes dans des directions que vous n'avez pas encore vues.

## Quand rien ne revient

Certains endroits ne se prêtent tout simplement pas aux boucles. Si la génération échoue, routess en indique la raison et propose des corrections en un clic : essayer n'importe quelle direction, essayer une distance plus courte, ou recommencer. Si le point de départ n'est pas proche d'une route ou d'un chemin, rapprochez-le et générez à nouveau.
`,
	},
	{
		path: "routes/importing-routes.mdx",
		content: `---
title: Importer des itinéraires
description: Importez des fichiers GPX existants dans routess.
translationStatus: machine-draft
---

Ouvrez **Importer** depuis le panneau de planification, la bibliothèque ou la palette de commandes (\`Ctrl/Cmd + K\`).

![La boîte de dialogue d'import](/guide/import-route.jpg)

## Comment ça marche

1. Déposez un fichier sur la boîte de dialogue ou cliquez sur **Choisir un fichier**.
2. Choisissez sa destination : **Ouvrir dans le planificateur** pour le vérifier et le modifier d'abord sur la carte, ou **Enregistrer dans la bibliothèque** pour le stocker directement comme itinéraire enregistré. Déconnecté, **Enregistrer dans la bibliothèque** enregistre l'itinéraire sur cet appareil ; il est transféré dans votre compte lorsque vous vous connectez.
3. routess lit la trace et détecte le type d'activité, ou vous en choisissez un vous-même.

Les itinéraires enregistrés directement dans la bibliothèque prennent leur nom dans les métadonnées du fichier GPX, à défaut du nom du fichier.

## Formats pris en charge

**GPX** est pris en charge aujourd'hui, jusqu'à 25 Mo. TCX, FIT et KML sont prévus ; en choisir un affiche un avis en attendant.

Les exports GPX d'autres applications (Strava, Komoot, Garmin Connect, etc.) s'importent sans problème. L'inverse fonctionne aussi : chaque itinéraire dans routess peut être [exporté en GPX](/fr/guide/routes/sharing-routes).
`,
	},
	{
		path: "routes/routing-preferences.mdx",
		content: `---
title: Préférences d'itinéraire
description: Les préférences de revêtement et d'évitement qui façonnent la manière dont routess vous trace un itinéraire.
translationStatus: machine-draft
---

Ouvrez les **Préférences d'itinéraire** depuis l'icône de curseurs en haut du panneau de planification, ou via la palette de commandes (\`Ctrl/Cmd + K\`). Les préférences sont enregistrées sur votre appareil et appliquées lorsque vous cliquez sur **Appliquer**.

![La boîte de dialogue des préférences d'itinéraire](/guide/routing-preferences.jpg)

## Préférence de revêtement

Orientez l'itinéraire vers un type de revêtement :

- **Revêtu** : reste sur les routes goudronnées, idéal pour les vélos de route
- **Mixte** : le réglage par défaut ; prend ce qui relie le mieux
- **Non revêtu** : privilégie le gravel et les sentiers

Lorsqu'un itinéraire calculé ne peut pas respecter votre préférence, les informations d'itinéraire affichent un avertissement de revêtement non conforme, pour que vous le sachiez avant de partir.

## Évitements

- **Éviter les autoroutes** : exclut les segments autoroutiers du calcul
- **Éviter les ferries** : ignore les itinéraires qui traversent l'eau en ferry

**Réinitialiser** restaure les valeurs par défaut. Après **Appliquer**, les nouveaux itinéraires et les recalculs utilisent vos réglages ; les segments existants ne changent que lorsque vous les modifiez.
`,
	},
	{
		path: "social/follow-and-feed.mdx",
		content: `---
title: Abonnements et fil
description: Suivez d'autres personnes et voyez leurs itinéraires nouvellement publiés.
translationStatus: machine-draft
---

Ouvrez **Social** depuis la barre latérale de gauche (ou la barre d'onglets du bas). Il comporte trois onglets : **Fil**, **Boîte de réception** et **Abonnements**. Tous nécessitent un compte.

![Le fil Social listant les itinéraires publiés par les personnes que vous suivez](/guide/feed.jpg)

## Suivre quelqu'un

Dans l'onglet **Abonnements**, recherchez des personnes par nom ou par identifiant et cliquez sur **Suivre**. Le suivi est unidirectionnel et immédiat : aucune étape d'approbation, et la personne n'a pas à vous suivre en retour. Désabonnez-vous à tout moment depuis le même onglet ou depuis son profil.

## Le fil

L'onglet **Fil** liste les itinéraires publiés par les personnes que vous suivez, du plus récent au plus ancien. Un itinéraire entre dans le fil lorsqu'il devient **public** pour la première fois ; basculer la visibilité d'avant en arrière ne le republie pas, donc personne ne peut inonder le fil.

Depuis une entrée du fil, vous pouvez ouvrir l'itinéraire ou accéder au profil de la personne qui l'a publié.

## Ce que le suivi ne fait pas

Suivre quelqu'un ne donne jamais accès à ses itinéraires : vous voyez exactement les itinéraires que voit tout visiteur de son profil, les itinéraires publics. Pour confier un itinéraire précis à une personne précise, utilisez plutôt la [boîte de réception](/fr/guide/social/inbox).
`,
	},
	{
		path: "social/inbox.mdx",
		content: `---
title: Envoyer des itinéraires à des personnes
description: Partagez un itinéraire directement avec un autre utilisateur de routess.
translationStatus: machine-draft
---

En plus des [liens de partage](/fr/guide/routes/sharing-routes), vous pouvez envoyer un itinéraire enregistré directement à une autre personne sur routess. Il arrive dans sa **boîte de réception**, dans le panneau Social.

![La boîte de réception Social montrant un itinéraire qu'on vous a envoyé, avec actions d'enregistrement et de lecture](/guide/inbox.jpg)

## Envoyer un itinéraire

1. Ouvrez les options de partage de l'itinéraire (depuis le panneau de planification ou le panneau de détails de l'itinéraire).
2. Choisissez **Envoyer à une personne** et recherchez le destinataire par nom ou par identifiant.
3. Ajoutez éventuellement un court message.
4. Envoyez.

Seuls les itinéraires non répertoriés et publics peuvent être envoyés. Si l'itinéraire est privé, routess vous le signale et propose **Rendre non répertorié et envoyer**, qui change la visibilité dans la même étape.

## Votre boîte de réception

L'onglet **Boîte de réception** affiche les itinéraires que des personnes vous ont envoyés, avec un badge « non lu » sur l'icône Social. Pour chaque entrée, vous pouvez :

- **Voir** l'itinéraire sur la carte
- **Enregistrer une copie** dans votre propre bibliothèque ; votre copie est privée et entièrement à vous
- La marquer comme lue ou la retirer

Une entrée de la boîte de réception est une référence en direct, pas un instantané : si l'expéditeur rend ensuite l'itinéraire privé ou le supprime, l'entrée n'est plus consultable. Enregistrez une copie si vous voulez la conserver définitivement.
`,
	},
	{
		path: "social/notifications.mdx",
		content: `---
title: Notifications
description: La cloche de notifications regroupe les nouveaux abonnés et les itinéraires partagés.
translationStatus: machine-draft
---

La cloche de notifications se trouve en bas de la barre latérale de gauche (sur ordinateur) ou dans la barre supérieure (sur mobile) et regroupe ce qui s'est passé autour de votre compte. Elle n'apparaît que lorsque vous êtes connecté.

![Le centre de notifications avec des entrées pour nouveaux abonnés et itinéraires partagés](/guide/notifications.jpg)

## Ce qui s'y retrouve

- **Nouveaux abonnés** : quelqu'un s'est mis à [vous suivre](/fr/guide/social/follow-and-feed). Cliquer ouvre son profil.
- **Itinéraires partagés** : quelqu'un a envoyé un itinéraire à votre [boîte de réception](/fr/guide/social/inbox). Cliquer ouvre la boîte de réception.

Les notifications sont déduites de l'état en direct : si quelqu'un cesse de vous suivre ou si un itinéraire partagé est retiré, sa notification disparaît avec lui.

## Le badge « non lu »

La cloche affiche un badge indiquant le nombre de notifications depuis la dernière fois que vous avez ouvert le panneau. Ouvrir le panneau réinitialise le badge ; les entrées nouvelles depuis votre dernière visite conservent un point bleu tant que le panneau est ouvert.

Le badge est indépendant de l'état de lecture par itinéraire de la boîte de réception : ouvrir la cloche ne marque jamais les itinéraires partagés comme lus.

Les notifications sont uniquement dans l'application ; routess n'envoie aucun e-mail de notification ni message push.
`,
	},
	{
		path: "social/profiles.mdx",
		content: `---
title: Profils et identifiants
description: Votre page de profil public et l'identifiant qui la nomme.
translationStatus: machine-draft
---

Chaque compte routess possède un **profil** : une page publique affichant votre nom, votre avatar et vos **itinéraires publics uniquement**. Les itinéraires privés et non répertoriés n'y apparaissent jamais, quel que soit celui qui regarde.

![Une page de profil public avec statistiques, nombre d'abonnés et itinéraires publics](/guide/profile.jpg)

## Votre identifiant

Votre identifiant est votre nom unique sur routess, généré à partir de votre nom affiché au lancement de la fonctionnalité (jamais à partir de votre e-mail). Il se compose de lettres minuscules, de chiffres et de traits d'union, de 3 à 30 caractères.

Votre profil se trouve à l'adresse \`app.routess.com/u/votre-identifiant\`. Vous pouvez modifier l'identifiant dans les **Paramètres** ; notez que les liens vers l'ancien identifiant cessent de fonctionner, et l'identifiant libéré devient disponible pour les autres.

## Ce qu'on trouve sur un profil

- Nom, identifiant et avatar
- Statistiques calculées sur les itinéraires publics : nombre d'itinéraires, distance totale
- Nombre d'abonnés et d'abonnements
- La liste des itinéraires publics

Tout le monde peut consulter un profil, connecté ou non. Le **nombre** d'abonnés est public ; la liste réelle de qui suit qui n'est visible que par vous sur votre propre profil.

## Partager votre profil

Envoyez simplement l'URL. Pour y faire figurer des itinéraires, définissez leur visibilité sur **public** dans les [détails de l'itinéraire](/fr/guide/library/route-details).

Ensuite : [Abonnements et fil](/fr/guide/social/follow-and-feed).
`,
	},
];
