import type { Command } from "commander";
import { request } from "../client";
import { loadConfig, requireToken } from "../config";
import { CliError, EXIT_CODES, type RunOptions, renderResult } from "../output";

interface RouteResponse {
	id: number;
	name: string;
	description?: string | null;
	activity?: string | null;
	visibility: "private" | "unlisted" | "public";
	tags: string[];
	distance?: number | null;
	duration?: number | null;
	elevationGain?: number | null;
	createdAt: string;
	updatedAt: string;
}

interface UpdateRouteBody {
	name?: string;
	activity?: string;
	visibility?: "private" | "unlisted" | "public";
}

function formatRouteRow(route: RouteResponse): string {
	const distanceKm = route.distance ? `${(route.distance / 1000).toFixed(1)}km` : "—";
	const activity = route.activity ?? "—";
	return `${route.id}\t${route.name}\t${activity}\t${route.visibility}\t${distanceKm}`;
}

export function registerRoutesCommands(program: Command): void {
	const routes = program.command("routes").description("List, inspect, and edit metadata of saved routes.");

	routes
		.command("list")
		.description("List the authenticated user's routes.")
		.action(async () => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const items = await request<RouteResponse[]>(config, "/api/v1/routes");
				renderResult(runOptions, items, (data) => {
					if (data.length === 0) {
						return "No routes.";
					}
					const header = "id\tname\tactivity\tprivacy\tdistance";
					const body = data.map(formatRouteRow).join("\n");
					return `${header}\n${body}`;
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
				const numericId = parseId(id);
				const route = await request<RouteResponse>(config, `/api/v1/routes/${numericId}`);
				renderResult(runOptions, route, (data) => {
					const distanceKm = data.distance ? `${(data.distance / 1000).toFixed(2)} km` : "n/a";
					const lines = [
						`Route ${data.id}: ${data.name}`,
						`  activity  : ${data.activity ?? "n/a"}`,
						`  visibility: ${data.visibility}`,
						`  distance  : ${distanceKm}`,
						`  tags      : ${data.tags.join(", ") || "(none)"}`,
						`  created   : ${data.createdAt}`,
						`  updated   : ${data.updatedAt}`,
					];
					return lines.join("\n");
				});
			});
		});

	routes
		.command("update <id>")
		.description(
			"Update metadata on a route (name / activity / visibility). Body fields are optional but at least one is required.",
		)
		.option("--name <name>", "rename the route")
		.option("--activity <activity>", "set the activity (e.g. run, cycle, walk)")
		.option("--visibility <visibility>", "set the visibility: private | unlisted | public")
		.option("--confirm", "set X-Routess-Confirm: true (required when --visibility is public)")
		.action(async (id: string, options: UpdateRouteBody & { confirm?: boolean }) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const body: UpdateRouteBody = {};
				if (options.name !== undefined) body.name = options.name;
				if (options.activity !== undefined) body.activity = options.activity;
				if (options.visibility !== undefined) body.visibility = options.visibility;
				if (Object.keys(body).length === 0) {
					throw new CliError("At least one of --name, --activity, --visibility is required.", EXIT_CODES.USAGE);
				}
				const numericId = parseId(id);
				const route = await request<RouteResponse>(config, `/api/v1/routes/${numericId}`, {
					method: "PATCH",
					body,
					confirm: options.confirm,
				});
				renderResult(runOptions, route, (data) => `Updated route ${data.id}: ${data.name} (${data.visibility}).`);
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
				const numericId = parseId(id);
				const result = await request<{ success: boolean; message: string }>(config, `/api/v1/routes/${numericId}`, {
					method: "DELETE",
					confirm: options.confirm,
				});
				renderResult(runOptions, result, (data) => data.message);
			});
		});
}

function parseId(id: string): number {
	const numeric = Number(id);
	if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric <= 0) {
		throw new CliError(`Invalid route id: ${id}`, EXIT_CODES.USAGE);
	}
	return numeric;
}

async function runWithProgram(program: Command, action: (options: RunOptions) => Promise<void>): Promise<void> {
	const opts = program.opts<{ json?: boolean }>();
	const runOptions: RunOptions = { json: Boolean(opts.json) };
	try {
		await action(runOptions);
	} catch (error) {
		const { renderError } = await import("../output");
		const code = renderError(runOptions, error);
		process.exit(code);
	}
}
