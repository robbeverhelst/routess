import { useState } from "react";
import { useT } from "@/lib/i18n";
import { I } from "../components/icons";
import { MapBackdrop } from "../components/MapBackdrop";
import { Badge, Btn, RDS_COLORS } from "../components/primitives";

interface Stop {
	target: { top: number; left: number; width: number; height: number };
	tooltip: { top: number; left: number };
	titleKey: string;
	bodyKey: string;
}

const STOPS: Stop[] = [
	{
		target: { top: 50, left: 50, width: 56, height: 280 },
		tooltip: { top: 80, left: 130 },
		titleKey: "coach.stop1.title",
		bodyKey: "coach.stop1.body",
	},
	{
		target: { top: 50, left: 116, width: 360, height: 600 },
		tooltip: { top: 80, left: 500 },
		titleKey: "coach.stop2.title",
		bodyKey: "coach.stop2.body",
	},
	{
		target: { top: 12, left: 280, width: 480, height: 44 },
		tooltip: { top: 60, left: 280 },
		titleKey: "coach.stop3.title",
		bodyKey: "coach.stop3.body",
	},
	{
		target: { top: 600, left: 240, width: 360, height: 56 },
		tooltip: { top: 530, left: 240 },
		titleKey: "coach.stop4.title",
		bodyKey: "coach.stop4.body",
	},
];

export function CoachmarksScreen({ onComplete }: { onComplete?: () => void }) {
	const [step, setStep] = useState(0);
	const t = useT();
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
						{t("coach.stepFraction", { n: String(step + 1), total: String(STOPS.length) })}
					</Badge>
				</div>
				<div style={{ fontSize: 15, fontWeight: 600 }}>{t(stop.titleKey)}</div>
				<p
					style={{
						fontSize: 13,
						color: RDS_COLORS.fgMuted,
						margin: "6px 0 14px",
						lineHeight: 1.5,
					}}
				>
					{t(stop.bodyKey)}
				</p>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<Btn variant="ghost" onClick={onComplete} style={{ color: RDS_COLORS.fgMuted }}>
						{t("coach.skipTour")}
					</Btn>
					<div style={{ flex: 1 }} />
					{step > 0 && <Btn onClick={() => setStep(step - 1)}>{t("common.back")}</Btn>}
					<Btn
						variant="primary"
						onClick={() => {
							if (step < STOPS.length - 1) setStep(step + 1);
							else onComplete?.();
						}}
					>
						{step < STOPS.length - 1 ? (
							<>
								{t("coach.next")} <I.chevronR size={12} />
							</>
						) : (
							t("coach.done")
						)}
					</Btn>
				</div>
			</div>
		</div>
	);
}
