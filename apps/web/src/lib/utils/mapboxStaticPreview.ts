import { buildMapboxStaticPreviewUrl as buildWithToken, type StaticPreviewOptions as CoreOptions } from "@routess/core";
import { getRuntimeConfig } from "@/lib/runtime-config";

type Coordinate = [number, number];

export type StaticPreviewOptions = Omit<CoreOptions, "token">;

export function buildMapboxStaticPreviewUrl(points: Coordinate[], options: StaticPreviewOptions): string | null {
	const token = getRuntimeConfig("VITE_MAPBOX_ACCESS_TOKEN");
	if (!token) return null;
	return buildWithToken(points, { ...options, token });
}
