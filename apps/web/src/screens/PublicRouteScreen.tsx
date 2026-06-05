import { toRouteSlug } from "@routess/core";
import { useEffect, useMemo } from "react";
import { type ApiRoute, apiService } from "@/lib/api";
import { useRoute } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { useUnits } from "@/lib/units";
import { buildMapboxStaticPreviewUrl } from "@/lib/utils/mapboxStaticPreview";

function setMetaTag(attr: "name" | "property", key: string, content: string) {
	if (typeof document === "undefined") return;
	let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
	if (!el) {
		el = document.createElement("meta");
		el.setAttribute(attr, key);
		document.head.appendChild(el);
	}
	el.setAttribute("content", content);
}

function setCanonical(href: string) {
	if (typeof document === "undefined") return;
	let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
	if (!el) {
		el = document.createElement("link");
		el.rel = "canonical";
		document.head.appendChild(el);
	}
	el.href = href;
}

import { I } from "../components/icons";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

const HERO_WIDTH = 1200;
const HERO_HEIGHT = 480;

function StatBlock({ label, value, unit }: { label: string; value: string; unit?: string }) {
	return (
		<div style={{ padding: "12px 16px", borderRight: `1px solid ${RDS_COLORS.border}` }}>
			<SecTitle>{label}</SecTitle>
			<div className="rds-mono" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1, marginTop: 4 }}>
				{value}
				{unit && (
					<span style={{ fontSize: 12, color: RDS_COLORS.fgSubtle, marginLeft: 4, fontWeight: 400 }}>{unit}</span>
				)}
			</div>
		</div>
	);
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
			const target = `/r/${canonicalSlug}-${route.id}${window.location.search}${window.location.hash}`;
			window.history.replaceState({}, "", target);
		}
	}, [canonicalSlug, expectedSlug, route.id]);

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
				<div className="rds-mono" style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, letterSpacing: 0.4 }}>
					{t("public.byOwner", { name: route.user?.name ?? t("public.anonymous") })}
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
						window.location.href = `/?route=${route.id}`;
					}}
				>
					<I.play size={14} /> {t("public.openInRoutess")}
				</Btn>
				<a href={apiService.routeGpxUrl(route.id)} style={{ textDecoration: "none" }}>
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

export function PublicRouteScreen({ slug, routeId }: { slug: string; routeId: number }) {
	const t = useT();
	const { data: route, isLoading, isError } = useRoute(routeId);

	useEffect(() => {
		if (!route) return;
		Logger.debug("[PublicRouteScreen] viewing", { id: route.id, visibility: route.visibility });
		const canonicalSlug = toRouteSlug(route.name);
		const canonicalUrl = `${window.location.origin}/r/${canonicalSlug}-${route.id}`;
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
		<div style={{ minHeight: "100svh", display: "flex", flexDirection: "column", background: RDS_COLORS.bg }}>
			<header
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					padding: "14px 20px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<a
					href="/"
					style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: RDS_COLORS.fg }}
				>
					<I.route size={18} />
					<span style={{ fontWeight: 600, fontSize: 14, letterSpacing: -0.2 }}>routess</span>
				</a>
				<div style={{ flex: 1 }} />
				<a href="/" style={{ textDecoration: "none" }}>
					<Btn variant="ghost">{t("public.signIn")}</Btn>
				</a>
			</header>
			<main style={{ flex: 1 }}>
				{isLoading && (
					<div style={{ padding: 40, textAlign: "center", color: RDS_COLORS.fgSubtle, fontSize: 14 }}>
						{t("public.loading")}
					</div>
				)}
				{isError && (
					<div style={{ padding: 40, textAlign: "center", color: RDS_COLORS.fgMuted }}>
						<h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>{t("public.notFound.title")}</h2>
						<p style={{ fontSize: 13, color: RDS_COLORS.fgSubtle, margin: 0 }}>{t("public.notFound.body")}</p>
					</div>
				)}
				{route && <PublicRouteHero route={route} expectedSlug={slug} />}
			</main>
			<footer
				style={{
					padding: "20px",
					textAlign: "center",
					borderTop: `1px solid ${RDS_COLORS.border}`,
					color: RDS_COLORS.fgSubtle,
					fontSize: 12,
				}}
			>
				{t("public.footer.cta")}{" "}
				<a href="/" style={{ color: RDS_COLORS.accent }}>
					{t("public.footer.try")}
				</a>
			</footer>
		</div>
	);
}
