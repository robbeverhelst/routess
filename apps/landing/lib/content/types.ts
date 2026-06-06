export interface Dict {
	nav: {
		plan: string;
		features: string;
		community: string;
		pricing: string;
		forDevelopers: string;
		planRoute: string;
		home: string;
		docs: string;
		github: string;
		star: string;
		readDocs: string;
	};
	hero: {
		chip: string;
		headlineLines: ReadonlyArray<{ text: string; accent?: boolean }>;
		body: string;
		ctaPrimary: string;
		ctaSecondary: string;
		bullets: ReadonlyArray<string>;
	};
	marquee: ReadonlyArray<string>;
	planner: {
		eyebrow: string;
		title: ReadonlyArray<{ text: string; accent?: boolean }>;
		body: string;
		mode: string;
		modes: { run: string; cycle: string; walk: string };
		total: string;
		computedLive: string;
		timeLabel: string;
		openInApp: string;
		hint: string;
		clickHint: string;
		reset: string;
		waypoints: string;
	};
	mapStyles: {
		eyebrow: string;
		title: ReadonlyArray<{ text: string; accent?: boolean }>;
		body: string;
		items: ReadonlyArray<{ key: "streets" | "outdoors" | "satellite" | "dark"; name: string; desc: string }>;
	};
	outside: {
		eyebrow: string;
		title: ReadonlyArray<{ text: string; accent?: boolean }>;
		body: string;
		bullets: ReadonlyArray<string>;
		phoneCaption: string;
	};
	surface: {
		eyebrow: string;
		title: ReadonlyArray<{ text: string; accent?: boolean }>;
		body: string;
		buckets: ReadonlyArray<{ name: string; pct: number; desc: string }>;
		elevationLabel: string;
		elevationStats: string;
	};
	routegen: {
		eyebrow: string;
		title: ReadonlyArray<{ text: string; accent?: boolean }>;
		body: string;
		bullets: ReadonlyArray<string>;
		promptLabel: string;
		prompts: ReadonlyArray<string>;
		generateBtn: string;
	};
	sharing: {
		eyebrow: string;
		title: string;
		body: string;
		myRoutes: string;
		filters: { all: string; run: string; cycle: string };
		shareTitle: string;
		shareSubtitle: string;
		copy: string;
		comingSoonEyebrow: string;
		comingSoonTitle: string;
		comingSoonBody: string;
		routes: ReadonlyArray<{ name: string; dist: string; time: string; elev: string }>;
	};
	pricing: {
		eyebrow: string;
		title: ReadonlyArray<{ text: string; accent?: boolean }>;
		body: string;
		freeName: string;
		freeTagline: string;
		freePrice: string;
		freePeriod: string;
		freePerks: ReadonlyArray<string>;
		freeCta: string;
		proName: string;
		proTagline: string;
		proPrice: string;
		proPeriod: string;
		proAlt: string;
		proPerks: ReadonlyArray<string>;
		proCta: string;
		proBadge: string;
		selfHostNote: string;
		selfHostLink: string;
	};
	openSource: {
		repo: string;
		title: string;
		body: string;
		cta: string;
	};
	footer: {
		tagline: string;
		colProduct: { title: string; items: ReadonlyArray<{ label: string; href: string }> };
		colOpen: { title: string; items: ReadonlyArray<{ label: string; href: string }> };
		colMore: { title: string; items: ReadonlyArray<{ label: string; href: string }> };
		copyright: string;
		madeWith: string;
	};
	dev: {
		hero: {
			chip: string;
			title: ReadonlyArray<{ text: string; accent?: boolean }>;
			body: string;
			ctaDocs: string;
			ctaGithub: string;
		};
		sections: ReadonlyArray<{ eyebrow: string; title: string; body: string; bullets: ReadonlyArray<string> }>;
	};
	routePage: {
		eyebrow: string;
		activities: { run: string; cycle: string; walk: string; route: string };
		stats: { distance: string; elevation: string; duration: string };
		openInApp: string;
		downloadGpx: string;
		planYourOwn: string;
		about: string;
		mapAlt: string;
		summaryTemplate: string;
		byAuthor: string;
	};
	profilePage: {
		eyebrow: string;
		stats: { routes: string; distance: string; elevation: string; followers: string };
		routesTitle: string;
		followInApp: string;
		planYourOwn: string;
		summaryTemplate: string;
	};
	meta: {
		landing: { title: string; description: string };
		developers: { title: string; description: string };
	};
}
