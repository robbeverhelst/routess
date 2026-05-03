import { haversineDistance, type Waypoint } from "@routess/core";
import { useMemo, useState } from "react";
import { serializeAndCompress } from "@/lib/shareUtils";
import { useIsMapLocked, useRouteDistance, useRouteDuration, useWaypoints } from "@/stores/routingStore";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, SecTitle, Toggle } from "../components/primitives";
import { useModalsStore } from "../stores/modalsStore";
import { useRedesignSettingsStore } from "../stores/settingsStore";

const PRIVACY_KM = 1;

function trimPrivacyEdges(waypoints: Waypoint[]): Waypoint[] {
	if (waypoints.length < 4) return waypoints;

	let startIdx = 0;
	let cum = 0;
	for (let i = 1; i < waypoints.length; i++) {
		cum += haversineDistance(waypoints[i - 1].coord, waypoints[i].coord);
		if (cum > PRIVACY_KM) {
			startIdx = i;
			break;
		}
	}

	let endIdx = waypoints.length - 1;
	cum = 0;
	for (let i = waypoints.length - 1; i > 0; i--) {
		cum += haversineDistance(waypoints[i].coord, waypoints[i - 1].coord);
		if (cum > PRIVACY_KM) {
			endIdx = i - 1;
			break;
		}
	}

	if (endIdx - startIdx < 1) return waypoints;
	return waypoints.slice(startIdx, endIdx + 1);
}

const VISIBILITY = [
	{ key: "link", label: "Anyone with link" },
	{ key: "followers", label: "Only followers", disabled: true },
	{ key: "specific", label: "Specific people", disabled: true },
] as const;

export function ShareModal() {
	const closeModal = useModalsStore((s) => s.closeModal);
	const waypoints = useWaypoints();
	const isMapLocked = useIsMapLocked();
	const distance = useRouteDistance();
	const duration = useRouteDuration();

	const [visibility, setVisibility] = useState<(typeof VISIBILITY)[number]["key"]>("link");
	const hideEdges = useRedesignSettingsStore((s) => s.hidePrivacy);
	const setHideEdges = useRedesignSettingsStore((s) => s.setHidePrivacy);
	const [copied, setCopied] = useState(false);

	const url = useMemo(() => {
		try {
			const wps = hideEdges ? trimPrivacyEdges(waypoints) : waypoints;
			const encoded = serializeAndCompress(wps, isMapLocked);
			if (!encoded) return window.location.origin;
			return `${window.location.origin}?route=${encoded}`;
		} catch {
			return window.location.origin;
		}
	}, [waypoints, isMapLocked, hideEdges]);

	const copy = async () => {
		window.dispatchEvent(new CustomEvent("routess:share-route"));
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			/* noop */
		}
	};

	const handleShare = () => {
		window.dispatchEvent(new CustomEvent("routess:share-route"));
		closeModal();
	};

	const handleDownload = () => {
		window.dispatchEvent(new CustomEvent("routess:export-gpx"));
		closeModal();
	};

	return (
		<ModalShell
			title="Share route"
			sub={`${distance || "—"} · ${duration || "—"}`}
			width={520}
			onClose={closeModal}
			footer={
				<>
					<div style={{ flex: 1 }} />
					<Btn onClick={closeModal}>Close</Btn>
					<Btn variant="primary" onClick={copy}>
						<I.copy size={14} /> {copied ? "Copied" : "Copy link"}
					</Btn>
				</>
			}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
				{/* Preview */}
				<div
					style={{
						borderRadius: 12,
						border: `1px solid ${RDS_COLORS.border}`,
						overflow: "hidden",
						background: RDS_COLORS.bgPanelElev,
					}}
				>
					<div style={{ height: 140, position: "relative", background: RDS_COLORS.bgInput }}>
						<svg
							viewBox="0 0 480 140"
							style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
							aria-hidden="true"
						>
							<path
								d="M 60 100 Q 160 30, 250 80 T 420 50"
								stroke="var(--rds-accent)"
								strokeWidth="2.6"
								fill="none"
								strokeLinecap="round"
							/>
							<circle cx="60" cy="100" r="5" fill="var(--rds-success)" stroke="white" strokeWidth="2" />
							<circle cx="420" cy="50" r="5" fill="var(--rds-danger)" stroke="white" strokeWidth="2" />
						</svg>
					</div>
					<div style={{ padding: 14 }}>
						<div style={{ fontSize: 14, fontWeight: 600 }}>Current route</div>
						<div
							className="rds-mono"
							style={{
								display: "flex",
								gap: 8,
								fontSize: 11,
								color: RDS_COLORS.fgSubtle,
								marginTop: 4,
							}}
						>
							<span>{distance || "—"}</span>
							<span>·</span>
							<span>{waypoints.length} waypoints</span>
						</div>
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>Share link</SecTitle>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 8,
							padding: "0 12px",
							height: 38,
						}}
					>
						<I.globe size={14} />
						<span
							className="rds-mono"
							style={{
								fontSize: 12,
								flex: 1,
								color: RDS_COLORS.fgMuted,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{url}
						</span>
						<Btn variant="ghost" onClick={copy} style={{ height: 28, padding: "0 10px", fontSize: 11 }}>
							{copied ? "Copied" : "Copy"}
						</Btn>
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>Who can view</SecTitle>
					<div style={{ display: "flex", gap: 8 }}>
						{VISIBILITY.map((v) => {
							const on = visibility === v.key;
							return (
								<button
									key={v.key}
									type="button"
									disabled={v.disabled}
									onClick={() => !v.disabled && setVisibility(v.key)}
									style={{
										flex: 1,
										height: 36,
										borderRadius: 8,
										border: on ? `1px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
										background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
										color: on ? RDS_COLORS.accent : RDS_COLORS.fg,
										fontSize: 12.5,
										fontWeight: 500,
										cursor: v.disabled ? "not-allowed" : "pointer",
										opacity: v.disabled ? 0.5 : 1,
									}}
								>
									{v.label}
								</button>
							);
						})}
					</div>
				</div>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						background: RDS_COLORS.bgInput,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 8,
						padding: 12,
					}}
				>
					<I.lock size={14} />
					<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
						<div style={{ fontSize: 12.5, fontWeight: 500 }}>Hide first/last 1 km</div>
						<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
							Recommended for routes near home
						</div>
					</div>
					<Toggle on={hideEdges} onChange={setHideEdges} />
				</div>

				{/* Channel buttons */}
				<div style={{ display: "flex", gap: 8 }}>
					<Btn title="Share" onClick={handleShare} style={{ flex: 1, height: 44 }}>
						<I.share size={16} />
					</Btn>
					<Btn title="Download" onClick={handleDownload} style={{ flex: 1, height: 44 }}>
						<I.download size={16} />
					</Btn>
				</div>
			</div>
		</ModalShell>
	);
}
