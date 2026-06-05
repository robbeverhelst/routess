import type { Article } from "./types";

export const gpxFileCreate: Article = {
	key: "gpx-file-create",
	section: "guides",
	datePublished: "2026-06-05",
	dateModified: "2026-06-05",
	content: {
		en: {
			slug: "create-gpx-file",
			metaTitle: "How to create a GPX file online, free and without signup",
			title: "How to create a GPX file, free",
			description:
				"Create a GPX file online in about two minutes: plan a route in the free routess planner and export it. No account, no software install. Plus: getting it onto Garmin and Wahoo.",
			intro: [
				"The fastest free way to create a GPX file: open the ",
				{ text: "routess planner", href: "https://app.routess.com" },
				", click your route together on the map, and export. No account needed to plan, no software to install, takes about two minutes. This guide also covers what a GPX file actually contains and how to get it onto your devices.",
			],
			blocks: [
				{ kind: "h2", text: "What a GPX file actually is" },
				{
					kind: "p",
					content: [
						"GPX (GPS Exchange Format) is a small, open XML file that describes geographic data. It can hold three kinds of things: waypoints (single points), routes (an ordered list of points to navigate between), and tracks (a dense trail of points describing the exact path). Most modern devices and apps want a track: it follows roads and trails precisely instead of drawing straight lines between a few points. routess exports the full computed path of your route, so your device follows the actual roads you planned.",
					],
				},
				{ kind: "h2", text: "Create a GPX in two minutes" },
				{
					kind: "ul",
					items: [
						[
							"Open ",
							{ text: "app.routess.com", href: "https://app.routess.com" },
							" in any browser, on desktop or phone.",
						],
						["Pick your activity: run, cycle, or walk. It changes how routes snap to the network."],
						["Click the map to drop waypoints. The path snaps along roads and trails between them."],
						[
							"Need to cut across a field or follow an unmapped trail? Switch a segment to a straight line instead of a routed one.",
						],
						["Check the distance, elevation profile, and surface breakdown as you go."],
						["Export as GPX. That is the whole process."],
					],
				},
				{ kind: "h2", text: "Getting the GPX onto your device" },
				{ kind: "h3", text: "Garmin" },
				{
					kind: "p",
					content: [
						"Import the GPX in Garmin Connect (web or app) as a course and send it to your watch or Edge from there. Older devices also accept GPX files copied straight into the NewFiles folder over USB.",
					],
				},
				{ kind: "h3", text: "Wahoo" },
				{
					kind: "p",
					content: [
						"Import the file in the Wahoo companion app (or a linked service) and sync; the route shows up on your ELEMNT ready to ride.",
					],
				},
				{ kind: "h3", text: "Phones and other apps" },
				{
					kind: "p",
					content: [
						"Nearly every outdoor app accepts GPX imports. And since routess itself runs as a web app on your phone, you can also skip the file entirely and just open your saved route.",
					],
				},
				{ kind: "h2", text: "Editing an existing GPX file" },
				{
					kind: "p",
					content: [
						"Import any GPX into routess and it becomes editable: the importer detects turns and rebuilds waypoints you can drag, add, and delete, instead of leaving you a frozen line. Adjust the route, then export a fresh GPX. Useful for fixing a friend's route, shortening a ride from another platform, or rerouting around roadworks. For planning a good route from scratch, see ",
						{ text: "how to plan a cycling route", href: "/guides/plan-a-cycling-route" },
						".",
					],
				},
				{
					kind: "note",
					content: [
						"Everything above is free and works without an account; you only need one to save routes for later. routess is open source (MIT) and tracker-free.",
					],
				},
				{ kind: "cta", label: "Create a GPX file now", href: "https://app.routess.com" },
			],
		},
		nl: {
			slug: "gpx-bestand-maken",
			metaTitle: "GPX-bestand maken: gratis, online, zonder account",
			title: "Een GPX-bestand maken, gratis",
			description:
				"Maak online een GPX-bestand in zo'n twee minuten: plan een route in de gratis routess-planner en exporteer. Geen account, geen software. Plus: zo krijg je het op je Garmin of Wahoo.",
			intro: [
				"De snelste gratis manier om een GPX-bestand te maken: open de ",
				{ text: "routess-planner", href: "https://app.routess.com" },
				", klik je route bij elkaar op de kaart en exporteer. Geen account nodig om te plannen, geen software te installeren, klaar in zo'n twee minuten. Deze gids legt ook uit wat er echt in een GPX-bestand zit en hoe je het op je toestellen krijgt.",
			],
			blocks: [
				{ kind: "h2", text: "Wat een GPX-bestand echt is" },
				{
					kind: "p",
					content: [
						"GPX (GPS Exchange Format) is een klein, open XML-bestand met geografische data. Er kunnen drie soorten dingen in zitten: waypoints (losse punten), routes (een geordende lijst punten om tussen te navigeren) en tracks (een dicht spoor van punten dat het exacte pad beschrijft). De meeste moderne toestellen en apps willen een track: die volgt wegen en paden precies, in plaats van rechte lijnen te trekken tussen een paar punten. routess exporteert het volledig berekende pad van je route, dus je toestel volgt de wegen die je echt plande.",
					],
				},
				{ kind: "h2", text: "Een GPX maken in twee minuten" },
				{
					kind: "ul",
					items: [
						[
							"Open ",
							{ text: "app.routess.com", href: "https://app.routess.com" },
							" in eender welke browser, op desktop of telefoon.",
						],
						["Kies je activiteit: lopen, fietsen of wandelen. Dat bepaalt hoe de route aan het netwerk snapt."],
						["Klik op de kaart om waypoints te plaatsen. Het pad volgt vanzelf wegen en paden ertussen."],
						["Moet je een veld oversteken of een niet-gekarteerd pad volgen? Zet dat segment om naar een rechte lijn."],
						["Hou onderweg de afstand, het hoogteprofiel en de ondergrond in het oog."],
						["Exporteer als GPX. Dat is het hele proces."],
					],
				},
				{ kind: "h2", text: "De GPX op je toestel krijgen" },
				{ kind: "h3", text: "Garmin" },
				{
					kind: "p",
					content: [
						"Importeer de GPX in Garmin Connect (web of app) als koers en stuur hem van daaruit naar je horloge of Edge. Oudere toestellen aanvaarden ook GPX-bestanden die je via USB rechtstreeks in de map NewFiles zet.",
					],
				},
				{ kind: "h3", text: "Wahoo" },
				{
					kind: "p",
					content: [
						"Importeer het bestand in de Wahoo-app (of een gekoppelde dienst) en synchroniseer; de route staat klaar op je ELEMNT.",
					],
				},
				{ kind: "h3", text: "Telefoons en andere apps" },
				{
					kind: "p",
					content: [
						"Bijna elke outdoor-app aanvaardt GPX-import. En omdat routess zelf als web-app op je telefoon draait, kan je het bestand ook overslaan en gewoon je opgeslagen route openen.",
					],
				},
				{ kind: "h2", text: "Een bestaand GPX-bestand bewerken" },
				{
					kind: "p",
					content: [
						"Importeer eender welke GPX in routess en hij wordt bewerkbaar: de import herkent bochten en bouwt waypoints die je kan verslepen, toevoegen en verwijderen, in plaats van een bevroren lijn achter te laten. Pas de route aan en exporteer een verse GPX. Handig om de route van een vriend te fixen, een rit van een ander platform in te korten of om wegenwerken heen te plannen. Voor een goede route vanaf nul, lees ",
						{ text: "fietsroute plannen", href: "/gids/fietsroute-plannen" },
						".",
					],
				},
				{
					kind: "note",
					content: [
						"Alles hierboven is gratis en werkt zonder account; je hebt er alleen een nodig om routes te bewaren. routess is open source (MIT) en tracker-vrij.",
					],
				},
				{ kind: "cta", label: "Maak nu een GPX-bestand", href: "https://app.routess.com" },
			],
		},
	},
};
