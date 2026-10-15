import type { RouteActivity } from "@routess/core";
import { I, type IconKey } from "@/components/icons";
import { Btn, IconBtn, RDS_COLORS } from "@/components/primitives";
import { exportRouteGpx } from "@/features/routing/services/exportRouteGpx";
import { emitAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { useUnits } from "@/lib/units";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import type { LocalRoute } from "./localRouteDb";
import { useLocalRoutesStore } from "./localRoutesStore";

const ACTIVITY_ICON: Record<RouteActivity, IconKey> = { cycle: "bike", run: "run", walk: "walk" };

// The library for someone without an account: the routes saved on this
// device, plus the case for an account (keep them on your phone too).
export function DeviceRoutesPanel({ routes }: { routes: LocalRoute[] }) {
	const t = useT();
	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
			<div style={{ padding: "16px 20px 8px" }}>
				<h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t("library.device.title")}</h3>
				<p style={{ margin: "4px 0 0", fontSize: 12.5, color: RDS_COLORS.fgMuted, lineHeight: 1.5 }}>
					{t("library.device.subtitle")}
				</p>
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 20px" }}>
				{routes.map((route) => (
					<DeviceRouteRow key={route.localId} localRoute={route} />
				))}
			</div>
			<div
				style={{
					margin: "12px 20px 20px",
					padding: 14,
					borderRadius: 10,
					background: RDS_COLORS.accentSoft,
					display: "flex",
					flexDirection: "column",
					gap: 10,
				}}
			>
				<div style={{ fontSize: 13, fontWeight: 600, color: RDS_COLORS.fg }}>{t("library.device.keepTitle")}</div>
				<div style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted, lineHeight: 1.5 }}>{t("library.device.keepBody")}</div>
				<div style={{ display: "flex", gap: 8 }}>
					<Btn variant="primary" onClick={() => emitAppEvent("routess:open-signup", { entryPoint: "device_routes" })}>
						{t("save.createAccount")}
					</Btn>
					<Btn onClick={() => emitAppEvent("routess:open-login", { entryPoint: "device_routes" })}>
						<I.user size={14} /> {t("common.signIn")}
					</Btn>
				</div>
			</div>
		</div>
	);
}

function DeviceRouteRow({ localRoute }: { localRoute: LocalRoute }) {
	const t = useT();
	const { formatDistance } = useUnits();
	const setContext = useUiStore((s) => s.setContext);
	const pushToast = useToastStore((s) => s.push);
	const remove = useLocalRoutesStore((s) => s.remove);
	const { route } = localRoute;
	const ActivityIcon = route.activity ? I[ACTIVITY_ICON[route.activity]] : I.route;

	const open = () => {
		setContext("plan");
		emitAppEvent("routess:load-local-route", { localRoute });
	};

	const exportGpx = () => {
		if (!exportRouteGpx(route)) pushToast({ kind: "danger", title: t("share.exportFailed") });
	};

	const handleDelete = () => {
		if (!window.confirm(t("library.device.deleteConfirm", { name: route.name }))) return;
		remove(localRoute.localId).catch((error: unknown) => {
			Logger.error("[DeviceRoutesPanel] delete failed:", error);
			pushToast({ kind: "danger", title: t("common.tryAgain") });
		});
	};

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 10,
				padding: "10px 12px",
				borderRadius: 10,
				border: `1px solid ${RDS_COLORS.border}`,
				background: RDS_COLORS.bgPanel,
			}}
		>
			<button
				type="button"
				onClick={open}
				style={{
					flex: 1,
					minWidth: 0,
					display: "flex",
					alignItems: "center",
					gap: 10,
					background: "transparent",
					border: 0,
					padding: 0,
					textAlign: "left",
					cursor: "pointer",
					color: "inherit",
				}}
			>
				<span style={{ color: RDS_COLORS.accent, display: "inline-flex" }}>
					<ActivityIcon size={16} />
				</span>
				<span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
					<span
						style={{
							fontSize: 13.5,
							fontWeight: 600,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{route.name}
					</span>
					<span style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>
						{formatDistance((route.distance ?? 0) / 1000)}
					</span>
				</span>
			</button>
			<IconBtn title={t("library.device.exportGpx")} onClick={exportGpx}>
				<I.download size={14} />
			</IconBtn>
			<IconBtn title={t("library.device.delete")} onClick={handleDelete}>
				<I.trash size={14} />
			</IconBtn>
		</div>
	);
}
