import type { Command } from "commander";
import { request } from "../client";
import { loadConfig, requireToken } from "../config";
import { CliError, EXIT_CODES, renderResult } from "../output";
import { runWithProgram } from "../run";
import { formatRouteRow, parseId, type RouteResponse } from "./routes";

interface CollectionResponse {
	id: number;
	name: string;
	description?: string;
	visibility: "private" | "unlisted" | "public";
	routeIds: number[];
	routeCount: number;
	shareToken: string;
	createdAt: string;
	updatedAt: string;
}

interface CollectionDetailResponse extends CollectionResponse {
	routes: RouteResponse[];
}

const VISIBILITIES = ["private", "unlisted", "public"] as const;

function parseVisibility(value: string): (typeof VISIBILITIES)[number] {
	if (!(VISIBILITIES as readonly string[]).includes(value)) {
		throw new CliError(`Invalid --visibility: ${value}. One of: ${VISIBILITIES.join(", ")}`, EXIT_CODES.USAGE);
	}
	return value as (typeof VISIBILITIES)[number];
}

function parseRef(ref: string): string {
	if (/^[0-9a-f]{32}$/.test(ref)) return ref;
	return String(parseId(ref));
}

function parseRouteIds(value: string): number[] {
	if (value.trim() === "") return [];
	return value.split(",").map((part) => {
		const id = Number(part.trim());
		if (!Number.isInteger(id) || id <= 0) {
			throw new CliError(`Invalid route id in --routes: ${part.trim()}`, EXIT_CODES.USAGE);
		}
		return id;
	});
}

function formatCollectionRow(collection: CollectionResponse): string {
	return `${collection.id}\t${collection.name}\t${collection.visibility}\t${collection.routeCount} routes`;
}

export function registerCollectionsCommands(program: Command): void {
	const collections = program
		.command("collections")
		.description("Group saved routes into collections: list, inspect, create, edit, and set membership.");

	collections
		.command("list")
		.description("List the authenticated user's collections, newest first.")
		.action(async () => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const items = await request<CollectionResponse[]>(config, "/api/v1/collections");
				renderResult(runOptions, items, (data) => {
					if (data.length === 0) {
						return "No collections.";
					}
					const header = "id\tname\tprivacy\troutes";
					return `${header}\n${data.map(formatCollectionRow).join("\n")}`;
				});
			});
		});

	collections
		.command("get <ref>")
		.description("Fetch a collection with its routes. `ref` is a collection id or a 32-hex share token.")
		.action(async (ref: string) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				const detail = await request<CollectionDetailResponse>(config, `/api/v1/collections/${parseRef(ref)}`);
				renderResult(runOptions, detail, (data) => {
					const lines = [
						`Collection ${data.id}: ${data.name}`,
						`  visibility: ${data.visibility}`,
						...(data.description ? [`  notes     : ${data.description}`] : []),
						`  share     : ${data.shareToken}`,
						`  routes    : ${data.routeCount}`,
					];
					if (data.routes.length > 0) {
						lines.push("", "id\tname\tactivity\tprivacy\tdistance");
						lines.push(...data.routes.map(formatRouteRow));
					}
					return lines.join("\n");
				});
			});
		});

	collections
		.command("create")
		.description("Create a collection.")
		.requiredOption("--name <name>", "collection name")
		.option("--description <text>", "optional description")
		.option("--visibility <visibility>", `set the visibility: ${VISIBILITIES.join(" | ")} (default private)`)
		.action(async (options: { name: string; description?: string; visibility?: string }) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const collection = await request<CollectionResponse>(config, "/api/v1/collections", {
					method: "POST",
					body: {
						name: options.name,
						...(options.description !== undefined ? { description: options.description } : {}),
						...(options.visibility !== undefined ? { visibility: parseVisibility(options.visibility) } : {}),
					},
				});
				renderResult(
					runOptions,
					collection,
					(data) => `Created collection ${data.id}: ${data.name} (${data.visibility}).`,
				);
			});
		});

	collections
		.command("update <id>")
		.description("Update collection metadata. At least one field option is required.")
		.option("--name <name>", "rename the collection")
		.option("--description <text>", "set the description")
		.option("--visibility <visibility>", `set the visibility: ${VISIBILITIES.join(" | ")}`)
		.option("--confirm", "set X-Routess-Confirm: true (required when --visibility is public)")
		.action(
			async (id: string, options: { name?: string; description?: string; visibility?: string; confirm?: boolean }) => {
				await runWithProgram(program, async (runOptions) => {
					const config = loadConfig();
					requireToken(config);
					const body: Record<string, string> = {};
					if (options.name !== undefined) body.name = options.name;
					if (options.description !== undefined) body.description = options.description;
					if (options.visibility !== undefined) body.visibility = parseVisibility(options.visibility);
					if (Object.keys(body).length === 0) {
						throw new CliError("At least one of --name, --description, --visibility is required.", EXIT_CODES.USAGE);
					}
					const collection = await request<CollectionResponse>(config, `/api/v1/collections/${parseId(id)}`, {
						method: "PATCH",
						body,
						confirm: options.confirm,
					});
					renderResult(
						runOptions,
						collection,
						(data) => `Updated collection ${data.id}: ${data.name} (${data.visibility}).`,
					);
				});
			},
		);

	collections
		.command("set-routes <id>")
		.description("Replace the collection's full ordered membership. Order defines route position.")
		.requiredOption("--routes <ids>", "comma-separated route ids (empty string empties the collection)")
		.action(async (id: string, options: { routes: string }) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const detail = await request<CollectionDetailResponse>(config, `/api/v1/collections/${parseId(id)}/routes`, {
					method: "PUT",
					body: { routeIds: parseRouteIds(options.routes) },
				});
				renderResult(
					runOptions,
					detail,
					(data) => `Collection ${data.id} (${data.name}) now holds ${data.routeCount} routes.`,
				);
			});
		});

	collections
		.command("delete <id>")
		.description("Delete a collection (routes inside are kept). PAT callers must pass --confirm.")
		.option("--confirm", "set X-Routess-Confirm: true")
		.action(async (id: string, options: { confirm?: boolean }) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const result = await request<{ success: boolean; message: string }>(
					config,
					`/api/v1/collections/${parseId(id)}`,
					{ method: "DELETE", confirm: options.confirm },
				);
				renderResult(runOptions, result, (data) => data.message);
			});
		});
}
