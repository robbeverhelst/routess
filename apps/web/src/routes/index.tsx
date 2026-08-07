import { createFileRoute } from "@tanstack/react-router";

// Keys are optional, not "present but undefined". With required keys the
// router demands a `search` object on every navigation to "/", which is why
// redirects and <Link to="/"> elsewhere had to be typed around.
type HomeSearch = {
	center?: [number, number];
	zoom?: number;
	route?: string;
};

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>): HomeSearch => {
		return {
			center: (() => {
				const center = search.center as string | [number, number] | undefined;
				if (!center) return undefined;
				// The router round-trips the parsed value through the URL as JSON,
				// so a reload hands us back the array we returned last time.
				if (Array.isArray(center)) {
					const [lng, lat] = center.map(Number);
					if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined;
					return [lng, lat] as [number, number];
				}
				const [lat, lng] = center.split(",").map(Number);
				if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined;
				return [lng, lat] as [number, number];
			})(),
			zoom: (() => {
				const zoom = search.zoom as string | undefined;
				if (!zoom) return undefined;
				const numZoom = Number(zoom);
				return Number.isNaN(numZoom) ? undefined : numZoom;
			})(),
			route: search.route as string | undefined,
		};
	},
});
