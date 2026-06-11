import { brandHex } from "@routess/design-tokens";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "routess",
		short_name: "routess",
		description: "Plan routes for running, cycling, and hiking.",
		start_url: "/",
		display: "standalone",
		background_color: brandHex.paper,
		theme_color: brandHex.indigo,
		icons: [
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
		],
	};
}
