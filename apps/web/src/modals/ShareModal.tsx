import { buildRouteSlugId } from "@routess/core";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { trackEvent } from "@/lib/analytics/track";
import { useRoute } from "@/lib/api-queries";
import { emitAppEvent } from "@/lib/app-events";
import { t } from "@/lib/i18n";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { serializeAndCompress } from "@/lib/shareUtils";
import { buildMapboxStaticPreviewUrl } from "@/lib/utils/mapboxStaticPreview";
import { buildRouteShareCard } from "@/lib/utils/routeShareCard";
import { useMapViewStore } from "@/stores/mapViewStore";
import { useModalsStore } from "@/stores/modalsStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useRouteSurfaceStore } from "@/stores/routeSurfaceStore";
import {
	useElevationGain,
	useIsMapLocked,
	useRouteDistance,
	useRouteDuration,
	useRoutePath,
	useRoutingStore,
	useWaypoints,
} from "@/stores/routingStore";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { FacebookBrand, I, WhatsAppBrand, XBrand } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

const PREVIEW_WIDTH = 480;
const PREVIEW_HEIGHT = 168;

type Coordinate = [number, number];

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
	const activityType = useUiStore((s) => s.activityType);
	const activityIconUrl = useMemo(() => {
		const ActivityIcon = activityType === "cycle" ? I.bike : activityType === "walk" ? I.walk : I.run;
		const svg = renderToStaticMarkup(<ActivityIcon size={64} />).replace("<svg", '<svg color="#16161d"');
		return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
	}, [activityType]);
	const waypoints = useWaypoints();
	const routePath = useRoutePath();
	const isMapLocked = useIsMapLocked();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const elevationGain = useElevationGain();
	const pushToast = useToastStore((s) => s.push);

	const mapStyle = useRedesignSettingsStore((s) => s.mapStyle);
	const lightPreset = useMapViewStore((s) => s.lightPreset);
	const surfaceBreakdown = useRouteSurfaceStore((s) => s.breakdown);
	const [copied, setCopied] = useState(false);
	const [canNativeShare, setCanNativeShare] = useState(false);
	const [imageBusy, setImageBusy] = useState(false);

	useEffect(() => {
		setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
	}, []);

	const mode = useRoutingStore((s) => s.mode);
	const savedRouteId = mode.kind === "editing" ? mode.routeId : null;
	const { data: savedRoute } = useRoute(savedRouteId ?? 0);
	const savedVisibility = savedRouteId && savedRoute?.id === savedRouteId ? savedRoute.visibility : null;
	const canShareCanonical = savedRouteId !== null && (savedVisibility === "public" || savedVisibility === "unlisted");

	const url = useMemo(() => {
		if (canShareCanonical && savedRouteId !== null && savedRoute) {
			// Canonical page is on the landing host once VITE_PUBLIC_ROUTE_BASE_URL is set (ADR 0025); else this origin.
			const base = (getRuntimeConfig("VITE_PUBLIC_ROUTE_BASE_URL") ?? window.location.origin).replace(/\/+$/, "");
			return `${base}/r/${buildRouteSlugId(savedRoute.name, savedRouteId)}`;
		}
		try {
			const encoded = serializeAndCompress(waypoints, isMapLocked);
			if (!encoded) return window.location.origin;
			return `${window.location.origin}?route=${encoded}`;
		} catch {
			return window.location.origin;
		}
	}, [waypoints, isMapLocked, canShareCanonical, savedRouteId, savedRoute]);

	const hasRoute = waypoints.length > 0;
	const previewPoints = useMemo<Coordinate[]>(() => {
		if (routePath.length >= 2) return routePath as Coordinate[];
		return waypoints.map((waypoint) => waypoint.coord as Coordinate);
	}, [routePath, waypoints]);
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
			const urlLengthBucket: "short" | "medium" | "long" =
				url.length < 200 ? "short" : url.length < 500 ? "medium" : "long";
			trackEvent({
				name: "route_share_link_copied",
				properties: {
					route_was_saved: useRoutingStore.getState().mode.kind === "editing",
					url_length_bucket: urlLengthBucket,
				},
			});
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

	const makeCard = () =>
		buildRouteShareCard({
			points: previewPoints,
			waypoints,
			surfaceSegments: surfaceBreakdown?.segments ?? [],
			mapStyle,
			lightPreset,
			activityIconUrl,
			distance,
			duration,
			elevationMeters: elevationGain ?? null,
		});

	const copyImage = async () => {
		if (!hasRoute) {
			pushToast({ kind: "warn", title: t("share.empty") });
			return;
		}
		if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
			pushToast({ kind: "warn", title: t("share.imageCopyUnsupported") });
			return;
		}
		setImageBusy(true);
		try {
			const blob = await makeCard();
			if (!blob) throw new Error("card unavailable");
			await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
			pushToast({ kind: "success", title: t("share.imageCopied") });
		} catch {
			pushToast({ kind: "danger", title: t("share.imageFailed") });
		} finally {
			setImageBusy(false);
		}
	};

	const downloadImage = async () => {
		if (!hasRoute) {
			pushToast({ kind: "warn", title: t("share.empty") });
			return;
		}
		setImageBusy(true);
		try {
			const blob = await makeCard();
			if (!blob) throw new Error("card unavailable");
			const objectUrl = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = objectUrl;
			link.download = "routess-route.png";
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(objectUrl);
			pushToast({ kind: "success", title: t("share.imageSaved") });
		} catch {
			pushToast({ kind: "danger", title: t("share.imageFailed") });
		} finally {
			setImageBusy(false);
		}
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
					{savedRouteId !== null && savedVisibility === "private" && (
						<div
							style={{
								fontSize: 11.5,
								color: RDS_COLORS.fgSubtle,
								lineHeight: 1.5,
								padding: "8px 10px",
								borderRadius: 8,
								background: `color-mix(in oklch, ${RDS_COLORS.warn} 8%, transparent)`,
								border: `1px solid color-mix(in oklch, ${RDS_COLORS.warn} 25%, transparent)`,
							}}
						>
							{t("share.privateHint")}
						</div>
					)}
					{canShareCanonical && (
						<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{t("share.canonicalHint")}</div>
					)}
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>{t("share.via")}</SecTitle>
					<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						<TargetTile
							label={t("share.copyImage")}
							icon={<I.copy size={18} />}
							onClick={copyImage}
							tint={RDS_COLORS.accent}
							disabled={!hasRoute || imageBusy}
						/>
						<TargetTile
							label={t("share.saveImage")}
							icon={<I.download size={18} />}
							onClick={downloadImage}
							disabled={!hasRoute || imageBusy}
						/>
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
			</div>
		</ModalShell>
	);
}
