import type { Metadata } from "next";
import { HeroAppScreenshotMock } from "../components/HeroAppScreenshotMock";

// Internal tooling route, not for visitors. robots.txt disallows it; this also
// keeps it out of the index if the URL leaks.
export const metadata: Metadata = {
	robots: { index: false, follow: false },
};

// Standalone page that renders only the hero app-screenshot mock at fixed
// 920x560 dimensions. Used by `scripts/screenshot-hero.ts` to capture
// public/hero-screenshot.png via a headless browser.
export default function ScreenshotPage() {
	return (
		<main
			style={{
				margin: 0,
				padding: 0,
				background: "transparent",
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "flex-start",
				width: "100vw",
				height: "100vh",
			}}
		>
			<HeroAppScreenshotMock />
		</main>
	);
}
