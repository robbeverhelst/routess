import type { Page } from "./types";

export const nl: Page[] = [
	{
		path: "index.mdx",
		content: `---
title: Welkom bij routess
description: Een korte rondleiding door wat routess doet en hoe deze gebruikersgids is opgebouwd.
translationStatus: machine-draft
---

routess is een routeplanner waarmee je waypoint voor waypoint een route op een kaart uitstippelt en bewaart voor later. Deze gids is bedoeld voor **mensen die de routess-app gebruiken**: programmeren is niet nodig.

![De routess-planner met een route door Gent](/guide/route-overview.jpg)

## Wat je kunt doen

- Meld je aan met Google of e-mail en begin in enkele seconden met routes plannen
- Klik op de kaart om waypoints neer te zetten, sleep om de volgorde te wijzigen, maak ongedaan als je van gedachten verandert
- Bekijk de totale afstand en geschatte duur die live meeveranderen terwijl je bewerkt
- Bewaar routes in je account zodat ze paginaverversingen en apparaten overleven
- Zet de app over naar Engels, Nederlands, Frans of Duits

## Hoe deze gids is opgebouwd

- **[Aan de slag](/nl/guide/getting-started/sign-in)**: meld je aan en plan je eerste route in 3 minuten
- **[Routes](/nl/guide/routes/creating-routes)**: routes maken, bewerken, bewaren en delen
- **[Kaart](/nl/guide/map/navigation)**: pannen, zoomen, stijlen wijzigen, je locatie volgen
- **[Account](/nl/guide/account/profile)**: profiel, taal en account verwijderen
- **[Probleemoplossing](/nl/guide/troubleshooting)**: oplossingen voor veelvoorkomende problemen
- **[Veelgestelde vragen](/nl/guide/faq)**: snelle antwoorden

Op zoek naar technische documentatie? Ga naar de [Developer Docs](/docs).
`,
	},
	{
		path: "getting-started/sign-in.mdx",
		content: `---
title: Aanmelden
description: Meld je aan bij routess met Google of met e-mail en wachtwoord.
translationStatus: machine-draft
---

Je kunt je bij routess aanmelden met je Google-account of met een e-mailadres en wachtwoord.

## Aanmelden met Google

1. Open routess en klik rechtsboven op **Aanmelden met Google**.
2. Er verschijnt een Google-venster. Kies het account dat je wilt gebruiken.
3. Keur de gevraagde toestemmingen goed.
4. Je keert terug in routess, aangemeld.

![Het aanmeldscherm van routess met de opties Google, e-mail en anoniem](/guide/welcome.jpg)

### Wat routess kan zien

- Je naam en profielfoto
- Je e-mailadres (om je account te identificeren)

Meer niet. routess leest nooit je Gmail, Drive of Agenda.

## Aanmelden met e-mail

1. Klik op het aanmeldscherm op **Aanmelden met e-mail**.
2. Om een account aan te maken, kies je **Account aanmaken**, voer je je e-mailadres en een wachtwoord in en bevestig je de verificatielink die routess je toestuurt.
3. Om je later aan te melden, voer je hetzelfde e-mailadres en wachtwoord in.

Wachtwoord vergeten? Gebruik **Resetlink versturen** op het aanmeldscherm en volg de e-mail.

Als je je hebt aangemeld met Google, kun je later een wachtwoord toevoegen via je profielinstellingen, zodat beide methodes voor hetzelfde account werken.

## Afmelden

Open het menu rechtsboven en klik op **Afmelden**. Je routes blijven bewaard op de server en verschijnen weer de volgende keer dat je je aanmeldt.

## Lukt aanmelden niet?

Zie [Probleemoplossing → Aanmeldproblemen](/nl/guide/troubleshooting).
`,
	},
	{
		path: "getting-started/your-first-route.mdx",
		content: `---
title: Je eerste route
description: Plan je eerste route in minder dan 3 minuten.
translationStatus: machine-draft
---

Laten we snel een route vanaf nul plannen.

![De lege planner, klaar voor een eerste waypoint](/guide/planner-empty.jpg)

## 1. Klik je startpunt

Klik ergens op de kaart. Er verschijnt een waypoint: dat is je startpunt. Het eerste waypoint wordt in het groen getoond.

## 2. Voeg waypoints toe

Klik opnieuw om het volgende waypoint toe te voegen. routess verbindt je waypoints met een lijn en toont de totale afstand en duur in de zijbalk.

![Drie waypoints verbonden door een berekende routelijn door Gent](/guide/route-overview.jpg)

## 3. Wijzig de volgorde door te slepen

Sleep een willekeurig waypoint om de volgorde te wijzigen. De route wordt direct bijgewerkt.

## 4. Maak een fout ongedaan

Verkeerd geklikt? Klik op **Ongedaan maken** (of \\\`Ctrl/Cmd + Z\\\`). Je kunt stap voor stap terug door elke wijziging die je hebt gemaakt.

## 5. Bewaar je route

Routes worden automatisch bewaard zodra je bent aangemeld. Vernieuw de pagina en je route staat er nog steeds.

## Volgende stappen

- Leer de bewerkgereedschappen kennen in **[Routes → Routes bewerken](/nl/guide/routes/editing-routes)**
- Pas het uiterlijk aan in **[Kaart → Stijlen](/nl/guide/map/styles)**
`,
	},
	{
		path: "getting-started/interface-tour.mdx",
		content: `---
title: Rondleiding door de interface
description: Een korte rondleiding door de routess-interface.
translationStatus: machine-draft
---

![De routess-planner met een actieve route](/guide/route-overview.jpg)

## De kaart

Vult het grootste deel van het scherm. Pan door te slepen, zoom met scrollen of met de \\\`+\\\` / \\\`-\\\`-knoppen in de kaartwerkbalk.

## De zijbalk links

De pictogramkolom helemaal links wisselt tussen panelen:

- **Plan**: de route die je aan het bouwen bent
- **Bibliotheek**: je opgeslagen routes
- **Ontdekken** en **Sociaal**: gedeelde en community-routes
- **Instellingen**: sporten, eenheden, taal, kaart- en privacyopties

Onderaan de zijbalk: meldingen, de schakelaar voor donkere modus en je account.

## De planzijbalk

Toont je huidige route: de sporttabbladen (Lopen, Fietsen, Wandelen), elk waypoint, de hoogte- en ondergrondgrafiek en de totale routestatistieken. Klik op een waypoint om de kaart erop te richten. De knoppen **Opslaan**, delen en exporteren staan onderaan.

## De kaartwerkbalk

Bovenaan de kaart:

- **Zoeken**: vind een plaats en spring met de kaart ernaartoe
- **Centreer op mij**: centreer de kaart op je locatie (vraagt de eerste keer om toestemming)
- **Ongedaan maken / Opnieuw**: stap door je bewerkingen
- **Route verwijderen**: wis de huidige route
- **Kaartstijl**, **Kaart vergrendelen**, **Op route richten** en zoom \\\`+\\\` / \\\`-\\\`

![De locatiezoekfunctie met resultaten](/guide/search.jpg)

Lees verder bij [routes maken](/nl/guide/routes/creating-routes).
`,
	},
	{
		path: "getting-started/keyboard-shortcuts.mdx",
		content: `---
title: Sneltoetsen
description: Alle sneltoetsen in routess.
translationStatus: machine-draft
---

Alle sneltoetsen gebruiken \\\`Ctrl\\\` op Windows en Linux, \\\`Cmd\\\` op macOS.

| Sneltoets | Actie |
| --- | --- |
| \\\`Ctrl/Cmd + Z\\\` | Laatste routebewerking ongedaan maken |
| \\\`Ctrl/Cmd + Shift + Z\\\` | Opnieuw |
| \\\`Ctrl/Cmd + K\\\` | Open het opdrachtenpalet |
| \\\`Ctrl/Cmd + D\\\` | Donkere modus aan/uit |
| \\\`Esc\\\` | Sluit het geopende venster |

Het opdrachtenpalet is de snelste manier om naar acties te springen zonder naar de muis te grijpen: open het en begin te typen.
`,
	},
	{
		path: "routes/creating-routes.mdx",
		content: `---
title: Routes maken
description: Hoe je waypoints toevoegt en een route op de kaart bouwt.
translationStatus: machine-draft
---

![Het eerste waypoint neergezet op de kaart](/guide/first-waypoint.jpg)

Een route is gewoon een lijst van waypoints. Om er een te maken, klik je ergens op de kaart.

- De eerste klik zet je **startpunt** (groene markering).
- Elke klik voegt een waypoint toe (genummerde markering).
- routess tekent al doende een verbindingslijn tussen de waypoints.

## Tips

- **Houd ingedrukt en sleep** bij het plaatsen van een markering voor fijne aanpassingen.
- **Klik met de rechtermuisknop** (of houd lang ingedrukt op touch) om een waypoint te verwijderen.
- **Klik op een leeg stuk tussen twee waypoints** om er een waypoint tussenin te voegen.

Ga verder met [Routes bewerken](/nl/guide/routes/editing-routes).
`,
	},
	{
		path: "routes/editing-routes.mdx",
		content: `---
title: Routes bewerken
description: Slepen, herordenen, verwijderen, ongedaan maken, opnieuw en metadata bewerken van opgeslagen routes.
translationStatus: machine-draft
---

![De waypointlijst in de zijbalk met sleepgrepen](/guide/editing-routes.png)

## Volgorde wijzigen

Sleep een waypointmarkering op de kaart. De route wordt bijgewerkt zodra je loslaat.

## Verwijderen

Klik met de rechtermuisknop (of houd lang ingedrukt) op een waypoint om het te verwijderen. De route wordt opnieuw berekend rond de leemte.

## Hover-synchronisatie tussen zijbalk en kaart

Beweeg in de zijbalk over een waypoint om het op de kaart te markeren, en beweeg over een markering op de kaart om de bijbehorende rij in de zijbalk te markeren. Dit werkt in beide richtingen, wat handig is wanneer een lange route veel waypoints heeft.

## Ongedaan maken / Opnieuw

- **Ongedaan maken:** klik op de undo-knop of druk \\\`Ctrl/Cmd + Z\\\`
- **Opnieuw:** redo-knop of \\\`Ctrl/Cmd + Shift + Z\\\`

routess bewaart je volledige bewerkingsgeschiedenis voor de huidige sessie.

## Een opgeslagen route ter plekke bewerken

Open een route uit je bibliotheek en bewerk de naam, beschrijving, zichtbaarheid of waypoints rechtstreeks. Een indicator "Onopgeslagen wijzigingen" verschijnt naast de titel zolang je openstaande bewerkingen hebt. Klik op **Opslaan** om door te voeren, of op **Verwerpen** om terug te keren naar de laatst opgeslagen versie. Als je weggaat met onopgeslagen wijzigingen, vraagt routess je eerst om bevestiging.

## Reset

Klik op **Reset** om de huidige route volledig te wissen. Dit is meteen ongedaan te maken, handig als je per ongeluk hebt gewist.
`,
	},
	{
		path: "routes/saving-routes.mdx",
		content: `---
title: Routes bewaren
description: Hoe routess je routes bewaart tussen sessies.
translationStatus: machine-draft
---

De route waar je aan werkt, wordt automatisch in je browser bewaard: vernieuw de pagina en hij staat er nog steeds, zelfs als je niet bent aangemeld.

![De route nog steeds aanwezig na een paginaverversing](/guide/route-after-refresh.jpg)

## Opslaan in je bibliotheek

Klik op **Opslaan** in de zijbalk om de route in je bibliotheek te bewaren met een naam en een zichtbaarheid (privé, niet vermeld of openbaar). Opgeslagen routes worden in je account bewaard en synchroniseren tussen apparaten. Opslaan vereist een account; als je bent afgemeld, vraagt routess je eerst om je aan te melden.

## Wat als ik niet ben aangemeld?

Je route in uitvoering blijft alleen in je browser staan. Hij overleeft verversingen, maar volgt je niet naar een ander apparaat en kan verloren gaan als je je browsergegevens wist. Meld je aan en sla op om hem te behouden.

## Een route verwijderen

Klik op **Reset** (het prullenbakpictogram) om de huidige route van de kaart te wissen. Om een opgeslagen route te verwijderen, open je die uit je bibliotheek en gebruik je de verwijderactie.
`,
	},
	{
		path: "routes/route-info.mdx",
		content: `---
title: Route-informatie
description: Afstand, duur, hoogte en ondergrond.
translationStatus: machine-draft
---

De zijbalk toont live statistieken voor je route terwijl je hem bouwt.

![De zijbalk met hoogtegrafiek, ondergrondverdeling, statistieken en waypointlijst](/guide/route-info.png)

## Totale statistieken

- **Afstand**: som van alle deeltrajecten, in km of mi (in te stellen in je account)
- **Duur**: geschatte reistijd voor de sport die je hebt geselecteerd
- **Hoogtemeters**: totale klim over de hele route

## Statistieken per deeltraject

Klik op een waypoint in de zijbalk om het uit te klappen. Je ziet de afstand en duur van het deeltraject dat naar dat waypoint leidt.

## Hoogte- en ondergrondgrafiek

Onder de statistieken toont één grafiek het hoogteprofiel van je route met de ondergrond als gekleurde banden eronder. Beweeg over de grafiek om op dat punt op de route de hoogte, afstand en ondergrond te zien. Het bijbehorende punt op de kaart wordt mee gemarkeerd terwijl je beweegt.

De routelijn op de kaart gebruikt ook streepjespatronen om de ondergrond aan te duiden: doorgetrokken voor verhard, gestreept voor onverhard, gestippeld voor paden. De grafiek en de kaart delen dezelfde kleurschaal, zodat je ze in één oogopslag aan elkaar kunt koppelen.

## Hoe schattingen worden berekend

De duur gebruikt je tempo per sport uit **Instellingen → Sporten en tempo**. Elke sport (wandelen, lopen, fietsen) heeft een eigen standaardtempo; overschrijf de standaard als die niet overeenkomt met hoe snel je echt beweegt. Hoogtemeters komen van Mapbox Terrain-RGB; de ondergrond komt van de routeringsmotor.
`,
	},
	{
		path: "routes/sharing-routes.mdx",
		content: `---
title: Routes delen
description: Deel een route met een link of via systeem-deelopties.
translationStatus: machine-draft
---

Klik op **Delen** in de routezijbalk, of open een opgeslagen route en klik op de deelknop, om het deelvenster te openen.

![Het deelvenster met kaartvoorbeeld, deellink, deeldoelen en GPX-export](/guide/share-modal.jpg)

## Wat staat er in het venster

- **Link kopiëren**: kopieert een link naar je klembord. De route zelf zit gecodeerd in de link, dus die geeft altijd de route weer zoals die was op het moment dat je kopieerde.
- **Systeemdeling**: op mobiel opent dit het deelmenu van je telefoon (WhatsApp, Berichten, Mail, enzovoort).
- **Deeldoelen**: stuur de route rechtstreeks naar e-mail, WhatsApp, Facebook of X.
- **GPX exporteren**: download de route als GPX-bestand in plaats van een link te delen.
- **Voorbeeld**: een kaartminiatuur en de routestatistieken, zodat de persoon naar wie je het stuurt weet wat hij krijgt.

## Wat de ontvanger ziet

Iedereen die de link opent, ziet de route geladen in de planner: het pad op de kaart, de statistieken en de hoogte- en ondergrondgrafiek. Een account is niet nodig om de route te bekijken, en hij kan die als GPX exporteren. Om een kopie in de eigen bibliotheek te bewaren, moet hij zich aanmelden.

## Zichtbaarheid: privé, niet vermeld, openbaar

Opgeslagen routes hebben een zichtbaarheidsinstelling, die je kiest bij het bewaren en later kunt wijzigen:

- **Privé**: alleen jij ziet de route in je bibliotheek.
- **Niet vermeld**: iedereen met de link kan de route bekijken.
- **Openbaar**: zichtbaar voor iedereen.

Je kunt een standaardwaarde voor nieuwe routes instellen via **Instellingen → Routeringsstandaarden → Standaardzichtbaarheid**. Een link delen vanuit het deelvenster verandert de zichtbaarheid van een route niet, omdat de link de routegegevens zelf bevat.
`,
	},
	{
		path: "map/navigation.mdx",
		content: `---
title: Kaartnavigatie
description: Pan, zoom en draai de kaart.
translationStatus: machine-draft
---

![De kaartwerkbalk met zoeken, ongedaan maken/opnieuw, stijl, vergrendelen en zoom](/guide/map-controls.png)

## Pannen

Klik en sleep om je te verplaatsen. Op touchapparaten sleep je met één vinger.

## Zoomen

- Scroll omhoog om in te zoomen, scroll omlaag om uit te zoomen
- Dubbelklik om in te zoomen
- Knijp met twee vingers op touchapparaten
- Gebruik de \\\`+\\\` / \\\`-\\\`-knoppen in de kaartwerkbalk

## Draaien en kantelen

Houd \\\`Ctrl\\\` ingedrukt (of klik met de rechtermuisknop) en sleep om te draaien. Houd \\\`Ctrl + Shift\\\` ingedrukt om de kaart in een 3D-perspectief te kantelen.

## Opnieuw centreren

Klik op de knop **Centreer op mij** in de kaartwerkbalk om opnieuw te centreren op je huidige locatie (de browser vraagt de eerste keer om toestemming).
`,
	},
	{
		path: "map/styles.mdx",
		content: `---
title: Kaartstijlen
description: Wissel tussen kaartweergaven.
translationStatus: machine-draft
---

routess biedt drie ingebouwde kaartstijlen. Open de knop **Kaartstijl** in de kaartwerkbalk om te wisselen.

![De kaartstijlkiezer met Streets, Outdoors en Satellite](/guide/map-styles.jpg)

## Beschikbare stijlen

- **Streets**: standaard gedetailleerde stratenweergave
- **Outdoors**: hoogtelijnen en paddetails, handig voor wandelen
- **Satellite**: luchtbeelden

De gekozen stijl blijft bewaard tussen sessies.

Op zoek naar een donkere kaart? Donkere modus is een thema, geen kaartstijl: schakel die in via de zijbalk links of met \\\`Ctrl/Cmd + D\\\`.
`,
	},
	{
		path: "map/your-location.mdx",
		content: `---
title: Je locatie
description: Toon je actuele locatie op de kaart.
translationStatus: machine-draft
---

routess kan je locatie op de kaart tonen en je volgen terwijl je beweegt.

![De blauwe locatiestip op de kaart](/guide/your-location.jpg)

## Locatie inschakelen

Klik op de knop **Centreer op mij** in de kaartwerkbalk. Je browser vraagt de eerste keer om toestemming; kies **Toestaan**.

Er verschijnt een blauwe stip op de kaart op je huidige positie.

## Privacy

Je locatie blijft in je browser. routess stuurt je actuele locatie niet naar zijn servers.

## Problemen?

- Zorg dat je browser locatie mag gebruiken voor deze site
- HTTPS is vereist; locatie werkt niet via gewone HTTP
- Sommige VPN's en bedrijfsnetwerken blokkeren geolocatie
`,
	},
	{
		path: "account/profile.mdx",
		content: `---
title: Je profiel
description: Bekijk en werk je profiel en sportinstellingen bij.
translationStatus: machine-draft
---

Open **Instellingen** in de zijbalk links om je profiel en voorkeuren te beheren.

![Het instellingenpaneel met snelinstellingen en secties](/guide/settings.jpg)

## Wat je kunt aanpassen

- **Thema en eenheden**: licht of donker, metrisch of imperiaal (snelinstellingen bovenaan)
- **Sporten en tempo**: voor welke sporten je plant (wandelen, lopen, fietsen) en een standaardtempo per sport
- **Kaart en weergave**: kaartstijl, taal, accentkleur en kaartgedrag
- **Privacy en delen**: standaardzichtbaarheid voor nieuwe routes

Je weergavenaam staat onder je account; je e-mailadres wordt uit je aanmeldmethode gelezen en kan niet worden gewijzigd in routess.

## Sporten en tempo

Kies een of meer sporten onder **Sporten en tempo** en markeer er een als standaard voor nieuwe routes. De op dat moment geselecteerde sport bepaalt de geschatte duur van je routes. Elke sport heeft een eigen standaardtempo; overschrijf het als het niet overeenkomt met hoe snel je echt beweegt. De wijziging wordt toegepast bij de volgende herberekening van de route.
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
- Français
- Deutsch

![De taalkiezer onder Instellingen, Kaart en weergave](/guide/language.jpg)

Open **Instellingen** in de zijbalk links en daarna **Kaart en weergave**. De **Taal**-kiezer staat onder Weergave. Je keuze wordt onthouden bij je volgende bezoek.

## Een taal die we niet hebben?

routess is open source en bijdragen zijn welkom. Zie [Developer Docs → Packages → i18n](/docs/packages/i18n) voor hoe je een taal toevoegt.
`,
	},
	{
		path: "account/deleting-account.mdx",
		content: `---
title: Je account verwijderen
description: Verwijder permanent je routess-account en al je routes.
translationStatus: machine-draft
---

Je kunt je routess-account op elk moment verwijderen. Dit is **permanent en onomkeerbaar**.

## Wat wordt verwijderd

- Je profiel
- Al je opgeslagen routes
- De koppeling van je aanmelding met Google

## Hoe verwijderen

1. Open het menu → **Profiel**
2. Scroll naar **Gevarenzone**
3. Klik op **Account verwijderen** en bevestig

> Screenshotplaceholder: bevestigingsvenster voor accountverwijdering.

Na verwijdering maakt opnieuw aanmelden met Google een vers account aan zonder geschiedenis.
`,
	},
	{
		path: "troubleshooting.mdx",
		content: `---
title: Probleemoplossing
description: Oplossingen voor veelvoorkomende problemen.
translationStatus: machine-draft
---

## Aanmeldproblemen

- **Het Google-venster wordt geblokkeerd.** Sta pop-ups toe voor het routess-domein en probeer opnieuw.
- **"Dit account is niet geautoriseerd."** routess gebruikt je primaire Google-identiteit; meld je eerst aan via \\\`accounts.google.com\\\`.
- **Blijft hangen op een laadanimatie na het aanmelden.** Vernieuw de pagina. Als het blijft gebeuren, wis dan de cookies voor het routess-domein.

## Kaart laadt niet

- Controleer je internetverbinding
- Schakel adblockers / privacy-extensies uit voor het routess-domein; Mapbox-tegels worden soms geblokkeerd
- Probeer een andere browser om een extensieprobleem uit te sluiten

## Mijn route is verdwenen

Als je niet was aangemeld, blijven routes alleen in je browser staan en kunnen ze gewist zijn. Meld je de volgende keer aan om ze te bewaren.

## Locatie werkt niet

Zie [Kaart → Je locatie](/nl/guide/map/your-location).

Kom je er niet uit? [Open een issue op GitHub](https://github.com/robbeverhelst/routess/issues).
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

Ja. routess is open source en zelf te hosten. De gehoste versie op routess.com is ook gratis.

## Heb ik een account nodig?

Je kunt een route plannen zonder je aan te melden, maar routes die je afgemeld bewaart, blijven alleen in je browser staan. Meld je aan om ze over sessies en apparaten heen te behouden.

## Welke gegevens bewaart routess?

- Je naam en e-mailadres (van Google-aanmelding of e-mailregistratie)
- Je opgeslagen routes (waypoints + metadata)

routess verzamelt anonieme gebruiksgegevens op een zelf gehoste analytics-instantie om te begrijpen welke functies worden gebruikt. Deze gegevens bevatten nooit je e-mailadres, je routenamen of je ruwe account-ID. Er zijn geen trackers van derden.

## Kan ik mijn routes exporteren?

Ja. Open een route en gebruik **Opslaan als GPX** in de zijbalk om hem te downloaden. Je kunt ook GPX-bestanden in de planner importeren. Import van TCX, FIT en KML staat gepland.

## Kan ik een eigen kopie draaien?

Ja, routess is open source. Zie **[Developer Docs → Operations](/docs/operations/self-host)**.

## Waar meld ik een bug?

[GitHub Issues](https://github.com/robbeverhelst/routess/issues).
`,
	},
	{
		path: "support.mdx",
		content: `---
title: Ondersteuning
description: Waar je hulp krijgt, bugs meldt en functies aanvraagt.
translationStatus: machine-draft
---

## Een bug gevonden?

Open een issue op [GitHub Issues](https://github.com/robbeverhelst/routess/issues). Vermeld:

- Wat je deed, wat je verwachtte en wat er in plaats daarvan gebeurde
- Je browser en besturingssysteem
- Een schermafbeelding als het probleem visueel is

## Een functie wensen?

Functieaanvragen verlopen ook via [GitHub Issues](https://github.com/robbeverhelst/routess/issues). Beschrijf het probleem dat je probeert op te lossen, niet alleen de oplossing die je voor ogen hebt.

## Vragen over je gegevens

- **Alles exporteren**: je profielinstellingen bevatten een volledige accountexport (een ZIP met je gegevens en één GPX-bestand per route).
- **Je account verwijderen**: zie [Je account verwijderen](/nl/guide/account/deleting-account). Verwijderen heeft een respijtperiode van 30 dagen waarin je je kunt bedenken door je opnieuw aan te melden.
- **Privacy**: zie [Privacy](/nl/guide/privacy).

## Veelvoorkomende problemen

Bekijk eerst [Probleemoplossing](/nl/guide/troubleshooting); de meest voorkomende aanmeld- en kaartproblemen worden daar behandeld.
`,
	},
	{
		path: "privacy.mdx",
		content: `---
title: Privacy
description: Welke gegevens routess bewaart en hoe je ze beheert.
translationStatus: machine-draft
---

routess is open source en gebouwd om je gegevens van jou te houden. Het volledige privacybeleid staat op [routess.com/privacy](https://routess.com/privacy); deze pagina is de korte versie voor app-gebruikers.

## Wat routess bewaart

- Je naam en e-mailadres (van Google-aanmelding of e-mailregistratie)
- Je opgeslagen routes (waypoints en metadata zoals naam, activiteit en zichtbaarheid)

## Analytics

routess gebruikt Umami, een privacyvriendelijk, cookieloos analyticsgereedschap, zelf gehost op routess-infrastructuur. Gebruiksgegevens zijn anoniem: ze bevatten nooit je e-mailadres, je routenamen of je ruwe account-ID. Er zijn geen trackers van derden en geen advertentieprofielen.

## Jouw bediening

- **Exporteren**: download een volledige kopie van je account (JSON + GPX per route) via je profielinstellingen.
- **Zichtbaarheid**: elke route is standaard privé. Je beslist per route of die privé, niet vermeld of openbaar is.
- **Verwijderen**: je account verwijderen wist je routes en profiel na een respijtperiode van 30 dagen. Zie [Je account verwijderen](/nl/guide/account/deleting-account).

## Zelf hosten

Als je je eigen routess-instantie draait, blijven je gegevens op je eigen infrastructuur. Er is geen ingebouwde phone-home.
`,
	},
	{
		path: "whats-new.mdx",
		content: `---
title: Wat is er nieuw
description: Waar je routess-releases en wijzigingen kunt volgen.
translationStatus: machine-draft
---

routess wordt doorlopend uitgebracht: elke samengevoegde verbetering wordt automatisch uitgebracht met een versienummer en release notes.

- **Release notes**: de [GitHub-releasespagina](https://github.com/robbeverhelst/routess/releases) toont elke versie met de bijbehorende wijzigingen.
- **Volg mee**: bekijk de [GitHub-repository](https://github.com/robbeverhelst/routess) om meldingen te krijgen over nieuwe releases.

Zelf hosten? Zet een specifieke versie vast met de variabele \\\`ROUTESS_TAG\\\`; zie [Developer Docs → Self-host](/docs/operations/self-host).
`,
	},
];
