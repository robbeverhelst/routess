import type { Article } from "./types";

export const planCyclingRoute: Article = {
	key: "plan-cycling-route",
	section: "guides",
	datePublished: "2026-06-05",
	dateModified: "2026-06-05",
	content: {
		en: {
			slug: "plan-a-cycling-route",
			metaTitle: "How to plan a cycling route online, free",
			title: "How to plan a cycling route you'll actually enjoy",
			description:
				"Plan a cycling route online, free: drop waypoints, check surfaces and elevation before you commit, export GPX to your head unit. A practical guide using the routess planner.",
			intro: [
				"Planning a cycling route takes five minutes: open the free ",
				{ text: "routess planner", href: "https://app.routess.com" },
				", drop waypoints, and export a GPX. Planning a route you will actually enjoy takes a bit more thought: the right shape, the right surfaces, honest elevation, and quiet roads. This guide covers both.",
			],
			blocks: [
				{ kind: "h2", text: "Start with the shape of the ride" },
				{
					kind: "p",
					content: [
						"Decide loop or A to B before touching the map. Loops start and end at your door and never leave you stranded; A to B rides pair well with a train ride home. Then pick a target distance and, for longer rides, check the wind: riding out into a headwind and coming home with a tailwind beats the reverse every single time.",
					],
				},
				{ kind: "h2", text: "Drop waypoints, let the road network do the work" },
				{
					kind: "p",
					content: [
						"In the planner, every click adds a waypoint and the path snaps along the road network between them. Fewer waypoints is better: place them at the places you genuinely care about (that one gravel section, the café at the turnaround) and let the routing fill in the rest. For cycling, the planner can avoid highways and ferries. And where you know better than the map, switch a segment to a straight line and the route obeys you instead of the network.",
					],
				},
				{ kind: "h2", text: "Check what you'll ride on" },
				{
					kind: "p",
					content: [
						"The difference between a great ride and a miserable one is usually the surface. routess breaks every route into surface segments: paved, compacted, unpaved, and path. On a road bike, scan for unpaved surprises before they find you; on gravel, hunt for them on purpose. Not sure whether that grey line is asphalt or dirt? Flip to the satellite map style and look.",
					],
				},
				{ kind: "h2", text: "Be honest about elevation" },
				{
					kind: "p",
					content: [
						"The elevation profile shows total climbing and where it lands. A rough rule of thumb: 10 metres of gain per kilometre is rolling, 20 or more means real climbing. The number matters less than the placement: 600 metres spread across a ride feels fine, 600 metres stacked in the last 20 kilometres is a decision you make on purpose or regret thoroughly.",
					],
				},
				{ kind: "h2", text: "Get it out the door" },
				{
					kind: "p",
					content: [
						"Export the route as GPX for your head unit or watch (the ",
						{ text: "GPX guide", href: "/guides/create-gpx-file" },
						" covers Garmin and Wahoo), or open routess on your phone: it installs as a web app straight from the browser, so the route you planned on Sunday evening is in your pocket on Monday morning. Save it to your library and it stays editable for next time.",
					],
				},
				{
					kind: "note",
					content: [
						"All of this is free and works without an account; you only need one to save routes. Wondering how routess compares to what you use today? See the ",
						{ text: "route planner comparison", href: "/compare/route-planners-compared" },
						".",
					],
				},
				{ kind: "cta", label: "Plan your route now", href: "https://app.routess.com" },
			],
		},
		nl: {
			slug: "fietsroute-plannen",
			metaTitle: "Fietsroute plannen: online, gratis en zonder account",
			title: "Een fietsroute plannen waar je echt van geniet",
			description:
				"Plan online een fietsroute, gratis: zet waypoints, controleer ondergrond en hoogtemeters voor je vertrekt, exporteer GPX naar je fietscomputer. Een praktische gids met de routess-planner.",
			intro: [
				"Een fietsroute plannen duurt vijf minuten: open de gratis ",
				{ text: "routess-planner", href: "https://app.routess.com" },
				", zet waypoints en exporteer een GPX. Een route plannen waar je echt van geniet, vraagt iets meer denkwerk: de juiste vorm, de juiste ondergrond, eerlijke hoogtemeters en rustige wegen. Deze gids behandelt allebei.",
			],
			blocks: [
				{ kind: "h2", text: "Begin met de vorm van de rit" },
				{
					kind: "p",
					content: [
						"Kies lus of A naar B voor je de kaart aanraakt. Een lus start en eindigt aan je deur en laat je nooit stranden; een rit van A naar B combineert mooi met de trein terug. Kies daarna een richtafstand en check voor langere ritten de wind: vertrekken met tegenwind en thuiskomen met rugwind wint het elke keer van het omgekeerde.",
					],
				},
				{ kind: "h2", text: "Zet waypoints, laat het wegennet het werk doen" },
				{
					kind: "p",
					content: [
						"In de planner voegt elke klik een waypoint toe en snapt het pad ertussen langs het wegennet. Minder waypoints is beter: zet ze op de plekken die er echt toe doen (dat ene gravelstuk, het café aan het keerpunt) en laat de routing de rest invullen. Voor fietsen kan de planner grote wegen en veerponten vermijden. En waar jij het beter weet dan de kaart, zet je een segment om naar een rechte lijn en volgt de route jou in plaats van het netwerk.",
					],
				},
				{ kind: "h2", text: "Controleer waarop je zal rijden" },
				{
					kind: "p",
					content: [
						"Het verschil tussen een toprit en een miserabele rit is meestal de ondergrond. routess verdeelt elke route in ondergrondsegmenten: verhard, halfverhard, onverhard en paadjes. Op een koersfiets speur je naar onverharde verrassingen voor zij jou vinden; op gravel zoek je ze juist op. Twijfel je of die grijze lijn asfalt of aarde is? Schakel naar de satellietkaart en kijk.",
					],
				},
				{ kind: "h2", text: "Wees eerlijk over hoogtemeters" },
				{
					kind: "p",
					content: [
						"Het hoogteprofiel toont het totale klimwerk en waar het valt. Een ruwe vuistregel: 10 hoogtemeters per kilometer is golvend, vanaf 20 wordt het echt klimmen. Het getal telt minder dan de plaatsing: 600 hoogtemeters gespreid over een rit voelt prima, 600 hoogtemeters opgestapeld in de laatste 20 kilometer is een beslissing die je bewust neemt of grondig betreurt.",
					],
				},
				{ kind: "h2", text: "Naar buiten ermee" },
				{
					kind: "p",
					content: [
						"Exporteer de route als GPX voor je fietscomputer of horloge (de ",
						{ text: "GPX-gids", href: "/gids/gpx-bestand-maken" },
						" behandelt Garmin en Wahoo), of open routess op je telefoon: het installeert als web-app rechtstreeks vanuit de browser, dus de route die je zondagavond plande zit maandagochtend in je zak. Sla ze op in je bibliotheek en ze blijft bewerkbaar voor de volgende keer.",
					],
				},
				{
					kind: "note",
					content: [
						"Dit alles is gratis en werkt zonder account; je hebt er alleen een nodig om routes te bewaren. Benieuwd hoe routess zich verhoudt tot wat je vandaag gebruikt? Bekijk de ",
						{ text: "vergelijking van routeplanners", href: "/vergelijk/routeplanners-vergeleken" },
						".",
					],
				},
				{ kind: "cta", label: "Plan nu je route", href: "https://app.routess.com" },
			],
		},
	},
};
