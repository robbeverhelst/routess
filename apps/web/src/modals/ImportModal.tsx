import { useRef, useState } from "react";
import { useModalsStore } from "@/stores/modalsStore";
import { useToastStore } from "@/stores/toastStore";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

const EXTENSIONS = [".gpx", ".tcx", ".fit", ".kml"] as const;
const ACTIVITIES = ["Auto-detect", "Run", "Cycle", "Walk"] as const;

export function ImportModal() {
	const closeModal = useModalsStore((s) => s.closeModal);
	const pushToast = useToastStore((s) => s.push);
	const inputRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [activity, setActivity] = useState<(typeof ACTIVITIES)[number]>("Auto-detect");
	const [isDragging, setIsDragging] = useState(false);
	const [isImporting, setIsImporting] = useState(false);

	const onPick = () => inputRef.current?.click();

	const onFile = (f: File | null | undefined) => {
		if (!f) return;
		setFile(f);
	};

	const onImport = async () => {
		if (!file || isImporting) return;
		const ext = file.name.toLowerCase().split(".").pop();
		if (ext !== "gpx") {
			pushToast({
				kind: "warn",
				title: "Only GPX is supported right now",
				body: "TCX, FIT, and KML imports are coming in a follow-up.",
			});
			return;
		}
		setIsImporting(true);
		try {
			const gpxString = await file.text();
			window.dispatchEvent(
				new CustomEvent("routess:import-gpx", {
					detail: { gpxString, fileName: file.name },
				}),
			);
			pushToast({
				kind: "success",
				title: "Route imported",
				body: file.name,
			});
			closeModal();
		} catch (err) {
			pushToast({
				kind: "danger",
				title: "Import failed",
				body: err instanceof Error ? err.message : "Could not read the file.",
			});
		} finally {
			setIsImporting(false);
		}
	};

	return (
		<ModalShell
			title="Import route"
			sub="GPX, TCX, FIT · max 25 MB"
			width={560}
			onClose={closeModal}
			footer={
				<>
					<div style={{ flex: 1 }} />
					<Btn onClick={closeModal}>Cancel</Btn>
					{!file && (
						<Btn variant="primary" onClick={onPick}>
							Choose file
						</Btn>
					)}
					{file && (
						<Btn variant="primary" onClick={onImport} disabled={isImporting}>
							<I.zap size={14} /> {isImporting ? "Importing…" : "Import 1 route"}
						</Btn>
					)}
				</>
			}
		>
			<input
				ref={inputRef}
				type="file"
				accept=".gpx,.tcx,.fit,.kml"
				onChange={(e) => onFile(e.target.files?.[0])}
				style={{ display: "none" }}
			/>
			{!file ? (
				<button
					type="button"
					onClick={onPick}
					onDragOver={(e) => {
						e.preventDefault();
						setIsDragging(true);
					}}
					onDragLeave={() => setIsDragging(false)}
					onDrop={(e) => {
						e.preventDefault();
						setIsDragging(false);
						onFile(e.dataTransfer.files?.[0]);
					}}
					style={{
						width: "100%",
						padding: 32,
						border: `2px dashed ${isDragging ? RDS_COLORS.accent : RDS_COLORS.borderStrong}`,
						borderRadius: 12,
						textAlign: "center",
						background: isDragging ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
						cursor: "pointer",
						color: "inherit",
					}}
				>
					<div
						style={{
							width: 56,
							height: 56,
							borderRadius: 16,
							background: RDS_COLORS.accentSoft,
							color: RDS_COLORS.accent,
							margin: "0 auto 14px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<I.upload size={24} />
					</div>
					<div style={{ fontSize: 15, fontWeight: 600 }}>Drop file here</div>
					<div style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted, marginTop: 6 }}>or click to browse</div>
					<div
						style={{
							display: "flex",
							gap: 8,
							justifyContent: "center",
							marginTop: 16,
							flexWrap: "wrap",
						}}
					>
						{EXTENSIONS.map((e) => (
							<span
								key={e}
								className="rds-mono"
								style={{
									display: "inline-flex",
									alignItems: "center",
									padding: "2px 8px",
									height: 22,
									borderRadius: 999,
									background: RDS_COLORS.bgPanel,
									border: `1px solid ${RDS_COLORS.border}`,
									color: RDS_COLORS.fgMuted,
									fontSize: 11.5,
								}}
							>
								{e}
							</span>
						))}
					</div>
				</button>
			) : (
				<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 12,
							padding: 14,
							background: RDS_COLORS.bgPanelElev,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 10,
						}}
					>
						<div
							style={{
								width: 40,
								height: 40,
								borderRadius: 8,
								background: RDS_COLORS.accentSoft,
								color: RDS_COLORS.accent,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<I.pin size={18} />
						</div>
						<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
							<div style={{ fontSize: 13, fontWeight: 600 }}>{file.name}</div>
							<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
								{(file.size / 1024).toFixed(1)} KB
							</div>
						</div>
						<span
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 6,
								padding: "2px 8px",
								height: 22,
								borderRadius: 999,
								background: `color-mix(in oklch, ${RDS_COLORS.success} 18%, transparent)`,
								color: RDS_COLORS.success,
								fontSize: 11.5,
							}}
						>
							<I.zap size={11} /> Ready
						</span>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
						<SecTitle>Activity type</SecTitle>
						<div style={{ display: "flex", gap: 8 }}>
							{ACTIVITIES.map((l) => {
								const on = activity === l;
								return (
									<button
										key={l}
										type="button"
										onClick={() => setActivity(l)}
										style={{
											flex: 1,
											height: 34,
											borderRadius: 8,
											border: on ? `1px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
											background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
											color: on ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
											fontSize: 12,
											cursor: "pointer",
										}}
									>
										{l}
									</button>
								);
							})}
						</div>
					</div>

					{file.name.toLowerCase().endsWith(".gpx") ? null : (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								padding: 12,
								background: RDS_COLORS.bgInput,
								borderRadius: 8,
							}}
						>
							<I.zap size={14} style={{ color: RDS_COLORS.warn }} />
							<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>
								Only GPX is supported right now. TCX, FIT, and KML imports are coming in a follow-up.
							</div>
						</div>
					)}
				</div>
			)}
		</ModalShell>
	);
}
