import { useState } from "react";
import { I } from "../components/icons";
import { MapBackdrop } from "../components/MapBackdrop";
import { Badge, Btn, RDS_COLORS } from "../components/primitives";

interface Stop {
	target: { top: number; left: number; width: number; height: number };
	tooltip: { top: number; left: number };
	title: string;
	body: string;
}

const STOPS: Stop[] = [
	{
		target: { top: 50, left: 50, width: 56, height: 280 },
		tooltip: { top: 80, left: 130 },
		title: "Switch contexts here",
		body: "Plan, Library, Discover, and Social each have their own panel. The map stays in place.",
	},
	{
		target: { top: 50, left: 116, width: 360, height: 600 },
		tooltip: { top: 80, left: 500 },
		title: "Your panel",
		body: "Everything you need for the current task lives in this panel — search, filter, edit.",
	},
	{
		target: { top: 12, left: 280, width: 480, height: 44 },
		tooltip: { top: 60, left: 280 },
		title: "Map controls",
		body: "Search a place, lock the map, change the style, and zoom from one toolbar.",
	},
	{
		target: { top: 600, left: 240, width: 360, height: 56 },
		tooltip: { top: 530, left: 240 },
		title: "Save & share",
		body: "Save your route or share it with a single link. ⌘K from anywhere to jump.",
	},
];

export function CoachmarksScreen({ onComplete }: { onComplete?: () => void }) {
	const [step, setStep] = useState(0);
	const stop = STOPS[step];

	return (
		<div style={{ position: "absolute", inset: 0, zIndex: 90 }}>
			<MapBackdrop showRoute />
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: "color-mix(in oklch, oklch(0 0 0) 55%, transparent)",
				}}
			/>
			{/* Spotlight */}
			<div
				style={{
					position: "absolute",
					top: stop.target.top,
					left: stop.target.left,
					width: stop.target.width,
					height: stop.target.height,
					borderRadius: 16,
					boxShadow: `0 0 0 9999px color-mix(in oklch, oklch(0 0 0) 55%, transparent), 0 0 0 4px ${RDS_COLORS.accent}`,
					background: "transparent",
					pointerEvents: "none",
					transition: "all 200ms",
				}}
			/>

			{/* Tooltip */}
			<div
				style={{
					position: "absolute",
					top: stop.tooltip.top,
					left: stop.tooltip.left,
					width: 320,
					padding: 18,
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 14,
					boxShadow: "var(--rds-shadow-lg)",
					transition: "all 200ms",
				}}
			>
				<div style={{ marginBottom: 10 }}>
					<Badge variant="accent" dot>
						{step + 1} of {STOPS.length}
					</Badge>
				</div>
				<div style={{ fontSize: 15, fontWeight: 600 }}>{stop.title}</div>
				<p
					style={{
						fontSize: 13,
						color: RDS_COLORS.fgMuted,
						margin: "6px 0 14px",
						lineHeight: 1.5,
					}}
				>
					{stop.body}
				</p>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<Btn variant="ghost" onClick={onComplete} style={{ color: RDS_COLORS.fgMuted }}>
						Skip tour
					</Btn>
					<div style={{ flex: 1 }} />
					{step > 0 && <Btn onClick={() => setStep(step - 1)}>Back</Btn>}
					<Btn
						variant="primary"
						onClick={() => {
							if (step < STOPS.length - 1) setStep(step + 1);
							else onComplete?.();
						}}
					>
						{step < STOPS.length - 1 ? (
							<>
								Next <I.chevronR size={12} />
							</>
						) : (
							<>Done</>
						)}
					</Btn>
				</div>
			</div>
		</div>
	);
}
