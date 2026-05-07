import { haversineDistance, type Waypoint } from "@routess/core";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";
import { emitAppEvent } from "@/lib/app-events";
import { t } from "@/lib/i18n";
import { serializeAndCompress } from "@/lib/shareUtils";
import { buildMapboxStaticPreviewUrl } from "@/lib/utils/mapboxStaticPreview";
import { useModalsStore } from "@/stores/modalsStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useIsMapLocked, useRouteDistance, useRouteDuration, useRoutePath, useWaypoints } from "@/stores/routingStore";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { FacebookBrand, I, WhatsAppBrand, XBrand } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, SecTitle, Toggle } from "../components/primitives";

const PRIVACY_KM = 1;
const PREVIEW_WIDTH = 480;
const PREVIEW_HEIGHT = 168;

type Coordinate = [number, number];

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
	const _language = useUiStore((s) => s.language);
	const waypoints = useWaypoints();
	const routePath = useRoutePath();
	const isMapLocked = useIsMapLocked();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const pushToast = useToastStore((s) => s.push);

	const hideEdges = useRedesignSettingsStore((s) => s.hidePrivacy);
	const setHideEdges = useRedesignSettingsStore((s) => s.setHidePrivacy);
	const mapStyle = useRedesignSettingsStore((s) => s.mapStyle);
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
	const previewPoints = useMemo<Coordinate[]>(() => {
		if (routePath.length >= 2) return routePath as Coordinate[];
		const previewWaypoints = hideEdges ? trimPrivacyEdges(waypoints) : waypoints;
		return previewWaypoints.map((waypoint) => waypoint.coord as Coordinate);
	}, [routePath, waypoints, hideEdges]);
	const staticMapUrl = useMemo(
		() => buildMapboxStaticPreviewUrl(previewPoints, { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, mapStyle }),
		[previewPoints, mapStyle],
	);
	const hasPreview = previewPoints.length > 0;
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const showStaticMap = staticMapUrl !== null && failedUrl !== staticMapUrl;
	const shareText = useMemo(() => {
		const parts: string[] = [t("share.checkOut")];
		if (distance) parts.push(distance);
		if (duration) parts.push(duration);
		return parts.join(" · ");
	}, [distance, duration]);

	const copy = async () => {
		if (!hasRoute) {
			pushToast({ kind: "warn", title: t("share.empty") });
			return;
		}
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
			pushToast({ kind: "success", title: t("share.copied") });
		} catch {
			pushToast({ kind: "danger", title: t("share.copyFailed") });
		}
	};

	const shareNative = async () => {
		if (!hasRoute) {
			pushToast({ kind: "warn", title: t("share.empty") });
			return;
		}
		try {
			await navigator.share({
				title: t("share.routessRoute"),
				text: shareText,
				url,
			});
			pushToast({ kind: "success", title: t("share.shared") });
			closeModal();
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") return;
			pushToast({ kind: "warn", title: t("share.cancelled") });
		}
	};

	const openExternal = (target: string, label: string) => {
		if (!hasRoute) {
			pushToast({ kind: "warn", title: t("share.empty") });
			return;
		}
		const w = window.open(target, "_blank", "noopener,noreferrer");
		if (w) {
			pushToast({ kind: "success", title: t("share.opened", { label }) });
			closeModal();
		} else {
			pushToast({ kind: "warn", title: t("share.popupBlocked") });
		}
	};

	const shareEmail = () => {
		const subject = encodeURIComponent(t("share.myRoute"));
		const body = encodeURIComponent(`${shareText}\n\n${url}`);
		openExternal(`mailto:?subject=${subject}&body=${body}`, t("share.email"));
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
			pushToast({ kind: "warn", title: t("share.exportEmpty") });
			return;
		}
		emitAppEvent("routess:export-gpx");
		closeModal();
	};

	return (
		<ModalShell
			title={t("share.title")}
			sub={`${distance || "—"} · ${duration || "—"}`}
			width={520}
			onClose={closeModal}
			footer={
				<>
					<div style={{ flex: 1 }} />
					<Btn onClick={closeModal}>{t("common.close")}</Btn>
					<Btn variant="primary" onClick={copy} disabled={!hasRoute}>
						<I.copy size={14} /> {copied ? t("common.copied") : t("share.copyLink")}
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
					<div
						style={{
							height: PREVIEW_HEIGHT,
							position: "relative",
							background: `linear-gradient(180deg, ${RDS_COLORS.bgInput} 0%, ${RDS_COLORS.bgPanelElev} 100%)`,
						}}
					>
						{showStaticMap && staticMapUrl && (
							<img
								src={staticMapUrl}
								alt={t("share.previewAlt")}
								onError={() => setFailedUrl(staticMapUrl)}
								style={{
									position: "absolute",
									inset: 0,
									width: "100%",
									height: "100%",
									objectFit: "cover",
									display: "block",
								}}
							/>
						)}
						{!showStaticMap && (
							<svg
								viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
								style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
								aria-hidden="true"
							>
								<defs>
									<pattern id="share-preview-grid" width="40" height="40" patternUnits="userSpaceOnUse">
										<path d="M 40 0 L 0 0 0 40" fill="none" stroke={RDS_COLORS.border} strokeOpacity="0.45" />
									</pattern>
								</defs>
								<rect width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} fill="url(#share-preview-grid)" />
							</svg>
						)}
						{!hasPreview && (
							<div
								style={{
									position: "absolute",
									inset: 0,
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									justifyContent: "center",
									gap: 8,
									color: RDS_COLORS.fgSubtle,
								}}
							>
								<I.route size={24} />
								<div style={{ fontSize: 12.5, fontWeight: 500 }}>{t("share.noPreview")}</div>
							</div>
						)}
						<div
							style={{
								position: "absolute",
								top: 12,
								left: 12,
								display: "inline-flex",
								alignItems: "center",
								gap: 6,
								padding: "6px 9px",
								borderRadius: 999,
								background: "rgba(255,255,255,0.82)",
								border: `1px solid ${RDS_COLORS.border}`,
								color: RDS_COLORS.fgMuted,
								fontSize: 11,
								fontWeight: 600,
								backdropFilter: "blur(10px)",
							}}
						>
							<I.route size={12} />
							<span>{showStaticMap ? t("share.mapPreview") : t("share.sharePreview")}</span>
						</div>
					</div>
					<div style={{ padding: 14 }}>
						<div style={{ fontSize: 14, fontWeight: 600 }}>{t("share.currentRoute")}</div>
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
							<span>{t("share.waypointsCount", { count: String(waypoints.length) })}</span>
						</div>
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>{t("share.shareLink")}</SecTitle>
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
							{copied ? t("common.copied") : t("common.copy")}
						</Btn>
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>{t("share.via")}</SecTitle>
					<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						{canNativeShare && (
							<TargetTile
								label={t("share.more")}
								icon={<I.share size={18} />}
								onClick={shareNative}
								tint={RDS_COLORS.accent}
								disabled={!hasRoute}
							/>
						)}
						<TargetTile
							label={t("share.email")}
							icon={<I.mail size={18} />}
							onClick={shareEmail}
							disabled={!hasRoute}
						/>
						<TargetTile label={t("share.x")} icon={<XBrand size={16} />} onClick={shareX} disabled={!hasRoute} />
						<TargetTile
							label={t("share.facebook")}
							icon={<FacebookBrand size={18} />}
							onClick={shareFacebook}
							tint="#1877F2"
							disabled={!hasRoute}
						/>
						<TargetTile
							label={t("share.whatsapp")}
							icon={<WhatsAppBrand size={18} />}
							onClick={shareWhatsApp}
							tint="#25D366"
							disabled={!hasRoute}
						/>
						<TargetTile
							label={t("share.gpx")}
							icon={<I.download size={18} />}
							onClick={downloadGpx}
							disabled={!hasRoute}
						/>
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
						<div style={{ fontSize: 12.5, fontWeight: 500 }}>{t("share.hidePrivacy")}</div>
						<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>{t("share.hidePrivacyHint")}</div>
					</div>
					<Toggle on={hideEdges} onChange={setHideEdges} />
				</div>
			</div>
		</ModalShell>
	);
}
