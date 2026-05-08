import type { Page } from "./types";

export const nl: Page[] = [
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
