import type { Article } from "./types";

export const routePlannersCompared: Article = {
	key: "route-planners-compared",
	section: "compare",
	datePublished: "2026-06-05",
	dateModified: "2026-06-05",
	content: {
		en: {
			slug: "route-planners-compared",
			metaTitle: "Route planners compared: routess, Komoot, Strava, RideWithGPS, Plotaroute",
			title: "Route planners compared, honestly",
			description:
				"routess vs Komoot vs Strava vs RideWithGPS vs Plotaroute: pricing models, GPX freedom, surfaces, navigation. An honest comparison from the team behind routess.",
			intro: [
				"There is no single best route planner, only a best one for how you ride, run, or hike. Short version: routess for free, GPX-first planning in the browser; Komoot for community routes and turn-by-turn navigation; Strava for training and social features; RideWithGPS for committed road cyclists and clubs; Plotaroute for fine-grained manual control. We build routess, so read our take knowing that, but we have kept the table honest.",
			],
			blocks: [
				{ kind: "h2", text: "The short table" },
				{
					kind: "table",
					headers: ["Planner", "Best for", "Price model", "GPX export", "Open source"],
					rows: [
						[
							[{ text: "routess", strong: true }],
							["Free web-first planning with surface data"],
							["Free, Pro planned"],
							["Free, unlimited"],
							["Yes, MIT"],
						],
						[
							["Komoot"],
							["Community routes, voice navigation"],
							["Free tier, Premium subscription for new users"],
							["Yes, own tours"],
							["No"],
						],
						[["Strava"], ["Training, segments, social"], ["Route planning needs a subscription"], ["Yes"], ["No"]],
						[["RideWithGPS"], ["Road cycling, clubs, events"], ["Limited free tier, subscriptions"], ["Yes"], ["No"]],
						[["Plotaroute"], ["Detailed manual editing"], ["Free tier, paid Premium"], ["Yes"], ["No"]],
					],
				},
				{ kind: "h2", text: "routess" },
				{
					kind: "p",
					content: [
						"A free, open-source planner for cycling, running, and hiking. Plan in the browser without an account, see the surface breakdown (paved, compacted, unpaved, path) and elevation profile of every route, then import or export GPX without restrictions. Installable as a web app on your phone. The honest gaps: no voice navigation, no community route library yet, and the product is young. If you want to know exactly where it beats and loses to Komoot, the ",
						{ text: "Komoot comparison", href: "/compare/komoot-alternative" },
						" goes deeper.",
					],
				},
				{ kind: "h2", text: "Komoot" },
				{
					kind: "p",
					content: [
						"The biggest community of the bunch: route collections, highlights, and photos for nearly anywhere, plus polished native apps with voice turn-by-turn navigation and offline maps. The trade-offs: since early 2025 new users need the Premium subscription for most paid features, including sending routes to a Garmin or Wahoo, an account is required, and the platform is closed. For multi-day touring with navigation it is still the reference.",
					],
				},
				{ kind: "h2", text: "Strava" },
				{
					kind: "p",
					content: [
						"Strava is a training and social platform first, a route planner second. The planner can overlay the global heatmap and favours popular roads, genuinely useful for finding where people actually ride and run, but creating routes sits behind the subscription. If you live in Strava for segments and training load anyway, the planner is right there; few people pick Strava for planning alone.",
					],
				},
				{ kind: "h2", text: "RideWithGPS" },
				{
					kind: "p",
					content: [
						"The road cyclist's workhorse: strong cue sheets, club and event tooling, and reliable head-unit integration. The web planner is solid on the free tier, with mobile planning and the heavier features behind subscriptions. Less aimed at runners and hikers.",
					],
				},
				{ kind: "h2", text: "Plotaroute" },
				{
					kind: "p",
					content: [
						"A web planner with an emphasis on manual control: snap on or off per section, bulk editing tools, and flexible printing. The interface shows its age and the free tier works with usage quotas (limited stops on auto-routing, one generated route per day, ads), but for meticulous manual editing it has a loyal following.",
					],
				},
				{ kind: "h2", text: "Which one should you pick?" },
				{
					kind: "ul",
					items: [
						[
							"You want free, fast planning in the browser with GPX freedom and surface data: ",
							{ text: "routess", strong: true },
							".",
						],
						[
							"You want voice navigation and community-proven routes for touring: ",
							{ text: "Komoot", strong: true },
							".",
						],
						["You train with segments and already pay for it: ", { text: "Strava", strong: true }, "."],
						["You ride road seriously, in a club, with a head unit: ", { text: "RideWithGPS", strong: true }, "."],
						["You want maximal manual editing control: ", { text: "Plotaroute", strong: true }, "."],
					],
				},
				{
					kind: "note",
					content: [
						"Pricing models change often. We keep this page current, but check the linked products for exact prices before deciding. Last reviewed: June 2026.",
					],
				},
				{ kind: "cta", label: "Plan a route in routess, free", href: "https://app.routess.com" },
			],
		},
		nl: {
			slug: "routeplanners-vergeleken",
			metaTitle: "Routeplanners vergeleken: routess, Komoot, Strava, RideWithGPS, Plotaroute",
			title: "Routeplanners vergeleken, eerlijk",
			description:
				"routess vs Komoot vs Strava vs RideWithGPS vs Plotaroute: prijsmodellen, GPX-vrijheid, ondergrond, navigatie. Een eerlijke vergelijking door het team achter routess.",
			intro: [
				"Er bestaat geen beste routeplanner, alleen een beste voor hoe jij fietst, loopt of wandelt. Kort: routess voor gratis, GPX-eerst plannen in de browser; Komoot voor community-routes en gesproken navigatie; Strava voor training en sociale functies; RideWithGPS voor fanatieke wegfietsers en clubs; Plotaroute voor fijnmazige handmatige controle. Wij bouwen routess, lees onze kijk dus met dat in het achterhoofd, maar de tabel hielden we eerlijk.",
			],
			blocks: [
				{ kind: "h2", text: "De korte tabel" },
				{
					kind: "table",
					headers: ["Planner", "Best voor", "Prijsmodel", "GPX-export", "Open source"],
					rows: [
						[
							[{ text: "routess", strong: true }],
							["Gratis web-eerst plannen met ondergronddata"],
							["Gratis, Pro gepland"],
							["Gratis, onbeperkt"],
							["Ja, MIT"],
						],
						[
							["Komoot"],
							["Community-routes, gesproken navigatie"],
							["Gratis instap, Premium-abonnement voor nieuwe gebruikers"],
							["Ja, eigen tochten"],
							["Nee"],
						],
						[["Strava"], ["Training, segmenten, sociaal"], ["Routes plannen vereist een abonnement"], ["Ja"], ["Nee"]],
						[
							["RideWithGPS"],
							["Wegfietsen, clubs, evenementen"],
							["Beperkte gratis laag, abonnementen"],
							["Ja"],
							["Nee"],
						],
						[["Plotaroute"], ["Gedetailleerd handmatig bewerken"], ["Gratis laag, betaald Premium"], ["Ja"], ["Nee"]],
					],
				},
				{ kind: "h2", text: "routess" },
				{
					kind: "p",
					content: [
						"Een gratis, open-source planner voor fietsen, lopen en wandelen. Plan in de browser zonder account, bekijk per route de ondergrond (verhard, halfverhard, onverhard, paadjes) en het hoogteprofiel, en importeer of exporteer GPX zonder beperkingen. Installeerbaar als web-app op je telefoon. De eerlijke gaten: geen gesproken navigatie, nog geen community-bibliotheek, en het product is jong. Wil je exact weten waar het wint en verliest van Komoot, dan gaat de ",
						{ text: "Komoot-vergelijking", href: "/vergelijk/komoot-alternatief" },
						" dieper.",
					],
				},
				{ kind: "h2", text: "Komoot" },
				{
					kind: "p",
					content: [
						"De grootste community van allemaal: routecollecties, highlights en foto's voor bijna overal, plus afgewerkte native apps met gesproken turn-by-turn navigatie en offline kaarten. De keerzijde: sinds begin 2025 hebben nieuwe gebruikers het Premium-abonnement nodig voor de meeste betaalde functies, ook om routes naar een Garmin of Wahoo te sturen, een account is verplicht en het platform is gesloten. Voor meerdaagse tochten met navigatie blijft het de referentie.",
					],
				},
				{ kind: "h2", text: "Strava" },
				{
					kind: "p",
					content: [
						"Strava is eerst een trainings- en sociaal platform, daarna pas een routeplanner. De planner kan de wereldwijde heatmap als laag tonen en verkiest populaire wegen, oprecht handig om te zien waar mensen echt fietsen en lopen, maar routes aanmaken zit achter het abonnement. Leef je toch al in Strava voor segmenten en trainingsload, dan ligt de planner binnen handbereik; weinig mensen kiezen Strava puur om te plannen.",
					],
				},
				{ kind: "h2", text: "RideWithGPS" },
				{
					kind: "p",
					content: [
						"Het werkpaard van de wegfietser: sterke cue sheets, club- en evenemententools en betrouwbare koppeling met fietscomputers. De webplanner is degelijk in de gratis laag; mobiel plannen en de zwaardere functies zitten achter abonnementen. Minder gericht op lopers en wandelaars.",
					],
				},
				{ kind: "h2", text: "Plotaroute" },
				{
					kind: "p",
					content: [
						"Een webplanner met nadruk op handmatige controle: snappen aan of uit per sectie, bulkbewerkingen en flexibel printen. De interface toont zijn leeftijd en de gratis laag werkt met gebruikslimieten (beperkte stops bij automatisch routeren, één gegenereerde route per dag, advertenties), maar voor secuur handwerk heeft het een trouwe aanhang.",
					],
				},
				{ kind: "h2", text: "Welke moet je kiezen?" },
				{
					kind: "ul",
					items: [
						[
							"Je wil gratis en snel plannen in de browser, met GPX-vrijheid en ondergronddata: ",
							{ text: "routess", strong: true },
							".",
						],
						["Je wil gesproken navigatie en door de community bewezen routes: ", { text: "Komoot", strong: true }, "."],
						["Je traint met segmenten en betaalt er toch al voor: ", { text: "Strava", strong: true }, "."],
						[
							"Je rijdt serieus op de weg, in clubverband, met een fietscomputer: ",
							{ text: "RideWithGPS", strong: true },
							".",
						],
						["Je wil maximale handmatige controle: ", { text: "Plotaroute", strong: true }, "."],
					],
				},
				{
					kind: "note",
					content: [
						"Prijsmodellen veranderen vaak. We houden deze pagina actueel, maar controleer de exacte prijzen bij de producten zelf voor je beslist. Laatst nagekeken: juni 2026.",
					],
				},
				{ kind: "cta", label: "Plan een route in routess, gratis", href: "https://app.routess.com" },
			],
		},
	},
};
