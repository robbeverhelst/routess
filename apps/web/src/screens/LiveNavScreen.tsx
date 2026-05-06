import { useState } from "react";
import { I } from "../components/icons";
import { MapBackdrop } from "../components/MapBackdrop";
import { Btn, IconBtn, RDS_COLORS, SecTitle, Toggle } from "../components/primitives";

const STATS = [
	{ label: "Remaining", value: "4.7", unit: "km" },
	{ label: "ETA", value: "11:42", unit: "" },
	{ label: "Speed", value: "24", unit: "km/h" },
	{ label: "HR", value: "142", unit: "bpm" },
];

export function LiveNavScreen({ onClose }: { onClose?: () => void }) {
	const [voicePanelOpen, setVoicePanelOpen] = useState(false);
	const [voiceGuidance, setVoiceGuidance] = useState(true);
	const [speedAlerts, setSpeedAlerts] = useState(false);
	const [muted, setMuted] = useState(false);

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

			{/* Top maneuver banner */}
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
							Turn right onto <strong>Schelde dijkpad</strong>
						</div>
					</div>
					<IconBtn
						title="Voice options"
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
					<SecTitle>Then</SecTitle>
					<I.arrowUp size={14} />
					<div style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>Continue 1.4 km, then sharp left</div>
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
						<SecTitle>Voice options</SecTitle>
						<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
							<span style={{ fontSize: 13, flex: 1 }}>Voice guidance</span>
							<Toggle on={voiceGuidance} onChange={setVoiceGuidance} />
						</div>
						<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
							<span style={{ fontSize: 13, flex: 1 }}>Speed alerts</span>
							<Toggle on={speedAlerts} onChange={setSpeedAlerts} />
						</div>
					</div>
				)}
			</div>

			{/* Bottom progress + stats */}
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
							<I.bell size={14} /> {muted ? "Unmute" : "Mute"}
						</Btn>
						<Btn onClick={handleReroute}>
							<I.layers size={14} /> Reroute
						</Btn>
						<Btn onClick={handleShare}>
							<I.share size={14} /> Share
						</Btn>
						<Btn onClick={handleExportGpx}>
							<I.download size={14} /> Export GPX
						</Btn>
						<div style={{ flex: 1 }} />
						<Btn variant="danger" onClick={onClose}>
							End
						</Btn>
					</div>
				</div>
			</div>
		</div>
	);
}
