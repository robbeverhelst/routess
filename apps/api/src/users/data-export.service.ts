import { EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { BadRequestException, Injectable } from "@nestjs/common";
import { normalizeUserPreferences } from "@routess/core";
import JSZip from "jszip";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";

// Hard ceiling on the number of Routes that can be exported in one ZIP.
// Above this, sync request-time export becomes unfriendly (slow, memory).
// Users with more than this should ask for support; an async/queued path is
// future work (ADR worth writing if/when it lands).
const MAX_EXPORT_ROUTES = 1000;

const ROUTESS_GPX_NS = "https://routess.app/gpx/1";

const escapeXml = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");

function slugify(value: string): string {
	return (
		value
			.toLowerCase()
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60) || "route"
	);
}

function routeToGpx(route: Route): string {
	const waypoints = Array.isArray(route.waypoints) ? route.waypoints : [];
	const trkpts = Array.isArray(route.geometry) ? route.geometry : [];
	let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
	xml += `<gpx version="1.1" creator="Routess" xmlns="http://www.topografix.com/GPX/1/1" xmlns:routess="${ROUTESS_GPX_NS}">\n`;
	xml += `  <metadata>\n`;
	xml += `    <name>${escapeXml(route.name)}</name>\n`;
	xml += `    <time>${route.createdAt.toISOString()}</time>\n`;
	xml += `  </metadata>\n`;

	if (waypoints.length > 0) {
		xml += `  <rte>\n    <name>${escapeXml(route.name)}</name>\n`;
		for (const wp of waypoints) {
			xml += `    <rtept lat="${wp.coord[1]}" lon="${wp.coord[0]}">\n`;
			if (wp.name) xml += `      <name>${escapeXml(wp.name)}</name>\n`;
			xml += `      <extensions>\n`;
			xml += `        <routess:type>${wp.type}</routess:type>\n`;
			xml += `      </extensions>\n`;
			xml += `    </rtept>\n`;
		}
		xml += `  </rte>\n`;
	}

	if (trkpts.length > 0) {
		xml += `  <trk>\n    <name>${escapeXml(route.name)}</name>\n    <trkseg>\n`;
		for (const [lon, lat] of trkpts) {
			xml += `      <trkpt lat="${lat}" lon="${lon}"></trkpt>\n`;
		}
		xml += `    </trkseg>\n  </trk>\n`;
	}

	xml += `</gpx>\n`;
	return xml;
}

const README = `routess data export

Files:
  routess-export.json
    Authoritative dump of your account: profile, preferences, and every Route
    you own with its full waypoint and geometry data. This is the file to keep
    if you want to re-import your data into Routess later.

  routes/<id>-<slug>.gpx
    One standard GPX 1.1 file per Route, suitable for importing into Strava,
    Garmin Connect, Komoot, or any other route tool. Routess waypoint type
    information (routed/direct) is preserved in a Routess namespace extension
    that other tools will ignore safely.

This export was generated under your right of access (GDPR Art. 15). For your
right to erasure (Art. 17), delete your account from Settings; deletion is
permanent after a 30-day grace window.
`;

@Injectable()
export class DataExportService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
	) {}

	async buildExportZip(userId: number): Promise<{ filename: string; bytes: Buffer }> {
		const user = await this.userRepository.findOneOrFail({ id: userId });
		const totalRoutes = await this.routeRepository.count({ user: userId });
		if (totalRoutes > MAX_EXPORT_ROUTES) {
			throw new BadRequestException(
				`This account has ${totalRoutes} routes, more than the export limit of ${MAX_EXPORT_ROUTES}. Contact support for a manual export.`,
			);
		}

		const routes = await this.routeRepository.find(
			{ user: userId },
			{ orderBy: { createdAt: "ASC" }, limit: MAX_EXPORT_ROUTES },
		);

		const exportPayload = {
			schemaVersion: 1,
			exportedAt: new Date().toISOString(),
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				avatar: user.avatar ?? null,
				role: user.role,
				preferences: user.preferences ? normalizeUserPreferences(user.preferences) : null,
				createdAt: user.createdAt.toISOString(),
				updatedAt: user.updatedAt.toISOString(),
			},
			routes: routes.map((r) => ({
				id: r.id,
				name: r.name,
				description: r.description ?? null,
				activity: r.activity ?? null,
				visibility: r.visibility,
				tags: r.tags,
				waypoints: r.waypoints,
				geometry: r.geometry ?? null,
				distance: r.distance ?? null,
				duration: r.duration ?? null,
				elevationGain: r.elevationGain ?? null,
				startAddress: r.startAddress ?? null,
				endAddress: r.endAddress ?? null,
				createdAt: r.createdAt.toISOString(),
				updatedAt: r.updatedAt.toISOString(),
			})),
		};

		const zip = new JSZip();
		zip.file("README.txt", README);
		zip.file("routess-export.json", JSON.stringify(exportPayload, null, 2));
		const routesFolder = zip.folder("routes");
		if (routesFolder) {
			for (const route of routes) {
				const filename = `${route.id}-${slugify(route.name)}.gpx`;
				routesFolder.file(filename, routeToGpx(route));
			}
		}

		const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
		const dateStamp = new Date().toISOString().slice(0, 10);
		const filename = `routess-export-${dateStamp}.zip`;
		return { filename, bytes };
	}
}
