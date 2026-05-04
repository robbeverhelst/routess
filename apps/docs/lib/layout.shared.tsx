import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { i18n, localeLabels } from "@/lib/i18n";

export function baseOptions(locale: string = "en"): BaseLayoutProps {
	const guideUrl = `/${locale}/guide`;

	return {
		i18n,
		nav: {
			title: (
				<span className="docs-wordmark">
					<img
						src="/logo.png"
						alt=""
						width={26}
						height={26}
						className="docs-wordmark__logo"
						aria-hidden="true"
					/>
					<span className="docs-wordmark__text">routess</span>
					<span className="docs-wordmark__tag">docs</span>
				</span>
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
		],
		githubUrl: "https://github.com/robbeverhelst/maps",
	};
}

export { localeLabels };
