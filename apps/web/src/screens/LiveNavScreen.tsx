import { useState } from "react";
import { t } from "@/lib/i18n";
import { useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { MapBackdrop } from "../components/MapBackdrop";
import { Btn, IconBtn, RDS_COLORS, SecTitle, Toggle } from "../components/primitives";

export function LiveNavScreen({ onClose }: { onClose?: () => void }) {
	const [voicePanelOpen, setVoicePanelOpen] = useState(false);
	const [voiceGuidance, setVoiceGuidance] = useState(true);
	const [speedAlerts, setSpeedAlerts] = useState(false);
	const [muted, setMuted] = useState(false);
	const language = useUiStore((s) => s.language);

	const STATS = [
		{ label: t("nav.remaining", language), value: "4.7", unit: "km" },
		{ label: t("nav.eta", language), value: "11:42", unit: "" },
		{ label: t("nav.speed", language), value: "24", unit: "km/h" },
		{ label: t("nav.hr", language), value: "142", unit: "bpm" },
	];

	const handleShare = () => {
		window.dispatchEvent(new CustomEvent("routess:share-route"));
	};

	const handleExportGpx = () => {
		window.dispatchEvent(new CustomEvent("routess:export-gpx"));
	};

	const handleReroute = () => {
		window.dispatchEvent(new CustomEvent("routess:reroute"));
	};

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: RDS_COLORS.bgCanvas,
				overflow: "hidden",
			}}
		>
			<MapBackdrop showRoute />
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"linear-gradient(to bottom, color-mix(in oklch, var(--rds-bg-canvas) 85%, transparent), transparent 30%, transparent 60%, color-mix(in oklch, var(--rds-bg-canvas) 95%, transparent))",
					pointerEvents: "none",
				}}
			/>

			<div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 5 }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 16,
						padding: "16px 20px",
						borderRadius: 14,
						background: RDS_COLORS.accent,
						color: RDS_COLORS.accentFg,
						boxShadow: "var(--rds-shadow-lg)",
					}}
				>
					<div
						style={{
							width: 56,
							height: 56,
							borderRadius: 12,
							background: "color-mix(in oklch, white 18%, transparent)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<I.arrowUp size={32} style={{ transform: "rotate(45deg)" }} />
					</div>
					<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
						<div className="rds-mono" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1, letterSpacing: -0.5 }}>
							240 m
						</div>
						<div style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>
							{t("nav.turnRight", language, { street: "Schelde dijkpad" })}
						</div>
					</div>
					<IconBtn
						title={t("nav.voiceOptions", language)}
						pressed={voicePanelOpen}
						onClick={() => setVoicePanelOpen((v) => !v)}
						style={{ width: 40, height: 40, color: RDS_COLORS.accentFg }}
					>
						<I.command size={16} />
					</IconBtn>
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						marginTop: 6,
						padding: "10px 16px",
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 12,
						boxShadow: "var(--rds-shadow-sm)",
					}}
				>
					<SecTitle>{t("nav.then", language)}</SecTitle>
					<I.arrowUp size={14} />
					<div style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>
						{t("nav.continue", language, { distance: "1.4 km" })}
					</div>
				</div>
				{voicePanelOpen && (
					<div
						style={{
							marginTop: 6,
							padding: "12px 16px",
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 12,
							boxShadow: "var(--rds-shadow-sm)",
							display: "flex",
							flexDirection: "column",
							gap: 10,
						}}
					>
						<SecTitle>{t("nav.voiceOptions", language)}</SecTitle>
						<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
							<span style={{ fontSize: 13, flex: 1 }}>{t("nav.voiceGuidance", language)}</span>
							<Toggle on={voiceGuidance} onChange={setVoiceGuidance} />
						</div>
						<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
							<span style={{ fontSize: 13, flex: 1 }}>{t("nav.speedAlerts", language)}</span>
							<Toggle on={speedAlerts} onChange={setSpeedAlerts} />
						</div>
					</div>
				)}
			</div>

			<div style={{ position: "absolute", bottom: 16, left: 16, right: 16, zIndex: 5 }}>
				<div
					style={{
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 16,
						boxShadow: "var(--rds-shadow-lg)",
						overflow: "hidden",
					}}
				>
					<div style={{ height: 4, background: RDS_COLORS.bgInput }}>
						<div style={{ height: "100%", width: "62%", background: RDS_COLORS.accent }} />
					</div>
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: 18 }}>
						{STATS.map((s, i) => (
							<div
								key={s.label}
								style={{
									borderLeft: i ? `1px solid ${RDS_COLORS.border}` : "none",
									paddingLeft: i ? 16 : 0,
								}}
							>
								<SecTitle>{s.label}</SecTitle>
								<div className="rds-mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 4, lineHeight: 1 }}>
									{s.value}
									{s.unit && (
										<span
											style={{
												fontSize: 11,
												color: RDS_COLORS.fgSubtle,
												marginLeft: 4,
												fontWeight: 400,
											}}
										>
											{s.unit}
										</span>
									)}
								</div>
							</div>
						))}
					</div>
					<div style={{ display: "flex", gap: 8, padding: "0 18px 18px", flexWrap: "wrap" }}>
						<Btn onClick={() => setMuted((m) => !m)} variant={muted ? "primary" : undefined}>
							<I.bell size={14} /> {muted ? t("nav.unmute", language) : t("nav.mute", language)}
						</Btn>
						<Btn onClick={handleReroute}>
							<I.layers size={14} /> {t("nav.reroute", language)}
						</Btn>
						<Btn onClick={handleShare}>
							<I.share size={14} /> {t("nav.share", language)}
						</Btn>
						<Btn onClick={handleExportGpx}>
							<I.download size={14} /> {t("nav.exportGpx", language)}
						</Btn>
						<div style={{ flex: 1 }} />
						<Btn variant="danger" onClick={onClose}>
							{t("nav.end", language)}
						</Btn>
					</div>
				</div>
			</div>
		</div>
	);
}
