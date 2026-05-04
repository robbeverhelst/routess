import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type Locale = "nl" | "fr" | "de";

type Page = {
	path: string;
	content: string;
};

const docsRoot = process.cwd();

const meta = {
	root: {
		nl: {
			title: "Gebruikersgids",
			pages: ["index", "getting-started", "routes", "map", "account", "troubleshooting", "faq"],
		},
		fr: {
			title: "Guide utilisateur",
			pages: ["index", "getting-started", "routes", "map", "account", "troubleshooting", "faq"],
		},
		de: {
			title: "Benutzerhandbuch",
			pages: ["index", "getting-started", "routes", "map", "account", "troubleshooting", "faq"],
		},
	},
	gettingStarted: {
		nl: { title: "Aan de slag", pages: ["sign-in", "your-first-route", "interface-tour"] },
		fr: { title: "Bien demarrer", pages: ["sign-in", "your-first-route", "interface-tour"] },
		de: { title: "Erste Schritte", pages: ["sign-in", "your-first-route", "interface-tour"] },
	},
	routes: {
		nl: { title: "Routes", pages: ["creating-routes", "editing-routes", "saving-routes", "route-info"] },
		fr: { title: "Itineraires", pages: ["creating-routes", "editing-routes", "saving-routes", "route-info"] },
		de: { title: "Routen", pages: ["creating-routes", "editing-routes", "saving-routes", "route-info"] },
	},
	map: {
		nl: { title: "Kaart", pages: ["navigation", "styles", "your-location"] },
		fr: { title: "Carte", pages: ["navigation", "styles", "your-location"] },
		de: { title: "Karte", pages: ["navigation", "styles", "your-location"] },
	},
	account: {
		nl: { title: "Account", pages: ["profile", "language", "deleting-account"] },
		fr: { title: "Compte", pages: ["profile", "language", "deleting-account"] },
		de: { title: "Konto", pages: ["profile", "language", "deleting-account"] },
	},
} satisfies Record<string, Record<Locale, { title: string; pages: string[] }>>;

const nl: Page[] = [
	{
		path: "index.mdx",
		content: `---
title: Welkom bij routess
description: Een korte rondleiding door routess en deze gebruikersgids.
translationStatus: machine-draft
---

routess is een routeplanner waarmee je een route met meerdere stops op een kaart uitstippelt en bewaart voor later. Deze gids is bedoeld voor mensen die de routess-app gebruiken. Je hoeft niet te programmeren.

> Screenshotplaceholder: startscherm met een opgeslagen route.

## Wat je kunt doen

- Aanmelden met Google en meteen beginnen met plannen
- Waypoints toevoegen, verplaatsen, verwijderen en opnieuw ordenen
- Afstand, duur en routegegevens bekijken
- Routes bewaren zodat ze op andere apparaten beschikbaar blijven
- De kaartstijl en app-taal aanpassen

Begin met [Aanmelden met Google](/nl/guide/getting-started/sign-in) of plan direct [je eerste route](/nl/guide/getting-started/your-first-route).
`,
	},
	{
		path: "getting-started/sign-in.mdx",
		content: `---
title: Aanmelden met Google
description: Meld je aan bij routess met je Google-account.
translationStatus: machine-draft
---

routess gebruikt Google om je veilig aan te melden. Je hoeft geen apart wachtwoord voor routess te beheren.

## Stappen

1. Open routess en klik rechtsboven op **Aanmelden met Google**.
2. Kies in het Google-venster het account dat je wilt gebruiken.
3. Keur de gevraagde toestemming goed.
4. Je keert terug naar de kaart en je profiel verschijnt in de navigatie.

> Screenshotplaceholder: Google-aanmeldknop rechtsboven.

## Als het niet lukt

Controleer of pop-ups zijn toegestaan voor het routess-domein. Meld je ook eerst aan op accounts.google.com als Google geen account toont.
`,
	},
	{
		path: "getting-started/your-first-route.mdx",
		content: `---
title: Je eerste route
description: Plan een route met meerdere stops in minder dan drie minuten.
translationStatus: machine-draft
---

Gebruik deze snelle oefening om de basis te leren.

> Screenshotplaceholder: lege kaart na het aanmelden.

## 1. Kies je startpunt

Klik op de kaart. Er verschijnt een waypoint. Dit is het startpunt van je route.

## 2. Voeg stops toe

Klik opnieuw op de kaart om extra stops toe te voegen. routess tekent de lijn tussen de punten terwijl je werkt.

## 3. Pas de route aan

Sleep een waypoint om het te verplaatsen. Gebruik de routezijbalk om de volgorde te bekijken en punten te verwijderen.

## 4. Bewaar automatisch

Als je bent aangemeld, bewaart routess je wijzigingen automatisch.
`,
	},
	{
		path: "getting-started/interface-tour.mdx",
		content: `---
title: Rondleiding door de interface
description: Leer de belangrijkste onderdelen van routess kennen.
translationStatus: machine-draft
---

> Screenshotplaceholder: volledige app met genummerde aanduidingen.

## De kaart

De kaart vult het grootste deel van het scherm. Versleep om te pannen en gebruik scrollen of de zoomknoppen om in en uit te zoomen.

## De routezijbalk

Hier zie je waypoints, volgorde, afstand en duur. Gebruik de zijbalk om sneller te scannen wat je route bevat.

## Accountmenu

In het menu rechtsboven vind je je profiel, taalinstellingen en accountacties.

## Kaartknoppen

De kaartknoppen helpen je met zoomen, je locatie tonen en kaartstijlen wisselen.
`,
	},
	{
		path: "routes/creating-routes.mdx",
		content: `---
title: Routes maken
description: Voeg waypoints toe en bouw een route op de kaart.
translationStatus: machine-draft
---

Een route is een lijst van waypoints. Klik op de kaart om een waypoint toe te voegen.

> Screenshotplaceholder: waypoint toevoegen door op de kaart te klikken.

- De eerste klik zet je startpunt.
- Elke volgende klik voegt een stop toe.
- routess tekent de verbinding tussen de punten.
- De routezijbalk werkt meteen mee.

## Tips

Zoom eerst in op het gebied waar je wilt plannen. Voeg daarna je grove route toe en verfijn de punten door ze te slepen.
`,
	},
	{
		path: "routes/editing-routes.mdx",
		content: `---
title: Routes bewerken
description: Verplaats, orden, verwijder, herstel en herhaal routewijzigingen.
translationStatus: machine-draft
---

> Screenshotplaceholder: waypoint wordt versleept.

## Verplaatsen

Sleep een waypoint op de kaart. routess werkt de route bij zodra je het punt loslaat.

## Verwijderen

Selecteer een waypoint in de zijbalk en gebruik de verwijderactie.

## Ongedaan maken en opnieuw

Gebruik ongedaan maken als je een wijziging wilt terugdraaien. Gebruik opnieuw om die wijziging terug te zetten.

## Volgorde aanpassen

Wijzig de volgorde van stops in de routezijbalk wanneer de route in een andere volgorde moet lopen.
`,
	},
	{
		path: "routes/saving-routes.mdx",
		content: `---
title: Routes bewaren
description: Hoe routess je routes bewaart tussen sessies.
translationStatus: machine-draft
---

Als je bent aangemeld, bewaart routess je route automatisch.

Je route blijft beschikbaar na:

- De pagina vernieuwen
- De browser sluiten en opnieuw openen
- Aanmelden op een ander apparaat

Er is geen aparte bewaarknop. routess schrijft wijzigingen weg terwijl je werkt.

## Zonder account

Zonder aanmelden kan je nog steeds plannen, maar je route blijft alleen lokaal in je browser staan.
`,
	},
	{
		path: "routes/route-info.mdx",
		content: `---
title: Route-informatie
description: Afstand, duur en statistieken per route.
translationStatus: machine-draft
---

De routezijbalk toont live informatie terwijl je de route maakt.

> Screenshotplaceholder: zijbalk met afstand en duur.

## Totale waarden

- **Afstand** toont de totale lengte van de route.
- **Duur** toont de geschatte reistijd.
- **Waypoints** tonen waar de route stopt of draait.

## Wanneer waarden veranderen

De waarden veranderen wanneer je punten toevoegt, verwijdert, verplaatst of opnieuw ordent.
`,
	},
	{
		path: "map/navigation.mdx",
		content: `---
title: Kaartnavigatie
description: Pan, zoom en draai de kaart.
translationStatus: machine-draft
---

> Screenshotplaceholder: kaartknoppen rechtsonder.

## Pannen

Klik en sleep om de kaart te verplaatsen. Op een touchscreen sleep je met een vinger.

## Zoomen

Gebruik het muiswiel, knijp op een touchscreen of klik op de zoomknoppen.

## Draaien

Als draaien is ingeschakeld, gebruik je de standaard kaartbewegingen van je apparaat. Zet de kaart terug naar noord als je overzicht wilt.
`,
	},
	{
		path: "map/styles.mdx",
		content: `---
title: Kaartstijlen
description: Wissel tussen verschillende kaartweergaven.
translationStatus: machine-draft
---

routess heeft meerdere kaartstijlen zodat je de kaart kunt afstemmen op je taak.

> Screenshotplaceholder: menu met kaartstijlen.

## Beschikbare stijlen

- **Straten** voor dagelijks plannen
- **Satelliet** voor visuele herkenning van terrein
- **Donker** voor gebruik bij weinig licht

De gekozen stijl blijft bewaard in je browser.
`,
	},
	{
		path: "map/your-location.mdx",
		content: `---
title: Je locatie
description: Toon je actuele locatie op de kaart.
translationStatus: machine-draft
---

routess kan je huidige locatie op de kaart tonen als je browser toestemming krijgt.

> Screenshotplaceholder: locatiestip op de kaart.

## Locatie inschakelen

Klik op de knop **Mijn locatie**. Kies **Toestaan** wanneer je browser om toestemming vraagt.

## Privacy

Je browser beheert de toestemming. Je kunt die toestemming later intrekken via de instellingen van je browser of apparaat.
`,
	},
	{
		path: "account/profile.mdx",
		content: `---
title: Je profiel
description: Bekijk en werk je profiel bij.
translationStatus: machine-draft
---

Open het menu rechtsboven en klik op je avatar of naam om je profiel te bekijken.

> Screenshotplaceholder: profielscherm.

## Wat je kunt aanpassen

- Weergavenaam
- Avatar, als die door je account wordt ondersteund
- Voorkeuren zoals taal

Je e-mailadres komt uit je Google-account en wordt gebruikt om je routes aan je account te koppelen.
`,
	},
	{
		path: "account/language.mdx",
		content: `---
title: Taal
description: Wijzig de taal van de app.
translationStatus: machine-draft
---

routess is beschikbaar in:

- English
- Nederlands
- Francais
- Deutsch

## Taal wijzigen

Open het accountmenu en kies je gewenste taal. De interface wordt meteen bijgewerkt.

## Voor ontwikkelaars

Wil je een taal toevoegen of vertalingen verbeteren? Bekijk de ontwikkelaarsdocumentatie over het i18n-pakket.
`,
	},
	{
		path: "account/deleting-account.mdx",
		content: `---
title: Je account verwijderen
description: Verwijder permanent je routess-account en routes.
translationStatus: machine-draft
---

Je kunt je routess-account verwijderen wanneer je wilt. Dit is permanent.

## Wat wordt verwijderd

- Je profiel
- Al je opgeslagen routes
- De koppeling met je Google-aanmelding

## Voor je verwijdert

Controleer of je geen routes meer nodig hebt. Na verwijdering kan routess je gegevens niet herstellen.
`,
	},
	{
		path: "troubleshooting.mdx",
		content: `---
title: Probleemoplossing
description: Oplossingen voor veelvoorkomende problemen.
translationStatus: machine-draft
---

## Aanmelden lukt niet

- **Google-pop-up wordt geblokkeerd.** Sta pop-ups toe voor het routess-domein.
- **Geen account zichtbaar.** Meld je eerst aan op accounts.google.com.
- **Blijft laden.** Vernieuw de pagina en probeer opnieuw.

## Kaart laadt niet

Controleer je internetverbinding en of scripts voor het routess-domein zijn toegestaan.

## Locatie werkt niet

Controleer of je browser locatietoegang heeft en of locatievoorzieningen op je apparaat aan staan.
`,
	},
	{
		path: "faq.mdx",
		content: `---
title: Veelgestelde vragen
description: Korte antwoorden op veelgestelde vragen.
translationStatus: machine-draft
---

## Is routess gratis?

Ja. routess is open source. De publieke versie op routess.com is bedoeld om gratis te gebruiken.

## Heb ik een account nodig?

Je kunt zonder account plannen, maar aanmelden is nodig om routes tussen apparaten te bewaren.

## Kan ik mijn routes delen?

Route delen hoort bij de geplande workflow. Tot die klaar is, bewaar je routes in je eigen account.

## Welke talen worden ondersteund?

English, Nederlands, Francais en Deutsch.
`,
	},
];

const fr: Page[] = [
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
description: Deplacez, reorganisez, supprimez, annulez et retablissez les changements.
translationStatus: machine-draft
---

> Emplacement de capture d'ecran : deplacement d'un point.

## Deplacer

Faites glisser un point sur la carte. Le trajet est recalcule lorsque vous le deposez.

## Supprimer

Selectionnez un point dans le panneau lateral et utilisez l'action de suppression.

## Annuler et retablir

Utilisez annuler pour revenir en arriere et retablir pour reappliquer une modification.

## Reorganiser

Changez l'ordre des arrets dans le panneau lateral lorsque le trajet doit suivre une autre sequence.
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
description: Distance, duree et statistiques de trajet.
translationStatus: machine-draft
---

Le panneau lateral affiche les informations en direct pendant la creation.

> Emplacement de capture d'ecran : panneau avec distance et duree.

## Totaux

- **Distance** indique la longueur totale.
- **Duree** indique le temps estime.
- **Points de passage** montrent les arrets et changements de direction.

Les valeurs changent quand vous ajoutez, deplacez, supprimez ou reorganisez des points.
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
description: Consultez et mettez a jour votre profil.
translationStatus: machine-draft
---

Ouvrez le menu en haut a droite et cliquez sur votre avatar ou votre nom.

> Emplacement de capture d'ecran : ecran de profil.

## Ce que vous pouvez modifier

- Nom affiche
- Avatar, selon votre compte
- Preferences comme la langue

Votre adresse e-mail vient de votre compte Google et sert a associer vos itineraires a votre compte.
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

const de: Page[] = [
	{
		path: "index.mdx",
		content: `---
title: Willkommen bei routess
description: Ein kurzer Rundgang durch routess und das Benutzerhandbuch.
translationStatus: machine-draft
---

routess ist eine Routenplanungs-App. Du setzt mehrere Stopps auf einer Karte, passt die Route an und speicherst sie fuer spaeter.

> Screenshot-Platzhalter: Startansicht mit gespeicherter Route.

## Was du tun kannst

- Mit Google anmelden
- Wegpunkte hinzufuegen, verschieben, loeschen und neu sortieren
- Distanz, Dauer und Routendetails ansehen
- Routen in deinem Konto speichern
- Sprache und Kartenstil wechseln

Starte mit [Mit Google anmelden](/de/guide/getting-started/sign-in) oder plane [deine erste Route](/de/guide/getting-started/your-first-route).
`,
	},
	{
		path: "getting-started/sign-in.mdx",
		content: `---
title: Mit Google anmelden
description: Melde dich mit deinem Google-Konto bei routess an.
translationStatus: machine-draft
---

routess nutzt Google fuer die Anmeldung. Du musst kein separates routess-Passwort verwalten.

## Schritte

1. Oeffne routess und klicke auf **Mit Google anmelden**.
2. Waehle das Google-Konto aus.
3. Bestaetige die angefragten Berechtigungen.
4. Danach kehrst du zur Karte zurueck und dein Profil ist aktiv.

> Screenshot-Platzhalter: Google-Anmeldebutton.

## Wenn es nicht klappt

Erlaube Pop-ups fuer die routess-Domain und pruefe, ob du bei accounts.google.com angemeldet bist.
`,
	},
	{
		path: "getting-started/your-first-route.mdx",
		content: `---
title: Deine erste Route
description: Plane eine Route in weniger als drei Minuten.
translationStatus: machine-draft
---

Diese kurze Uebung zeigt die wichtigsten Grundlagen.

> Screenshot-Platzhalter: leere Karte nach der Anmeldung.

## 1. Startpunkt waehlen

Klicke auf die Karte. Der erste Wegpunkt erscheint.

## 2. Stopps hinzufuegen

Klicke weitere Stellen auf der Karte an. routess zeichnet die Verbindung waehrend der Planung.

## 3. Anpassen

Ziehe einen Wegpunkt, um ihn zu verschieben. Pruefe die Reihenfolge in der Seitenleiste.

## 4. Speichern

Wenn du angemeldet bist, speichert routess deine Aenderungen automatisch.
`,
	},
	{
		path: "getting-started/interface-tour.mdx",
		content: `---
title: Rundgang durch die Oberflaeche
description: Lerne die wichtigsten Bereiche von routess kennen.
translationStatus: machine-draft
---

> Screenshot-Platzhalter: gesamte App mit Markierungen.

## Die Karte

Die Karte nimmt den groessten Teil des Bildschirms ein. Ziehe zum Verschieben und zoome mit Mausrad, Touch-Geste oder Buttons.

## Die Routenseitenleiste

Sie zeigt Wegpunkte, Reihenfolge, Distanz und Dauer.

## Das Kontomenue

Oben rechts findest du Profil, Sprache und Kontoaktionen.

## Kartensteuerung

Mit den Kartenbuttons zoomst du, zeigst deinen Standort und wechselst den Kartenstil.
`,
	},
	{
		path: "routes/creating-routes.mdx",
		content: `---
title: Routen erstellen
description: Fuege Wegpunkte hinzu und baue eine Route auf der Karte.
translationStatus: machine-draft
---

Eine Route ist eine Liste von Wegpunkten. Klicke auf die Karte, um einen Punkt hinzuzufuegen.

> Screenshot-Platzhalter: Wegpunkt auf der Karte setzen.

- Der erste Klick setzt den Startpunkt.
- Weitere Klicks fuegen Stopps hinzu.
- routess zeichnet die Verbindung zwischen den Punkten.
- Die Seitenleiste aktualisiert sich sofort.

## Tipp

Zoome zuerst in den Bereich, den du planen willst. Setze grobe Punkte und verfeinere sie danach durch Ziehen.
`,
	},
	{
		path: "routes/editing-routes.mdx",
		content: `---
title: Routen bearbeiten
description: Verschiebe, sortiere, loesche, rueckgaengig und wiederhole Aenderungen.
translationStatus: machine-draft
---

> Screenshot-Platzhalter: ein Wegpunkt wird gezogen.

## Verschieben

Ziehe einen Wegpunkt auf der Karte. routess aktualisiert die Route, wenn du ihn loslaesst.

## Loeschen

Waehle einen Wegpunkt in der Seitenleiste aus und nutze die Loeschaktion.

## Rueckgaengig und wiederholen

Nutze Rueckgaengig, um eine Aenderung zurueckzunehmen. Nutze Wiederholen, um sie erneut anzuwenden.

## Reihenfolge aendern

Aendere die Reihenfolge der Stopps in der Seitenleiste, wenn die Route anders verlaufen soll.
`,
	},
	{
		path: "routes/saving-routes.mdx",
		content: `---
title: Routen speichern
description: Wie routess deine Routen zwischen Sitzungen erhaelt.
translationStatus: machine-draft
---

Wenn du angemeldet bist, speichert routess deine Route automatisch.

Deine Route bleibt verfuegbar nach:

- Neuladen der Seite
- Schliessen und erneutem Oeffnen des Browsers
- Anmeldung auf einem anderen Geraet

Es gibt keinen separaten Speichern-Button. routess speichert waehrend du arbeitest.

## Ohne Konto

Ohne Anmeldung kannst du planen, aber die Route bleibt nur lokal in deinem Browser.
`,
	},
	{
		path: "routes/route-info.mdx",
		content: `---
title: Routeninformationen
description: Distanz, Dauer und Routendaten.
translationStatus: machine-draft
---

Die Seitenleiste zeigt Live-Informationen, waehrend du die Route erstellst.

> Screenshot-Platzhalter: Seitenleiste mit Distanz und Dauer.

## Gesamtwerte

- **Distanz** zeigt die gesamte Laenge.
- **Dauer** zeigt die geschaetzte Zeit.
- **Wegpunkte** zeigen Stopps und Richtungswechsel.

Die Werte aendern sich, wenn du Punkte hinzufuegst, verschiebst, loeschst oder neu sortierst.
`,
	},
	{
		path: "map/navigation.mdx",
		content: `---
title: Kartennavigation
description: Karte verschieben, zoomen und ausrichten.
translationStatus: machine-draft
---

> Screenshot-Platzhalter: Kartensteuerung.

## Verschieben

Klicke und ziehe, um die Karte zu bewegen. Auf Touch-Geraeten ziehst du mit einem Finger.

## Zoomen

Nutze Mausrad, Pinch-Geste oder Zoombuttons.

## Ausrichten

Wenn Rotation aktiv ist, nutze die Standardgesten deines Geraets. Richte die Karte wieder nach Norden aus, wenn du mehr Uebersicht brauchst.
`,
	},
	{
		path: "map/styles.mdx",
		content: `---
title: Kartenstile
description: Wechsle zwischen Kartenansichten.
translationStatus: machine-draft
---

routess bietet mehrere Kartenstile, damit die Karte zur Aufgabe passt.

> Screenshot-Platzhalter: Menue fuer Kartenstile.

## Verfuegbare Stile

- **Strassen** fuer die normale Planung
- **Satellit** zur Erkennung von Umgebung und Gelaende
- **Dunkel** fuer wenig Licht

Der gewaehlte Stil bleibt im Browser gespeichert.
`,
	},
	{
		path: "map/your-location.mdx",
		content: `---
title: Dein Standort
description: Zeige deinen aktuellen Standort auf der Karte.
translationStatus: machine-draft
---

routess kann deinen Standort anzeigen, wenn dein Browser die Berechtigung hat.

> Screenshot-Platzhalter: Standortpunkt auf der Karte.

## Standort aktivieren

Klicke auf **Mein Standort** und waehle **Erlauben**, wenn der Browser fragt.

## Datenschutz

Die Berechtigung wird vom Browser verwaltet. Du kannst sie spaeter in den Browser- oder Geraeteeinstellungen entziehen.
`,
	},
	{
		path: "account/profile.mdx",
		content: `---
title: Dein Profil
description: Profil ansehen und aktualisieren.
translationStatus: machine-draft
---

Oeffne das Menue oben rechts und klicke auf Avatar oder Namen.

> Screenshot-Platzhalter: Profilansicht.

## Was du aendern kannst

- Anzeigename
- Avatar, wenn dein Konto ihn bereitstellt
- Einstellungen wie Sprache

Deine E-Mail-Adresse kommt aus deinem Google-Konto und verbindet deine Routen mit deinem Konto.
`,
	},
	{
		path: "account/language.mdx",
		content: `---
title: Sprache
description: Aendere die Sprache der App.
translationStatus: machine-draft
---

routess ist verfuegbar in:

- English
- Nederlands
- Francais
- Deutsch

## Sprache wechseln

Oeffne das Kontomenue und waehle die gewuenschte Sprache. Die Oberflaeche wird sofort aktualisiert.

## Fuer Entwickler

Wenn du eine Sprache hinzufuegen oder Uebersetzungen verbessern willst, lies die Dokumentation zum i18n-Paket.
`,
	},
	{
		path: "account/deleting-account.mdx",
		content: `---
title: Konto loeschen
description: Loesche dein routess-Konto und deine Routen dauerhaft.
translationStatus: machine-draft
---

Du kannst dein routess-Konto jederzeit loeschen. Diese Aktion ist dauerhaft.

## Was geloescht wird

- Dein Profil
- Alle gespeicherten Routen
- Die Verbindung zu deiner Google-Anmeldung

Pruefe vor dem Loeschen, ob du deine Routen noch brauchst. routess kann sie danach nicht wiederherstellen.
`,
	},
	{
		path: "troubleshooting.mdx",
		content: `---
title: Fehlerbehebung
description: Loesungen fuer haeufige Probleme.
translationStatus: machine-draft
---

## Anmeldung klappt nicht

- **Google-Pop-up wird blockiert.** Erlaube Pop-ups fuer die routess-Domain.
- **Kein Konto sichtbar.** Melde dich zuerst bei accounts.google.com an.
- **Ladeanzeige bleibt stehen.** Lade die Seite neu und versuche es erneut.

## Karte laedt nicht

Pruefe deine Internetverbindung und ob Scripts fuer die routess-Domain erlaubt sind.

## Standort funktioniert nicht

Pruefe die Standortberechtigung im Browser und auf dem Geraet.
`,
	},
	{
		path: "faq.mdx",
		content: `---
title: FAQ
description: Kurze Antworten auf haeufige Fragen.
translationStatus: machine-draft
---

## Ist routess kostenlos?

Ja. routess ist Open Source. Die oeffentliche Version auf routess.com soll kostenlos nutzbar sein.

## Brauche ich ein Konto?

Du kannst ohne Konto planen, aber fuer Routen ueber mehrere Geraete hinweg musst du angemeldet sein.

## Kann ich Routen teilen?

Teilen ist Teil des geplanten Workflows. Bis dahin bleiben Routen in deinem Konto.

## Welche Sprachen werden unterstuetzt?

English, Nederlands, Francais und Deutsch.
`,
	},
];

const pages: Record<Locale, Page[]> = { nl, fr, de };

async function writeJson(path: string, value: unknown) {
	const output = resolve(docsRoot, "content/guide", path);
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, `${JSON.stringify(value, null, "\t")}\n`, "utf8");
}

async function writePage(locale: Locale, page: Page) {
	const output = resolve(docsRoot, "content/guide", locale, page.path);
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, page.content, "utf8");
}

for (const locale of Object.keys(pages) as Locale[]) {
	await writeJson(`${locale}/meta.json`, meta.root[locale]);
	await writeJson(`${locale}/getting-started/meta.json`, meta.gettingStarted[locale]);
	await writeJson(`${locale}/routes/meta.json`, meta.routes[locale]);
	await writeJson(`${locale}/map/meta.json`, meta.map[locale]);
	await writeJson(`${locale}/account/meta.json`, meta.account[locale]);

	for (const page of pages[locale]) {
		await writePage(locale, page);
	}
}

console.log("Synchronized nl/fr/de guide translation drafts.");
