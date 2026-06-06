import type { Article } from "./types";

export const komootAlternative: Article = {
	key: "komoot-alternative",
	section: "compare",
	datePublished: "2026-06-05",
	dateModified: "2026-06-05",
	content: {
		en: {
			slug: "komoot-alternative",
			metaTitle: "Komoot alternative: free, open-source route planning",
			title: "Looking for a Komoot alternative?",
			description:
				"routess is a free, open-source Komoot alternative: unlimited route planning, GPX import and export, surface and elevation data, no account needed to try it.",
			intro: [
				"routess is a free, open-source alternative to Komoot for planning cycling, running, and hiking routes: unlimited routes, GPX import and export, surface and elevation data on every route, and no account needed to try it. It does not yet match Komoot's community library or native navigation apps. Here is the honest comparison.",
			],
			blocks: [
				{ kind: "h2", text: "Why people look for an alternative" },
				{
					kind: "p",
					content: [
						"Komoot is a polished product with a huge community. The usual reasons people go looking elsewhere: since early 2025 new users need the Premium subscription for most paid features (the one-time region packs are legacy now, and even sending routes to a Garmin or Wahoo sits behind Premium), wanting route data in an open format that is not tied to one platform, and unease about where the product is heading since the company was acquired in March 2025. If none of those bother you, Komoot remains a fine choice.",
					],
				},
				{ kind: "h2", text: "What routess does better" },
				{
					kind: "ul",
					items: [
						[
							{ text: "Free, everywhere", strong: true },
							": no map unlocks, no region packs. Every feature below works worldwide without paying.",
						],
						[
							{ text: "No account to start", strong: true },
							": open the planner and click. You only need an account to save routes.",
						],
						[
							{ text: "GPX in and out, unrestricted", strong: true },
							": import from any source, export to any device, no limits.",
						],
						[
							{ text: "Surface breakdown on every route", strong: true },
							": paved, compacted, unpaved, and path segments, so you know what your tires are in for.",
						],
						[
							{ text: "Open source (MIT)", strong: true },
							": read the source, fork it, or self-host the whole thing on your own infrastructure.",
						],
						[
							{ text: "Privacy by default", strong: true },
							": no ad trackers, no behavioural profiles, only cookie-less aggregate analytics.",
						],
					],
				},
				{ kind: "h2", text: "What Komoot does better" },
				{
					kind: "ul",
					items: [
						[
							"Native iOS and Android apps with voice turn-by-turn navigation. routess runs as an installable web app on your phone, but it does not talk to you yet.",
						],
						["A massive community library of routes, highlights, and photos built over more than a decade."],
						["Mature offline maps in the mobile apps."],
						["Multi-day tour planning (a Premium feature)."],
						["Sport-specific routing profiles refined over many years, including mountain biking."],
					],
				},
				{ kind: "h2", text: "Side by side" },
				{
					kind: "table",
					headers: ["", "routess", "Komoot"],
					rows: [
						[["Price"], ["Free"], ["Free tier with one region, Premium subscription for the rest"]],
						[["Account required"], ["Only to save routes"], ["Yes"]],
						[["Open source"], ["Yes, MIT"], ["No"]],
						[["GPX import and export"], ["Free, unlimited"], ["Yes, if the route's start region is unlocked"]],
						[["Surface data"], ["Free on every route"], ["Yes"]],
						[["Voice navigation"], ["Not yet, follow the route in the web app"], ["Yes, native apps"]],
						[["Community route library"], ["Not yet, planned"], ["Yes, huge"]],
						[["Self-hosting"], ["Yes"], ["No"]],
					],
				},
				{ kind: "h2", text: "Switching from Komoot" },
				{
					kind: "p",
					content: [
						"Your planned tours are not locked in. Export any tour from Komoot as a GPX file, then import it into routess: the importer detects turns and rebuilds editable waypoints, so you can keep working on the route instead of starting over. If GPX files are new to you, the ",
						{ text: "GPX guide", href: "/guides/create-gpx-file" },
						" covers the format in two minutes.",
					],
				},
				{
					kind: "note",
					content: [
						"routess is young and moving fast. Route generation and community routes are in the works but not live yet. The comparison above only counts what works today.",
					],
				},
				{ kind: "h2", text: "Frequently asked questions" },
				{ kind: "h3", text: "Is routess really free?" },
				{
					kind: "p",
					content: [
						"Yes. The planner, saving, GPX import and export, and surface and elevation data are free, worldwide. A Pro plan with heavier extras is planned, but the planner stays free. And because it is MIT-licensed, you can always run it yourself.",
					],
				},
				{ kind: "h3", text: "Can I import my Komoot routes?" },
				{
					kind: "p",
					content: [
						"Yes, via GPX export from Komoot. Imported routes become fully editable, not a frozen line on the map.",
					],
				},
				{ kind: "h3", text: "Does routess work on my phone?" },
				{
					kind: "p",
					content: [
						"Yes. It installs as a web app from the browser, no app store needed, and you can export GPX to your watch or head unit for navigation.",
					],
				},
				{ kind: "cta", label: "Try the planner, no account needed", href: "https://app.routess.com" },
			],
		},
		nl: {
			slug: "komoot-alternatief",
			metaTitle: "Komoot-alternatief: gratis, open-source routeplanner",
			title: "Op zoek naar een Komoot-alternatief?",
			description:
				"routess is een gratis, open-source alternatief voor Komoot: onbeperkt routes plannen, GPX-import en -export, ondergrond- en hoogtedata, geen account nodig om te proberen.",
			intro: [
				"routess is een gratis, open-source alternatief voor Komoot om fiets-, loop- en wandelroutes te plannen: onbeperkt routes, GPX-import en -export, ondergrond- en hoogtedata op elke route, en geen account nodig om het te proberen. De community-bibliotheek en navigatie-apps van Komoot evenaart het nog niet. Dit is de eerlijke vergelijking.",
			],
			blocks: [
				{ kind: "h2", text: "Waarom mensen een alternatief zoeken" },
				{
					kind: "p",
					content: [
						"Komoot is een afgewerkt product met een enorme community. De gebruikelijke redenen om toch rond te kijken: sinds begin 2025 hebben nieuwe gebruikers het Premium-abonnement nodig voor de meeste betaalde functies (de eenmalige regiopakketten zijn uitdovend, en zelfs routes naar een Garmin of Wahoo sturen zit achter Premium), je routedata in een open formaat willen dat niet aan één platform vasthangt, en onzekerheid over de koers sinds de overname van het bedrijf in maart 2025. Stoort geen van die dingen je, dan blijft Komoot een prima keuze.",
					],
				},
				{ kind: "h2", text: "Wat routess beter doet" },
				{
					kind: "ul",
					items: [
						[
							{ text: "Gratis, overal", strong: true },
							": geen kaarten vrijspelen, geen regiopakketten. Alles hieronder werkt wereldwijd zonder te betalen.",
						],
						[
							{ text: "Geen account om te starten", strong: true },
							": open de planner en klik. Een account heb je alleen nodig om routes op te slaan.",
						],
						[
							{ text: "GPX in en uit, onbeperkt", strong: true },
							": importeer vanaf eender welke bron, exporteer naar eender welk toestel.",
						],
						[
							{ text: "Ondergrond op elke route", strong: true },
							": verhard, halfverhard, onverhard en paadjes, zodat je weet waar je banden aan toe zijn.",
						],
						[
							{ text: "Open source (MIT)", strong: true },
							": lees de broncode, fork het, of host alles zelf op je eigen infrastructuur.",
						],
						[
							{ text: "Privacy als standaard", strong: true },
							": geen advertentietrackers, geen gedragsprofielen, alleen cookie-loze geaggregeerde statistieken.",
						],
					],
				},
				{ kind: "h2", text: "Wat Komoot beter doet" },
				{
					kind: "ul",
					items: [
						[
							"Native iOS- en Android-apps met gesproken turn-by-turn navigatie. routess draait als installeerbare web-app op je telefoon, maar praat nog niet tegen je.",
						],
						[
							"Een gigantische community-bibliotheek met routes, highlights en foto's, opgebouwd over meer dan tien jaar.",
						],
						["Volwassen offline kaarten in de mobiele apps."],
						["Meerdaagse tochten plannen (een Premium-functie)."],
						["Sportspecifieke routeprofielen die jarenlang verfijnd zijn, ook voor mountainbike."],
					],
				},
				{ kind: "h2", text: "Naast elkaar" },
				{
					kind: "table",
					headers: ["", "routess", "Komoot"],
					rows: [
						[["Prijs"], ["Gratis"], ["Gratis instap met één regio, Premium-abonnement voor de rest"]],
						[["Account verplicht"], ["Alleen om routes op te slaan"], ["Ja"]],
						[["Open source"], ["Ja, MIT"], ["Nee"]],
						[["GPX-import en -export"], ["Gratis, onbeperkt"], ["Ja, als de startregio van de route ontgrendeld is"]],
						[["Ondergronddata"], ["Gratis op elke route"], ["Ja"]],
						[["Gesproken navigatie"], ["Nog niet, volg de route in de web-app"], ["Ja, native apps"]],
						[["Community-routes"], ["Nog niet, gepland"], ["Ja, enorm veel"]],
						[["Zelf hosten"], ["Ja"], ["Nee"]],
					],
				},
				{ kind: "h2", text: "Overstappen vanaf Komoot" },
				{
					kind: "p",
					content: [
						"Je geplande tochten zitten niet vast. Exporteer een tocht uit Komoot als GPX-bestand en importeer het in routess: de import herkent bochten en bouwt bewerkbare waypoints, zodat je verder kan werken aan de route in plaats van opnieuw te beginnen. Zijn GPX-bestanden nieuw voor jou, dan legt de ",
						{ text: "GPX-gids", href: "/gids/gpx-bestand-maken" },
						" het formaat in twee minuten uit.",
					],
				},
				{
					kind: "note",
					content: [
						"routess is jong en evolueert snel. Routegeneratie en community-routes zitten in de pijplijn maar zijn nog niet live. De vergelijking hierboven telt alleen wat vandaag werkt.",
					],
				},
				{ kind: "h2", text: "Veelgestelde vragen" },
				{ kind: "h3", text: "Is routess echt gratis?" },
				{
					kind: "p",
					content: [
						"Ja. De planner, opslaan, GPX-import en -export en ondergrond- en hoogtedata zijn gratis, wereldwijd. Er komt een Pro-plan met zwaardere extra's, maar de planner blijft gratis. En omdat alles MIT-gelicentieerd is, kan je het altijd zelf draaien.",
					],
				},
				{ kind: "h3", text: "Kan ik mijn Komoot-routes importeren?" },
				{
					kind: "p",
					content: [
						"Ja, via GPX-export uit Komoot. Geïmporteerde routes worden volledig bewerkbaar, geen bevroren lijn op de kaart.",
					],
				},
				{ kind: "h3", text: "Werkt routess op mijn telefoon?" },
				{
					kind: "p",
					content: [
						"Ja. Je installeert het als web-app vanuit de browser, zonder app store, en je exporteert GPX naar je horloge of fietscomputer om te navigeren.",
					],
				},
				{ kind: "cta", label: "Probeer de planner, geen account nodig", href: "https://app.routess.com" },
			],
		},
	},
};
