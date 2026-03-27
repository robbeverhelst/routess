import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>) => {
		return {
			center: (() => {
				const center = search.center as string | undefined;
				if (!center) return undefined;
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
