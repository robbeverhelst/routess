import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import { i18n, localeLabels } from "@/lib/i18n";

export function baseOptions(locale: string = "en", options: { languageSwitch?: boolean } = {}): BaseLayoutProps {
	const guideUrl = `/${locale}/guide`;

	return {
		// The language switch only belongs on the guide (the one translated
		// section); on English-only sections it produced /nl/docs-style 404s.
		...(options.languageSwitch ? { i18n } : {}),
		nav: {
			title: (
				<span className="docs-wordmark">
					<Image src="/logo.png" alt="" width={26} height={26} className="docs-wordmark__logo" aria-hidden="true" />
					<span className="docs-wordmark__text">routess</span>
					<span className="docs-wordmark__tag">docs</span>
				</span>
			),
			// The docs home only exists unprefixed; /nl etc. used to 404.
			url: "/",
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
		githubUrl: "https://github.com/robbeverhelst/routess",
	};
}

export { localeLabels };
