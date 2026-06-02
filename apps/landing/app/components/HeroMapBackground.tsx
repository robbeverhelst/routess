/**
 * Hero map background. SVG cartography styled like an OSM "light" tile around
 * a fictional Belgian town centre. No real Mapbox tiles (per the marketing-page
 * cost decision), but realistic enough to read as a map: parks, water, road
 * hierarchy with case lines, building blocks. The animated route is rendered
 * separately on top by Hero.tsx.
 */
export function HeroMapBackground() {
	return (
		<svg
			viewBox="0 0 800 700"
			preserveAspectRatio="xMidYMid slice"
			style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
			aria-hidden="true"
		>
			<defs>
				<pattern id="forestHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
					<rect width="6" height="6" fill="oklch(0.86 0.1 145)" />
					<line x1="0" y1="0" x2="0" y2="6" stroke="oklch(0.78 0.13 145)" strokeWidth="0.6" />
				</pattern>
				<filter id="softMap">
					<feGaussianBlur stdDeviation="0.3" />
				</filter>
			</defs>

			{/* base */}
			<rect width="800" height="700" fill="oklch(0.97 0.018 80)" />

			{/* river — broad, curving */}
			<path
				d="M -50 540 C 80 510, 180 560, 280 530 S 460 480, 560 510 S 720 560, 880 540 L 880 720 L -50 720 Z"
				fill="oklch(0.86 0.06 225)"
			/>
			<path
				d="M -50 540 C 80 510, 180 560, 280 530 S 460 480, 560 510 S 720 560, 880 540"
				stroke="oklch(0.78 0.07 225)"
				strokeWidth="1"
				fill="none"
			/>

			{/* secondary water — small lake */}
			<path
				d="M 110 220 Q 140 200, 180 215 T 250 240 Q 230 280, 180 285 T 100 260 Q 90 235, 110 220 Z"
				fill="oklch(0.88 0.06 225)"
			/>
			<path
				d="M 110 220 Q 140 200, 180 215 T 250 240 Q 230 280, 180 285 T 100 260 Q 90 235, 110 220 Z"
				stroke="oklch(0.8 0.07 225)"
				strokeWidth="0.8"
				fill="none"
			/>

			{/* parks — organic polygons */}
			<g opacity="0.92">
				<path
					d="M 460 90 Q 530 70, 600 95 Q 660 130, 650 200 Q 620 250, 540 240 Q 480 220, 470 170 Q 440 130, 460 90 Z"
					fill="oklch(0.9 0.075 145)"
				/>
				<path
					d="M 460 90 Q 530 70, 600 95 Q 660 130, 650 200 Q 620 250, 540 240 Q 480 220, 470 170 Q 440 130, 460 90 Z"
					stroke="oklch(0.78 0.1 145)"
					strokeWidth="0.6"
					fill="none"
				/>
				<path
					d="M 50 380 Q 110 360, 170 385 Q 200 420, 180 470 Q 130 490, 70 470 Q 30 440, 50 380 Z"
					fill="oklch(0.91 0.075 145)"
				/>
				<path
					d="M 50 380 Q 110 360, 170 385 Q 200 420, 180 470 Q 130 490, 70 470 Q 30 440, 50 380 Z"
					stroke="oklch(0.78 0.1 145)"
					strokeWidth="0.6"
					fill="none"
				/>
				{/* forest with hatching */}
				<path
					d="M 640 360 Q 720 340, 790 380 Q 800 440, 770 480 Q 700 510, 650 480 Q 610 430, 640 360 Z"
					fill="url(#forestHatch)"
					opacity="0.7"
				/>
			</g>

			{/* building footprints — clusters near "town centre" */}
			<g fill="oklch(0.86 0.012 80)" stroke="oklch(0.78 0.014 80)" strokeWidth="0.4">
				{[
					[300, 300, 22, 14],
					[326, 298, 18, 14],
					[348, 302, 16, 12],
					[300, 318, 22, 12],
					[326, 316, 18, 12],
					[348, 318, 16, 14],
					[368, 300, 14, 14],
					[368, 318, 14, 12],
					[300, 334, 22, 14],
					[326, 334, 26, 14],
					[358, 334, 24, 14],
					[280, 380, 18, 12],
					[302, 380, 16, 12],
					[322, 380, 20, 14],
					[346, 380, 22, 14],
					[280, 396, 18, 14],
					[302, 398, 16, 12],
					[322, 398, 20, 12],
					[346, 398, 22, 14],
					[395, 240, 14, 12],
					[412, 240, 16, 12],
					[432, 240, 14, 12],
					[395, 256, 14, 14],
					[412, 258, 16, 12],
					[432, 256, 14, 14],
					[170, 110, 18, 12],
					[192, 112, 16, 12],
					[212, 110, 18, 14],
					[170, 128, 18, 14],
					[192, 130, 16, 12],
					[212, 128, 18, 12],
					[560, 380, 18, 12],
					[582, 380, 16, 14],
					[602, 382, 18, 12],
					[560, 398, 18, 14],
					[582, 400, 16, 12],
				].map(([x, y, w, h]) => (
					<rect key={`b-${x}-${y}`} x={x} y={y} width={w} height={h} rx="1.5" />
				))}
			</g>

			{/* road network — three tiers, white case + filled centre */}
			{/* motorway-like (case) */}
			<g stroke="oklch(0.95 0.012 80)" strokeWidth="11" fill="none" strokeLinecap="round">
				<path d="M -20 200 C 100 210, 200 180, 320 200 S 540 240, 660 220 S 820 180, 880 190" />
				<path d="M 200 -20 C 220 100, 200 200, 240 320 S 280 520, 260 720" />
			</g>
			{/* motorway fill */}
			<g stroke="oklch(0.99 0.005 80)" strokeWidth="6" fill="none" strokeLinecap="round">
				<path d="M -20 200 C 100 210, 200 180, 320 200 S 540 240, 660 220 S 820 180, 880 190" />
				<path d="M 200 -20 C 220 100, 200 200, 240 320 S 280 520, 260 720" />
			</g>

			{/* primary roads */}
			<g stroke="oklch(0.93 0.012 80)" strokeWidth="6" fill="none" strokeLinecap="round">
				<path d="M -20 360 Q 120 350, 240 365 T 460 350 T 680 360 T 880 350" />
				<path d="M 460 -20 Q 470 100, 460 220 T 480 460 T 460 720" />
			</g>
			<g stroke="white" strokeWidth="3" fill="none" strokeLinecap="round">
				<path d="M -20 360 Q 120 350, 240 365 T 460 350 T 680 360 T 880 350" />
				<path d="M 460 -20 Q 470 100, 460 220 T 480 460 T 460 720" />
			</g>

			{/* secondary / residential — thinner, no case */}
			<g stroke="oklch(0.91 0.012 80)" strokeWidth="2.2" fill="none">
				<path d="M -20 100 Q 120 95, 240 105 T 470 90 T 680 100 T 880 95" />
				<path d="M -20 280 Q 120 290, 240 280 T 470 295 T 680 285 T 880 290" />
				<path d="M -20 440 Q 120 445, 240 440 T 470 450 T 680 440 T 880 445" />
				<path d="M -20 620 Q 120 615, 240 625 T 470 615 T 680 625 T 880 620" />
				<path d="M 80 -20 Q 90 100, 80 220 T 100 460 T 80 720" />
				<path d="M 320 -20 Q 330 100, 320 220 T 340 460 T 320 720" />
				<path d="M 580 -20 Q 590 100, 580 220 T 600 460 T 580 720" />
				<path d="M 720 -20 Q 730 100, 720 220 T 740 460 T 720 720" />
				{/* short connectors / cul-de-sacs */}
				<path d="M 200 360 L 200 460" />
				<path d="M 380 280 L 380 360" />
				<path d="M 540 280 L 540 360" />
				<path d="M 280 100 L 280 200" />
			</g>

			{/* footpaths / dashed */}
			<g stroke="oklch(0.7 0.04 45)" strokeWidth="1.4" strokeDasharray="3 3" fill="none" opacity="0.7">
				<path d="M 90 470 Q 140 460, 180 480 Q 220 510, 260 530" />
				<path d="M 470 200 Q 510 220, 560 240 Q 620 280, 640 360" />
			</g>

			{/* subtle vignette top */}
			<rect width="800" height="120" fill="url(#topFade)" opacity="0.4" />
			<defs>
				<linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="oklch(0.97 0.018 80)" stopOpacity="0.7" />
					<stop offset="100%" stopColor="oklch(0.97 0.018 80)" stopOpacity="0" />
				</linearGradient>
			</defs>
		</svg>
	);
}
