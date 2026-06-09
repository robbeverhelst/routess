import { buildExternalRouteSlugId, toRouteSlug } from "@routess/core";
import { useEffect, useMemo } from "react";
import { apiService } from "@/lib/api";
import { useExternalRoute } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useUnits } from "@/lib/units";
import { buildMapboxStaticPreviewUrl } from "@/lib/utils/mapboxStaticPreview";
import { I } from "../components/icons";
import { Btn, RDS_COLORS } from "../components/primitives";
import { PublicPageShell, StatBlock, setCanonical, setMetaTag } from "./public-page";

const HERO_WIDTH = 1200;
const HERO_HEIGHT = 480;

// Page for a seeded ExternalRoute (/r/{slug}-x{id}, ADR 0033). No owner, no
// in-app editor entry (editing is a fork, future slice). The source
// attribution is mandatory (license).
export function ExternalRouteScreen({ slug, externalId }: { slug: string; externalId: number }) {
	const t = useT();
	const { formatDistanceParts, formatElevationParts } = useUnits();
	const { data: route, isLoading, isError } = useExternalRoute(externalId);

	const previewPoints = useMemo<[number, number][]>(() => route?.geometry ?? [], [route]);
	const heroUrl = useMemo(
		() => buildMapboxStaticPreviewUrl(previewPoints, { width: HERO_WIDTH, height: HERO_HEIGHT, padding: 32 }),
		[previewPoints],
	);

	useEffect(() => {
		if (!route) return;
		const canonicalSlug = toRouteSlug(route.name);
		const canonicalUrl = `${window.location.origin}/r/${buildExternalRouteSlugId(route.name, route.id)}`;
		const distanceKm = route.distance ? `${(route.distance / 1000).toFixed(1)} km` : null;
		document.title = [route.name, distanceKm, "routess"].filter(Boolean).join(" · ");
		const description =
			route.description?.trim() || `${route.name}${distanceKm ? `, ${distanceKm}` : ""} · ${route.source.attribution}`;
		setMetaTag("name", "description", description);
		setMetaTag("property", "og:title", document.title);
		setMetaTag("property", "og:type", "article");
		setMetaTag("property", "og:url", canonicalUrl);
		if (heroUrl) setMetaTag("property", "og:image", heroUrl);
		// ExternalRoutes are always public and Indexable on the quality gate.
		setMetaTag("name", "robots", "index,follow");
		setCanonical(canonicalUrl);
		// Keep the URL slug canonical without reloading.
		if (canonicalSlug !== slug) {
			window.history.replaceState(
				{},
				"",
				`/r/${buildExternalRouteSlugId(route.name, route.id)}${window.location.search}${window.location.hash}`,
			);
		}
	}, [route, slug, heroUrl]);

	const distance = route?.distance ? formatDistanceParts(route.distance / 1000) : null;
	const duration = route?.duration ? `${Math.round(route.duration / 60)} min` : "—";
	const elevation = route?.elevationGain ? formatElevationParts(route.elevationGain) : null;

	return (
		<PublicPageShell isLoading={isLoading} isError={isError}>
			{route && (
				<div
					style={{ display: "flex", flexDirection: "column", gap: 20, padding: 20, maxWidth: 960, margin: "0 auto" }}
				>
					<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
						<a
							href={route.source.url}
							target="_blank"
							rel="noreferrer noopener"
							className="rds-mono"
							style={{ fontSize: 11.5, color: RDS_COLORS.accent, letterSpacing: 0.4, textDecoration: "none" }}
						>
							{route.source.name}
						</a>
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
							gridTemplateColumns: "repeat(3, 1fr)",
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 12,
							background: RDS_COLORS.bgPanel,
							overflow: "hidden",
						}}
					>
						<StatBlock label={t("route.distance")} value={distance ? distance.value : "—"} unit={distance?.unit} />
						<StatBlock label={t("route.duration")} value={duration} />
						<StatBlock label={t("route.elev")} value={elevation ? elevation.value : "—"} unit={elevation?.unit} />
					</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
						<a href={apiService.externalRouteGpxUrl(route.id)} style={{ textDecoration: "none" }}>
							<Btn variant="primary">
								<I.download size={14} /> {t("public.downloadGpx")}
							</Btn>
						</a>
					</div>
					{/* Attribution: the ODbL/CC license obligation, rendered on every page. */}
					<div style={{ fontSize: 12, color: RDS_COLORS.fgSubtle, lineHeight: 1.5 }}>
						<a href={route.source.url} target="_blank" rel="noreferrer noopener" style={{ color: RDS_COLORS.accent }}>
							{route.source.attribution}
						</a>{" "}
						· {route.source.license}
					</div>
					{route.tags.length > 0 && (
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
			)}
		</PublicPageShell>
	);
}
