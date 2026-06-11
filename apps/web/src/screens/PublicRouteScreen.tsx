import { toRouteSlug } from "@routess/core";
import { useEffect, useMemo } from "react";
import { type ApiRoute, apiService } from "@/lib/api";
import { useRoute } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { useUnits } from "@/lib/units";
import { buildMapboxStaticPreviewUrl } from "@/lib/utils/mapboxStaticPreview";
import { I } from "../components/icons";
import { Btn, RDS_COLORS } from "../components/primitives";
import { PublicPageShell, StatBlock, setCanonical, setMetaTag } from "./public-page";

const HERO_WIDTH = 1200;
const HERO_HEIGHT = 480;

// Public routes use the canonical slug-id URL (stable, SEO-friendly);
// unlisted routes use the unguessable share token so the link can't be
// derived from the sequential id.
function routeShareRef(route: ApiRoute): number | string {
	return route.visibility === "public" ? route.id : route.shareToken;
}

function PublicRouteHero({ route, expectedSlug }: { route: ApiRoute; expectedSlug: string }) {
	const t = useT();
	const { formatDistanceParts, formatElevationParts } = useUnits();
	const distance = route.distance ? formatDistanceParts(route.distance / 1000) : null;
	const duration = route.duration ? `${Math.round(route.duration / 60)} min` : "—";
	const elevation = route.elevationGain ? formatElevationParts(route.elevationGain) : null;
	const canonicalSlug = toRouteSlug(route.name);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (canonicalSlug !== expectedSlug) {
			const target = `/r/${canonicalSlug}-${routeShareRef(route)}${window.location.search}${window.location.hash}`;
			window.history.replaceState({}, "", target);
		}
	}, [canonicalSlug, expectedSlug, route]);

	const previewPoints = useMemo<[number, number][]>(() => {
		if (route.geometry && route.geometry.length >= 2) return route.geometry;
		return (route.waypoints ?? []).map((w) => w.coord);
	}, [route]);
	const heroUrl = useMemo(
		() => buildMapboxStaticPreviewUrl(previewPoints, { width: HERO_WIDTH, height: HERO_HEIGHT, padding: 32 }),
		[previewPoints],
	);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 20, maxWidth: 960, margin: "0 auto" }}>
			<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
				<div
					className="rds-mono"
					style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, letterSpacing: 0.4, display: "flex", gap: 8 }}
				>
					{route.user?.handle ? (
						<a href={`/u/${route.user.handle}`} style={{ color: RDS_COLORS.accent, textDecoration: "none" }}>
							{t("public.byOwner", { name: route.user.name })}
						</a>
					) : (
						<span>{t("public.byOwner", { name: route.user?.name ?? t("public.anonymous") })}</span>
					)}
				</div>
				<h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: -0.6 }}>{route.name}</h1>
				{route.description && (
					<p style={{ margin: "4px 0 0", fontSize: 14, color: RDS_COLORS.fgMuted, lineHeight: 1.5 }}>
						{route.description}
					</p>
				)}
			</div>
			<div
				style={{
					borderRadius: 16,
					overflow: "hidden",
					border: `1px solid ${RDS_COLORS.border}`,
					background: RDS_COLORS.bgPanelElev,
					aspectRatio: "5 / 2",
				}}
			>
				{heroUrl ? (
					<img
						src={heroUrl}
						alt={t("public.mapAlt", { name: route.name })}
						style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
					/>
				) : (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							height: "100%",
							color: RDS_COLORS.fgSubtle,
							fontSize: 13,
						}}
					>
						{t("public.noPreview")}
					</div>
				)}
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(4, 1fr)",
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 12,
					background: RDS_COLORS.bgPanel,
					overflow: "hidden",
				}}
			>
				<StatBlock label={t("route.distance")} value={distance ? distance.value : "—"} unit={distance?.unit} />
				<StatBlock label={t("route.duration")} value={duration} />
				<StatBlock label={t("route.elev")} value={elevation ? elevation.value : "—"} unit={elevation?.unit} />
				<StatBlock
					label={t("route.waypointsCount", { count: String(route.waypoints?.length ?? 0) })}
					value={String(route.waypoints?.length ?? 0)}
				/>
			</div>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
				<Btn
					variant="primary"
					onClick={() => {
						window.location.href = `/?route=${routeShareRef(route)}`;
					}}
				>
					<I.play size={14} /> {t("public.openInRoutess")}
				</Btn>
				<a href={apiService.routeGpxUrl(routeShareRef(route))} style={{ textDecoration: "none" }}>
					<Btn>
						<I.download size={14} /> {t("public.downloadGpx")}
					</Btn>
				</a>
			</div>
			{route.tags && route.tags.length > 0 && (
				<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
					{route.tags.map((tag) => (
						<span
							key={tag}
							style={{
								display: "inline-flex",
								alignItems: "center",
								padding: "4px 10px",
								borderRadius: 999,
								background: RDS_COLORS.accentSoft,
								color: RDS_COLORS.accent,
								fontSize: 12,
								fontWeight: 500,
							}}
						>
							#{tag}
						</span>
					))}
				</div>
			)}
		</div>
	);
}

export function PublicRouteScreen({ slug, routeRef }: { slug: string; routeRef: number | string }) {
	const { data: route, isLoading, isError } = useRoute(routeRef);

	useEffect(() => {
		if (!route) return;
		Logger.debug("[PublicRouteScreen] viewing", { id: route.id, visibility: route.visibility });
		const canonicalSlug = toRouteSlug(route.name);
		const canonicalUrl = `${window.location.origin}/r/${canonicalSlug}-${routeShareRef(route)}`;
		const distanceKm = route.distance ? `${(route.distance / 1000).toFixed(1)} km` : null;
		const titleParts = [route.name, distanceKm, "routess"].filter(Boolean);
		document.title = titleParts.join(" · ");

		const description =
			route.description?.trim() ||
			`Route by ${route.user?.name ?? "a routess user"}${distanceKm ? `, ${distanceKm}` : ""}${
				route.elevationGain ? `, ${Math.round(route.elevationGain)} m elevation` : ""
			}.`;

		setMetaTag("name", "description", description);
		setMetaTag("property", "og:title", document.title);
		setMetaTag("property", "og:description", description);
		setMetaTag("property", "og:type", "article");
		setMetaTag("property", "og:url", canonicalUrl);
		setMetaTag("name", "twitter:card", "summary_large_image");

		const previewPoints: [number, number][] =
			route.geometry && route.geometry.length >= 2 ? route.geometry : (route.waypoints ?? []).map((w) => w.coord);
		const ogImage = buildMapboxStaticPreviewUrl(previewPoints, { width: 1200, height: 630, padding: 40 });
		if (ogImage) setMetaTag("property", "og:image", ogImage);

		const robots = route.visibility === "public" ? "index,follow" : "noindex,nofollow";
		setMetaTag("name", "robots", robots);
		setCanonical(canonicalUrl);
	}, [route]);

	return (
		<PublicPageShell isLoading={isLoading} isError={isError}>
			{route && <PublicRouteHero route={route} expectedSlug={slug} />}
		</PublicPageShell>
	);
}
