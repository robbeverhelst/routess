import { useState } from "react";
import { useT } from "@/lib/i18n";
import { clearNavigationSnapshot, loadNavigationSnapshot } from "@/stores/navigationStore";
import { I } from "../../components/icons";
import { Btn, RDS_COLORS } from "../../components/primitives";
import { resumeNavigation } from "./startNavigation";

// Offers to resume a NavigationSession after a reload or swipe-kill. A prompt,
// not an auto-resume: the ride may simply be over.
export function ResumeNavBanner() {
	const t = useT();
	const [snapshot, setSnapshot] = useState(() => loadNavigationSnapshot());
	if (!snapshot) return null;

	return (
		<div
			style={{
				position: "absolute",
				bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
				left: "50%",
				transform: "translateX(-50%)",
				zIndex: 90,
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "10px 14px",
				borderRadius: 12,
				background: RDS_COLORS.bgPanel,
				border: `1px solid ${RDS_COLORS.border}`,
				boxShadow: "var(--rds-shadow-lg)",
				maxWidth: "calc(100vw - 24px)",
			}}
		>
			<I.compass size={16} style={{ color: RDS_COLORS.accent, flexShrink: 0 }} />
			<div style={{ minWidth: 0 }}>
				<div style={{ fontSize: 13, fontWeight: 600 }}>{t("nav.resumeTitle")}</div>
				<div
					style={{
						fontSize: 12,
						color: RDS_COLORS.fgMuted,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{snapshot.routeName}
				</div>
			</div>
			<Btn
				variant="primary"
				onClick={() => {
					resumeNavigation();
					setSnapshot(null);
				}}
			>
				{t("nav.resume")}
			</Btn>
			<button
				type="button"
				aria-label={t("nav.dismissResume")}
				onClick={() => {
					clearNavigationSnapshot();
					setSnapshot(null);
				}}
				style={{
					background: "transparent",
					border: 0,
					color: RDS_COLORS.fgMuted,
					cursor: "pointer",
					display: "inline-flex",
					padding: 2,
				}}
			>
				<I.close size={14} />
			</button>
		</div>
	);
}
