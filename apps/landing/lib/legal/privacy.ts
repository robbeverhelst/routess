import { CONTROLLER, type LegalContent } from "./types";

// Whole-service privacy policy: the marketing site, the app, the docs, and the
// public API. Self-hosted instances are explicitly out of scope, because their
// operator is the controller, not us.
//
// Every factual claim here is meant to be checkable against the code. If you
// change what is collected, who receives it, or how long it is kept, change
// this file in the same PR.
export const UPDATED = "2026-08-07";

export const PRIVACY: LegalContent = {
	en: {
		title: "Privacy policy",
		updated: UPDATED,
		updatedLabel: "Last updated",
		tocLabel: "On this page",
		intro:
			"This policy explains what routess collects, why, who else sees it, and how to make us delete it. It covers routess.com, routess.be, the app at app.routess.com, the docs, and the public API. It is written to be read, not to be survived.",
		sections: [
			{
				id: "who-we-are",
				h: "Who we are",
				blocks: [
					{
						kind: "p",
						text: `routess is operated by ${CONTROLLER.name}, ${CONTROLLER.registeredAddress}, ${CONTROLLER.country.en} (enterprise number ${CONTROLLER.enterpriseNumber}). We are the data controller for everything described below.`,
					},
					{
						kind: "p",
						text: `For anything privacy related, including access, correction, or deletion requests, email ${CONTROLLER.privacyEmail}. We answer within 30 days. Please do not send personal data through the public GitHub issue tracker.`,
					},
				],
			},
			{
				id: "what-we-collect",
				h: "What we collect and why",
				blocks: [
					{
						kind: "p",
						text: "We collect what the service needs to work, and product analytics to understand what to build next. Nothing is sold, and nothing goes to advertisers.",
					},
					{
						kind: "table",
						head: ["What", "Why", "Legal basis"],
						rows: [
							[
								"Name and email address, from Google sign-in or email signup",
								"To create and secure your account, and to send transactional email such as verification and password resets",
								"Performance of a contract (Art. 6(1)(b))",
							],
							[
								"Your handle, and your avatar if you have one",
								"The public address of your profile. Generated from your display name at signup, never from your email",
								"Performance of a contract (Art. 6(1)(b))",
							],
							[
								"Password hash, if you signed up with email rather than Google",
								"To authenticate you. We never store the password itself",
								"Performance of a contract (Art. 6(1)(b))",
							],
							[
								"Your routes and collections: waypoints, geometry, name, description, activity, tags, visibility",
								"They are the product. We store them so you can come back to them",
								"Performance of a contract (Art. 6(1)(b))",
							],
							[
								"Session records: an identifier, your IP address, your browser user agent, and the time of last activity",
								"To keep you signed in, to show you your active devices, and to let you and us spot suspicious sign-ins",
								"Performance of a contract and legitimate interest in security (Art. 6(1)(b) and (f))",
							],
							[
								"Product analytics events, described in detail below",
								"To understand which features get used and where people get stuck",
								"Legitimate interest (Art. 6(1)(f)), with an opt-out in settings",
							],
							[
								"Browser error reports and performance traces",
								"To find and fix crashes and slow pages",
								"Legitimate interest (Art. 6(1)(f))",
							],
							[
								"Your approximate location, only if you grant the browser permission",
								"To centre the map on you and to start a generated loop from where you are. It is used in the moment and not stored on our servers",
								"Consent, given through your browser (Art. 6(1)(a))",
							],
						],
					},
				],
			},
			{
				id: "analytics",
				h: "Product analytics",
				blocks: [
					{
						kind: "p",
						text: "We use Umami, which we run ourselves on our own infrastructure. No third party receives this data and it is never used for advertising. Umami sets no cookies and does not fingerprint your device.",
					},
					{
						kind: "p",
						text: "Beyond page views, the app records named product events such as creating a route, importing a GPX file, or copying a share link. Each event carries context: the activity, distance and waypoint count of a route, the visibility you chose, your interface language, theme and unit preference, and the app version. Search terms are recorded only as a length bucket, never as the text you typed.",
					},
					{
						kind: "p",
						text: "If you are signed in, events also carry a pseudonymous identifier: a salted SHA-256 hash of your account ID. The salt lives only on our server and is never sent to your browser, so the hash cannot be reversed by anyone reading our JavaScript. It does let us follow one person's journey across sessions and devices, which is why we treat it as personal data rather than calling it anonymous.",
					},
					{
						kind: "p",
						text: "You can turn all of this off. Open Settings, then Privacy and sharing, and switch off usage analytics. Nothing is sent after that, including page views. We also honour your browser's Do Not Track setting automatically. This is your right to object under Art. 21, and you do not need to give a reason.",
					},
				],
			},
			{
				id: "error-reporting",
				h: "Error reporting",
				blocks: [
					{
						kind: "p",
						text: "When something breaks in the app, your browser sends us a crash report so we can fix it. We use the Sentry SDK pointed at a GlitchTip instance we run ourselves. No third party receives these reports.",
					},
					{
						kind: "p",
						text: "A report contains the error, a stack trace, the page you were on, recent interactions, and the shape of what you were editing: how many waypoints, how far, which mode. It does not contain your route coordinates, your email, or your name. Authentication tokens are stripped from URLs before sending, and reports are tagged with the same pseudonymous hash the analytics use, not your account ID.",
					},
				],
			},
			{
				id: "recipients",
				h: "Who else receives your data",
				blocks: [
					{
						kind: "p",
						text: "Most of our stack runs on our own infrastructure. These are the outside services that necessarily see something, and what they see:",
					},
					{
						kind: "table",
						head: ["Service", "What it receives", "Where"],
						rows: [
							[
								"Mapbox",
								"Map tiles, place search, address lookup, and terrain data are requested by your browser directly, so Mapbox sees your IP address, the part of the map you are looking at, what you type into search, and the coordinates of the route you are drawing",
								"United States",
							],
							[
								"Google",
								"If you sign in with Google, Google confirms your identity and gives us your name, email and profile picture. Google Fonts also serves the app's typefaces, so Google sees your IP address on page load",
								"United States",
							],
							["Resend", "Your email address and the contents of transactional email we send you", "United States"],
							[
								"Umami, GlitchTip, Valhalla, map tile server",
								"Analytics, error reports and route calculation all run on our own servers. Nothing leaves our infrastructure",
								"European Union",
							],
						],
					},
					{
						kind: "p",
						text: "Mapbox, Google and Resend are based in the United States. Transfers to them rely on the European Commission's adequacy decision for the EU-US Data Privacy Framework, or on Standard Contractual Clauses where that does not apply. You can ask us for a copy of the safeguards.",
					},
				],
			},
			{
				id: "staff-access",
				h: "Administrator access",
				blocks: [
					{
						kind: "p",
						text: "We would rather tell you this plainly than let you assume otherwise. routess has an admin panel, and the small number of people with admin rights can, when they use it:",
					},
					{
						kind: "ul",
						items: [
							"Search all accounts by name or email address",
							"See your active sessions, including the IP addresses and browsers you signed in from",
							"Open any route, including your private ones, and see its full waypoints and geometry",
							"Delete or restore accounts and routes, and sign a device out",
						],
					},
					{
						kind: "p",
						text: "This exists for support, moderation and abuse handling, not for browsing. Every admin action is written to an audit log recording who did what, to which record, and when. Private means private from other users; it does not mean encrypted against us. If that matters to you, self-hosting gives you a copy where nobody but you holds the keys.",
					},
				],
			},
			{
				id: "public-content",
				h: "What becomes public when you share",
				blocks: [
					{
						kind: "p",
						text: "Every route starts private. You choose, per route, whether to make it unlisted or public. Nothing changes visibility on its own.",
					},
					{
						kind: "ul",
						items: [
							"Private: only you and administrators can see it.",
							"Unlisted: anyone with the link can see it. It is not listed anywhere and we ask search engines not to index it.",
							"Public: it appears in Discover, on your profile, and search engines may index it. Its geometry, name, description, tags and your handle, display name and avatar are all visible to anyone.",
						],
					},
					{
						kind: "p",
						text: "A public route reveals where you have been. If a route starts at your front door, so does the map. Consider trimming the start and end of routes you publish. Who you follow, and who follows you, is visible on your profile. Changing a route back to private removes it from public pages, but search engines may keep a cached copy for a while, which is outside our control.",
					},
				],
			},
			{
				id: "retention",
				h: "How long we keep things",
				blocks: [
					{
						kind: "table",
						head: ["What", "How long"],
						rows: [
							[
								"Your account, routes and collections",
								"Until you delete your account. Deletion has a 30-day grace window in which you can change your mind by signing in again; after that everything is permanently erased",
							],
							[
								"Sessions, including IP address and user agent",
								"7 days from last activity. Expired sessions are purged automatically every hour",
							],
							["Email verification links", "24 hours"],
							["Password reset links", "30 minutes"],
							[
								"Product analytics events",
								"14 months. Your events are also erased when your account is permanently deleted",
							],
							["Browser error reports", "90 days"],
							["Administrator audit logs", "12 months"],
							[
								"Cached route calculations",
								"7 days, or 30 days for surface analysis. These are keyed by coordinates and are not linked to your account",
							],
						],
					},
				],
			},
			{
				id: "your-rights",
				h: "Your rights",
				blocks: [
					{
						kind: "p",
						text: "Under the GDPR you have the right to access your data, correct it, have it erased, restrict or object to how we use it, and receive it in a portable format. Where we rely on consent, you can withdraw it at any time without affecting what came before.",
					},
					{
						kind: "p",
						text:
							"Two of these you can exercise yourself, immediately, without asking us. Your profile settings include a full export of your account as JSON plus a GPX file per route, and a delete-my-account button. For anything else, email " +
							CONTROLLER.privacyEmail +
							".",
					},
					{
						kind: "p",
						text: "If you think we have got this wrong, you can complain to your local data protection authority. In Belgium that is the Gegevensbeschermingsautoriteit / Autorité de protection des données, Drukpersstraat 35, 1000 Brussels, gegevensbeschermingsautoriteit.be. We would rather you told us first, but it is your call.",
					},
				],
			},
			{
				id: "cookies",
				h: "Cookies and local storage",
				blocks: [
					{
						kind: "p",
						text: "routess sets one cookie: a session cookie that keeps you signed in. It is httpOnly, so scripts cannot read it, and it is strictly necessary for the service to function, which is why there is no cookie banner asking you about it.",
					},
					{
						kind: "p",
						text: "The app also uses your browser's local storage for your own settings, such as units, map style and your analytics preference, and for a copy of your profile so the interface can render before the network responds. That data stays in your browser. Our analytics sets no cookies at all.",
					},
				],
			},
			{
				id: "children",
				h: "Children",
				blocks: [
					{
						kind: "p",
						text: "routess is not directed at children under 16. We do not knowingly collect their data. If you believe a child has created an account, email us and we will remove it.",
					},
				],
			},
			{
				id: "automated-decisions",
				h: "Automated decision-making",
				blocks: [
					{
						kind: "p",
						text: "We do not make automated decisions that produce legal effects for you, and we do not profile you for advertising. Route generation and search ranking are algorithms applied to map data, not judgements about you.",
					},
				],
			},
			{
				id: "self-hosting",
				h: "If you self-host routess",
				blocks: [
					{
						kind: "p",
						text: "routess is open source and you can run your own instance. If you do, this policy does not apply to it: you are the controller of the data on your servers, and your users' rights are yours to honour. There is no phone-home in the code. Analytics and error reporting are off unless you configure them, and the map and email providers are yours to choose.",
					},
				],
			},
			{
				id: "changes",
				h: "Changes to this policy",
				blocks: [
					{
						kind: "p",
						text: "When we change this policy, we update the date at the top. If a change materially affects what we collect or who receives it, we will tell account holders by email before it takes effect. The history of this page is in the public git repository, so you can see exactly what changed and when.",
					},
				],
			},
		],
	},
	nl: {
		title: "Privacybeleid",
		updated: UPDATED,
		updatedLabel: "Laatst bijgewerkt",
		tocLabel: "Op deze pagina",
		intro:
			"Dit beleid legt uit wat routess verzamelt, waarom, wie het verder ziet, en hoe je het laat verwijderen. Het geldt voor routess.com, routess.be, de app op app.routess.com, de docs, en de publieke API. Het is geschreven om gelezen te worden, niet om doorstaan te worden.",
		sections: [
			{
				id: "who-we-are",
				h: "Wie we zijn",
				blocks: [
					{
						kind: "p",
						text: `routess wordt beheerd door ${CONTROLLER.name}, ${CONTROLLER.registeredAddress}, ${CONTROLLER.country.nl} (ondernemingsnummer ${CONTROLLER.enterpriseNumber}). Wij zijn de verwerkingsverantwoordelijke voor alles wat hieronder staat.`,
					},
					{
						kind: "p",
						text: `Voor alles rond privacy, inclusief inzage, correctie of verwijdering, mail naar ${CONTROLLER.privacyEmail}. We antwoorden binnen 30 dagen. Stuur geen persoonsgegevens via de publieke GitHub-issues.`,
					},
				],
			},
			{
				id: "what-we-collect",
				h: "Wat we verzamelen en waarom",
				blocks: [
					{
						kind: "p",
						text: "We verzamelen wat de dienst nodig heeft om te werken, plus productstatistieken om te weten wat we hierna moeten bouwen. Niets wordt verkocht, en er gaat niets naar adverteerders.",
					},
					{
						kind: "table",
						head: ["Wat", "Waarom", "Rechtsgrond"],
						rows: [
							[
								"Naam en e-mailadres, via Google-login of e-mailregistratie",
								"Om je account aan te maken en te beveiligen, en om transactionele mail te sturen zoals verificatie en wachtwoordherstel",
								"Uitvoering van een overeenkomst (art. 6(1)(b))",
							],
							[
								"Je handle, en je avatar als je die hebt",
								"Het publieke adres van je profiel. Gegenereerd uit je weergavenaam bij registratie, nooit uit je e-mailadres",
								"Uitvoering van een overeenkomst (art. 6(1)(b))",
							],
							[
								"Wachtwoord-hash, als je met e-mail registreerde in plaats van met Google",
								"Om je te authenticeren. We bewaren het wachtwoord zelf nooit",
								"Uitvoering van een overeenkomst (art. 6(1)(b))",
							],
							[
								"Je routes en collecties: waypoints, geometrie, naam, beschrijving, activiteit, tags, zichtbaarheid",
								"Dat is het product. We bewaren ze zodat je erop terug kan komen",
								"Uitvoering van een overeenkomst (art. 6(1)(b))",
							],
							[
								"Sessiegegevens: een identifier, je IP-adres, je browser-user-agent, en het tijdstip van laatste activiteit",
								"Om je ingelogd te houden, je actieve toestellen te tonen, en jou en ons verdachte logins te laten opmerken",
								"Uitvoering van een overeenkomst en gerechtvaardigd belang bij beveiliging (art. 6(1)(b) en (f))",
							],
							[
								"Productstatistieken, hieronder in detail beschreven",
								"Om te begrijpen welke functies gebruikt worden en waar mensen vastlopen",
								"Gerechtvaardigd belang (art. 6(1)(f)), met een opt-out in de instellingen",
							],
							[
								"Browserfoutmeldingen en prestatiemetingen",
								"Om crashes en trage pagina's te vinden en op te lossen",
								"Gerechtvaardigd belang (art. 6(1)(f))",
							],
							[
								"Je bij benadering locatie, alleen als je de browser toestemming geeft",
								"Om de kaart op jou te centreren en een gegenereerde lus te laten starten waar je bent. Het wordt op dat moment gebruikt en niet op onze servers bewaard",
								"Toestemming, gegeven via je browser (art. 6(1)(a))",
							],
						],
					},
				],
			},
			{
				id: "analytics",
				h: "Productstatistieken",
				blocks: [
					{
						kind: "p",
						text: "We gebruiken Umami, dat we zelf draaien op onze eigen infrastructuur. Geen enkele derde partij krijgt deze data en ze wordt nooit voor advertenties gebruikt. Umami plaatst geen cookies en maakt geen vingerafdruk van je toestel.",
					},
					{
						kind: "p",
						text: "Naast paginaweergaves registreert de app benoemde productgebeurtenissen, zoals een route aanmaken, een GPX-bestand importeren, of een deel-link kopiëren. Elke gebeurtenis draagt context mee: de activiteit, afstand en het aantal waypoints van een route, de zichtbaarheid die je koos, je taal, thema en eenheden, en de app-versie. Zoektermen worden enkel als lengte-categorie geregistreerd, nooit als de tekst die je typte.",
					},
					{
						kind: "p",
						text: "Als je ingelogd bent, dragen gebeurtenissen ook een pseudonieme identifier: een gezouten SHA-256-hash van je account-ID. Het zout staat enkel op onze server en gaat nooit naar je browser, dus niemand kan de hash omkeren door onze JavaScript te lezen. Het laat ons wel iemands traject over sessies en toestellen heen volgen, en daarom behandelen we het als persoonsgegeven in plaats van het anoniem te noemen.",
					},
					{
						kind: "p",
						text: "Je kan dit volledig uitzetten. Ga naar Instellingen, dan Privacy & delen, en zet gebruiksstatistieken uit. Daarna wordt er niets meer verstuurd, ook geen paginaweergaves. We respecteren automatisch ook de Do Not Track-instelling van je browser. Dit is je recht van bezwaar onder art. 21, en je hoeft geen reden te geven.",
					},
				],
			},
			{
				id: "error-reporting",
				h: "Foutrapportage",
				blocks: [
					{
						kind: "p",
						text: "Als er iets stukgaat in de app, stuurt je browser ons een crashrapport zodat we het kunnen oplossen. We gebruiken de Sentry-SDK gericht op een GlitchTip die we zelf draaien. Geen enkele derde partij krijgt deze rapporten.",
					},
					{
						kind: "p",
						text: "Een rapport bevat de fout, een stack trace, de pagina waar je was, recente handelingen, en de vorm van wat je aan het bewerken was: hoeveel waypoints, hoe ver, welke modus. Het bevat niet je routecoördinaten, je e-mailadres of je naam. Authenticatietokens worden uit URLs gestript voor verzending, en rapporten dragen dezelfde pseudonieme hash als de statistieken, niet je account-ID.",
					},
				],
			},
			{
				id: "recipients",
				h: "Wie je data verder ontvangt",
				blocks: [
					{
						kind: "p",
						text: "Het grootste deel van onze stack draait op onze eigen infrastructuur. Dit zijn de externe diensten die noodzakelijk iets zien, en wat ze zien:",
					},
					{
						kind: "table",
						head: ["Dienst", "Wat ze ontvangen", "Waar"],
						rows: [
							[
								"Mapbox",
								"Kaarttegels, plaatszoeken, adres-opzoeking en hoogtedata worden rechtstreeks door je browser opgevraagd, dus Mapbox ziet je IP-adres, het stuk kaart waar je naar kijkt, wat je in de zoekbalk typt, en de coördinaten van de route die je tekent",
								"Verenigde Staten",
							],
							[
								"Google",
								"Als je met Google inlogt, bevestigt Google je identiteit en geeft ons je naam, e-mailadres en profielfoto. Google Fonts levert ook de lettertypes van de app, dus Google ziet je IP-adres bij het laden",
								"Verenigde Staten",
							],
							["Resend", "Je e-mailadres en de inhoud van transactionele mail die we je sturen", "Verenigde Staten"],
							[
								"Umami, GlitchTip, Valhalla, kaarttegelserver",
								"Statistieken, foutrapporten en routeberekening draaien allemaal op onze eigen servers. Er verlaat niets onze infrastructuur",
								"Europese Unie",
							],
						],
					},
					{
						kind: "p",
						text: "Mapbox, Google en Resend zitten in de Verenigde Staten. Doorgiftes naar hen steunen op het adequaatheidsbesluit van de Europese Commissie voor het EU-US Data Privacy Framework, of op modelcontractbepalingen waar dat niet geldt. Je kan bij ons een kopie van de waarborgen opvragen.",
					},
				],
			},
			{
				id: "staff-access",
				h: "Toegang door beheerders",
				blocks: [
					{
						kind: "p",
						text: "We vertellen dit liever rechtuit dan je iets anders te laten aannemen. routess heeft een adminpaneel, en het kleine aantal mensen met adminrechten kan daarmee:",
					},
					{
						kind: "ul",
						items: [
							"Alle accounts doorzoeken op naam of e-mailadres",
							"Je actieve sessies zien, inclusief de IP-adressen en browsers waarmee je inlogde",
							"Elke route openen, ook je privéroutes, met alle waypoints en geometrie",
							"Accounts en routes verwijderen of herstellen, en een toestel uitloggen",
						],
					},
					{
						kind: "p",
						text: "Dit bestaat voor support, moderatie en misbruikafhandeling, niet om rond te neuzen. Elke adminhandeling gaat naar een auditlog met wie wat deed, bij welk record, en wanneer. Privé betekent privé voor andere gebruikers; het betekent niet versleuteld tegen ons. Als dat voor jou uitmaakt, geeft zelf hosten je een kopie waarvan enkel jij de sleutels hebt.",
					},
				],
			},
			{
				id: "public-content",
				h: "Wat publiek wordt als je deelt",
				blocks: [
					{
						kind: "p",
						text: "Elke route begint privé. Je kiest per route of je die niet-vermeld of publiek maakt. Niets verandert vanzelf van zichtbaarheid.",
					},
					{
						kind: "ul",
						items: [
							"Privé: enkel jij en beheerders zien ze.",
							"Niet-vermeld: iedereen met de link ziet ze. Ze staat nergens in een lijst en we vragen zoekmachines ze niet te indexeren.",
							"Publiek: ze verschijnt in Ontdek, op je profiel, en zoekmachines mogen ze indexeren. De geometrie, naam, beschrijving, tags en je handle, weergavenaam en avatar zijn voor iedereen zichtbaar.",
						],
					},
					{
						kind: "p",
						text: "Een publieke route verraadt waar je geweest bent. Als een route aan je voordeur begint, doet de kaart dat ook. Overweeg om het begin en einde van routes die je publiceert in te korten. Wie jij volgt, en wie jou volgt, staat op je profiel. Een route terugzetten naar privé haalt ze van de publieke pagina's, maar zoekmachines kunnen nog even een kopie in cache houden, en dat ligt buiten onze controle.",
					},
				],
			},
			{
				id: "retention",
				h: "Hoe lang we dingen bewaren",
				blocks: [
					{
						kind: "table",
						head: ["Wat", "Hoe lang"],
						rows: [
							[
								"Je account, routes en collecties",
								"Tot je je account verwijdert. Verwijdering heeft een respijtperiode van 30 dagen waarin je je kan bedenken door opnieuw in te loggen; daarna wordt alles definitief gewist",
							],
							[
								"Sessies, inclusief IP-adres en user agent",
								"7 dagen na de laatste activiteit. Verlopen sessies worden elk uur automatisch opgeruimd",
							],
							["E-mailverificatielinks", "24 uur"],
							["Wachtwoordherstel-links", "30 minuten"],
							[
								"Productstatistieken",
								"14 maanden. Je gebeurtenissen worden ook gewist wanneer je account definitief verwijderd wordt",
							],
							["Browserfoutrapporten", "90 dagen"],
							["Auditlogs van beheerders", "12 maanden"],
							[
								"Berekende routes in cache",
								"7 dagen, of 30 dagen voor ondergrondanalyse. Die zijn gekoppeld aan coördinaten, niet aan je account",
							],
						],
					},
				],
			},
			{
				id: "your-rights",
				h: "Je rechten",
				blocks: [
					{
						kind: "p",
						text: "Onder de AVG heb je recht op inzage in je gegevens, correctie, wissing, beperking van of bezwaar tegen het gebruik ervan, en op overdraagbaarheid. Waar we op toestemming steunen, kan je die op elk moment intrekken zonder dat dat het verleden aantast.",
					},
					{
						kind: "p",
						text:
							"Twee daarvan kan je meteen zelf uitoefenen, zonder het ons te vragen. In je profielinstellingen zit een volledige export van je account als JSON plus een GPX-bestand per route, en een knop om je account te verwijderen. Voor al de rest, mail " +
							CONTROLLER.privacyEmail +
							".",
					},
					{
						kind: "p",
						text: "Als je vindt dat we dit verkeerd aanpakken, kan je klacht indienen bij je lokale toezichthouder. In België is dat de Gegevensbeschermingsautoriteit, Drukpersstraat 35, 1000 Brussel, gegevensbeschermingsautoriteit.be. We horen het liever eerst van jou, maar dat is jouw keuze.",
					},
				],
			},
			{
				id: "cookies",
				h: "Cookies en lokale opslag",
				blocks: [
					{
						kind: "p",
						text: "routess plaatst één cookie: een sessiecookie die je ingelogd houdt. Die is httpOnly, dus scripts kunnen hem niet lezen, en hij is strikt noodzakelijk om de dienst te laten werken. Daarom is er geen cookiebanner die je ernaar vraagt.",
					},
					{
						kind: "p",
						text: "De app gebruikt ook de lokale opslag van je browser voor je eigen instellingen, zoals eenheden, kaartstijl en je statistiekenvoorkeur, en voor een kopie van je profiel zodat de interface al kan tekenen voor het netwerk antwoordt. Die data blijft in je browser. Onze statistieken plaatsen helemaal geen cookies.",
					},
				],
			},
			{
				id: "children",
				h: "Kinderen",
				blocks: [
					{
						kind: "p",
						text: "routess richt zich niet op kinderen onder 16. We verzamelen niet bewust hun gegevens. Denk je dat een kind een account heeft aangemaakt, mail ons en we verwijderen het.",
					},
				],
			},
			{
				id: "automated-decisions",
				h: "Geautomatiseerde besluitvorming",
				blocks: [
					{
						kind: "p",
						text: "We nemen geen geautomatiseerde beslissingen met rechtsgevolgen voor jou, en we profileren je niet voor advertenties. Routegeneratie en zoekvolgorde zijn algoritmes op kaartdata, geen oordelen over jou.",
					},
				],
			},
			{
				id: "self-hosting",
				h: "Als je routess zelf host",
				blocks: [
					{
						kind: "p",
						text: "routess is open source en je kan je eigen instantie draaien. Doe je dat, dan geldt dit beleid daar niet: jij bent de verwerkingsverantwoordelijke voor de data op jouw servers, en de rechten van jouw gebruikers zijn de jouwe om na te komen. Er zit geen phone-home in de code. Statistieken en foutrapportage staan uit tenzij je ze configureert, en de kaart- en e-mailproviders kies je zelf.",
					},
				],
			},
			{
				id: "changes",
				h: "Wijzigingen aan dit beleid",
				blocks: [
					{
						kind: "p",
						text: "Als we dit beleid wijzigen, passen we de datum bovenaan aan. Raakt een wijziging wezenlijk aan wat we verzamelen of wie het ontvangt, dan laten we accounthouders dat per e-mail weten voor ze ingaat. De geschiedenis van deze pagina staat in de publieke git-repository, dus je kan precies zien wat wanneer veranderde.",
					},
				],
			},
		],
	},
};
