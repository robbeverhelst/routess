import { useState } from "react";
import { trackEvent } from "@/lib/analytics/track";
import { useT } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { I } from "./icons";
import { RDS_COLORS } from "./primitives";

// Sits above the tab bar (60px tall, offset from the safe area) so both stay
// tappable.
const TAB_BAR_CLEARANCE = "calc(max(10px, calc(var(--rds-safe-bottom) + 6px)) + 60px + 10px)";

function ActionButton({
	onClick,
	icon,
	label,
	primary,
}: {
	onClick: () => void;
	icon: React.ReactNode;
	label: string;
	primary?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				width: "100%",
				// Matches MobilePlanActionBar; comfortably over the 44px tap target
				// floor that the rest of the map chrome misses.
				height: 46,
				borderRadius: 13,
				border: primary ? 0 : `1px solid ${RDS_COLORS.border}`,
				background: primary ? RDS_COLORS.accent : RDS_COLORS.bgPanel,
				color: primary ? "#fff" : RDS_COLORS.fg,
				fontSize: 15,
				fontWeight: 600,
				cursor: "pointer",
			}}
		>
			{icon}
			{label}
		</button>
	);
}

export function FirstRunActions() {
	const t = useT();
	const openModal = useModalsStore((s) => s.openModal);
	const dismiss = useRedesignSettingsStore((s) => s.setFirstRunActionsDismissed);
	// Local, not persisted: choosing "draw" swaps the card for the hint within
	// this visit, but a reload should offer the full choice again.
	const [drawing, setDrawing] = useState(false);

	const choose = (choice: "generate" | "draw") => {
		trackEvent({ name: "first_run_action_chosen", properties: { choice } });
		if (choice === "generate") {
			dismiss(true);
			openModal("loop");
			return;
		}
		setDrawing(true);
	};

	if (drawing) {
		return (
			<div style={wrapperStyle} aria-live="polite">
				<div style={hintStyle}>{t("firstRun.tapHint")}</div>
			</div>
		);
	}

	return (
		<div style={wrapperStyle}>
			<ActionButton
				primary
				onClick={() => choose("generate")}
				icon={<I.refresh size={16} />}
				label={t("plan.loopHeroTitle")}
			/>
			<ActionButton onClick={() => choose("draw")} icon={<I.pencil size={16} />} label={t("firstRun.drawItMyself")} />
		</div>
	);
}

const wrapperStyle: React.CSSProperties = {
	position: "absolute",
	left: 12,
	right: 12,
	bottom: TAB_BAR_CLEARANCE,
	// Under the tab bar (11) and plan action bar (12) so it can never cover
	// primary navigation.
	zIndex: 10,
	display: "flex",
	flexDirection: "column",
	gap: 8,
	pointerEvents: "auto",
};

const hintStyle: React.CSSProperties = {
	alignSelf: "center",
	padding: "9px 14px",
	borderRadius: 999,
	background: RDS_COLORS.bgPanel,
	border: `1px solid ${RDS_COLORS.border}`,
	color: RDS_COLORS.fgMuted,
	fontSize: 13,
	fontWeight: 500,
	boxShadow: "0 4px 16px -8px rgba(0,0,0,0.3)",
};
