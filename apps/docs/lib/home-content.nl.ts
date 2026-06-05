import type { HomeCopy } from "./home-content";

export const nl: HomeCopy = {
	eyebrow: "routess-documentatie",
	title: "Plan een route. Kies het pad.",
	lede: "routess is de open-source routeplanner voor fietsers, lopers en wandelaars. Gebruik het, host het of haak erop in. Begin waar je nu bent.",
	ctaDocs: "Developer Docs openen",
	ctaGuide: "Gebruikersgids lezen",
	lanesLabel: "Documentatieonderdelen",
	guide: {
		kicker: "Voor gebruikers",
		title: "Gebruikersgids",
		body: "Aanmelden, routes plannen, waypoints bewerken, kaartstijlen wisselen en problemen met de app oplossen.",
		bullets: ["Eerste route in minuten", "Taakgerichte handleidingen", "Gelokaliseerde onboarding"],
	},
	docs: {
		kicker: "Voor bouwers",
		title: "Developer Docs",
		body: "Architectuur, workspace-packages, operations en bijdraagregels voor de monorepo.",
		bullets: [
			"Aan de slag en repo-structuur",
			"Notities over state, auth en deployment",
			"Conventies die releases op gang houden",
		],
	},
	api: {
		kicker: "Voor integraties",
		title: "API-referentie",
		body: "Gegenereerde endpoint-docs, details over de auth-flow en request- en response-vormen uit de OpenAPI-spec.",
		bullets: ["Routes, users, auth en health", "Schema-gedreven request-docs", "Productie- en lokale base-URL's"],
	},
	metaDescription: "Documentatie, gidsen en API-referentie voor routess.",
};
