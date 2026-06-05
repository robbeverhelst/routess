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
			{/* Desktop: the tilted planner capture bleeding off the column. */}
			<div className="hero-screenshot">
				<Image
					src="/hero-screenshot.png"
					alt=""
					width={1840}
					height={1120}
					priority
					sizes="(max-width: 900px) 1px, 920px"
					style={{ width: "100%", height: "100%", objectFit: "cover" }}
				/>
			</div>
			{/* Mobile: the full mobile-layout capture in a phone frame, instead
			   of an illegible crop of the desktop UI. */}
			<div className="hero-phone">
				<div className="hero-phone-frame">
					<Image
						src="/app-mobile.png"
						alt=""
						width={780}
						height={1600}
						sizes="(max-width: 900px) 240px, 1px"
						style={{ width: "100%", height: "auto", display: "block", borderRadius: 26 }}
					/>
				</div>
			</div>
		</div>
	);
}
