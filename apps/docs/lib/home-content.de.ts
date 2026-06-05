import type { HomeCopy } from "./home-content";

export const de: HomeCopy = {
	eyebrow: "routess-Dokumentation",
	title: "Plane eine Route. Wähle den Weg.",
	lede: "routess ist der Open-Source-Routenplaner für Radfahrer, Läufer und Wanderer. Nutze ihn, hoste ihn oder binde ihn an. Starte da, wo du gerade stehst.",
	ctaDocs: "Entwicklerdocs öffnen",
	ctaGuide: "Benutzerhandbuch lesen",
	lanesLabel: "Dokumentationsbereiche",
	guide: {
		kicker: "Für Nutzer",
		title: "Benutzerhandbuch",
		body: "Anmelden, Routen planen, Wegpunkte bearbeiten, Kartenstile wechseln und die App-Fehlerbehebung meistern.",
		bullets: ["Erste Route in Minuten", "Aufgabenorientierte Anleitungen", "Lokalisiertes Onboarding"],
	},
	docs: {
		kicker: "Für Entwickler",
		title: "Entwicklerdocs",
		body: "Architektur, Workspace-Pakete, Betrieb und Beitragsregeln für das Monorepo.",
		bullets: [
			"Erste Schritte und Repo-Aufbau",
			"Hinweise zu State, Auth und Deployment",
			"Konventionen, die Releases am Laufen halten",
		],
	},
	api: {
		kicker: "Für Integrationen",
		title: "API-Referenz",
		body: "Generierte Endpunkt-Docs, Details zum Auth-Flow sowie Request- und Response-Formate aus der OpenAPI-Spezifikation.",
		bullets: ["Routes, Users, Auth und Health", "Schema-gesteuerte Request-Docs", "Produktions- und lokale Basis-URLs"],
	},
	metaDescription: "Dokumentation, Anleitungen und API-Referenz für routess.",
};
