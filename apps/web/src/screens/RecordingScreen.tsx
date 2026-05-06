import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { MapBackdrop } from "../components/MapBackdrop";
import { Badge, Btn, RDS_COLORS, SecTitle } from "../components/primitives";

function fmtTime(secs: number): { mmss: string; hundredths: string } {
	const total = Math.max(0, Math.floor(secs * 100));
	const minutes = Math.floor(total / 6000);
	const seconds = Math.floor((total % 6000) / 100);
	const hundredths = total % 100;
	return {
		mmss: `${minutes}:${seconds.toString().padStart(2, "0")}`,
		hundredths: hundredths.toString().padStart(2, "0"),
	};
}

export function RecordingScreen({ onStop }: { onStop?: () => void }) {
	const [running, setRunning] = useState(true);
	const [elapsed, setElapsed] = useState(42.18);
	const [lap, setLap] = useState(3);
	const language = useUiStore((s) => s.language);

	const STATS = [
		{ label: t("record.distance", language), value: "8.2", unit: "km" },
		{ label: t("record.pace", language), value: "4:32", unit: "/km" },
		{ label: t("record.hrAvg", language), value: "148", unit: "bpm" },
		{ label: t("record.cadence", language), value: "172", unit: "spm" },
	];
	const startedAt = useRef<number | null>(null);
	const baseline = useRef(elapsed);

	// biome-ignore lint/correctness/useExhaustiveDependencies: we only restart the loop on play/pause; reading current elapsed inside is the intent
	useEffect(() => {
		if (!running) return;
		startedAt.current = performance.now();
		baseline.current = elapsed;
		let raf = 0;
		const tick = () => {
			if (!running || startedAt.current == null) return;
			setElapsed(baseline.current + (performance.now() - startedAt.current) / 1000);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [running]);

	const time = fmtTime(elapsed);

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

			{/* Top status pill */}
			<div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 5 }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						padding: "10px 14px",
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 999,
						boxShadow: "var(--rds-shadow-md)",
					}}
				>
					<div
						style={{
							width: 8,
							height: 8,
							borderRadius: 999,
							background: running ? RDS_COLORS.danger : RDS_COLORS.warn,
							animation: running ? "rds-pulse 1.4s infinite" : undefined,
						}}
					/>
					<span style={{ fontSize: 13, fontWeight: 600 }}>
						{running ? t("record.recording", language) : t("record.paused", language)}
					</span>
					<span className="rds-mono" style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>
						· Schelde loop
					</span>
					<div style={{ flex: 1 }} />
					<Badge>
						<I.target size={11} /> {t("record.gpsStrong", language)}
					</Badge>
					<Badge>{t("record.satellites", language, { count: "12" })}</Badge>
				</div>
			</div>

			{/* Bottom stats card */}
			<div style={{ position: "absolute", bottom: 16, left: 16, right: 16, zIndex: 5 }}>
				<div
					style={{
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 18,
						boxShadow: "var(--rds-shadow-lg)",
						padding: 22,
					}}
				>
					<div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
						<div style={{ display: "flex", flexDirection: "column" }}>
							<SecTitle>{t("record.elapsed", language)}</SecTitle>
							<div
								className="rds-mono"
								style={{
									fontSize: 56,
									fontWeight: 600,
									lineHeight: 1,
									letterSpacing: -2,
								}}
							>
								{time.mmss}
								<span style={{ fontSize: 28, color: RDS_COLORS.fgSubtle, fontWeight: 400 }}>:{time.hundredths}</span>
							</div>
						</div>
						<div style={{ flex: 1 }} />
						<div style={{ display: "flex", flexDirection: "column", textAlign: "right" }}>
							<SecTitle>{t("record.lapOf", language, { n: String(lap), total: "4" })}</SecTitle>
							<div className="rds-mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
								2:14 <span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>/ km</span>
							</div>
						</div>
					</div>

					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(4, 1fr)",
							marginTop: 18,
							padding: "14px 0",
							borderTop: `1px solid ${RDS_COLORS.border}`,
							borderBottom: `1px solid ${RDS_COLORS.border}`,
						}}
					>
						{STATS.map((s, i) => (
							<div
								key={s.label}
								style={{
									borderLeft: i ? `1px solid ${RDS_COLORS.border}` : "none",
									paddingLeft: i ? 16 : 0,
								}}
							>
								<SecTitle>{s.label}</SecTitle>
								<div className="rds-mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>
									{s.value}
									<span
										style={{
											fontSize: 11,
											color: RDS_COLORS.fgSubtle,
											fontWeight: 400,
											marginLeft: 3,
										}}
									>
										{s.unit}
									</span>
								</div>
							</div>
						))}
					</div>

					<div style={{ display: "flex", gap: 8, marginTop: 16 }}>
						<Btn style={{ flex: 1, height: 48, fontSize: 14 }} onClick={() => setLap((l) => l + 1)}>
							<I.flag size={14} /> {t("record.lap", language)}
						</Btn>
						<Btn
							style={{
								flex: 1,
								height: 48,
								background: RDS_COLORS.warn,
								color: "white",
								borderColor: "transparent",
								fontSize: 14,
							}}
							onClick={() => setRunning((r) => !r)}
						>
							{running ? t("record.pause", language) : t("record.resume", language)}
						</Btn>
						<Btn variant="danger" style={{ height: 48, fontSize: 14, padding: "0 22px" }} onClick={onStop}>
							<span style={{ width: 14, height: 14, background: "white", borderRadius: 2 }} />{" "}
							{t("record.stop", language)}
						</Btn>
					</div>
				</div>
			</div>
		</div>
	);
}
