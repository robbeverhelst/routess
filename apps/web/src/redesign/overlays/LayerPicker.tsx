import { useState } from "react";
import { I } from "../components/icons";
import { IconBtn, RDS_COLORS, SecTitle, Toggle } from "../components/primitives";
import { useModalsStore } from "../stores/modalsStore";

const STYLES = [
	{ key: "streets", label: "Streets", bg: "linear-gradient(135deg, oklch(0.93 0.02 240), oklch(0.95 0.03 220))" },
	{ key: "outdoors", label: "Outdoors", bg: "linear-gradient(135deg, oklch(0.92 0.05 145), oklch(0.88 0.07 95))" },
	{ key: "satellite", label: "Satellite", bg: "linear-gradient(135deg, oklch(0.4 0.04 240), oklch(0.3 0.05 145))" },
	{ key: "terrain", label: "Terrain", bg: "linear-gradient(135deg, oklch(0.85 0.06 75), oklch(0.7 0.09 45))" },
	{ key: "dark", label: "Dark", bg: "linear-gradient(135deg, oklch(0.18 0.012 270), oklch(0.22 0.014 250))" },
	{ key: "minimal", label: "Minimal", bg: "linear-gradient(135deg, oklch(0.97 0.003 270), oklch(0.94 0.005 250))" },
] as const;

export function LayerPicker() {
	const close = useModalsStore((s) => s.closeOverlay);
	const [styleKey, setStyleKey] = useState<(typeof STYLES)[number]["key"]>("outdoors");
	const [overlays, setOverlays] = useState({
		heatmap: true,
		contour: false,
		bike: true,
		surface: false,
		wind: false,
	});

	const overlayItems = [
		{ key: "heatmap" as const, icon: I.trend, label: "Heatmap", sub: "Your activity history" },
		{ key: "contour" as const, icon: I.mountain, label: "Contour lines", sub: "Show elevation" },
		{ key: "bike" as const, icon: I.bike, label: "Cycling lanes", sub: "Highlight bike infra" },
		{ key: "surface" as const, icon: I.flag, label: "Surface type", sub: "Color by paved/gravel" },
		{ key: "wind" as const, icon: I.zap, label: "Wind", sub: "Live wind direction", pro: true },
	];

	return (
		<div
			style={{
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
			}}
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
				<div style={{ fontSize: 14, fontWeight: 600 }}>Map style</div>
				<div style={{ flex: 1 }} />
				<IconBtn title="Close" onClick={close}>
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
								onClick={() => setStyleKey(s.key)}
								style={{
									padding: 0,
									border: on ? `2px solid ${RDS_COLORS.accent}` : `1.5px solid ${RDS_COLORS.border}`,
									borderRadius: 10,
									overflow: "hidden",
									background: "transparent",
									cursor: "pointer",
								}}
							>
								<div style={{ height: 56, background: s.bg }} />
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
									{s.label}
								</div>
							</button>
						);
					})}
				</div>
			</div>
			<div style={{ borderTop: `1px solid ${RDS_COLORS.border}`, padding: 4 }}>
				<SecTitle style={{ padding: "10px 14px 6px" }}>Overlays</SecTitle>
				{overlayItems.map((o) => {
					const Icon = o.icon;
					const on = overlays[o.key];
					return (
						<div
							key={o.key}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: "9px 12px",
								borderRadius: 8,
							}}
						>
							<div
								style={{
									width: 26,
									height: 26,
									borderRadius: 6,
									background: RDS_COLORS.bgInput,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: RDS_COLORS.fgMuted,
								}}
							>
								<Icon size={13} />
							</div>
							<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
								<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
									<span style={{ fontSize: 12.5, fontWeight: 500 }}>{o.label}</span>
									{o.pro && (
										<span
											style={{
												display: "inline-flex",
												alignItems: "center",
												padding: "2px 6px",
												height: 16,
												borderRadius: 999,
												background: RDS_COLORS.accentSoft,
												color: RDS_COLORS.accent,
												fontSize: 9.5,
												fontWeight: 600,
											}}
										>
											Pro
										</span>
									)}
								</div>
								<div style={{ fontSize: 10.5, color: RDS_COLORS.fgSubtle, marginTop: 1 }}>{o.sub}</div>
							</div>
							<Toggle on={on} disabled={o.pro} onChange={(v) => setOverlays({ ...overlays, [o.key]: v })} />
						</div>
					);
				})}
			</div>
		</div>
	);
}
