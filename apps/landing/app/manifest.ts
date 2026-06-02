import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "routess",
		short_name: "routess",
		description: "Plan routes for running, cycling, and hiking.",
		start_url: "/",
		display: "standalone",
		background_color: "#fdfaf2",
		theme_color: "#5b3df5",
		icons: [
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
		],
	};
}
