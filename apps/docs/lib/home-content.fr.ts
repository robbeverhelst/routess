import type { HomeCopy } from "./home-content";

export const fr: HomeCopy = {
	eyebrow: "documentation routess",
	title: "Planifie un itinéraire. Choisis le tracé.",
	lede: "routess est le planificateur d'itinéraires open source pour les cyclistes, les coureurs et les randonneurs. Utilise-le, héberge-le ou branche-toi dessus. Commence là où tu en es.",
	ctaDocs: "Ouvrir la documentation développeur",
	ctaGuide: "Lire le guide utilisateur",
	lanesLabel: "Sections de la documentation",
	guide: {
		kicker: "Pour les utilisateurs",
		title: "Guide utilisateur",
		body: "Connecte-toi, planifie des itinéraires, modifie des points de passage, change de style de carte et dépanne l'application.",
		bullets: ["Premier itinéraire en quelques minutes", "Tutoriels orientés tâches", "Onboarding localisé"],
	},
	docs: {
		kicker: "Pour les builders",
		title: "Documentation développeur",
		body: "Architecture, packages du workspace, opérations et règles de contribution pour le monorepo.",
		bullets: [
			"Premiers pas et organisation du repo",
			"Notes sur l'état, l'authentification et le déploiement",
			"Conventions qui font avancer les releases",
		],
	},
	api: {
		kicker: "Pour les intégrations",
		title: "Référence de l'API",
		body: "Doc d'endpoints générée, détails du flux d'authentification, et formes de requête et de réponse issues de la spec OpenAPI.",
		bullets: [
			"Itinéraires, utilisateurs, authentification et santé",
			"Doc de requêtes pilotée par le schéma",
			"URL de base production et locale",
		],
	},
	metaDescription: "Documentation, guides et référence de l'API pour routess.",
};
