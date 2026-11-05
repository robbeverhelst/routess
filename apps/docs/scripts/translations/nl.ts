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
- Bewaar routes in je bibliotheek, orden ze met tags en collecties
- Volg vrienden, zie wat ze publiceren en stuur routes naar elkaar
- Importeer en exporteer GPX, of installeer routess als app en gebruik het offline
- Zet de app over naar Engels, Nederlands, Frans of Duits

## Hoe deze gids is opgebouwd

- **[Aan de slag](/nl/guide/getting-started/sign-in)**: meld je aan en plan je eerste route in 3 minuten
- **[Routes](/nl/guide/routes/creating-routes)**: routes maken, bewerken, bewaren en delen
- **[Bibliotheek](/nl/guide/library/your-library)**: je opgeslagen routes, tags, favorieten en collecties
- **[Sociaal](/nl/guide/social/profiles)**: profielen, volgen, de feed en je inbox
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
- **Bibliotheek**: je [opgeslagen routes en collecties](/nl/guide/library/your-library)
- **Ontdekken**: [openbare routes van de community](/nl/guide/discover) voor het gebied dat je bekijkt
- **Sociaal**: je [feed, inbox en de mensen die je volgt](/nl/guide/social/follow-and-feed)
- **Instellingen**: sporten, eenheden, taal, kaart- en privacyopties

Onderaan de zijbalk: [meldingen](/nl/guide/social/notifications), de schakelaar voor donkere modus en je account.

## De planzijbalk

Toont je huidige route: de sporttabbladen (Lopen, Fietsen, Wandelen), de eindpunten **Van** en **Naar** met plaatsnamen, de genummerde waypoints daartussen, de totale routestatistieken en de hoogte- en ondergrondgrafiek. Klik op een waypoint om de kaart erop te richten. De knoppen **Opslaan**, delen en importeren staan onderaan.

## De kaartwerkbalk

Bovenaan de kaart:

- **Zoeken**: vind een plaats en spring met de kaart ernaartoe
- **Lus genereren**: [suggesties voor rondritten](/nl/guide/routes/generating-loops) vanaf een startpunt en een afstand
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

![Het opdrachtenpalet met navigatie-, actie- en recente-route-items](/guide/command-palette.jpg)

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

Geen idee waarheen? Laat routess in plaats daarvan een [lus genereren](/nl/guide/routes/generating-loops) voor je.

Ga verder met [Routes bewerken](/nl/guide/routes/editing-routes).
`,
	},
	{
		path: "routes/editing-routes.mdx",
		content: `---
title: Routes bewerken
description: Eindpunten, genummerde waypoints, herordenen, verwijderen en meer.
translationStatus: machine-draft
---

![De waypointlijst in de zijbalk met sleepgrepen](/guide/editing-routes.png)

## Eindpunten

De zijbalk begint met de rijen **Van** en **Naar**, getoond als plaatsnamen in plaats van coördinaten. Klik op een van beide om die via zoeken te vervangen, en gebruik de wisselknop ertussen om de richting van de hele route om te draaien.

Wanneer je route op dezelfde plek begint en eindigt, vouwen de twee rijen samen tot één rij **Lus vanaf …**. Nog geen lus? **Terug naar start** voegt met één klik een laatste deeltraject naar huis toe.

## Genummerde waypoints

De waypoints tussen de eindpunten zijn genummerd, en dezelfde nummers verschijnen op de kaartmarkeringen, zodat de lijst en de kaart altijd overeenkomen. Elke rij toont de afstand langs de route tot dat punt.

## Volgorde wijzigen

Sleep een waypointmarkering op de kaart, of sleep een rij aan de sleepgreep in de zijbalk. De route wordt bijgewerkt zodra je loslaat.

## Verwijderen

Klik met de rechtermuisknop op een waypoint op de kaart (of tik erop op aanraakschermen) om het te verwijderen. De route wordt opnieuw berekend rond de leemte. De rij-acties in de zijbalk verschijnen wanneer je over een rij beweegt.

## Hover-synchronisatie tussen zijbalk en kaart

Beweeg in de zijbalk over een waypoint om het op de kaart te markeren, en beweeg over een markering op de kaart om de bijbehorende rij in de zijbalk te markeren. Dit werkt in beide richtingen, wat handig is wanneer een lange route veel waypoints heeft.

## Ongedaan maken / Opnieuw

- **Ongedaan maken:** klik op de undo-knop of druk \`Ctrl/Cmd + Z\`
- **Opnieuw:** redo-knop of \`Ctrl/Cmd + Shift + Z\`

routess bewaart je volledige bewerkingsgeschiedenis voor de huidige sessie.

## Een opgeslagen route ter plekke bewerken

Open een route uit je bibliotheek en bewerk de naam, beschrijving, zichtbaarheid of waypoints rechtstreeks. Een indicator "Onopgeslagen wijzigingen" verschijnt naast de titel zolang je openstaande bewerkingen hebt. Klik op **Opslaan** om door te voeren, of op **Verwerpen** om terug te keren naar de laatst opgeslagen versie. Als je weggaat met onopgeslagen wijzigingen, vraagt routess je eerst om bevestiging.

## Reset

Klik op **Reset** om de huidige route volledig te wissen. Dit is meteen ongedaan te maken, handig als je per ongeluk hebt gewist.

Bewerken op een telefoon werkt anders; zie [routess op je telefoon](/nl/guide/mobile).
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

Klik op **Opslaan** in de zijbalk om de route in je bibliotheek te bewaren met een naam en een zichtbaarheid (privé, niet vermeld of openbaar). Opgeslagen routes worden in je account bewaard en synchroniseren tussen apparaten.

Eenmaal opgeslagen, staan routes in [je bibliotheek](/nl/guide/library/your-library), waar je ze van tags kunt voorzien, als favoriet kunt markeren en in collecties kunt groeperen.

## Een kopie opslaan

Werk je vanuit een opgeslagen route maar wil je het origineel behouden? Gebruik **Opslaan als kopie** in de planzijbalk om je bewerkingen als een nieuwe route te bewaren en het origineel onaangeroerd te laten.

## Wat als ik niet ben aangemeld?

Je kunt nog steeds op **Opslaan** klikken: de route wordt in deze browser op dit toestel bewaard, met een naam en tags, en verschijnt in je bibliotheek onder **Je routes op dit toestel**. Van daaruit kun je hem openen in de planner, exporteren als GPX of verwijderen. Sla je opnieuw op nadat je er een hebt geopend, dan wordt die bijgewerkt in plaats van gekopieerd.

Routes die op het toestel zijn opgeslagen, blijven privé. Ze volgen je niet naar een ander apparaat en gaan verloren als je je browsergegevens wist. Om een route te publiceren of te delen heb je een gratis account nodig. Meld je je aan (of maak je een account aan) op dit toestel, dan verhuizen de routes die hier zijn opgeslagen als privéroutes naar je account en verlaten ze het toestel. Heeft je abonnement niet voor allemaal plaats (gratis bewaar je tot 5 routes), dan blijven de overige in je bibliotheek staan onder **Op dit toestel** en verhuizen ze de volgende keer dat je je aanmeldt met genoeg ruimte.

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

De statistiekenrij staat boven de hoogtegrafiek:

- **Afstand**: som van alle deeltrajecten, in km of mi (in te stellen in je account)
- **Tijd**: geschatte reistijd voor de sport die je hebt geselecteerd, in uren en minuten
- **Hoogtemeters**: totale klim over de hele route
- **Snelheid of tempo**: gemiddelde snelheid (km/u of mph) bij fietsen, tempo (min/km of min/mi) bij hardlopen of wandelen

Elke waypointrij in de lijst toont ook de afstand langs de route tot dat punt.

## Hoogte- en ondergrondgrafiek

Eén grafiek toont het hoogteprofiel van je route met de ondergrond als gekleurde banden eronder. Beweeg over de grafiek en een uitlezing eronder toont op dat punt op de route de hoogte, afstand en ondergrond. Het bijbehorende punt op de kaart wordt mee gemarkeerd terwijl je beweegt.

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

## Een route naar een persoon sturen

Als de ontvanger op routess zit, kun je de link overslaan en een opgeslagen route rechtstreeks naar zijn inbox in het paneel Sociaal sturen: kies **Stuur naar een gebruiker**, zoek hem op naam of handle en voeg een optioneel bericht toe. Zie [Routes naar mensen sturen](/nl/guide/social/inbox).

## Openbare routepagina's

Opgeslagen routes die niet vermeld of openbaar zijn, krijgen ook een aparte webpagina met de kaart, de statistieken en een GPX-download, en daar verwijzen de linkvoorbeelden in chat-apps naar. Openbare routes kunnen daarnaast op je [profiel](/nl/guide/social/profiles), in [Ontdekken](/nl/guide/discover) en in zoekmachines verschijnen; niet vermelde routes blijven alleen via de link bereikbaar.

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

## Zoeken

Klik op **Zoek naar een locatie** in de kaartwerkbalk (of open het vanuit het opdrachtenpalet) en typ een plaatsnaam of adres; een resultaat kiezen springt daar met de kaart naartoe. Je recente zoekopdrachten verschijnen eronder zodat je ze snel kunt hergebruiken. De zoekgeschiedenis wordt alleen op je apparaat bewaard, nooit op de server.
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

## Je openbare profiel

Je account heeft ook een openbare profielpagina op \`/u/jouw-handle\`, met je openbare routes. De handle kan worden gewijzigd in Instellingen; zie [Profielen en handles](/nl/guide/social/profiles).

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

![De bevestiging voor accountverwijdering in de gevarenzone van het account](/guide/delete-account.jpg)

## Wat wordt verwijderd

- Je profiel
- Al je opgeslagen routes
- De koppeling van je aanmelding met Google

## Hoe verwijderen

1. Open het menu → **Profiel**
2. Scroll naar **Gevarenzone**
3. Klik op **Account verwijderen** en bevestig

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

Ja. routess is open source en zelf te hosten, en een eigen installatie heeft alle functies. De gehoste versie op routess.com is gratis voor plannen, GPX-import en -export, 3 gegenereerde routes per dag als je aangemeld bent en tot 5 bewaarde routes. Pro, een eenmalige jaarpas, voegt 50 gegenereerde routes per dag, onbeperkt routes bewaren, knooppuntroutes genereren, navigatie met afslag-instructies, collecties en API-tokens voor de CLI en agents toe.

## Heb ik een account nodig?

Nee. Je kunt routes plannen, opslaan en exporteren zonder account: routes die je afgemeld bewaart, blijven in deze browser op dit toestel. Maak een gratis account aan (of meld je aan) en ze verhuizen ernaartoe, zodat je ze hebt op elk apparaat waarop je je aanmeldt. Publiceren, sociale functies en synchronisatie vereisen een account.

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

routess is open source en gebouwd om je gegevens van jou te houden. Deze pagina is de korte versie voor app-gebruikers. Het volledige beleid, met rechtsgronden, ontvangers en bewaartermijnen, staat op [routess.com/privacy](https://routess.com/privacy).

## Wat routess bewaart

- Je naam en e-mailadres (van Google-aanmelding of e-mailregistratie)
- Je handle en avatar, het publieke gezicht van je profiel
- Je opgeslagen routes en collecties (waypoints, geometrie, en metadata zoals naam, activiteit, tags en zichtbaarheid)
- Je sessies, inclusief het IP-adres en de browser waarmee je inlogde, 7 dagen bewaard
- Enkel als je wekelijkse routesuggesties aanzet: wanneer je je aanmeldde en welke routes we je al mailden. Zet het uit in Instellingen of met de afmeldlink in zo'n mail, en beide worden gewist

## Statistieken

routess gebruikt Umami, een cookieloos statistiekengereedschap, zelf gehost op routess-infrastructuur. Geen enkele derde partij krijgt het en het wordt nooit voor advertenties gebruikt.

Naast paginaweergaves registreert de app benoemde productgebeurtenissen, zoals een route aanmaken of een GPX-bestand importeren, met context zoals afstand, aantal waypoints en de zichtbaarheid die je koos. Gebeurtenissen van ingelogde gebruikers dragen een **pseudonieme** identifier: een gezouten hash van je account-ID, berekend op de server. Het is niet je ruwe account-ID en het kan niet vanuit de browser omgekeerd worden, maar het koppelt je sessies wel aan elkaar, dus noemen we het pseudoniem in plaats van anoniem.

Elke gebeurtenis draagt ook een willekeurige toestel-identifier in de lokale opslag van je browser, zodat we zien of iemand die zonder account een route plande terugkwam. Zodra je op een toestel inlogt, worden de eerdere gebeurtenissen van dat toestel aan je account gekoppeld en ermee gewist. Uitloggen of statistieken uitzetten verwijdert de toestel-identifier.

Zoektermen worden enkel als lengte-categorie geregistreerd, nooit als de tekst die je typte.

**Uitzetten**: Instellingen → Privacy & delen → Gebruiksstatistieken. Daarna wordt er niets meer verstuurd, ook geen paginaweergaves. De Do Not Track-instelling van je browser wordt automatisch gerespecteerd.

## Foutrapportage

Crashrapporten gaan naar een zelf gehoste GlitchTip. Ze bevatten de fout, de pagina, en de vorm van wat je aan het bewerken was (aantal waypoints, afstanden), maar nooit je coördinaten, e-mailadres of naam.

## Toegang door beheerders

Beheerders kunnen accounts doorzoeken op naam of e-mailadres, je actieve sessies en hun IP-adressen zien, en elke route openen, ook privéroutes. Dat is voor support en misbruikafhandeling, en elke handeling gaat naar een auditlog. Privé betekent privé voor andere gebruikers, niet versleuteld tegen ons. Zelf hosten is het antwoord als dat voor jou uitmaakt.

## Jouw bediening

- **Exporteren**: download een volledige kopie van je account (JSON + GPX per route) via je profielinstellingen.
- **Zichtbaarheid**: elke route is standaard privé. Je beslist per route of die privé, niet vermeld of openbaar is. Een openbare route verraadt waar je geweest bent, dus overweeg het begin en einde in te korten.
- **Verwijderen**: je account verwijderen wist je routes, profiel en statistiekgebeurtenissen na een respijtperiode van 30 dagen. Zie [Je account verwijderen](/nl/guide/account/deleting-account).

## Zelf hosten

Als je je eigen routess-instantie draait, blijven je gegevens op je eigen infrastructuur. Er is geen ingebouwde phone-home, en statistieken en foutrapportage staan uit tenzij je ze configureert.
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
	{
		path: "account/api-tokens.mdx",
		content: `---
title: API-tokens
description: Maak tokens voor scripts, agents en de routess-CLI.
translationStatus: machine-draft
---

Met API-tokens kunnen scripts en tools met je routebibliotheek werken zonder je wachtwoord. Beheer ze onder **Instellingen → API-tokens** (zichtbaar wanneer je bent aangemeld).

![Het gedeelte API-tokens onder Instellingen, Geavanceerd, met tokens en hun scopes](/guide/api-tokens.jpg)

## Een token aanmaken

1. Klik op **Token aanmaken**.
2. Geef het een **label** dat je later herkent, bv. \`backup-script (laptop)\`.
3. Kies een **scope**:
   - **Lezen**: routes opvragen en inspecteren
   - **Schrijven**: lezen plus hernoemen, zichtbaarheid wijzigen en verwijderen
4. Stel eventueel een **verloopdatum** in. Leeg betekent dat hij nooit verloopt.

Het token wordt **één keer** getoond. Kopieer het en bewaar het op een veilige plek; raak je het kwijt, trek het dan in en maak een nieuw token aan.

## Gebruiken

Stuur het token mee als bearer-token:

\`\`\`sh
curl -H "Authorization: Bearer <jouw-token>" https://api.routess.com/api/v1/routes
\`\`\`

Zie de [API-referentie](https://docs.routess.com/api) voor elk endpoint.

## Een token intrekken

Bij elk token zie je wanneer het is aangemaakt en voor het laatst is gebruikt. **Intrekken** schakelt het meteen uit; alles wat het nog gebruikt, stopt met werken.

Vervang tokens die je niet meer herkent, en gebruik liefst één token per tool zodat het intrekken van één token de andere niet breekt.
`,
	},
	{
		path: "account/security.mdx",
		content: `---
title: Accountbeveiliging
description: Wachtwoorden, sessies en overal uitloggen.
translationStatus: machine-draft
---

Open je accountpagina via de avatar onderaan de zijbalk links.

![De accountpagina met wachtwoord, sessies en afmelden op alle apparaten](/guide/account-security.jpg)

## Wachtwoord

Als je je hebt aangemeld met Google kun je alsnog een **wachtwoord instellen**, zodat e-mail + wachtwoord een tweede manier wordt om in te loggen. Heb je er al een, dan kun je het op dezelfde plek **wijzigen**. Wachtwoorden moeten minimaal 12 tekens lang zijn.

Vergeten? Gebruik **Wachtwoord vergeten?** op het aanmeldscherm; de herstellink komt per e-mail binnen.

## Sessies

De sectie **Sessies** toont dit apparaat. Uitloggen via het menu beëindigt alleen de huidige sessie.

## Op alle apparaten uitloggen

Onder **Beveiliging** trekt **Op alle apparaten uitloggen** elke actieve sessie in, inclusief die je nu gebruikt. Gebruik het als je hebt ingelogd op een gedeelde computer of vermoedt dat iemand anders toegang heeft. Daarna moet je opnieuw inloggen.

Voor scriptmatige of toegang door derden tot je bibliotheek gebruik je [API-tokens](/nl/guide/account/api-tokens) in plaats van je wachtwoord.
`,
	},
	{
		path: "discover.mdx",
		content: `---
title: Ontdekken
description: Blader op de kaart door openbare routes van de community.
translationStatus: machine-draft
---

**Ontdekken** toont openbare routes van de community voor het deel van de kaart dat je bekijkt. Open het via de linkerzijbalk (of de onderste tabbalk op mobiel). Bladeren werkt zonder account.

![Ontdekken met routekaarten van de community voor het zichtbare kaartgebied](/guide/discover.jpg)

## De kaart is het zoekveld

Pan of zoom waarheen je wilt en de lijst ververst naar de routes die in beeld zijn, nieuwste eerst, tot 50 tegelijk. Er is geen zoekknop: de kaart verplaatsen is de zoekopdracht.

Twee filters versmallen de lijst:

- **Activiteit**: Alle, Fietsen, Hardlopen of Wandelen
- **Afstand**: elke afstand, of een band (onder 5 km, 5 tot 15 km, 15 tot 50 km, boven 50 km)

Een teller toont hoeveel routes er in beeld zijn.

## Routekaarten

Elk resultaat toont de naam, de activiteit, de afstand en de hoogtemeters van de route, een kaartminiatuur, de auteur en waar de route begint (stad en regio, automatisch afgeleid uit het startpunt). Beweeg je muis op desktop over een routekaart, dan wordt die route op de kaart gemarkeerd.

Klik je op een routekaart, dan opent de [openbare pagina](/nl/guide/routes/sharing-routes) van de route met de volledige kaart, de statistieken en een GPX-download. Meld je daar aan om een kopie in je eigen bibliotheek op te slaan.

## Je routes in Ontdekken krijgen

Ontdekken toont routes waarvan de zichtbaarheid **openbaar** is. Maak een route openbaar vanuit het detailpaneel in je [bibliotheek](/nl/guide/library/your-library) en hij verschijnt voor iedereen die dat gebied bekijkt. Zie [routes delen](/nl/guide/routes/sharing-routes) voor hoe zichtbaarheid werkt; niet-vermelde routes blijven buiten Ontdekken.
`,
	},
	{
		path: "getting-started/onboarding.mdx",
		content: `---
title: Instellen bij eerste gebruik
description: Wat het welkomstscherm vraagt en waarom.
translationStatus: machine-draft
---

![Het welkomstscherm van routess](/guide/welcome.jpg)

De eerste keer dat je routess opent, loodst het je door een korte instelling. Elk antwoord kun je later wijzigen via **Instellingen**.

1. **Kies je standaard sport(en)**: wandelen, hardlopen of fietsen. De standaard sport bepaalt nieuwe routes.
2. **Kies je eenheden**: metrisch of imperiaal, toegepast op elke afstand, hoogte en tempo die je ziet.
3. **Je gemiddelde tempo**: een typische snelheid per sport, gebruikt om routetijden te schatten.
4. **Kies je kaartstijl**: Straten, Buiten of Satelliet (zie [Kaartstijlen](/nl/guide/map/styles)).
5. **Locatietoegang toestaan?**: optioneel; gebruikt om de kaart op jou te centreren. Zie [Je locatie](/nl/guide/map/your-location).

Je kunt je meteen aanmelden of **doorgaan zonder account**; plannen en [opslaan](/nl/guide/routes/saving-routes) werken sowieso, en routes die op het toestel zijn opgeslagen, verhuizen naar je account zodra je je aanmeldt.
`,
	},
	{
		path: "library/collections.mdx",
		content: `---
title: Collecties
description: Groepeer routes in trips, trainingsblokken of verlanglijstjes.
translationStatus: machine-draft
---

Collecties groeperen opgeslagen routes in geordende lijsten: een fietsvakantie, een trainingsblok, een verlanglijstje met "wil ik rijden". Een route kan in een willekeurig aantal collecties zitten, en een collectie verwijst alleen naar routes, dus een route uit een collectie halen verwijdert de route zelf nooit.

![Het tabblad Collecties met collecties en hun aantal routes](/guide/collections.jpg)

## Een collectie maken

Open het tabblad **Collecties** in je bibliotheek en klik op **Nieuwe collectie**. Typ een naam en druk op Enter.

## Routes toevoegen en ordenen

Open een collectie en gebruik **Routes toevoegen** om uit je bibliotheek te kiezen, of gebruik **Toevoegen aan collectie** in het menu van een routekaart op het tabblad Routes. Sleep aan de sleepgreep van een rij om te herordenen; houd op een telefoon de greep ingedrukt en sleep dan.

## Een collectie delen

Gebruik de deelactie van de collectie om een link te kopiëren. Delen maakt de collectie **niet vermeld**: iedereen met de link kan die bekijken, ook mensen zonder account, maar hij wordt nergens openbaar vermeld. De link toont de routes van de collectie; privéroutes erin blijven voor anderen verborgen.

## Een collectie verwijderen

Gebruik de verwijderactie en klik nogmaals om te bevestigen. De routes erin blijven in je bibliotheek staan.
`,
	},
	{
		path: "library/route-details.mdx",
		content: `---
title: Routedetails
description: Het detailpaneel voor een opgeslagen route, van hernoemen tot GPX-export.
translationStatus: machine-draft
---

Klik op een kaart in je [bibliotheek](/nl/guide/library/your-library) om het detailpaneel van de route te openen. Het kaartvoorbeeld blijft erachter zichtbaar, zodat je de route ziet terwijl je werkt.

![Het detailpaneel van een opgeslagen route met statistieken, hoogteprofiel, eigenschappen en acties](/guide/route-details.jpg)

## Bovenaan

- **Naam**: klik op de titel om de route ter plekke te hernoemen.
- **Statistiekenrij**: afstand, duur, hoogtemeters en gemiddelde snelheid (fietsen) of tempo (hardlopen en wandelen).
- **Hoogtegrafiek**: hetzelfde hoogteprofiel en dezelfde ondergrondverdeling als in de planner.
- De koptekst bevat ook **favoriet** en **Opslaan als kopie** (dupliceren).

## Eigenschappen

- **Activiteit**: lopen, fietsen of wandelen; wisselen herberekent de duur.
- **Zichtbaarheid**: privé, niet vermeld of openbaar. Zie [Routes delen](/nl/guide/routes/sharing-routes) voor wat elk betekent.
- **Tags**: tags toevoegen of verwijderen; deze sturen het tagfilter van de bibliotheek aan.

## Acties onderaan

- **Route bewerken**: open de route in de planner om waypoints te wijzigen.
- **Delen**: links, naar een persoon sturen en sociale doelen.
- **GPX downloaden**: exporteer de route als GPX-bestand.
- **Verwijderen**: verwijdert de route definitief.

Waypoints wijzigen gebeurt altijd in de planner; al het andere aan een route kun je hier rechtstreeks bewerken.
`,
	},
	{
		path: "library/your-library.mdx",
		content: `---
title: Je bibliotheek
description: Blader, zoek, filter en sorteer je opgeslagen routes.
translationStatus: machine-draft
---

Open **Bibliotheek** in de linkerzijbalk (of de tabbalk onderaan op een telefoon) om alles te zien wat je hebt opgeslagen. Afgemeld toont de bibliotheek de [routes die op dit toestel zijn opgeslagen](/nl/guide/routes/saving-routes#wat-als-ik-niet-ben-aangemeld), of een aanmeldmelding als er nog geen zijn.

![Het tabblad Routes van de bibliotheek met routekaarten, activiteitschips en filters](/guide/library.jpg)

Het paneel heeft twee tabbladen: **Routes** voor afzonderlijke routes en **[Collecties](/nl/guide/library/collections)** om ze te groeperen.

## Routekaarten

Elke opgeslagen route is een kaart met een kaartvoorbeeld, naam, activiteit en belangrijkste statistieken. Klik op een kaart om de [details](/nl/guide/library/route-details) te openen. Het hartje op de kaart schakelt **favoriet** aan of uit, en verwijderen staat er vlak naast. Het kaartmenu bevat de rest:

- **Bewerken in planner**: laad de route in het planpaneel voor waypointbewerkingen
- **Hernoemen**
- **Toevoegen aan collectie**
- **Tags bewerken**
- **GPX exporteren**

## Zoeken en filters

- **Zoeken** komt overeen met routenamen terwijl je typt.
- **Activiteitschips** beperken tot Fietsen, Hardlopen of Wandelen; de hartjeschip toont alleen favorieten.
- **Filters** voegt afstandsbanden (kort tot episch), zichtbaarheid (privé, niet vermeld, openbaar) en tags toe.
- **Sorteren** ordent op recent bijgewerkt, naam, afstand of hoogtemeters.

## Tags

Tags zijn vrije labels (tot 10 per route) en het belangrijkste ordeningsmiddel van de bibliotheek: \`woon-werk\`, \`gravel\`, \`vakantie-2026\`, wat je maar wilt. Voeg ze toe via het kaartmenu of het detailpaneel van de route en filter er vervolgens op via het menu **Filters**.

## Opnieuw beginnen

Een lege bibliotheek biedt de drie manieren om aan een eerste route te komen: **Route plannen**, **Lus genereren** of **GPX importeren**.
`,
	},
	{
		path: "map/display-options.mdx",
		content: `---
title: Weergaveopties
description: Kaart- en weergave-instellingen die bepalen wat je ziet.
translationStatus: machine-draft
---

Open **Instellingen** in de zijbalk links en scroll naar **Kaart & weergave**.

![De instellingen voor kaart en weergave](/guide/map-display.jpg)

## Kaartgedrag

- **Kaartstijl**: Straten, Buiten of Satelliet (zie [Kaartstijlen](/nl/guide/map/styles))
- **Automatisch op wegen vastklikken**: waypoints die je neerzet of versleept klikken vast op de dichtstbijzijnde weg
- **Hulplijn bij afwijken**: toont een stippellijn naar het dichtstbijzijnde punt op je route wanneer je ervan afwijkt
- **Kijkrichtingkegel**: tekent een kegel op je locatiemarkering die wijst in de richting waarin je kijkt

## Uiterlijk

- **Thema**: licht of donker, ook te schakelen met \`Ctrl/Cmd + D\`
- **Accent**: Violet, Kobalt, Bos of Ember

## Experimenteel

Onder **Geavanceerd** vind je experimentele schakelaars:

- **Knooppunten-overlays**: toon genummerde fiets- en wandelknooppunten op de kaart. Veelvoorkomend in België en Nederland; handig om knooppunt-naar-knooppunt-tochten te plannen.

Experimentele functies kunnen tussen releases veranderen of verdwijnen.
`,
	},
	{
		path: "mobile.mdx",
		content: `---
title: routess op je telefoon
description: Hoe de interface werkt op kleine schermen.
translationStatus: machine-draft
---

Op een telefoon blijft de kaart schermvullend en wordt het zijpaneel van de desktop een onderpaneel.

![De planner op een telefoon met de tabbalk onderaan](/guide/mobile-planner.jpg)

## Bovenbalk

De balk bovenaan bevat zoeken, meldingen, de schakelaar voor donkere modus en je account.

## Tabbalk onderaan

De tabbladen onderaan wisselen tussen **Plannen**, **Bibliotheek**, **Ontdekken**, **Sociaal** en **Instellingen**, dezelfde panelen als de linkerbalk op desktop. Tik nogmaals op het actieve tabblad om het paneel in te klappen en de volledige kaart terug te krijgen.

## Het onderpaneel

Panelen openen als een paneel over de kaart. Sleep het omhoog voor het volledige paneel (waypoints, hoogte, statistieken) of omlaag om alleen een glimp te houden terwijl de kaart het scherm vult.

![Het planpaneel geopend als onderpaneel](/guide/mobile-drawer.jpg)

## Bewerkingsgebaren

Route bewerken op aanraakschermen heeft zijn eigen gebarentaal, gebouwd zodat de kaart nooit een waypoint grijpt dat je niet bedoelde aan te raken:

- **Tik op een lege kaart**: voeg een waypoint toe
- **Tik op een waypoint**: open de popup, met verwijderen
- **Houd een waypoint lang ingedrukt**: til het op (de markering wordt groter) en sleep het naar een nieuwe plek
- **Houd de routelijn lang ingedrukt**: voeg daar een nieuw waypoint in en sleep het meteen
- **Houd een lege kaart lang ingedrukt**: voeg een direct (rechte lijn) waypoint toe
- **Sleep een opgetild waypoint naar de prullenbakzone** onderaan de kaart om het te verwijderen

Je vinger meteen bewegen pant altijd de kaart; **knijpen** zoomt en een **draai met twee vingers** roteert. Om waypoints in het planpaneel te herordenen, houd je de sleepgreep van een rij ingedrukt en sleep je.

Voor het gebruik van routess onderweg op het pad met een wankele verbinding, zie [Offline & de app installeren](/nl/guide/offline).
`,
	},
	{
		path: "offline.mdx",
		content: `---
title: Offline & de app installeren
description: Installeer routess als app en gebruik het met een slechte verbinding.
translationStatus: machine-draft
---

routess is een progressive web app (PWA): je kunt het vanuit de browser installeren en het blijft werken wanneer je verbinding wegvalt, precies wanneer je onderweg bent op een pad.

## Installeren

De makkelijkste manier is vanuit routess zelf: open **Instellingen** en gebruik **App installeren**. In de meeste browsers verschijnt dan meteen de installatiemelding; op iOS leidt het je door de stappen van Safari (**Delen → Zet op beginscherm**).

Vanuit de browser zelf installeren werkt ook:

- **Chrome / Edge (desktop en Android)**: open het browsermenu en kies **App installeren** (of **Toevoegen aan startscherm**).
- **Safari (iOS)**: tik op **Delen** en daarna op **Zet op beginscherm**.

De geïnstalleerde app opent in een eigen venster, zonder browserranden.

## Wat werkt offline

Na je eerste bezoek bewaart routess in de cache:

- de app zelf, zodat hij meteen laadt, ook zonder verbinding
- kaarttegels, -stijlen en lettertypen die je al hebt bekeken
- recente routeberekeningen en locatiezoekopdrachten

Gebieden waarin je eerder hebt gepland, blijven doorbladerbaar, en routes die je hebt geopend, blijven offline beschikbaar, ook na app-updates. Alles wat nieuw is (niet eerder bezochte kaartgebieden, verse routeberekeningen, opslaan in je bibliotheek) vereist een verbinding; als een opslagactie de server niet bereikt, vertelt routess je dat in plaats van te doen alsof het gelukt is.

## Updates

De app werkt zichzelf op de achtergrond bij. Wanneer er een nieuwe versie klaarstaat, biedt een melding **Herladen** aan; de update wordt toegepast wanneer je bevestigt of bij de volgende verse start, nooit midden in een bewerking.
`,
	},
	{
		path: "routes/generating-loops.mdx",
		content: `---
title: Lussen genereren
description: Genereer suggesties voor rondritten vanaf een startpunt en een afstand.
translationStatus: machine-draft
---

Geen inspiratie? **Lus genereren** bouwt rondritten voor je: vanaf je startpunt, terug naar je startpunt. Het werkt zonder account.

![Het dialoogvenster Lus genereren met startpunt, afstand, richting en ondergrond](/guide/generate-loop.jpg)

## Genereren

1. Klik op de kompasknop in de kaartwerkbalk.
2. Kies een startpunt: **Kaartcentrum**, **Mijn locatie** of **Kies op kaart**.
3. Stel de **Doelafstand** in met de schuifregelaar (1 tot 100 km).
4. Stuur optioneel de **Richting** (Elke, Noord, Oost, Zuid, West) en de **Ondergrond** (Gemengd, Verhard, Onverhard) bij.
5. Klik op **Genereren**.

Lussen worden gegenereerd voor de activiteit die je hebt geselecteerd (Lopen, Fietsen, Wandelen) en volgen je [routeringsvoorkeuren](/nl/guide/routes/routing-preferences).

## Een lus kiezen

Na een paar ogenblikken verschijnen er tot drie lussen op de kaart, elk met een kaartje dat de afstand, de duur, de hoogtemeters en de verdeling van de ondergrond toont. Een lus die grotendeels dezelfde wegen opnieuw aflegt, krijgt een waarschuwing voor "herhaalde wegen" op zijn kaartje.

- Klik op een kaartje, of op een gedimde lus op de kaart, om een voorbeeld te bekijken.
- **Deze route gebruiken** laadt de lus in het plan, waar je hem net als elke andere route kunt [bewerken](/nl/guide/routes/editing-routes) en [opslaan](/nl/guide/routes/saving-routes).
- **Andere lussen tonen** genereert opnieuw met vormen in richtingen die je nog niet hebt gezien.

## Wanneer er niets terugkomt

Sommige plekken lussen gewoon niet goed. Lukt het genereren niet, dan vertelt routess waarom en biedt het oplossingen met één klik: probeer elke richting, probeer een kortere afstand, of begin opnieuw. Ligt het startpunt niet in de buurt van een weg of pad, verplaats het dan dichterbij en genereer opnieuw.
`,
	},
	{
		path: "routes/importing-routes.mdx",
		content: `---
title: Routes importeren
description: Breng bestaande GPX-bestanden binnen in routess.
translationStatus: machine-draft
---

Open **Route importeren** via de planzijbalk, de bibliotheek of het opdrachtenpalet (\`Ctrl/Cmd + K\`).

![Het importvenster](/guide/import-route.jpg)

## Hoe het werkt

1. Sleep een bestand op het dialoogvenster of klik op **Bestand kiezen**.
2. Kies waar het naartoe gaat: **Openen in planner** om het eerst op de kaart te bekijken en bewerken, of **Opslaan in bibliotheek** om het rechtstreeks als opgeslagen route te bewaren. Afgemeld bewaart **Opslaan in bibliotheek** de route op dit toestel; hij verhuist naar je account zodra je je aanmeldt.
3. routess leest het spoor en detecteert het activiteitstype, of je kiest er zelf een.

Routes die rechtstreeks in de bibliotheek worden opgeslagen, nemen hun naam over uit de metadata van het GPX-bestand, met de bestandsnaam als terugval.

## Ondersteunde formaten

**GPX** wordt nu ondersteund, tot 25 MB. TCX, FIT en KML zijn gepland; een van die formaten kiezen toont voorlopig een melding.

GPX-exports uit andere apps (Strava, Komoot, Garmin Connect, enzovoort) importeren prima. Andersom werkt het ook: elke route in routess kan [als GPX worden geëxporteerd](/nl/guide/routes/sharing-routes).
`,
	},
	{
		path: "routes/routing-preferences.mdx",
		content: `---
title: Routevoorkeuren
description: Ondergrond- en vermijdingsvoorkeuren die bepalen hoe routess je routeert.
translationStatus: machine-draft
---

Open **Routevoorkeuren** via het schuifregelaarspictogram bovenaan de planzijbalk, of via het opdrachtenpalet (\`Ctrl/Cmd + K\`). Voorkeuren worden op je apparaat bewaard en toegepast wanneer je op **Toepassen** klikt.

![Het dialoogvenster met routevoorkeuren](/guide/routing-preferences.jpg)

## Ondergrondvoorkeur

Stuur de route richting een type ondergrond:

- **Verhard**: blijf op verharde wegen, ideaal voor racefietsen
- **Gemengd**: de standaard; neem wat het beste aansluit
- **Onverhard**: voorkeur voor gravel en paden

Wanneer een berekende route niet aan je voorkeur kan voldoen, toont de route-info een waarschuwing over de afwijkende ondergrond, zodat je het weet voordat je vertrekt.

## Vermijdingen

- **Snelwegen vermijden**: sluit snelwegsegmenten uit van routering
- **Veerboten vermijden**: sla routes over die via een veerboot het water oversteken

**Resetten** herstelt de standaardwaarden. Na **Toepassen** gebruiken nieuwe routes en herberekeningen jouw instellingen; bestaande trajecten veranderen pas wanneer je ze bewerkt.
`,
	},
	{
		path: "social/follow-and-feed.mdx",
		content: `---
title: Volgen en feed
description: Volg andere mensen en zie hun pas gepubliceerde routes.
translationStatus: machine-draft
---

Open **Sociaal** in de linkerzijbalk (of de tabbalk onderaan). Het heeft drie tabbladen: **Feed**, **Inbox** en **Volgend**. Voor alle drie is een account nodig.

![De Sociaal-feed met routes die zijn gepubliceerd door mensen die je volgt](/guide/feed.jpg)

## Iemand volgen

Zoek op het tabblad **Volgend** mensen op naam of handle en klik op **Volgen**. Volgen is eenrichtingsverkeer en meteen actief: geen goedkeuringsstap, en ze hoeven jou niet terug te volgen. Ontvolg op elk moment vanuit hetzelfde tabblad of vanaf hun profiel.

## De feed

Het tabblad **Feed** toont routes die zijn gepubliceerd door de mensen die je volgt, nieuwste eerst. Een route komt in de feed wanneer die voor het eerst **openbaar** wordt; de zichtbaarheid heen en weer schakelen publiceert hem niet opnieuw, zodat niemand de feed kan volspammen.

Vanuit een feed-item kun je de route openen of naar het profiel van de publicist springen.

## Wat volgen niet doet

Iemand volgen geeft nooit toegang tot hun routes: je ziet precies de routes die elke bezoeker van hun profiel ziet, de openbare. Om een specifieke route aan een specifieke persoon te geven, gebruik je in plaats daarvan de [inbox](/nl/guide/social/inbox).
`,
	},
	{
		path: "social/inbox.mdx",
		content: `---
title: Routes naar mensen sturen
description: Deel een route rechtstreeks met een andere routess-gebruiker.
translationStatus: machine-draft
---

Naast [deellinks](/nl/guide/routes/sharing-routes) kun je een opgeslagen route rechtstreeks naar een andere persoon op routess sturen. Hij komt terecht in hun **Inbox** in het paneel Sociaal.

![De Sociaal-inbox met een route die iemand je stuurde, met opslaan- en lees-acties](/guide/inbox.jpg)

## Een route versturen

1. Open de deelopties van de route (vanuit het planpaneel of het detailpaneel van de route).
2. Kies **Stuur naar een gebruiker** en zoek de ontvanger op naam of handle.
3. Voeg eventueel een kort bericht toe.
4. Verstuur.

Alleen niet-vermelde en openbare routes kunnen worden verstuurd. Is de route privé, dan zegt routess dat en biedt **Maak verborgen & verstuur** aan, wat de zichtbaarheid in dezelfde stap omzet.

## Je inbox

Het tabblad **Inbox** toont routes die mensen je hebben gestuurd, met een badge voor ongelezen items op het Sociaal-pictogram. Voor elk item kun je:

- de route op de kaart **bekijken**
- een **kopie opslaan** in je eigen bibliotheek; je kopie is privé en helemaal van jou
- het als gelezen markeren of verwijderen

Een inbox-item is een live verwijzing, geen momentopname: als de afzender de route later privé maakt of verwijdert, kun je het item niet meer bekijken. Sla een kopie op als je het voorgoed wilt bewaren.
`,
	},
	{
		path: "social/notifications.mdx",
		content: `---
title: Meldingen
description: De meldingsbel verzamelt nieuwe volgers en gedeelde routes.
translationStatus: machine-draft
---

De meldingsbel staat onderaan de linkerzijbalk (desktop) of in de bovenbalk (mobiel) en verzamelt wat er rond je account gebeurde. Hij verschijnt alleen als je bent aangemeld.

![Het meldingencentrum met items voor nieuwe volgers en gedeelde routes](/guide/notifications.jpg)

## Wat hier terechtkomt

- **Nieuwe volgers**: iemand is je [beginnen volgen](/nl/guide/social/follow-and-feed). Klikken opent zijn profiel.
- **Gedeelde routes**: iemand stuurde een route naar je [inbox](/nl/guide/social/inbox). Klikken opent de inbox.

Meldingen worden afgeleid uit de live toestand: ontvolgt iemand je of wordt een gedeelde route ingetrokken, dan verdwijnt de bijbehorende melding mee.

## De badge voor ongelezen items

De bel toont een badge met het aantal meldingen sinds je het paneel voor het laatst opende. Het paneel openen stelt de badge terug; items die nieuw zijn sinds je laatste bezoek houden een blauwe stip zolang het paneel open is.

De badge staat los van de lees-status per route van de inbox: de bel openen markeert gedeelde routes nooit als gelezen.

Meldingen zijn alleen in-app; routess stuurt geen meldingsmails of pushberichten.
`,
	},
	{
		path: "social/profiles.mdx",
		content: `---
title: Profielen en handles
description: Je openbare profielpagina en de handle die haar een naam geeft.
translationStatus: machine-draft
---

Elk routess-account heeft een **profiel**: een openbare pagina met je naam, avatar en **alleen je openbare routes**. Privé- en niet-vermelde routes verschijnen er nooit op, wie er ook kijkt.

![Een openbare profielpagina met statistieken, volgersaantallen en openbare routes](/guide/profile.jpg)

## Je handle

Je handle is je unieke naam op routess, gegenereerd uit je weergavenaam toen de functie werd gelanceerd (nooit uit je e-mailadres). Het zijn kleine letters, cijfers en koppeltekens, 3 tot 30 tekens.

Je profiel staat op \`app.routess.com/u/jouw-handle\`. Je kunt de handle wijzigen in **Instellingen**; let op: links naar de oude handle werken dan niet meer, en de vrijgekomen handle wordt beschikbaar voor anderen.

## Wat op een profiel staat

- Naam, handle en avatar
- Statistieken berekend over openbare routes: aantal routes, totale afstand
- Aantallen volgers en volgend
- De lijst met openbare routes

Iedereen kan een profiel bekijken, aangemeld of niet. Volger**aantallen** zijn openbaar; de werkelijke lijst van wie wie volgt is alleen zichtbaar voor jou op je eigen profiel.

## Je profiel delen

Stuur gewoon de URL. Om er routes op te krijgen, stel je hun zichtbaarheid in op **openbaar** in de [routedetails](/nl/guide/library/route-details).

Volgende: [Volgen en feed](/nl/guide/social/follow-and-feed).
`,
	},
];
