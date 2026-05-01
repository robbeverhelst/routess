import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { i18n, localeLabels } from "@/lib/i18n";

export function baseOptions(locale: string = "en"): BaseLayoutProps {
	const guideUrl = `/${locale}/guide`;

	return {
		i18n,
		nav: {
			title: (
				<>
					<span style={{ fontWeight: 700 }}>Routess</span>
					<span style={{ opacity: 0.6, marginLeft: 6, fontSize: "0.85em" }}>docs</span>
				</>
			),
			url: locale === "en" ? "/" : `/${locale}`,
		},
		links: [
			{
				type: "main",
				text: "User Guide",
				url: guideUrl,
			},
			{
				type: "main",
				text: "Developer Docs",
				url: "/docs",
			},
			{
				type: "main",
				text: "API Reference",
				url: "/api-reference",
			},
			{
				type: "icon",
				url: "https://github.com/robbeverhelst/maps",
				text: "GitHub",
				icon: (
					<svg viewBox="0 0 24 24" fill="currentColor" aria-label="GitHub">
						<title>GitHub</title>
						<path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.48 3.15-1.17 3.15-1.17.62 1.59.23 2.76.11 3.05.73.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
					</svg>
				),
			},
		],
		githubUrl: "https://github.com/robbeverhelst/maps",
	};
}

export { localeLabels };
