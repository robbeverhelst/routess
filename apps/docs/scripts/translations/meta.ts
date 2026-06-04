import type { Locale } from "./types";

export const meta = {
	root: {
		nl: {
			title: "Gebruikersgids",
			pages: [
				"index",
				"getting-started",
				"routes",
				"map",
				"account",
				"troubleshooting",
				"faq",
				"support",
				"privacy",
				"whats-new",
			],
		},
		fr: {
			title: "Guide utilisateur",
			pages: [
				"index",
				"getting-started",
				"routes",
				"map",
				"account",
				"troubleshooting",
				"faq",
				"support",
				"privacy",
				"whats-new",
			],
		},
		de: {
			title: "Benutzerhandbuch",
			pages: [
				"index",
				"getting-started",
				"routes",
				"map",
				"account",
				"troubleshooting",
				"faq",
				"support",
				"privacy",
				"whats-new",
			],
		},
	},
	gettingStarted: {
		nl: { title: "Aan de slag", pages: ["sign-in", "your-first-route", "interface-tour", "keyboard-shortcuts"] },
		fr: { title: "Bien démarrer", pages: ["sign-in", "your-first-route", "interface-tour", "keyboard-shortcuts"] },
		de: { title: "Erste Schritte", pages: ["sign-in", "your-first-route", "interface-tour", "keyboard-shortcuts"] },
	},
	routes: {
		nl: {
			title: "Routes",
			pages: ["creating-routes", "editing-routes", "saving-routes", "route-info", "sharing-routes"],
		},
		fr: {
			title: "Itinéraires",
			pages: ["creating-routes", "editing-routes", "saving-routes", "route-info", "sharing-routes"],
		},
		de: {
			title: "Routen",
			pages: ["creating-routes", "editing-routes", "saving-routes", "route-info", "sharing-routes"],
		},
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
