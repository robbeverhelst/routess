/**
 * Tilted "app screenshot" for the hero. Renders a real PNG of the planner UI
 * (drop one into `public/hero-screenshot.png`, ideally ~1840×1120 for sharp
 * retina display at the ~920×560 render size). The whole thing is
 * CSS-perspective-tilted in globals.css so it reads as a 3D product shot
 * bleeding off the right edge of the hero column.
 */
import Image from "next/image";

export function HeroAppScreenshot() {
	return (
		<div className="hero-screenshot-wrap" aria-hidden="true">
			<div className="hero-screenshot">
				<Image
					src="/hero-screenshot.png"
					alt=""
					width={1840}
					height={1120}
					priority
					sizes="(max-width: 900px) 100vw, 920px"
					style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
				/>
			</div>
		</div>
	);
}
