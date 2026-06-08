#!/usr/bin/env bun
/**
 * Seed a local routess database with two accounts and enough content to
 * screenshot the signed-in guide pages (library, collections, social, account).
 * The anonymous flows in capture-guide-screenshots.ts never need this; the
 * authenticated pass does.
 *
 * Run against a local stack only:
 *   SEED_API_URL=http://localhost:3002/api/v1 \
 *   SEED_DB_URL=postgres://postgres:postgres@localhost:5433/screenshots_db \
 *   bun run scripts/seed-screenshot-data.ts
 *
 * Idempotent enough to re-run: accounts are login-or-create, and per-account
 * content is skipped when the account already has routes.
 */
// Minimal ambient types for Bun's global SQL client: the docs workspace is
// typed for Next (no bun-types dependency), but this script only runs under
// `bun`, where `Bun.SQL` is available.
type SqlClient = {
	(strings: TemplateStringsArray, ...values: unknown[]): Promise<Array<Record<string, unknown>>>;
	end(): Promise<void>;
};
declare const Bun: { SQL: new (url: string) => SqlClient };

const API = process.env.SEED_API_URL ?? "http://localhost:3002/api/v1";
const DB_URL = process.env.SEED_DB_URL ?? "postgres://postgres:postgres@localhost:5433/screenshots_db";

// Shared with capture-guide-screenshots.ts. Local throwaway accounts only.
export const HERO = {
	email: "alex.rivera@routess.dev",
	password: "ghent-canals-gravel-2026",
	name: "Alex Rivera",
	handle: "alex-rivera",
};
const FRIEND = {
	email: "sofie.claes@routess.dev",
	password: "leie-riverside-spring-2026",
	name: "Sofie Claes",
	handle: "sofie-claes",
};

const sql = new Bun.SQL(DB_URL);

function log(msg: string) {
	process.stdout.write(`[seed] ${msg}\n`);
}

async function api<T = unknown>(
	path: string,
	opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
	const res = await fetch(`${API}${path}`, {
		method: opts.method ?? "GET",
		headers: {
			"content-type": "application/json",
			...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
		},
		body: opts.body ? JSON.stringify(opts.body) : undefined,
	});
	if (!res.ok) {
		throw new Error(`${opts.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

// Valhalla returns polyline6-encoded leg shapes; decode to [lng, lat] pairs.
function decodePolyline6(str: string): [number, number][] {
	let index = 0;
	let lat = 0;
	let lng = 0;
	const coords: [number, number][] = [];
	while (index < str.length) {
		let shift = 0;
		let result = 0;
		let b: number;
		do {
			b = str.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		lat += result & 1 ? ~(result >> 1) : result >> 1;
		shift = 0;
		result = 0;
		do {
			b = str.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		lng += result & 1 ? ~(result >> 1) : result >> 1;
		coords.push([lng / 1e6, lat / 1e6]);
	}
	return coords;
}

type Account = { email: string; password: string; name: string; handle: string };

async function ensureAccount(acc: Account): Promise<{ token: string; user: { id: number; handle: string } }> {
	let res: { accessToken: string; user: { id: number; handle: string } };
	try {
		res = await api("/auth/login-email", { method: "POST", body: { email: acc.email, password: acc.password } });
		log(`logged in ${acc.email}`);
	} catch {
		await api("/auth/signup-email", {
			method: "POST",
			body: { email: acc.email, name: acc.name, password: acc.password },
		});
		const rows = await sql`
			select token from verification_token
			where email = ${acc.email.toLowerCase()} and purpose = 'pending_signup' and used_at is null
			order by created_at desc limit 1`;
		if (!rows[0]?.token) throw new Error(`no verification token for ${acc.email}`);
		res = await api("/auth/verify-email", { method: "POST", body: { token: rows[0].token } });
		log(`created ${acc.email}`);
	}
	await api("/users/me", { method: "PATCH", token: res.accessToken, body: { name: acc.name, handle: acc.handle } });
	return { token: res.accessToken, user: res.user };
}

type RouteSeed = {
	name: string;
	description?: string;
	activity: "run" | "cycle" | "walk";
	visibility: "private" | "unlisted" | "public";
	tags?: string[];
	favourite?: boolean;
	waypoints: [number, number][]; // [lng, lat]
};

async function routeGeometry(activity: RouteSeed["activity"], waypoints: [number, number][]) {
	const locations = waypoints.map(([lon, lat]) => ({ lat, lon }));
	try {
		const r = await api<{ legs: { shape: string; summary: { length: number; time: number } }[] }>("/routing/route", {
			method: "POST",
			body: {
				activity,
				preferences: { surfacePreference: "mixed", avoidFerries: false, avoidHighways: false },
				locations,
			},
		});
		const geometry = r.legs.flatMap((l) => decodePolyline6(l.shape));
		const distance = r.legs.reduce((s, l) => s + l.summary.length, 0) * 1000;
		const duration = r.legs.reduce((s, l) => s + l.summary.time, 0);
		return { geometry, distance, duration };
	} catch (err) {
		log(`routing failed for "${activity}" (${(err as Error).message.slice(0, 80)}); using straight waypoints`);
		return { geometry: waypoints, distance: undefined, duration: undefined };
	}
}

async function createRoute(token: string, seed: RouteSeed): Promise<number> {
	const { geometry, distance, duration } = await routeGeometry(seed.activity, seed.waypoints);
	const elevationGain = Math.round(80 + geometry.length / 30);
	const created = await api<{ id: number }>("/routes", {
		method: "POST",
		token,
		body: {
			name: seed.name,
			description: seed.description,
			activity: seed.activity,
			visibility: seed.visibility,
			tags: seed.tags,
			favourite: seed.favourite,
			waypoints: seed.waypoints.map((coord) => ({ coord, type: "routed" })),
			geometry,
			distance,
			duration,
			elevationGain,
			startAddress: "Ghent, East Flanders",
			endAddress: "Ghent, East Flanders",
		},
	});
	log(`route "${seed.name}" -> #${created.id}`);
	return created.id;
}

const HERO_ROUTES: RouteSeed[] = [
	{
		name: "Ghent canals loop",
		description: "A relaxed spin along the Coupure and the Leie, finishing at the Gravensteen.",
		activity: "cycle",
		visibility: "public",
		tags: ["scenic", "canal"],
		favourite: true,
		waypoints: [
			[3.7174, 51.0543],
			[3.709, 51.06],
			[3.726, 51.061],
			[3.7174, 51.0543],
		],
	},
	{
		name: "Leie riverside run",
		activity: "run",
		visibility: "private",
		tags: ["training", "riverside"],
		waypoints: [
			[3.7166, 51.0397],
			[3.7, 51.033],
			[3.685, 51.028],
		],
	},
	{
		name: "Sunday gravel",
		activity: "cycle",
		visibility: "public",
		tags: ["gravel", "weekend"],
		waypoints: [
			[3.7209, 51.0577],
			[3.74, 51.07],
			[3.76, 51.075],
		],
	},
	{
		name: "Bruges day ride",
		activity: "cycle",
		visibility: "unlisted",
		tags: ["holiday-2026"],
		waypoints: [
			[3.2247, 51.2093],
			[3.235, 51.218],
			[3.224, 51.209],
		],
	},
	{
		name: "Ardennes climb",
		activity: "cycle",
		visibility: "private",
		tags: ["wishlist", "climb"],
		waypoints: [
			[5.864, 50.492],
			[5.885, 50.5],
			[5.9, 50.51],
		],
	},
];

const FRIEND_ROUTES: RouteSeed[] = [
	{
		name: "Citadelpark intervals",
		activity: "run",
		visibility: "public",
		tags: ["intervals"],
		waypoints: [
			[3.7235, 51.038],
			[3.726, 51.041],
			[3.7235, 51.038],
		],
	},
	{
		name: "Scheldt valley cruise",
		activity: "cycle",
		visibility: "public",
		tags: ["scenic"],
		waypoints: [
			[3.73, 51.02],
			[3.78, 51.0],
			[3.82, 50.98],
		],
	},
	{
		name: "A gift for you: Lys loop",
		activity: "cycle",
		visibility: "public",
		tags: ["flat"],
		waypoints: [
			[3.7, 50.99],
			[3.66, 50.97],
			[3.7, 50.99],
		],
	},
];

async function main() {
	log(`API ${API}`);
	const hero = await ensureAccount(HERO);
	const friend = await ensureAccount(FRIEND);

	const heroRoutes = await api<{ id: number }[]>("/routes", { token: hero.token });
	if (heroRoutes.length === 0) {
		const ids: number[] = [];
		for (const seed of HERO_ROUTES) ids.push(await createRoute(hero.token, seed));

		const holiday = await api<{ id: number }>("/collections", {
			method: "POST",
			token: hero.token,
			body: { name: "Holiday 2026", description: "Routes for the summer trip.", visibility: "unlisted" },
		});
		await api(`/collections/${holiday.id}/routes`, {
			method: "PUT",
			token: hero.token,
			body: { routeIds: [ids[3], ids[4]] },
		});
		const training = await api<{ id: number }>("/collections", {
			method: "POST",
			token: hero.token,
			body: { name: "Training block", visibility: "private" },
		});
		await api(`/collections/${training.id}/routes`, {
			method: "PUT",
			token: hero.token,
			body: { routeIds: [ids[1]] },
		});
		log("collections created");

		for (const label of ["backup script (laptop)", "github action"]) {
			await api("/auth/tokens", {
				method: "POST",
				token: hero.token,
				body: { label, scope: label.includes("github") ? "write" : "read" },
			});
		}
		log("API tokens created");
	} else {
		log(`hero already has ${heroRoutes.length} routes, skipping content`);
	}

	let friendRoutes = await api<{ id: number; name: string }[]>("/routes", { token: friend.token });
	if (friendRoutes.length === 0) {
		for (const seed of FRIEND_ROUTES) await createRoute(friend.token, seed);
		friendRoutes = await api<{ id: number; name: string }[]>("/routes", { token: friend.token });
	}
	const giftId = (friendRoutes.find((r) => r.name.includes("Lys loop")) ?? friendRoutes[0])?.id;

	// Relationships: hero follows friend (feed + following tab), friend follows
	// hero (follower notification), friend sends hero a route (inbox + share
	// notification).
	await api(`/social/follows/${FRIEND.handle}`, { method: "POST", token: hero.token }).catch(() => undefined);
	await api(`/social/follows/${HERO.handle}`, { method: "POST", token: friend.token }).catch(() => undefined);
	if (giftId !== undefined) {
		await api("/social/shares", {
			method: "POST",
			token: friend.token,
			body: { routeId: giftId, recipientHandle: HERO.handle, message: "Thought you'd enjoy this flat Lys loop!" },
		}).catch((e) => log(`share skipped: ${(e as Error).message.slice(0, 80)}`));
	}
	log("relationships wired");

	log(`HERO email=${HERO.email} password=${HERO.password} handle=${HERO.handle}`);
	await sql.end();
	log("done");
}

main().catch(async (err) => {
	process.stderr.write(`${err}\n`);
	try {
		await sql.end();
	} catch {
		// ignore close errors during failure cleanup
	}
	process.exit(1);
});
