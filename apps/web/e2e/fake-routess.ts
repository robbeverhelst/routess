import type { BrowserContext, Route } from "@playwright/test";

// A stateful stand-in for the Routess API and Stripe Checkout, so the billing
// journey runs in a real browser against the real web app without a database,
// Valhalla or Stripe keys. It mirrors the API contract the web relies on:
// GET /billing (status, OG grant applied on read), POST /billing/checkout,
// the generation quota 429, and Pro time written only by the "webhook".

export const API_ORIGIN = "http://api.e2e.test";
export const CHECKOUT_ORIGIN = "https://checkout.stripe.e2e.test";

const DAY_MS = 24 * 60 * 60 * 1000;
const PASS_DAYS = 365;
const OG_GRANT_MONTHS = 3;
const PRICE = { amount: 2999, currency: "eur" };
const QUOTA = { anonymous: 1, free: 3, pro: 50 };

export const E2E_USER = {
	id: 42,
	email: "rider@routess.dev",
	password: "ghent-canals-gravel",
	name: "Rider",
	handle: "rider",
};

// A 1x1 transparent PNG for any map image request.
const EMPTY_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64",
);

// The smallest Mapbox style the map accepts: no network tiles, just a background.
const MAP_STYLE = {
	version: 8,
	name: "e2e",
	glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
	sources: {},
	layers: [{ id: "background", type: "background", paint: { "background-color": "#e7eee4" } }],
};

interface FakeOptions {
	// Pre-launch account: gets the OG grant on its first login after launch.
	preLaunchAccount?: boolean;
	// Generated routes already used today.
	generationsUsed?: number;
	// Status reads that still answer Free after payment, like a webhook that
	// lands a moment after the browser returns from Stripe.
	webhookDelayReads?: number;
}

interface CheckoutSession {
	id: string;
	successUrl: string;
	cancelUrl: string;
	status: "open" | "paid" | "expired";
}

export class FakeRoutess {
	plan: "free" | "pro" = "free";
	proExpiresAt: Date | null = null;
	ogGrantExpiresAt: Date | null = null;
	logins = 0;
	payments: { sessionId: string; method: string; amount: number }[] = [];
	generationsUsed: number;
	private readonly preLaunchAccount: boolean;
	private pendingWebhookReads = 0;
	private readonly webhookDelayReads: number;
	private readonly sessions = new Map<string, CheckoutSession>();
	private sessionCounter = 0;

	constructor(
		private readonly appOrigin: string,
		options: FakeOptions = {},
	) {
		this.preLaunchAccount = options.preLaunchAccount ?? false;
		this.generationsUsed = options.generationsUsed ?? 0;
		this.webhookDelayReads = options.webhookDelayReads ?? 0;
	}

	async install(context: BrowserContext): Promise<void> {
		await context.route("**/*", (route) => this.route(route));
	}

	private async route(route: Route): Promise<void> {
		const url = new URL(route.request().url());
		if (url.origin === this.appOrigin) {
			if (url.pathname === "/env-config.js") return this.envConfig(route);
			return route.fallback();
		}
		if (url.origin === API_ORIGIN) return this.api(route, url);
		if (url.origin === CHECKOUT_ORIGIN) return this.checkout(route, url);
		if (url.hostname.endsWith("mapbox.com")) return this.mapbox(route, url);
		// Everything else (Google sign-in script, analytics, fonts) stays offline.
		return route.abort();
	}

	private envConfig(route: Route) {
		const config = {
			VITE_API_URL: API_ORIGIN,
			VITE_GOOGLE_CLIENT_ID: "e2e.apps.googleusercontent.com",
			VITE_MAPBOX_ACCESS_TOKEN: "pk.e2e-test-token",
			VITE_APP_URL: this.appOrigin,
		};
		return route.fulfill({
			contentType: "application/javascript",
			body: `window.__ROUTESS_CONFIG__ = ${JSON.stringify(config)};`,
		});
	}

	private mapbox(route: Route, url: URL) {
		if (url.pathname.startsWith("/styles/v1/")) return route.fulfill({ json: MAP_STYLE });
		if (/\.(png|webp|jpg)$/.test(url.pathname)) return route.fulfill({ contentType: "image/png", body: EMPTY_PNG });
		return route.fulfill({ status: 204, body: "" });
	}

	private apiUser() {
		return {
			id: E2E_USER.id,
			email: E2E_USER.email,
			name: E2E_USER.name,
			handle: E2E_USER.handle,
			isEmailVerified: true,
			role: "user",
			idHash: "e2e-user-hash",
			deletionStatus: "active",
			hasPassword: true,
			preferences: null,
		};
	}

	// Pro in effect now, after any expired time lapsed back to Free.
	private currentPlan(now = new Date()): "free" | "pro" {
		if (this.plan === "pro" && this.proExpiresAt && this.proExpiresAt <= now) {
			this.plan = "free";
		}
		return this.plan;
	}

	// Mirrors BillingService.grantOgPassIfEligible: once per account, ever.
	private applyOgGrant(now = new Date()) {
		if (!this.preLaunchAccount || this.ogGrantExpiresAt) return;
		const from = this.currentPlan(now) === "pro" && this.proExpiresAt ? this.proExpiresAt : now;
		const until = new Date(from);
		until.setUTCMonth(until.getUTCMonth() + OG_GRANT_MONTHS);
		this.plan = "pro";
		this.proExpiresAt = until;
		this.ogGrantExpiresAt = until;
	}

	// Mirrors BillingService.applyEvent: a pass extends from the current expiry.
	private grantPass(sessionId: string, method: string, now = new Date()) {
		const from = this.currentPlan(now) === "pro" && this.proExpiresAt ? this.proExpiresAt : now;
		this.plan = "pro";
		this.proExpiresAt = new Date(from.getTime() + PASS_DAYS * DAY_MS);
		this.payments.push({ sessionId, method, amount: PRICE.amount });
	}

	private billingStatus(signedIn: boolean) {
		const base = {
			enabled: true,
			offer: { id: "pro_year_pass", plan: "pro", days: PASS_DAYS, price: PRICE },
			generationPerDay: { ...QUOTA },
			account: null as unknown,
		};
		if (!signedIn) return base;
		this.applyOgGrant();
		let plan = this.currentPlan();
		let proExpiresAt = this.proExpiresAt;
		if (this.pendingWebhookReads > 0) {
			// The browser is back from Stripe but the webhook has not landed.
			this.pendingWebhookReads -= 1;
			plan = "free";
			proExpiresAt = null;
		}
		return {
			...base,
			account: {
				plan,
				proExpiresAt: proExpiresAt?.toISOString() ?? null,
				ogGrantExpiresAt: this.ogGrantExpiresAt?.toISOString() ?? null,
				canBuy: true,
			},
		};
	}

	private async api(route: Route, url: URL) {
		const request = route.request();
		const method = request.method();
		const path = url.pathname.replace(/^\/api\/v1/, "");
		// Auth is a cookie in production; here a signed-in browser is one whose
		// stored profile the app sends along, so trust the test's own state.
		const signedIn = this.logins > 0;

		if (method === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders(this.appOrigin) });
		const reply = (status: number, body: unknown) =>
			route.fulfill({ status, json: body, headers: corsHeaders(this.appOrigin) });

		if (path === "/auth/login-email" && method === "POST") {
			const body = request.postDataJSON() as { email?: string; password?: string };
			if (body.email !== E2E_USER.email || body.password !== E2E_USER.password) {
				return reply(401, { statusCode: 401, message: "Invalid email or password" });
			}
			this.logins += 1;
			// Every login creates a session, which applies a pending OG grant.
			this.applyOgGrant();
			return reply(200, { accessToken: "e2e", user: this.apiUser(), isNewUser: false });
		}
		if (path === "/auth/logout") return reply(200, { success: true });
		if (path === "/users/me") return reply(200, this.apiUser());
		if (path === "/billing" && method === "GET") return reply(200, this.billingStatus(signedIn));
		if (path === "/billing/checkout" && method === "POST") {
			if (!signedIn) return reply(401, { statusCode: 401, message: "Unauthorized" });
			const id = `cs_test_e2e_${++this.sessionCounter}`;
			this.sessions.set(id, {
				id,
				successUrl: `${this.appOrigin}/upgrade?checkout=success&session_id=${id}`,
				cancelUrl: `${this.appOrigin}/upgrade?checkout=cancelled`,
				status: "open",
			});
			return reply(201, { url: `${CHECKOUT_ORIGIN}/c/pay/${id}` });
		}
		if (path === "/generation" && method === "POST") {
			const tier = signedIn ? this.currentPlan() : "anonymous";
			const limit = QUOTA[tier];
			this.generationsUsed += 1;
			if (this.generationsUsed > limit) {
				return reply(429, {
					statusCode: 429,
					code: "RATE_LIMITED",
					message: `Daily route generation limit of ${limit} reached. Try again tomorrow.`,
					details: {
						reason: "generation_quota",
						limit,
						tier,
						upgrade: tier === "anonymous" ? "sign_in" : tier === "free" ? "pro" : null,
					},
				});
			}
			return reply(503, { statusCode: 503, message: "No routing engine in the e2e fake" });
		}
		// The rest of the signed-in shell, all empty.
		if (path === "/routes" && method === "GET") return reply(200, []);
		if (path === "/collections" && method === "GET") return reply(200, []);
		if (path === "/social/shares/unread-count") return reply(200, { unread: 0 });
		if (path === "/social/notifications/unseen-count") return reply(200, { unseen: 0 });
		if (path === "/social/notifications") return reply(200, { items: [], seenAt: null });
		if (path.startsWith("/social/") && method === "GET") return reply(200, []);
		return reply(404, { statusCode: 404, message: `e2e fake has no ${method} ${path}` });
	}

	// The hosted Checkout page in test mode: the three decided methods, a pay
	// button that fires the "webhook" and returns to success_url, and a back
	// link to cancel_url. Nothing here touches Stripe.
	private async checkout(route: Route, url: URL) {
		const payMatch = url.pathname.match(/^\/pay\/(cs_test_[\w]+)$/);
		if (payMatch && route.request().method() === "POST") {
			const session = this.sessions.get(payMatch[1]);
			if (session?.status !== "open") return route.fulfill({ status: 410, body: "Session gone" });
			const form = new URLSearchParams(route.request().postData() ?? "");
			session.status = "paid";
			this.grantPass(session.id, form.get("method") ?? "card");
			this.pendingWebhookReads = this.webhookDelayReads;
			return route.fulfill({ status: 303, headers: { location: session.successUrl } });
		}
		const pageMatch = url.pathname.match(/^\/c\/pay\/(cs_test_[\w]+)$/);
		const session = pageMatch ? this.sessions.get(pageMatch[1]) : undefined;
		if (!session) return route.fulfill({ status: 404, body: "No such checkout session" });
		return route.fulfill({ contentType: "text/html", body: checkoutPage(session) });
	}
}

function corsHeaders(origin: string): Record<string, string> {
	return {
		"access-control-allow-origin": origin,
		"access-control-allow-credentials": "true",
		"access-control-allow-headers": "content-type, authorization, x-request-id",
		"access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	};
}

function checkoutPage(session: CheckoutSession): string {
	const amount = (PRICE.amount / 100).toFixed(2);
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Stripe Checkout (test mode)</title></head>
<body>
<main>
	<p>TEST MODE</p>
	<h1>Routess Pro year pass</h1>
	<p data-testid="checkout-amount">€${amount}</p>
	<form method="post" action="/pay/${session.id}">
		<fieldset>
			<legend>Payment method</legend>
			<label><input type="radio" name="method" value="bancontact" checked> Bancontact</label>
			<label><input type="radio" name="method" value="ideal"> iDEAL</label>
			<label><input type="radio" name="method" value="card"> Card</label>
		</fieldset>
		<button type="submit">Pay €${amount}</button>
	</form>
	<a href="${session.cancelUrl}">Back to Routess</a>
</main>
</body></html>`;
}
