import { de } from "./home-content.de";
import { fr } from "./home-content.fr";
import { nl } from "./home-content.nl";

export interface HomeLane {
	kicker: string;
	title: string;
	body: string;
	bullets: [string, string, string];
}

export interface HomeCopy {
	eyebrow: string;
	title: string;
	lede: string;
	ctaDocs: string;
	ctaGuide: string;
	lanesLabel: string;
	guide: HomeLane;
	docs: HomeLane;
	api: HomeLane;
	metaDescription: string;
}

export const homeCopy: Record<string, HomeCopy> = {
	en: {
		eyebrow: "routess documentation",
		title: "Plan a route. Pick the path.",
		lede: "routess is the open-source route planner for cyclists, runners, and hikers. Use it, host it, or hook into it. Start wherever you are.",
		ctaDocs: "Open Developer Docs",
		ctaGuide: "Read the User Guide",
		lanesLabel: "Documentation sections",
		guide: {
			kicker: "For users",
			title: "User Guide",
			body: "Sign in, plan routes, edit waypoints, switch map styles, and troubleshoot the app.",
			bullets: ["First route in minutes", "Task-focused walkthroughs", "Localized onboarding"],
		},
		docs: {
			kicker: "For builders",
			title: "Developer Docs",
			body: "Architecture, workspace packages, operations, and contribution rules for the monorepo.",
			bullets: [
				"Getting started and repo layout",
				"State, auth, and deployment notes",
				"Conventions that keep releases moving",
			],
		},
		api: {
			kicker: "For integrations",
			title: "API Reference",
			body: "Generated endpoint docs, auth flow details, and request and response shapes from the OpenAPI spec.",
			bullets: ["Routes, users, auth, and health", "Schema-driven request docs", "Production and local base URLs"],
		},
		metaDescription: "Documentation, guides, and API reference for routess.",
	},
	nl,
	fr,
	de,
};
