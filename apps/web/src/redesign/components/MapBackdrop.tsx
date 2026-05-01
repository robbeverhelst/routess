/**
 * Stylized map backdrop used by fullscreen screens (LiveNav, Recording,
 * Error, MobileDrawer, Coachmarks) where the real Mapbox tile isn't
 * available. Mirrors the mockup's `MapBackdrop` placeholder.
 */
import { RDS_COLORS } from "./primitives";

interface Props {
	showRoute?: boolean;
}

export function MapBackdrop({ showRoute = false }: Props) {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: `radial-gradient(circle at 30% 40%, oklch(0.92 0.04 230) 0%, transparent 30%),
				             radial-gradient(circle at 70% 60%, oklch(0.94 0.03 145) 0%, transparent 35%),
				             radial-gradient(circle at 20% 80%, oklch(0.93 0.05 225) 0%, transparent 30%),
				             oklch(0.96 0.01 240)`,
			}}
			aria-hidden="true"
		>
			{showRoute && (
				<svg
					viewBox="0 0 1200 800"
					preserveAspectRatio="xMidYMid slice"
					style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
					aria-hidden="true"
				>
					<title>Decorative route line</title>
					<path
						d="M 80 600 Q 280 360, 460 480 T 820 360 Q 980 320, 1080 240"
						stroke={RDS_COLORS.accent}
						strokeWidth="4"
						fill="none"
						strokeLinecap="round"
						opacity="0.85"
					/>
					<circle cx="80" cy="600" r="9" fill={RDS_COLORS.success} stroke="white" strokeWidth="3" />
					<circle cx="1080" cy="240" r="9" fill={RDS_COLORS.danger} stroke="white" strokeWidth="3" />
				</svg>
			)}
		</div>
	);
}
