import type { Locale } from "./types";

export const meta = {
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
