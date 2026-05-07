import { useT } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { ComingSoonState } from "../components/ComingSoonState";
import { I } from "../components/icons";
import { IconBtn, RDS_COLORS } from "../components/primitives";
import { useViewport } from "../hooks/useViewport";

export function NotificationCenter() {
	const close = useModalsStore((s) => s.closeOverlay);
	const t = useT();
	const { isMobile } = useViewport();

	return (
		<div
			style={
				isMobile
					? {
							position: "absolute",
							left: "max(12px, var(--rds-safe-left))",
							right: "max(12px, var(--rds-safe-right))",
							bottom: "var(--rds-bottom-tab-h)",
							maxHeight: "calc(100dvh - var(--rds-bottom-tab-h) - var(--rds-top-bar-h) - 16px)",
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 14,
							boxShadow: "var(--rds-shadow-lg)",
							zIndex: 60,
							display: "flex",
							flexDirection: "column",
							animation: "rds-sheet-in 200ms cubic-bezier(0.32, 0.72, 0, 1)",
						}
					: {
							position: "absolute",
							top: 16,
							right: 16,
							width: 380,
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 14,
							boxShadow: "var(--rds-shadow-lg)",
							zIndex: 60,
							display: "flex",
							flexDirection: "column",
						}
			}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "14px 16px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<I.bell size={16} />
				<div style={{ fontSize: 14, fontWeight: 600 }}>{t("rail.notifications")}</div>
				<div style={{ flex: 1 }} />
				<IconBtn title={t("common.close")} onClick={close}>
					<I.close size={14} />
				</IconBtn>
			</div>
			<ComingSoonState icon="bell" title={t("rail.notifications")} body={t("notifications.body")} />
		</div>
	);
}
