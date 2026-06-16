import { startNavigation } from "@/features/navigation/startNavigation";
import { useIsAuthenticated } from "@/hooks/useAuthState";
import { emitAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useDraftActivity, useDraftMode, useHasRoute, useRoutePath, useWaypoints } from "@/stores/routingStore";
import { I } from "./icons";
import { RDS_COLORS } from "./primitives";

// Persistent Plan action bar for mobile. Lives OUTSIDE the drawer (fixed to the
// viewport bottom) so the primary action — saving / starting a route — is
// always one tap away regardless of how far the drawer is scrolled. Decoupled
// from PlanPanel: it reads draft state from the store and dispatches through the
// same app-events / modals the in-panel footer uses on desktop.
export function MobilePlanActionBar() {
	const t = useT();
	const isAuthenticated = useIsAuthenticated();
	const navigationEnabled = useRedesignSettingsStore((s) => s.navigationEnabled);
	const openModal = useModalsStore((s) => s.openModal);

	const hasRoute = useHasRoute();
	const waypoints = useWaypoints();
	const routePath = useRoutePath();
	const mode = useDraftMode();
	const activity = useDraftActivity();
	const editingName = mode.kind === "editing" ? mode.name : null;

	const canSave = hasRoute && waypoints.length >= 2;
	const canNavigate = hasRoute && routePath.length >= 2;
	const saveLabel =
		mode.kind === "editing" ? t("common.save") : isAuthenticated ? t("common.save") : t("save.signInShort");

	return (
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				// Docked flush at the bottom edge: while planning, this replaces the
				// tab bar (one solid bar, no stacking or content bleed-through).
				bottom: 0,
				zIndex: 12,
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "10px 12px",
				paddingBottom: "max(10px, calc(var(--rds-safe-bottom) + 10px))",
				background: RDS_COLORS.bgPanel,
				borderTop: `1px solid ${RDS_COLORS.border}`,
				boxShadow: "0 -6px 20px -10px rgba(0,0,0,0.25)",
			}}
		>
			<button
				type="button"
				disabled={!canSave}
				onClick={() => emitAppEvent("routess:save-draft")}
				title={isAuthenticated ? undefined : t("save.signInHint")}
				style={{
					flex: 1,
					minWidth: 0,
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					gap: 8,
					height: 46,
					borderRadius: 13,
					border: 0,
					fontSize: 15,
					fontWeight: 600,
					cursor: canSave ? "pointer" : "not-allowed",
					opacity: canSave ? 1 : 0.5,
					background: RDS_COLORS.accent,
					color: RDS_COLORS.accentFg,
				}}
			>
				<I.save size={16} /> {saveLabel}
			</button>

			{navigationEnabled && (
				<ActionIcon
					icon="play"
					title={t("nav.navigate")}
					disabled={!canNavigate}
					onClick={() =>
						void startNavigation({
							routeName: editingName ?? t("nav.currentRoute"),
							geometry: routePath,
							activity: activity ?? "cycle",
						})
					}
				/>
			)}
			<ActionIcon icon="share" title={t("plan.shareRoute")} disabled={!hasRoute} onClick={() => openModal("share")} />
			<ActionIcon icon="upload" title={t("plan.importGpx")} disabled={false} onClick={() => openModal("import")} />
			<ActionIcon
				icon="trash"
				title={t("plan.clear")}
				disabled={waypoints.length === 0}
				danger
				onClick={() => emitAppEvent("routess:reset-route")}
			/>
		</div>
	);
}

function ActionIcon({
	icon,
	title,
	disabled,
	danger,
	onClick,
}: {
	icon: "play" | "share" | "upload" | "trash";
	title: string;
	disabled: boolean;
	danger?: boolean;
	onClick: () => void;
}) {
	const Icon = I[icon];
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			aria-label={title}
			title={title}
			style={{
				width: 46,
				height: 46,
				flexShrink: 0,
				borderRadius: 13,
				border: `1px solid ${RDS_COLORS.border}`,
				background: RDS_COLORS.bgInput,
				color: danger ? RDS_COLORS.danger : RDS_COLORS.fg,
				cursor: disabled ? "not-allowed" : "pointer",
				opacity: disabled ? 0.4 : 1,
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Icon size={18} />
		</button>
	);
}
