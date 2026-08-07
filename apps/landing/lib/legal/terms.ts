import { CONTROLLER, type LegalContent } from "./types";

// Terms of service for the hosted routess at routess.com / app.routess.com.
// The MIT licence governs the source code; these govern the service we run.
export const UPDATED = "2026-08-07";

export const TERMS: LegalContent = {
	en: {
		title: "Terms of service",
		updated: UPDATED,
		updatedLabel: "Last updated",
		tocLabel: "On this page",
		intro:
			"These terms cover the routess service we host at routess.com, routess.be and app.routess.com. The source code is separately available under the MIT licence, and if you run your own instance these terms do not apply to it.",
		sections: [
			{
				id: "who-we-are",
				h: "Who you are agreeing with",
				blocks: [
					{
						kind: "p",
						text: `routess is operated by ${CONTROLLER.name}, ${CONTROLLER.registeredAddress}, ${CONTROLLER.country} (enterprise number ${CONTROLLER.enterpriseNumber}). By creating an account or using the service you accept these terms. If you do not, please do not use it.`,
					},
					{
						kind: "p",
						text: `Questions about these terms go to ${CONTROLLER.supportEmail}. Privacy questions are answered in the privacy policy and at ${CONTROLLER.privacyEmail}.`,
					},
				],
			},
			{
				id: "the-service",
				h: "What routess is",
				blocks: [
					{
						kind: "p",
						text: "routess is a route planner for cyclists, runners and hikers. It is free to use. We may add, change or remove features, and we may introduce paid plans in future, but we will not start charging for something you already have without telling you first.",
					},
				],
			},
			{
				id: "your-account",
				h: "Your account",
				blocks: [
					{
						kind: "p",
						text: "You need an account to save routes. You must be at least 16 years old, give an email address that reaches you, and keep your credentials to yourself. You are responsible for what happens under your account. Tell us promptly if you think someone else has access, and revoke the session from your settings.",
					},
					{
						kind: "p",
						text: "One person, one account. Do not impersonate somebody else, and do not pick a handle designed to make people think you are someone you are not.",
					},
				],
			},
			{
				id: "acceptable-use",
				h: "Acceptable use",
				blocks: [
					{ kind: "p", text: "Use routess for planning routes. Do not:" },
					{
						kind: "ul",
						items: [
							"Upload content that is unlawful, harassing, hateful, or infringes somebody's rights",
							"Publish routes or descriptions that reveal another person's home or movements without their agreement",
							"Scrape, crawl or bulk-download other users' content, or use the API to build a mirror of it",
							"Attempt to break, overload, or gain unauthorised access to the service or anyone's account",
							"Circumvent rate limits, or use automation that degrades the service for other people",
						],
					},
					{
						kind: "p",
						text: "The public API is there to be used. Use it at a sane rate, identify your client honestly, and do not route it around the limits we publish.",
					},
				],
			},
			{
				id: "your-content",
				h: "Your routes stay yours",
				blocks: [
					{
						kind: "p",
						text: "You keep every right you have in the routes, names, descriptions and other content you create. We claim no ownership.",
					},
					{
						kind: "p",
						text: "You give us the limited permission we need to run the service: to store your content, back it up, and display it to you. If you mark a route unlisted or public, that permission extends to showing it to the people you have chosen to show it to, including on public pages and in Discover. Set a route back to private and that extension ends, other than copies already cached elsewhere on the internet.",
					},
					{
						kind: "p",
						text: "You confirm you have the right to upload what you upload, including any GPX file you import from another service.",
					},
				],
			},
			{
				id: "map-data",
				h: "Map and routing data",
				blocks: [
					{
						kind: "p",
						text: "Routing, elevation and the node networks are derived from OpenStreetMap, © OpenStreetMap contributors, available under the Open Database Licence. Map tiles, search and terrain come from Mapbox and are subject to Mapbox's own terms. If you export or republish data derived from OpenStreetMap, the ODbL attribution and share-alike conditions travel with it.",
					},
				],
			},
			{
				id: "safety",
				h: "Routes are suggestions, not instructions",
				blocks: [
					{
						kind: "p",
						text: "This is the part that actually matters. A generated or planned route is a suggestion computed from map data that can be incomplete, outdated or simply wrong. It does not know about roadworks, a washed-out bridge, a private gate, a seasonal closure, traffic, weather, or whether a path is sensible for you on the day.",
					},
					{
						kind: "p",
						text: "You are responsible for your own safety and for obeying the law where you are riding, running or walking. Judge the road in front of you over the line on the screen. Surface classifications, distances, elevation figures and turn-by-turn cues are estimates. Do not rely on routess where being wrong would be dangerous.",
					},
				],
			},
			{
				id: "availability",
				h: "Availability",
				blocks: [
					{
						kind: "p",
						text: "routess is provided as-is and as-available, without warranties of any kind. It is a free service run by a small operation. We do not promise a particular uptime, and we may take it down for maintenance, or permanently, though we would give notice and time to export before shutting the hosted service down.",
					},
					{
						kind: "p",
						text: "Keep your own copies of anything you cannot afford to lose. The export in your settings gives you every route as GPX plus your full account as JSON, and it is the reason self-hosting exists.",
					},
				],
			},
			{
				id: "termination",
				h: "Ending things",
				blocks: [
					{
						kind: "p",
						text: "You can delete your account at any time from your settings. Deletion has a 30-day grace window, after which it is permanent and we cannot recover your routes.",
					},
					{
						kind: "p",
						text: "We may suspend or terminate an account that breaks these terms, or that we are legally required to remove. Except where the breach is serious or ongoing, we will tell you why and give you a chance to export your data first.",
					},
				],
			},
			{
				id: "liability",
				h: "Liability",
				blocks: [
					{
						kind: "p",
						text: "To the maximum extent the law allows, we are not liable for indirect or consequential loss, lost data, lost profits, or anything arising from your reliance on a route. Nothing here limits liability that cannot be limited by law, including for death or personal injury caused by negligence, or for fraud.",
					},
					{
						kind: "p",
						text: "If you are a consumer in the European Union, you keep every mandatory statutory right you have. Nothing in these terms takes those away.",
					},
				],
			},
			{
				id: "changes",
				h: "Changes to these terms",
				blocks: [
					{
						kind: "p",
						text: "We update the date at the top when these terms change. For material changes we will notify account holders by email at least 30 days beforehand, and continuing to use routess after that counts as acceptance. If you disagree, delete your account and export your data.",
					},
				],
			},
			{
				id: "law",
				h: "Governing law",
				blocks: [
					{
						kind: "p",
						text: `These terms are governed by the law of ${CONTROLLER.country}, and disputes go to the courts with jurisdiction there. If you are a consumer, this does not deprive you of the protection of the mandatory law of the country you live in, nor of the right to bring proceedings there.`,
					},
				],
			},
		],
	},
	nl: {
		title: "Gebruiksvoorwaarden",
		updated: UPDATED,
		updatedLabel: "Laatst bijgewerkt",
		tocLabel: "Op deze pagina",
		intro:
			"Deze voorwaarden gelden voor de routess-dienst die wij hosten op routess.com, routess.be en app.routess.com. De broncode is apart beschikbaar onder de MIT-licentie, en draai je je eigen instantie, dan gelden deze voorwaarden daar niet.",
		sections: [
			{
				id: "who-we-are",
				h: "Met wie je een overeenkomst sluit",
				blocks: [
					{
						kind: "p",
						text: `routess wordt beheerd door ${CONTROLLER.name}, ${CONTROLLER.registeredAddress}, ${CONTROLLER.country} (ondernemingsnummer ${CONTROLLER.enterpriseNumber}). Door een account aan te maken of de dienst te gebruiken aanvaard je deze voorwaarden. Doe je dat niet, gebruik de dienst dan niet.`,
					},
					{
						kind: "p",
						text: `Vragen over deze voorwaarden gaan naar ${CONTROLLER.supportEmail}. Privacyvragen worden beantwoord in het privacybeleid en op ${CONTROLLER.privacyEmail}.`,
					},
				],
			},
			{
				id: "the-service",
				h: "Wat routess is",
				blocks: [
					{
						kind: "p",
						text: "routess is een route-planner voor fietsers, lopers en wandelaars. Het gebruik is gratis. We kunnen functies toevoegen, wijzigen of weghalen, en we kunnen later betalende plannen invoeren, maar we beginnen niets aan te rekenen wat je al hebt zonder het eerst te zeggen.",
					},
				],
			},
			{
				id: "your-account",
				h: "Je account",
				blocks: [
					{
						kind: "p",
						text: "Je hebt een account nodig om routes te bewaren. Je moet minstens 16 jaar zijn, een e-mailadres opgeven dat je bereikt, en je inloggegevens voor jezelf houden. Jij bent verantwoordelijk voor wat er onder je account gebeurt. Laat het ons snel weten als je denkt dat iemand anders toegang heeft, en trek de sessie in via je instellingen.",
					},
					{
						kind: "p",
						text: "Eén persoon, één account. Doe je niet voor als iemand anders, en kies geen handle die mensen moet doen denken dat je iemand bent die je niet bent.",
					},
				],
			},
			{
				id: "acceptable-use",
				h: "Aanvaardbaar gebruik",
				blocks: [
					{ kind: "p", text: "Gebruik routess om routes te plannen. Doe niet het volgende:" },
					{
						kind: "ul",
						items: [
							"Inhoud uploaden die onwettig is, intimiderend, haatdragend, of andermans rechten schendt",
							"Routes of beschrijvingen publiceren die de woonplaats of bewegingen van iemand anders prijsgeven zonder diens akkoord",
							"De inhoud van andere gebruikers scrapen, crawlen of in bulk downloaden, of de API gebruiken om er een kopie van te bouwen",
							"Proberen de dienst of iemands account te breken, te overbelasten, of er onbevoegd toegang toe te krijgen",
							"Rate limits omzeilen, of automatisering gebruiken die de dienst voor anderen verslechtert",
						],
					},
					{
						kind: "p",
						text: "De publieke API is er om gebruikt te worden. Gebruik ze aan een redelijk tempo, identificeer je client eerlijk, en omzeil de gepubliceerde limieten niet.",
					},
				],
			},
			{
				id: "your-content",
				h: "Je routes blijven van jou",
				blocks: [
					{
						kind: "p",
						text: "Je behoudt elk recht dat je hebt op de routes, namen, beschrijvingen en andere inhoud die je maakt. Wij claimen geen eigendom.",
					},
					{
						kind: "p",
						text: "Je geeft ons de beperkte toestemming die we nodig hebben om de dienst te draaien: je inhoud bewaren, back-uppen, en aan jou tonen. Markeer je een route als niet-vermeld of publiek, dan strekt die toestemming zich uit tot het tonen aan de mensen aan wie jij ze wil tonen, ook op publieke pagina's en in Ontdek. Zet je een route terug op privé, dan eindigt die uitbreiding, behalve voor kopieën die elders op het internet al in cache staan.",
					},
					{
						kind: "p",
						text: "Je bevestigt dat je het recht hebt om te uploaden wat je uploadt, inclusief elk GPX-bestand dat je vanuit een andere dienst importeert.",
					},
				],
			},
			{
				id: "map-data",
				h: "Kaart- en routedata",
				blocks: [
					{
						kind: "p",
						text: "Routering, hoogte en de knooppuntennetwerken zijn afgeleid van OpenStreetMap, © OpenStreetMap-bijdragers, beschikbaar onder de Open Database Licence. Kaarttegels, zoeken en terrein komen van Mapbox en vallen onder de eigen voorwaarden van Mapbox. Exporteer of herpubliceer je data afgeleid van OpenStreetMap, dan reizen de ODbL-voorwaarden rond naamsvermelding en gelijk delen mee.",
					},
				],
			},
			{
				id: "safety",
				h: "Routes zijn suggesties, geen instructies",
				blocks: [
					{
						kind: "p",
						text: "Dit is het deel dat er echt toe doet. Een gegenereerde of geplande route is een suggestie, berekend uit kaartdata die onvolledig, verouderd of gewoon fout kan zijn. Ze weet niets van wegenwerken, een weggespoelde brug, een private poort, een seizoensafsluiting, verkeer, weer, of dat een pad die dag verstandig is voor jou.",
					},
					{
						kind: "p",
						text: "Jij bent verantwoordelijk voor je eigen veiligheid en voor het naleven van de regels waar je fietst, loopt of wandelt. Beoordeel de weg voor je boven de lijn op het scherm. Ondergrondclassificaties, afstanden, hoogtemeters en afslagaanwijzingen zijn schattingen. Vertrouw niet op routess waar fout zitten gevaarlijk zou zijn.",
					},
				],
			},
			{
				id: "availability",
				h: "Beschikbaarheid",
				blocks: [
					{
						kind: "p",
						text: "routess wordt geleverd zoals het is en zoals het beschikbaar is, zonder garanties van welke aard ook. Het is een gratis dienst, gedraaid door een kleine ploeg. We beloven geen bepaalde uptime, en we kunnen de dienst offline halen voor onderhoud, of definitief, al zouden we bij het stopzetten van de gehoste dienst vooraf verwittigen en tijd geven om te exporteren.",
					},
					{
						kind: "p",
						text: "Hou eigen kopieën van alles wat je niet kan missen. De export in je instellingen geeft je elke route als GPX plus je volledige account als JSON, en dat is precies waarom zelf hosten bestaat.",
					},
				],
			},
			{
				id: "termination",
				h: "Stoppen",
				blocks: [
					{
						kind: "p",
						text: "Je kan je account op elk moment verwijderen via je instellingen. Verwijdering heeft een respijtperiode van 30 dagen, daarna is ze definitief en kunnen we je routes niet meer herstellen.",
					},
					{
						kind: "p",
						text: "Wij kunnen een account schorsen of beëindigen dat deze voorwaarden schendt, of dat we wettelijk moeten verwijderen. Behalve wanneer de schending ernstig of aanhoudend is, zeggen we waarom en geven we je eerst de kans om je data te exporteren.",
					},
				],
			},
			{
				id: "liability",
				h: "Aansprakelijkheid",
				blocks: [
					{
						kind: "p",
						text: "Voor zover de wet dat toelaat zijn we niet aansprakelijk voor indirecte of gevolgschade, verloren data, gederfde winst, of iets dat voortvloeit uit je vertrouwen op een route. Niets hier beperkt aansprakelijkheid die wettelijk niet beperkt kan worden, waaronder voor overlijden of lichamelijk letsel door nalatigheid, of voor bedrog.",
					},
					{
						kind: "p",
						text: "Ben je consument in de Europese Unie, dan behoud je elk dwingend wettelijk recht dat je hebt. Niets in deze voorwaarden neemt die weg.",
					},
				],
			},
			{
				id: "changes",
				h: "Wijzigingen aan deze voorwaarden",
				blocks: [
					{
						kind: "p",
						text: "We passen de datum bovenaan aan wanneer deze voorwaarden wijzigen. Bij wezenlijke wijzigingen verwittigen we accounthouders minstens 30 dagen op voorhand per e-mail, en routess daarna blijven gebruiken geldt als aanvaarding. Ben je het er niet mee eens, verwijder dan je account en exporteer je data.",
					},
				],
			},
			{
				id: "law",
				h: "Toepasselijk recht",
				blocks: [
					{
						kind: "p",
						text: "Deze voorwaarden worden beheerst door het recht van België, en geschillen gaan naar de bevoegde rechtbanken daar. Ben je consument, dan ontneemt dit je niet de bescherming van het dwingend recht van het land waar je woont, noch het recht om daar een procedure te starten.",
					},
				],
			},
		],
	},
};
