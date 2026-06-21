import "mapbox-gl/dist/mapbox-gl.css";
import MapGL, { Layer, Source } from "react-map-gl/mapbox";
import { RDS_COLORS } from "@/components/primitives";
import { getRuntimeConfig } from "@/lib/runtime-config";

const MAPBOX_TOKEN = getRuntimeConfig("VITE_MAPBOX_ACCESS_TOKEN") ?? "";
const MAP_STYLE = "mapbox://styles/mapbox/standard";

type Coord = [number, number];

// Standalone, read-only render of a route's RoutePath for the admin detail
// view. Self-contained: unlike LibraryRoutePreview it owns its map instance and
// never touches the routing/library stores. Coordinates follow the same
// [lng, lat] convention the rest of the map layer uses.
export function AdminRouteMap({
	geometry,
	waypoints,
	bbox,
	height = 360,
}: {
	geometry: Coord[] | null;
	waypoints: Array<{ coord: Coord }>;
	bbox: [number, number, number, number] | null;
	height?: number;
}) {
	const coords: Coord[] = geometry && geometry.length >= 2 ? geometry : waypoints.map((w) => w.coord);

	if (!MAPBOX_TOKEN || coords.length < 2) {
		return (
			<div
				style={{
					height,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					borderRadius: 10,
					border: `1px dashed ${RDS_COLORS.border}`,
					color: RDS_COLORS.fgSubtle,
					fontSize: 13,
				}}
			>
				{MAPBOX_TOKEN ? "No RoutePath geometry to display" : "Map unavailable (no Mapbox token)"}
			</div>
		);
	}

	const [minLng, minLat, maxLng, maxLat] = bbox ?? boundsOf(coords);
	const line = {
		type: "Feature" as const,
		properties: {},
		geometry: { type: "LineString" as const, coordinates: coords },
	};
	const points = {
		type: "FeatureCollection" as const,
		features: waypoints.map((w) => ({
			type: "Feature" as const,
			properties: {},
			geometry: { type: "Point" as const, coordinates: w.coord },
		})),
	};

	return (
		<div style={{ height, borderRadius: 10, overflow: "hidden", border: `1px solid ${RDS_COLORS.border}` }}>
			<MapGL
				mapboxAccessToken={MAPBOX_TOKEN}
				mapStyle={MAP_STYLE}
				initialViewState={{
					bounds: [
						[minLng, minLat],
						[maxLng, maxLat],
					],
					fitBoundsOptions: { padding: 48, maxZoom: 14.5 },
				}}
				style={{ width: "100%", height: "100%" }}
			>
				<Source id="admin-route" type="geojson" data={line}>
					<Layer
						id="admin-route-casing"
						type="line"
						layout={{ "line-cap": "round", "line-join": "round" }}
						paint={{ "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 }}
					/>
					<Layer
						id="admin-route-line"
						type="line"
						layout={{ "line-cap": "round", "line-join": "round" }}
						paint={{ "line-color": "#7d62ff", "line-width": 4, "line-opacity": 0.95 }}
					/>
				</Source>
				<Source id="admin-route-waypoints" type="geojson" data={points}>
					<Layer
						id="admin-route-waypoints"
						type="circle"
						paint={{
							"circle-radius": 4,
							"circle-color": "#7d62ff",
							"circle-stroke-color": "#ffffff",
							"circle-stroke-width": 2,
						}}
					/>
				</Source>
			</MapGL>
		</div>
	);
}

function boundsOf(coords: Coord[]): [number, number, number, number] {
	let minLng = coords[0][0];
	let minLat = coords[0][1];
	let maxLng = coords[0][0];
	let maxLat = coords[0][1];
	for (const [lng, lat] of coords) {
		minLng = Math.min(minLng, lng);
		maxLng = Math.max(maxLng, lng);
		minLat = Math.min(minLat, lat);
		maxLat = Math.max(maxLat, lat);
	}
	return [minLng, minLat, maxLng, maxLat];
}
