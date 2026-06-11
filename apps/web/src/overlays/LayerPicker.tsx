import { nodeNetworkColors } from "@routess/design-tokens";
import { useMemo } from "react";
import { loadLastMapViewFromLocalStorage } from "@/features/routing/services/LocalStorageService";
import { useT } from "@/lib/i18n";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { useModalsStore } from "@/stores/modalsStore";
import { type OverlayKey, useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { I } from "../components/icons";
import { IconBtn, RDS_COLORS, SecTitle } from "../components/primitives";
import { useViewport } from "../hooks/useViewport";

const STYLES = [
	{
		key: "streets",
		labelKey: "settings.map.streets",
		styleId: "streets-v12",
		fallbackBg: "linear-gradient(135deg, oklch(0.93 0.02 240), oklch(0.95 0.03 220))",
	},
	{
		key: "outdoors",
		labelKey: "settings.map.outdoors",
		styleId: "outdoors-v12",
		fallbackBg: "linear-gradient(135deg, oklch(0.92 0.05 145), oklch(0.88 0.07 95))",
	},
	{
		key: "satellite",
		labelKey: "settings.map.satellite",
		styleId: "satellite-streets-v12",
		fallbackBg: "linear-gradient(135deg, oklch(0.4 0.04 240), oklch(0.3 0.05 145))",
	},
] as const;

type MapStyleKey = (typeof STYLES)[number]["key"];

const PREVIEW_FALLBACK = { lng: 4.4025, lat: 51.2194, zoom: 11 };

function buildPreviewUrl(styleId: string, lng: number, lat: number, zoom: number, token: string) {
	const safeZoom = Math.min(Math.max(Math.round(zoom * 10) / 10, 4), 16);
	return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${lng.toFixed(4)},${lat.toFixed(4)},${safeZoom}/200x120@2x?access_token=${token}&logo=false&attribution=false`;
}

type OverlayRow = {
	key: OverlayKey;
	labelKey: string;
	subKey: string;
	color: string;
};

const OVERLAY_ROWS: OverlayRow[] = [
	{
		key: "hikingNodes",
		labelKey: "layers.hikingNodes",
		subKey: "layers.hikingNodesSub",
		color: nodeNetworkColors.hiking,
	},
	{
		key: "cyclingNodes",
		labelKey: "layers.cyclingNodes",
		subKey: "layers.cyclingNodesSub",
		color: nodeNetworkColors.cycling,
	},
];

export function LayerPicker() {
	const close = useModalsStore((s) => s.closeOverlay);
	const styleKey = useRedesignSettingsStore((s) => s.mapStyle as MapStyleKey);
	const setMapStyle = useRedesignSettingsStore((s) => s.setMapStyle);
	const overlays = useRedesignSettingsStore((s) => s.overlays);
	const setOverlay = useRedesignSettingsStore((s) => s.setOverlay);
	const showNodeNetworkOverlays = useRedesignSettingsStore((s) => s.showNodeNetworkOverlays);
	const t = useT();
	const { isMobile } = useViewport();
	const overlayRows = showNodeNetworkOverlays ? OVERLAY_ROWS : [];

	const previews = useMemo(() => {
		const token = getRuntimeConfig("VITE_MAPBOX_ACCESS_TOKEN");
		if (!token) return null;
		const view = loadLastMapViewFromLocalStorage();
		const lng = view?.longitude ?? PREVIEW_FALLBACK.lng;
		const lat = view?.latitude ?? PREVIEW_FALLBACK.lat;
		const zoom = view?.zoom ?? PREVIEW_FALLBACK.zoom;
		return Object.fromEntries(STYLES.map((s) => [s.key, buildPreviewUrl(s.styleId, lng, lat, zoom, token)])) as Record<
			MapStyleKey,
			string
		>;
	}, []);

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
							overflow: "auto",
							animation: "rds-sheet-in 200ms cubic-bezier(0.32, 0.72, 0, 1)",
						}
					: {
							position: "absolute",
							top: 60,
							right: 16,
							width: 340,
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 14,
							boxShadow: "var(--rds-shadow-lg)",
							zIndex: 60,
							overflow: "hidden",
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
				<I.layers size={16} />
				<div style={{ fontSize: 14, fontWeight: 600 }}>{t("settings.map.styleLabel")}</div>
				<div style={{ flex: 1 }} />
				<IconBtn title={t("common.close")} onClick={close}>
					<I.close size={14} />
				</IconBtn>
			</div>
			<div style={{ padding: 12 }}>
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
					{STYLES.map((s) => {
						const on = styleKey === s.key;
						return (
							<button
								key={s.key}
								type="button"
								onClick={() => setMapStyle(s.key)}
								style={{
									padding: 0,
									border: on ? `2px solid ${RDS_COLORS.accent}` : `1.5px solid ${RDS_COLORS.border}`,
									borderRadius: 10,
									overflow: "hidden",
									background: "transparent",
									cursor: "pointer",
								}}
							>
								<div
									style={{
										height: 56,
										background: s.fallbackBg,
										backgroundSize: "cover",
										backgroundPosition: "center",
										backgroundImage: previews?.[s.key] ? `url("${previews[s.key]}")` : undefined,
									}}
								/>
								<div
									style={{
										padding: "6px 8px",
										fontSize: 11.5,
										fontWeight: 500,
										color: on ? RDS_COLORS.accent : RDS_COLORS.fg,
										textAlign: "left",
										background: RDS_COLORS.bgPanel,
									}}
								>
									{t(s.labelKey)}
								</div>
							</button>
						);
					})}
				</div>
			</div>
			{overlayRows.length > 0 && (
				<div style={{ borderTop: `1px solid ${RDS_COLORS.border}`, padding: "10px 14px 14px" }}>
					<SecTitle style={{ padding: "0 0 6px" }}>{t("layers.overlays")}</SecTitle>
					<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
						{overlayRows.map((row) => {
							const on = overlays?.[row.key] ?? false;
							return (
								<button
									key={row.key}
									type="button"
									aria-pressed={on}
									onClick={() => setOverlay(row.key, !on)}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 10,
										padding: "10px 12px",
										borderRadius: 8,
										background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
										border: `1px solid ${on ? RDS_COLORS.accent : RDS_COLORS.border}`,
										cursor: "pointer",
										textAlign: "left",
										width: "100%",
									}}
								>
									<div
										style={{
											width: 26,
											height: 26,
											borderRadius: 6,
											background: on ? row.color : RDS_COLORS.bgPanel,
											color: on ? "#fff" : row.color,
											border: `1px solid ${row.color}`,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											flexShrink: 0,
										}}
									>
										<I.layers size={13} />
									</div>
									<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
										<span style={{ fontSize: 12.5, fontWeight: 600, color: on ? RDS_COLORS.accent : RDS_COLORS.fg }}>
											{t(row.labelKey)}
										</span>
										<span style={{ fontSize: 10.5, color: RDS_COLORS.fgSubtle, marginTop: 2, lineHeight: 1.4 }}>
											{t(row.subKey)}
										</span>
									</div>
									<div
										aria-hidden
										style={{
											width: 30,
											height: 18,
											borderRadius: 999,
											background: on ? RDS_COLORS.accent : RDS_COLORS.border,
											position: "relative",
											transition: "background 120ms ease",
											flexShrink: 0,
										}}
									>
										<div
											style={{
												position: "absolute",
												top: 2,
												left: on ? 14 : 2,
												width: 14,
												height: 14,
												borderRadius: "50%",
												background: "#fff",
												transition: "left 120ms ease",
											}}
										/>
									</div>
								</button>
							);
						})}
						<div
							style={{
								fontSize: 10.5,
								color: RDS_COLORS.fgSubtle,
								lineHeight: 1.4,
								padding: "4px 4px 0",
							}}
						>
							{t("layers.overlaysSub")}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
