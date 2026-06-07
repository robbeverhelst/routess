import { readFileSync, writeFileSync } from "node:fs";
import { calculatePathDistance, ROUTE_ACTIVITIES, type RouteActivity, type Waypoint } from "@routess/core";
import type { Command } from "commander";
import { request, requestRaw, requestWithHeaders } from "../client";
import { loadConfig, requireToken } from "../config";
import { parseGpx } from "../gpx";
import { CliError, EXIT_CODES, renderResult } from "../output";
import { runWithProgram } from "../run";

export interface RouteResponse {
	id: number;
	name: string;
	description?: string | null;
	activity?: string | null;
	visibility: "private" | "unlisted" | "public";
	tags: string[];
	favourite: boolean;
	distance?: number | null;
	duration?: number | null;
	elevationGain?: number | null;
	shareToken?: string;
	createdAt: string;
	updatedAt: string;
}

interface PublicRouteSummary {
	id: number;
	name: string;
	distance?: number | null;
	updatedAt: string;
}

interface UpdateRouteBody {
	name?: string;
	description?: string;
	activity?: string;
	visibility?: "private" | "unlisted" | "public";
	tags?: string[];
	favourite?: boolean;
}

interface CreateRouteBody extends UpdateRouteBody {
	name: string;
	waypoints: Waypoint[];
	geometry?: [number, number][];
	distance?: number;
	provenance?: string;
}

const VISIBILITIES = ["private", "unlisted", "public"] as const;

export function formatRouteRow(route: RouteResponse): string {
	const distanceKm = route.distance ? `${(route.distance / 1000).toFixed(1)}km` : "n/a";
	const activity = route.activity ?? "n/a";
	const fav = route.favourite ? "*" : "";
	return `${route.id}\t${route.name}${fav}\t${activity}\t${route.visibility}\t${distanceKm}`;
}

export function parsePaging(options: { limit?: string; offset?: string }): string {
	const params = new URLSearchParams();
	if (options.limit !== undefined) {
		const limit = Number(options.limit);
		if (!Number.isInteger(limit) || limit <= 0)
			throw new CliError(`Invalid --limit: ${options.limit}`, EXIT_CODES.USAGE);
		params.set("limit", String(limit));
	}
	if (options.offset !== undefined) {
		const offset = Number(options.offset);
		if (!Number.isInteger(offset) || offset < 0)
			throw new CliError(`Invalid --offset: ${options.offset}`, EXIT_CODES.USAGE);
		params.set("offset", String(offset));
	}
	const query = params.toString();
	return query ? `?${query}` : "";
}

function parseActivity(value: string): RouteActivity {
	if (!(ROUTE_ACTIVITIES as readonly string[]).includes(value)) {
		throw new CliError(`Invalid --activity: ${value}. One of: ${ROUTE_ACTIVITIES.join(", ")}`, EXIT_CODES.USAGE);
	}
	return value as RouteActivity;
}

function parseVisibility(value: string): (typeof VISIBILITIES)[number] {
	if (!(VISIBILITIES as readonly string[]).includes(value)) {
		throw new CliError(`Invalid --visibility: ${value}. One of: ${VISIBILITIES.join(", ")}`, EXIT_CODES.USAGE);
	}
	return value as (typeof VISIBILITIES)[number];
}

export function parseId(id: string): number {
	const numeric = Number(id);
	if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric <= 0) {
		throw new CliError(`Invalid id: ${id}`, EXIT_CODES.USAGE);
	}
	return numeric;
}

// `ref` params accept a numeric route ID or a 32-hex share token.
function parseRef(ref: string): string {
	if (/^[0-9a-f]{32}$/.test(ref)) return ref;
	return String(parseId(ref));
}

function renderRouteDetail(data: RouteResponse): string {
	const distanceKm = data.distance ? `${(data.distance / 1000).toFixed(2)} km` : "n/a";
	const lines = [
		`Route ${data.id}: ${data.name}`,
		`  activity  : ${data.activity ?? "n/a"}`,
		`  visibility: ${data.visibility}`,
		`  favourite : ${data.favourite ? "yes" : "no"}`,
		`  distance  : ${distanceKm}`,
		`  tags      : ${data.tags.join(", ") || "(none)"}`,
		...(data.description ? [`  notes     : ${data.description}`] : []),
		...(data.shareToken ? [`  share     : ${data.shareToken}`] : []),
		`  created   : ${data.createdAt}`,
		`  updated   : ${data.updatedAt}`,
	];
	return lines.join("\n");
}

export function registerRoutesCommands(program: Command): void {
	const routes = program.command("routes").description("List, inspect, create, import, export, and edit saved routes.");

	routes
		.command("list")
		.description("List the authenticated user's routes, newest first.")
		.option("--limit <n>", "page size (server default applies when omitted)")
		.option("--offset <n>", "number of routes to skip")
		.action(async (options: { limit?: string; offset?: string }) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const { data, headers } = await requestWithHeaders<RouteResponse[]>(
					config,
					`/api/v1/routes${parsePaging(options)}`,
				);
				const total = headers.get("x-total-count");
				renderResult(runOptions, data, (items) => {
					if (items.length === 0) {
						return "No routes.";
					}
					const header = "id\tname\tactivity\tprivacy\tdistance";
					const body = items.map(formatRouteRow).join("\n");
					const footer = total ? `\nshowing ${items.length} of ${total}` : "";
					return `${header}\n${body}${footer}`;
				});
			});
		});

	routes
		.command("public")
		.description("List indexable public routes. No authentication required.")
		.option("--limit <n>", "page size (server default applies when omitted)")
		.option("--offset <n>", "number of routes to skip")
		.action(async (options: { limit?: string; offset?: string }) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				const { data, headers } = await requestWithHeaders<PublicRouteSummary[]>(
					config,
					`/api/v1/routes/public${parsePaging(options)}`,
				);
				const total = headers.get("x-total-count");
				renderResult(runOptions, data, (items) => {
					if (items.length === 0) {
						return "No public routes.";
					}
					const header = "id\tname\tdistance\tupdated";
					const body = items
						.map(
							(r) =>
								`${r.id}\t${r.name}\t${r.distance ? `${(r.distance / 1000).toFixed(1)}km` : "n/a"}\t${r.updatedAt}`,
						)
						.join("\n");
					const footer = total ? `\nshowing ${items.length} of ${total}` : "";
					return `${header}\n${body}${footer}`;
				});
			});
		});

	routes
		.command("get <id>")
		.description("Fetch a single route by id.")
		.action(async (id: string) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const route = await request<RouteResponse>(config, `/api/v1/routes/${parseId(id)}`);
				renderResult(runOptions, route, renderRouteDetail);
			});
		});

	routes
		.command("gpx <ref>")
		.description(
			"Download a route as GPX. `ref` is a route id or a 32-hex share token; public/shared routes need no auth.",
		)
		.option("-o, --output <file>", "write to a file instead of stdout")
		.action(async (ref: string, options: { output?: string }) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				const raw = await requestRaw(config, `/api/v1/routes/${parseRef(ref)}/gpx`);
				const gpx = new TextDecoder().decode(raw.bytes);
				if (options.output) {
					writeFileSync(options.output, gpx, "utf8");
					renderResult(
						runOptions,
						{ path: options.output, bytes: raw.bytes.length },
						(data) => `Wrote ${data.bytes} bytes to ${data.path}.`,
					);
					return;
				}
				process.stdout.write(gpx.endsWith("\n") ? gpx : `${gpx}\n`);
			});
		});

	routes
		.command("create")
		.description("Create a route from a CreateRoute JSON payload (file path or `-` for stdin).")
		.requiredOption("--from <file>", "JSON file matching the POST /api/v1/routes body, or - for stdin")
		.option("--confirm", "set X-Routess-Confirm: true (required when the payload sets visibility: public)")
		.action(async (options: { from: string; confirm?: boolean }) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const raw = options.from === "-" ? readFileSync(0, "utf8") : readFileSync(options.from, "utf8");
				let body: CreateRouteBody;
				try {
					body = JSON.parse(raw) as CreateRouteBody;
				} catch (cause) {
					throw new CliError(
						`Payload is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
						EXIT_CODES.USAGE,
					);
				}
				const route = await request<RouteResponse>(config, "/api/v1/routes", {
					method: "POST",
					body,
					confirm: options.confirm,
				});
				renderResult(runOptions, route, (data) => `Created route ${data.id}: ${data.name} (${data.visibility}).`);
			});
		});

	routes
		.command("import <file>")
		.description("Import a GPX file as a new private route in the library.")
		.option("--name <name>", "route name (defaults to the GPX metadata name, then the file name)")
		.option("--activity <activity>", `set the activity: ${ROUTE_ACTIVITIES.join(" | ")}`)
		.option("--visibility <visibility>", `set the visibility: ${VISIBILITIES.join(" | ")} (default private)`)
		.option("--confirm", "set X-Routess-Confirm: true (required when --visibility is public)")
		.action(
			async (file: string, options: { name?: string; activity?: string; visibility?: string; confirm?: boolean }) => {
				await runWithProgram(program, async (runOptions) => {
					const config = loadConfig();
					requireToken(config);
					const xml = readFileSync(file, "utf8");
					const parsed = parseGpx(xml);
					const geometry = parsed.trackPoints.length >= 2 ? parsed.trackPoints : undefined;
					let waypoints = parsed.waypoints;
					if (waypoints.length === 0 && geometry) {
						// Track-only file: anchor the route on the track endpoints.
						waypoints = [
							{ coord: geometry[0], type: "routed" },
							{ coord: geometry[geometry.length - 1], type: "routed" },
						];
					}
					if (waypoints.length === 0) {
						throw new CliError("No waypoints or track points found in the GPX file.", EXIT_CODES.USAGE);
					}
					const fileName = file.split("/").pop();
					const name = options.name?.trim() || parsed.name || fileName?.replace(/\.[^.]+$/, "") || "Imported route";
					const distancePath = geometry ?? waypoints.map((w) => w.coord);
					const body: CreateRouteBody = {
						name,
						visibility: options.visibility ? parseVisibility(options.visibility) : "private",
						waypoints,
						...(geometry ? { geometry } : {}),
						distance: Math.round(calculatePathDistance(distancePath) * 1000),
						...(options.activity ? { activity: parseActivity(options.activity) } : {}),
						provenance: "gpx-import",
					};
					const route = await request<RouteResponse>(config, "/api/v1/routes", {
						method: "POST",
						body,
						confirm: options.confirm,
					});
					renderResult(
						runOptions,
						route,
						(data) =>
							`Imported route ${data.id}: ${data.name} (${data.visibility}, ${data.distance ? `${(data.distance / 1000).toFixed(1)}km` : "n/a"}).`,
					);
				});
			},
		);

	routes
		.command("update <id>")
		.description("Update metadata on a route. At least one field option is required.")
		.option("--name <name>", "rename the route")
		.option("--description <text>", "set the description (empty string clears it)")
		.option("--activity <activity>", `set the activity: ${ROUTE_ACTIVITIES.join(" | ")}`)
		.option("--visibility <visibility>", `set the visibility: ${VISIBILITIES.join(" | ")}`)
		.option("--tags <tags>", "comma-separated tag list (empty string clears all tags)")
		.option("--favourite", "mark the route as a favourite")
		.option("--no-favourite", "remove the route from favourites")
		.option("--confirm", "set X-Routess-Confirm: true (required when --visibility is public)")
		.action(
			async (
				id: string,
				options: {
					name?: string;
					description?: string;
					activity?: string;
					visibility?: string;
					tags?: string;
					favourite?: boolean;
					confirm?: boolean;
				},
			) => {
				await runWithProgram(program, async (runOptions) => {
					const config = loadConfig();
					requireToken(config);
					const body: UpdateRouteBody = {};
					if (options.name !== undefined) body.name = options.name;
					if (options.description !== undefined) body.description = options.description;
					if (options.activity !== undefined) body.activity = parseActivity(options.activity);
					if (options.visibility !== undefined) body.visibility = parseVisibility(options.visibility);
					if (options.tags !== undefined) {
						body.tags = options.tags
							.split(",")
							.map((tag) => tag.trim())
							.filter((tag) => tag.length > 0);
					}
					if (options.favourite !== undefined) body.favourite = options.favourite;
					if (Object.keys(body).length === 0) {
						throw new CliError(
							"At least one of --name, --description, --activity, --visibility, --tags, --favourite/--no-favourite is required.",
							EXIT_CODES.USAGE,
						);
					}
					const route = await request<RouteResponse>(config, `/api/v1/routes/${parseId(id)}`, {
						method: "PATCH",
						body,
						confirm: options.confirm,
					});
					renderResult(runOptions, route, (data) => `Updated route ${data.id}: ${data.name} (${data.visibility}).`);
				});
			},
		);

	routes
		.command("favourite <id>")
		.description("Mark a route as a favourite.")
		.action(async (id: string) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const route = await request<RouteResponse>(config, `/api/v1/routes/${parseId(id)}`, {
					method: "PATCH",
					body: { favourite: true },
				});
				renderResult(runOptions, route, (data) => `Route ${data.id} (${data.name}) is now a favourite.`);
			});
		});

	routes
		.command("unfavourite <id>")
		.description("Remove a route from favourites.")
		.action(async (id: string) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const route = await request<RouteResponse>(config, `/api/v1/routes/${parseId(id)}`, {
					method: "PATCH",
					body: { favourite: false },
				});
				renderResult(runOptions, route, (data) => `Route ${data.id} (${data.name}) is no longer a favourite.`);
			});
		});

	routes
		.command("delete <id>")
		.description("Delete a route. PAT callers must pass --confirm.")
		.option("--confirm", "set X-Routess-Confirm: true")
		.action(async (id: string, options: { confirm?: boolean }) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const result = await request<{ success: boolean; message: string }>(config, `/api/v1/routes/${parseId(id)}`, {
					method: "DELETE",
					confirm: options.confirm,
				});
				renderResult(runOptions, result, (data) => data.message);
			});
		});
}
