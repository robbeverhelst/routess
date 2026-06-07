import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	decodePolyline6,
	HEADINGS,
	type Heading,
	ROUTE_ACTIVITIES,
	type RouteActivity,
	SURFACE_TYPES,
	type Waypoint,
} from "@routess/core";
import type { Command } from "commander";
import { request } from "../client";
import { loadConfig, requireToken } from "../config";
import { buildGpx } from "../gpx";
import { CliError, EXIT_CODES, type RunOptions, renderResult } from "../output";
import { runWithProgram } from "../run";
import type { RouteResponse } from "./routes";

interface Location {
	lat: number;
	lon: number;
}

interface GenerationCandidate {
	bearingDeg: number;
	viaPoints: Location[];
	shape: string;
	distanceKm: number;
	durationSeconds: number;
	overlapPct: number;
	score: number;
	lowQuality: boolean;
	surfaceMetersByBucket: Record<string, number>;
}

interface GenerateResponse {
	candidates: GenerationCandidate[];
	failure?: { code: string; bestOverlapPct?: number };
}

const FAILURE_MESSAGES: Record<string, string> = {
	invalid_input: "The generation parameters were rejected.",
	start_not_routable: "The start point could not be snapped to a routable road. Move it closer to a road.",
	no_candidates_routable: "No loop could be routed from this start with these parameters. Try a different distance.",
	all_candidates_low_quality: "Every candidate loop had too much overlap. Try a different heading or distance.",
	all_bearings_excluded: "All fan bearings were excluded. Drop --exclude-bearings to start over.",
	provider_unavailable: "The routing provider is unavailable. Try again later.",
};

function parseStart(value: string): Location {
	const parts = value.split(",").map((part) => Number(part.trim()));
	if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
		throw new CliError(`Invalid --start: ${value}. Expected "lat,lng".`, EXIT_CODES.USAGE);
	}
	const [lat, lon] = parts;
	if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
		throw new CliError(`Invalid --start: ${value}. Latitude must be -90..90, longitude -180..180.`, EXIT_CODES.USAGE);
	}
	return { lat, lon };
}

function parseChoice<T extends string>(flag: string, value: string, choices: readonly T[]): T {
	if (!(choices as readonly string[]).includes(value)) {
		throw new CliError(`Invalid ${flag}: ${value}. One of: ${choices.join(", ")}`, EXIT_CODES.USAGE);
	}
	return value as T;
}

function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.round((seconds % 3600) / 60);
	return hours > 0 ? `${hours}h${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

function formatSurfaces(metersByBucket: Record<string, number>): string {
	const total = Object.values(metersByBucket).reduce((sum, m) => sum + m, 0);
	if (total === 0) return "n/a";
	return Object.entries(metersByBucket)
		.filter(([, meters]) => meters > 0)
		.sort(([, a], [, b]) => b - a)
		.map(([bucket, meters]) => `${bucket} ${Math.round((meters / total) * 100)}%`)
		.join(", ");
}

function renderCandidates(data: GenerateResponse): string {
	const header = "#\tbearing\tdistance\tduration\toverlap\tscore\tsurfaces";
	const rows = data.candidates.map((candidate, index) => {
		const quality = candidate.lowQuality ? " (low quality)" : "";
		return [
			`${index + 1}`,
			`${Math.round(candidate.bearingDeg)}°`,
			`${candidate.distanceKm.toFixed(1)}km`,
			formatDuration(candidate.durationSeconds),
			`${candidate.overlapPct.toFixed(1)}%`,
			`${candidate.score.toFixed(2)}${quality}`,
			formatSurfaces(candidate.surfaceMetersByBucket),
		].join("\t");
	});
	return `${header}\n${rows.join("\n")}`;
}

function candidateWaypoints(start: Location, candidate: GenerationCandidate): Waypoint[] {
	return [start, ...candidate.viaPoints, start].map((point) => ({
		coord: [point.lon, point.lat] as [number, number],
		type: "routed" as const,
	}));
}

interface GenerateOptions {
	start: string;
	activity: string;
	distance: string;
	heading: string;
	surface: string;
	avoidFerries?: boolean;
	avoidHighways?: boolean;
	excludeBearings?: string;
	gpxDir?: string;
	save?: string | boolean;
	name?: string;
}

async function saveCandidate(
	runOptions: RunOptions,
	options: GenerateOptions,
	start: Location,
	activity: RouteActivity,
	preferences: { surfacePreference: string; avoidFerries: boolean; avoidHighways: boolean },
	candidate: GenerationCandidate,
	index: number,
): Promise<void> {
	const config = loadConfig();
	requireToken(config);
	const name = options.name?.trim() || `Generated ${activity} loop ${candidate.distanceKm.toFixed(0)}km`;
	const route = await request<RouteResponse>(config, "/api/v1/routes", {
		method: "POST",
		body: {
			name,
			activity,
			visibility: "private",
			waypoints: candidateWaypoints(start, candidate),
			geometry: decodePolyline6(candidate.shape),
			distance: Math.round(candidate.distanceKm * 1000),
			duration: Math.round(candidate.durationSeconds),
			routingPreferences: preferences,
			provenance: "generation",
		},
	});
	renderResult(
		runOptions,
		route,
		(data) => `Saved candidate ${index + 1} as route ${data.id}: ${data.name} (${data.visibility}).`,
	);
}

export function registerGenerateCommand(program: Command): void {
	program
		.command("generate")
		.description(
			"Generate loop route candidates from a start point and target distance. Works without authentication; --save needs a write token.",
		)
		.requiredOption("--start <lat,lng>", 'loop start point, e.g. "50.8467,4.3525"')
		.requiredOption("--activity <activity>", `activity: ${ROUTE_ACTIVITIES.join(" | ")}`)
		.requiredOption("--distance <km>", "target loop distance in kilometers (1-200)")
		.option("--heading <heading>", `compass arc to extend toward: ${HEADINGS.join(" | ")}`, "any")
		.option("--surface <surface>", `surface preference: ${SURFACE_TYPES.join(" | ")}`, "mixed")
		.option("--avoid-ferries", "avoid ferries", false)
		.option("--avoid-highways", "avoid highways", false)
		.option("--exclude-bearings <degrees>", "comma-separated bearings already seen; regenerates fresh shapes")
		.option("--gpx-dir <dir>", "write each candidate as candidate-<n>.gpx into this directory")
		.option("--save [n]", "save candidate n (1-based, default 1) to the library as a private route")
		.option("--name <name>", "route name to use with --save")
		.action(async (options: GenerateOptions) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				const start = parseStart(options.start);
				const activity = parseChoice("--activity", options.activity, ROUTE_ACTIVITIES);
				const heading: Heading = parseChoice("--heading", options.heading, HEADINGS);
				const surface = parseChoice("--surface", options.surface, SURFACE_TYPES);
				const targetDistanceKm = Number(options.distance);
				if (!Number.isFinite(targetDistanceKm) || targetDistanceKm < 1 || targetDistanceKm > 200) {
					throw new CliError(`Invalid --distance: ${options.distance}. Expected 1-200 km.`, EXIT_CODES.USAGE);
				}
				const excludeBearings = options.excludeBearings
					?.split(",")
					.map((part) => Number(part.trim()))
					.filter((n) => Number.isFinite(n));
				const preferences = {
					surfacePreference: surface,
					avoidFerries: Boolean(options.avoidFerries),
					avoidHighways: Boolean(options.avoidHighways),
				};

				const response = await request<GenerateResponse>(config, "/api/v1/generation", {
					method: "POST",
					body: {
						start,
						activity,
						targetDistanceKm,
						heading,
						preferences,
						...(excludeBearings && excludeBearings.length > 0 ? { excludeBearings } : {}),
					},
				});

				if (response.candidates.length === 0) {
					const code = response.failure?.code ?? "unknown";
					const detail =
						response.failure?.bestOverlapPct !== undefined
							? ` Best overlap was ${response.failure.bestOverlapPct.toFixed(1)}%.`
							: "";
					if (runOptions.json) {
						process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
					} else {
						process.stderr.write(`error: generation failed (${code}). ${FAILURE_MESSAGES[code] ?? ""}${detail}\n`);
					}
					process.exit(EXIT_CODES.GENERIC);
				}

				if (options.gpxDir) {
					mkdirSync(options.gpxDir, { recursive: true });
					response.candidates.forEach((candidate, index) => {
						const gpx = buildGpx({
							name: `Generated ${activity} loop, candidate ${index + 1}`,
							waypoints: candidateWaypoints(start, candidate),
							geometry: decodePolyline6(candidate.shape),
						});
						writeFileSync(join(options.gpxDir as string, `candidate-${index + 1}.gpx`), `${gpx}\n`, "utf8");
					});
				}

				renderResult(runOptions, response, (data) => {
					const lines = [renderCandidates(data)];
					if (options.gpxDir) {
						lines.push(`Wrote ${data.candidates.length} GPX files to ${options.gpxDir}.`);
					}
					return lines.join("\n");
				});

				if (options.save !== undefined) {
					const index = options.save === true ? 0 : Number(options.save) - 1;
					if (!Number.isInteger(index) || index < 0 || index >= response.candidates.length) {
						throw new CliError(
							`Invalid --save index: ${options.save}. The response has ${response.candidates.length} candidates.`,
							EXIT_CODES.USAGE,
						);
					}
					await saveCandidate(runOptions, options, start, activity, preferences, response.candidates[index], index);
				}
			});
		});
}
