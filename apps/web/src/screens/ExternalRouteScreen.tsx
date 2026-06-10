import { buildExternalRouteSlugId, estimateDuration, toRouteSlug } from "@routess/core";
import { useEffect, useMemo, useState } from "react";
import { computeElevationForCandidate } from "@/features/generation/candidateElevation";
import { apiService } from "@/lib/api";
import { useExternalRoute } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useUnits } from "@/lib/units";
import { buildMapboxStaticPreviewUrl } from "@/lib/utils/mapboxStaticPreview";
import { I } from "../components/icons";
import { Badge, Btn, RDS_COLORS } from "../components/primitives";
import { PublicPageShell, StatBlock, setCanonical, setMetaTag } from "./public-page";

const HERO_WIDTH = 1200;
const HERO_HEIGHT = 480;

// Recreational pace per activity for the estimated duration; the real number
// arrives once the user opens the route in the planner.
const ESTIMATE_SPEED_KMH = { cycle: 18, run: 10, walk: 5 } as const;

// Page for a seeded ExternalRoute (/r/{slug}-x{id}, ADR 0033). Mirrors the
// user route page; the creator line is the SeedSource and "Open in routess"
// loads the official geometry into the planner as a fresh draft (saving forks
// a copy, the ExternalRoute itself stays immutable). ElevationGain is sampled
// client-side like generation candidates: display-only, fail-open.
export function ExternalRouteScreen({ slug, externalId }: { slug: string; externalId: number }) {
	const t = useT();
	const { formatDistanceParts, formatElevationParts } = useUnits();
	const { data: route, isLoading, isError } = useExternalRoute(externalId);
	const [elevationGain, setElevationGain] = useState<number | null>(null);

	const previewPoints = useMemo<[number, number][]>(() => route?.geometry ?? [], [route]);
	const heroUrl = useMemo(
		() => buildMapboxStaticPreviewUrl(previewPoints, { width: HERO_WIDTH, height: HERO_HEIGHT, padding: 32 }),
		[previewPoints],
	);

	useEffect(() => {
		if (!route) return;
		let cancelled = false;
		void computeElevationForCandidate(route.geometry).then((gain) => {
			if (!cancelled) setElevationGain(gain);
		});
		return () => {
			cancelled = true;
		};
	}, [route]);

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
	const activity = route?.activity ?? "cycle";
	const durationMinutes = route?.distance
		? estimateDuration(route.distance / 1000, ESTIMATE_SPEED_KMH[activity])
		: null;
	const duration = durationMinutes
		? durationMinutes >= 90
			? `≈ ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
			: `≈ ${durationMinutes} min`
		: "—";
	const elevation = elevationGain != null ? formatElevationParts(elevationGain) : null;
	const ActivityIcon = activity === "cycle" ? I.bike : activity === "run" ? I.run : I.walk;

	return (
		<PublicPageShell isLoading={isLoading} isError={isError}>
			{route && (
				<div
					style={{ display: "flex", flexDirection: "column", gap: 20, padding: 20, maxWidth: 960, margin: "0 auto" }}
				>
					<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
							<a
								href={route.source.url}
								target="_blank"
								rel="noreferrer noopener"
								className="rds-mono"
								style={{ fontSize: 11.5, color: RDS_COLORS.accent, letterSpacing: 0.4, textDecoration: "none" }}
							>
								{route.source.name}
							</a>
							<Badge variant="default">{route.source.license}</Badge>
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
						<StatBlock label={t("route.elev")} value={elevation ? elevation.value : "…"} unit={elevation?.unit} />
						<div style={{ padding: "12px 16px" }}>
							<div
								style={{
									fontSize: 11,
									fontWeight: 600,
									letterSpacing: 0.6,
									textTransform: "uppercase",
									color: RDS_COLORS.fgSubtle,
								}}
							>
								{t("route.field.activity")}
							</div>
							<div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
								<ActivityIcon size={18} />
								<span style={{ fontSize: 15, fontWeight: 600 }}>{t(`sport.${activity}`)}</span>
							</div>
						</div>
					</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
						<Btn
							variant="primary"
							onClick={() => {
								window.location.href = `/?externalRoute=${route.id}`;
							}}
						>
							<I.play size={14} /> {t("public.openInRoutess")}
						</Btn>
						<a href={apiService.externalRouteGpxUrl(route.id)} style={{ textDecoration: "none" }}>
							<Btn>
								<I.download size={14} /> {t("public.downloadGpx")}
							</Btn>
						</a>
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
					{/* Attribution: the ODbL/CC license obligation, rendered on every page. */}
					<div
						style={{
							fontSize: 12,
							color: RDS_COLORS.fgSubtle,
							lineHeight: 1.5,
							paddingTop: 12,
							borderTop: `1px solid ${RDS_COLORS.border}`,
						}}
					>
						<a href={route.source.url} target="_blank" rel="noreferrer noopener" style={{ color: RDS_COLORS.accent }}>
							{route.source.attribution}
						</a>{" "}
						· {route.source.license}
					</div>
				</div>
			)}
		</PublicPageShell>
	);
}
