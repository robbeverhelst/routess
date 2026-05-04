import { haversineDistance, type Waypoint } from "@routess/core";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";
import { serializeAndCompress } from "@/lib/shareUtils";
import {
	useIsMapLocked,
	useRouteDistance,
	useRouteDuration,
	useSetShareNotification,
	useWaypoints,
} from "@/stores/routingStore";
import { FacebookBrand, I, WhatsAppBrand, XBrand } from "../components/icons";
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

function notify(setShareNotification: (msg: string) => void, message: string) {
	setShareNotification(message);
	setTimeout(() => setShareNotification(""), 2000);
}

interface TargetTileProps {
	label: string;
	icon: ReactNode;
	onClick: () => void;
	disabled?: boolean;
	tint?: string;
}

function TargetTile({ label, icon, onClick, disabled, tint }: TargetTileProps) {
	const baseStyle: CSSProperties = {
		flex: 1,
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		minWidth: 64,
		height: 68,
		borderRadius: 10,
		border: `1px solid ${RDS_COLORS.border}`,
		background: RDS_COLORS.bgInput,
		color: RDS_COLORS.fg,
		fontSize: 11,
		fontWeight: 500,
		cursor: disabled ? "not-allowed" : "pointer",
		opacity: disabled ? 0.45 : 1,
		transition: "background 120ms, border-color 120ms, color 120ms",
	};

	return (
		<button
			type="button"
			onClick={disabled ? undefined : onClick}
			disabled={disabled}
			style={baseStyle}
			onMouseEnter={(e) => {
				if (disabled) return;
				e.currentTarget.style.background = RDS_COLORS.bgHover;
				e.currentTarget.style.borderColor = RDS_COLORS.borderStrong;
			}}
			onMouseLeave={(e) => {
				if (disabled) return;
				e.currentTarget.style.background = RDS_COLORS.bgInput;
				e.currentTarget.style.borderColor = RDS_COLORS.border;
			}}
		>
			<span style={{ color: tint ?? RDS_COLORS.fgMuted, display: "inline-flex" }}>{icon}</span>
			<span>{label}</span>
		</button>
	);
}

export function ShareModal() {
	const closeModal = useModalsStore((s) => s.closeModal);
	const waypoints = useWaypoints();
	const isMapLocked = useIsMapLocked();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const setShareNotification = useSetShareNotification();

	const hideEdges = useRedesignSettingsStore((s) => s.hidePrivacy);
	const setHideEdges = useRedesignSettingsStore((s) => s.setHidePrivacy);
	const [copied, setCopied] = useState(false);
	const [canNativeShare, setCanNativeShare] = useState(false);

	useEffect(() => {
		setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
	}, []);

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

	const hasRoute = waypoints.length > 0;
	const shareText = useMemo(() => {
		const parts: string[] = ["Check out this route on Routess"];
		if (distance) parts.push(distance);
		if (duration) parts.push(duration);
		return parts.join(" · ");
	}, [distance, duration]);

	const copy = async () => {
		if (!hasRoute) {
			notify(setShareNotification, "Cannot share an empty route.");
			return;
		}
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
			notify(setShareNotification, "Link copied to clipboard!");
		} catch {
			notify(setShareNotification, "Failed to copy link.");
		}
	};

	const shareNative = async () => {
		if (!hasRoute) {
			notify(setShareNotification, "Cannot share an empty route.");
			return;
		}
		try {
			await navigator.share({
				title: "Routess route",
				text: shareText,
				url,
			});
			notify(setShareNotification, "Shared!");
			closeModal();
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") return;
			notify(setShareNotification, "Sharing was cancelled.");
		}
	};

	const openExternal = (target: string, label: string) => {
		if (!hasRoute) {
			notify(setShareNotification, "Cannot share an empty route.");
			return;
		}
		const w = window.open(target, "_blank", "noopener,noreferrer");
		if (w) {
			notify(setShareNotification, `Opened ${label}.`);
			closeModal();
		} else {
			notify(setShareNotification, "Popup blocked. Try copying the link instead.");
		}
	};

	const shareEmail = () => {
		const subject = encodeURIComponent("My Routess route");
		const body = encodeURIComponent(`${shareText}\n\n${url}`);
		openExternal(`mailto:?subject=${subject}&body=${body}`, "email");
	};

	const shareX = () => {
		const text = encodeURIComponent(shareText);
		const u = encodeURIComponent(url);
		openExternal(`https://twitter.com/intent/tweet?text=${text}&url=${u}`, "X");
	};

	const shareFacebook = () => {
		const u = encodeURIComponent(url);
		openExternal(`https://www.facebook.com/sharer/sharer.php?u=${u}`, "Facebook");
	};

	const shareWhatsApp = () => {
		const text = encodeURIComponent(`${shareText}\n${url}`);
		openExternal(`https://wa.me/?text=${text}`, "WhatsApp");
	};

	const downloadGpx = () => {
		if (!hasRoute) {
			notify(setShareNotification, "Cannot export an empty route.");
			return;
		}
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
					<Btn variant="primary" onClick={copy} disabled={!hasRoute}>
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
						<Btn
							variant="ghost"
							onClick={copy}
							disabled={!hasRoute}
							style={{ height: 28, padding: "0 10px", fontSize: 11 }}
						>
							{copied ? "Copied" : "Copy"}
						</Btn>
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>Share via</SecTitle>
					<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						{canNativeShare && (
							<TargetTile
								label="More"
								icon={<I.share size={18} />}
								onClick={shareNative}
								tint={RDS_COLORS.accent}
								disabled={!hasRoute}
							/>
						)}
						<TargetTile label="Email" icon={<I.mail size={18} />} onClick={shareEmail} disabled={!hasRoute} />
						<TargetTile label="X" icon={<XBrand size={16} />} onClick={shareX} disabled={!hasRoute} />
						<TargetTile
							label="Facebook"
							icon={<FacebookBrand size={18} />}
							onClick={shareFacebook}
							tint="#1877F2"
							disabled={!hasRoute}
						/>
						<TargetTile
							label="WhatsApp"
							icon={<WhatsAppBrand size={18} />}
							onClick={shareWhatsApp}
							tint="#25D366"
							disabled={!hasRoute}
						/>
						<TargetTile label="GPX" icon={<I.download size={18} />} onClick={downloadGpx} disabled={!hasRoute} />
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
			</div>
		</ModalShell>
	);
}
