import type { RouteActivity } from "@routess/core";
import { useEffect, useState } from "react";
import { useIsAuthenticated } from "@/hooks/useAuthState";
import { trackEvent } from "@/lib/analytics/track";
import { useDiscoverRoutes } from "@/lib/api-queries";
import { emitAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { useUnits } from "@/lib/units";
import { useDiscoverStore } from "@/stores/discoverStore";
import { useUiStore } from "@/stores/uiStore";
import { I, type IconKey } from "../components/icons";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";
import { SignInGate } from "../components/SignInGate";
import { Tooltip } from "../components/Tooltip";
import { DiscoverRouteCard } from "./discover/DiscoverRouteCard";
import { DropMenu, MenuItem } from "./library/DropMenu";
import { DISTANCE_BANDS, type DistanceBand } from "./library/RoutesTab";

const ACTIVITY_CHIPS: { key: "all" | RouteActivity; icon?: IconKey; labelKey: string }[] = [
	{ key: "all", labelKey: "library.filter.all" },
	{ key: "cycle", icon: "bike", labelKey: "library.filter.cycling" },
	{ key: "run", icon: "run", labelKey: "library.filter.running" },
	{ key: "walk", icon: "walk", labelKey: "library.filter.walking" },
];

const countBucket = (n: number): string => (n === 0 ? "0" : n < 10 ? "1-9" : n < 50 ? "10-49" : "50+");

const BETA_NOTICE_DISMISSED_KEY = "routess.discover-beta-notice-dismissed";

function Chip({
	on,
	onClick,
	children,
	title,
}: {
	on: boolean;
	onClick: () => void;
	children: React.ReactNode;
	title?: string;
}) {
	return (
		<Tooltip label={title}>
			<button
				type="button"
				onClick={onClick}
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 5,
					height: 28,
					padding: "0 10px",
					borderRadius: 999,
					border: `1px solid ${on ? RDS_COLORS.borderStrong : RDS_COLORS.border}`,
					background: on ? RDS_COLORS.bgActive : "transparent",
					color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
					fontSize: 12,
					cursor: "pointer",
					whiteSpace: "nowrap",
				}}
			>
				{children}
			</button>
		</Tooltip>
	);
}

// Discover (CONTEXT.md): all public routes in the current map viewport,
// newest-published first. The map is the filter; this panel lists what it
// shows and the cards link to /r/{slugId}.
export function DiscoverPanel() {
	const t = useT();
	const { formatDistance } = useUnits();
	const isAuthenticated = useIsAuthenticated();
	const setContext = useUiStore((s) => s.setContext);
	const defaultActivity = useUiStore((s) => s.activityType);

	const [activity, setActivity] = useState<"all" | RouteActivity>(defaultActivity);
	const [distanceBand, setDistanceBand] = useState<DistanceBand>("any");
	const [bandOpen, setBandOpen] = useState(false);
	const [noticeDismissed, setNoticeDismissed] = useState(
		() => localStorage.getItem(BETA_NOTICE_DISMISSED_KEY) === "true",
	);

	const viewportBbox = useDiscoverStore((s) => s.viewportBbox);
	const hoveredRouteId = useDiscoverStore((s) => s.hoveredRouteId);
	const setHoveredRouteId = useDiscoverStore((s) => s.setHoveredRouteId);
	const setRoutes = useDiscoverStore((s) => s.setRoutes);

	const band = DISTANCE_BANDS.find((b) => b.key === distanceBand);
	const { data, isLoading, isError, isFetching, refetch } = useDiscoverRoutes({
		bbox: viewportBbox,
		activity: activity === "all" ? undefined : activity,
		minDistance: band && band.min > 0 ? band.min : undefined,
		maxDistance: band && Number.isFinite(band.max) ? band.max : undefined,
	});
	const items = data?.items ?? [];

	useEffect(() => {
		trackEvent({ name: "discover_opened", properties: {} });
	}, []);

	// Mirror results to the store so the map overlay renders them.
	useEffect(() => {
		setRoutes(data?.items ?? []);
	}, [data, setRoutes]);

	// Map-driven hover (dot mouseover/click) scrolls its card into view; for
	// list-driven hover the card is already visible, so this is a no-op.
	useEffect(() => {
		if (hoveredRouteId == null) return;
		document.querySelector(`[data-discover-card="${hoveredRouteId}"]`)?.scrollIntoView({ block: "nearest" });
	}, [hoveredRouteId]);

	const pickActivity = (key: "all" | RouteActivity) => {
		setActivity(key);
		trackEvent({ name: "discover_filtered", properties: { filter_type: "activity" } });
	};

	const pickBand = (key: DistanceBand) => {
		setDistanceBand(key);
		setBandOpen(false);
		trackEvent({ name: "discover_filtered", properties: { filter_type: "distance" } });
	};

	const bandLabel = (b: { key: DistanceBand; min: number; max: number }): string => {
		if (b.key === "any") return t("library.filter.any");
		if (b.max === Number.POSITIVE_INFINITY) return `> ${formatDistance(b.min / 1000)}`;
		if (b.min === 0) return `< ${formatDistance(b.max / 1000)}`;
		return `${formatDistance(b.min / 1000)} – ${formatDistance(b.max / 1000)}`;
	};

	// Distinct surface states: waiting for the map to report a viewport,
	// first fetch, failure, then results (previous results stay visible while
	// a pan refetches; `isFetching` only drives the subtle inline hint).
	const waitingForMap = viewportBbox === null;
	const showLoading = !waitingForMap && isLoading && !isError;
	const showError = !waitingForMap && isError;
	const empty = !waitingForMap && !showLoading && !showError && items.length === 0;

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div style={{ padding: "16px 20px 0" }}>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<SecTitle>{t("nav.discover")}</SecTitle>
					<span
						style={{
							padding: "1px 7px",
							borderRadius: 999,
							background: RDS_COLORS.accentSoft,
							color: RDS_COLORS.accent,
							fontSize: 10,
							fontWeight: 700,
							letterSpacing: 0.6,
							textTransform: "uppercase",
						}}
					>
						{t("discover.beta")}
					</span>
				</div>
				<div style={{ fontSize: 12, color: RDS_COLORS.fgSubtle, marginTop: 4 }}>{t("discover.subtitle")}</div>
				{!noticeDismissed && (
					<div
						style={{
							display: "flex",
							alignItems: "flex-start",
							gap: 8,
							marginTop: 10,
							padding: "8px 10px",
							borderRadius: 10,
							background: RDS_COLORS.accentSoft,
							color: RDS_COLORS.fgMuted,
							fontSize: 12,
							lineHeight: 1.45,
						}}
					>
						<span style={{ flex: 1 }}>{t("discover.notice")}</span>
						<button
							type="button"
							aria-label={t("discover.notice.dismiss")}
							onClick={() => {
								localStorage.setItem(BETA_NOTICE_DISMISSED_KEY, "true");
								setNoticeDismissed(true);
							}}
							style={{
								background: "transparent",
								border: 0,
								padding: 2,
								cursor: "pointer",
								color: RDS_COLORS.fgSubtle,
								display: "inline-flex",
								flexShrink: 0,
							}}
						>
							<I.close size={13} />
						</button>
					</div>
				)}
				<div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", margin: "10px 0 12px" }}>
					{ACTIVITY_CHIPS.map((chip) => {
						const Icon = chip.icon ? I[chip.icon] : null;
						return (
							<Chip
								key={chip.key}
								on={activity === chip.key}
								onClick={() => pickActivity(chip.key)}
								title={t(chip.labelKey)}
							>
								{Icon ? <Icon size={13} /> : t(chip.labelKey)}
							</Chip>
						);
					})}
					<div style={{ position: "relative" }}>
						<Chip
							on={bandOpen || distanceBand !== "any"}
							onClick={() => setBandOpen((v) => !v)}
							title={t("library.filter.distance")}
						>
							<I.sliders size={13} />
							{band ? bandLabel(band) : t("library.filter.any")}
						</Chip>
						<DropMenu open={bandOpen} onClose={() => setBandOpen(false)} align="left" width={180}>
							{DISTANCE_BANDS.map((b) => (
								<MenuItem
									key={b.key}
									label={bandLabel(b)}
									checked={distanceBand === b.key}
									onClick={() => pickBand(b.key)}
								/>
							))}
						</DropMenu>
					</div>
					{!empty && !showLoading && !showError && !waitingForMap && (
						<span className="rds-mono" style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginLeft: "auto" }}>
							{isFetching
								? t("discover.updating")
								: `${items.length} ${items.length === 1 ? t("library.routeSingular") : t("library.routePlural")} ${t("discover.inView")}`}
						</span>
					)}
				</div>
			</div>

			<div style={{ flex: 1, overflowY: "auto", borderTop: `1px solid ${RDS_COLORS.border}` }}>
				{waitingForMap && (
					<div
						style={{
							padding: 40,
							textAlign: "center",
							fontSize: 13,
							color: RDS_COLORS.fgSubtle,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 12,
						}}
					>
						<span>{t("discover.waitingForMap")}</span>
						<Btn onClick={() => emitAppEvent("routess:discover-search-area")}>{t("discover.searchArea")}</Btn>
					</div>
				)}
				{showLoading && (
					<div style={{ padding: 40, textAlign: "center", fontSize: 13, color: RDS_COLORS.fgSubtle }}>
						{t("discover.loading")}
					</div>
				)}
				{showError && (
					<div
						style={{
							padding: 40,
							textAlign: "center",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 12,
						}}
					>
						<span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("discover.error.title")}</span>
						<Btn onClick={() => void refetch()}>{t("discover.error.retry")}</Btn>
					</div>
				)}
				{empty && !isAuthenticated && (
					<SignInGate title={t("discover.empty.title")} description={t("discover.empty.anonBody")} icon={I.explore} />
				)}
				{empty && isAuthenticated && (
					<div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, height: "100%" }}>
						<div style={{ maxWidth: 280, textAlign: "center" }}>
							<div
								style={{
									width: 72,
									height: 72,
									margin: "0 auto 14px",
									borderRadius: 18,
									background: RDS_COLORS.accentSoft,
									color: RDS_COLORS.accent,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<I.explore size={30} />
							</div>
							<h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t("discover.empty.title")}</h3>
							<p style={{ fontSize: 13, color: RDS_COLORS.fgMuted, margin: "6px 0 16px", lineHeight: 1.5 }}>
								{t("discover.empty.body")}
							</p>
							<Btn variant="primary" onClick={() => setContext("library")} style={{ margin: "0 auto" }}>
								{t("discover.empty.publishCta")}
							</Btn>
						</div>
					</div>
				)}
				{!showLoading && items.length > 0 && (
					<div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
						{items.map((route) => (
							<DiscoverRouteCard
								key={route.id}
								route={route}
								hovered={hoveredRouteId === route.id}
								onHover={setHoveredRouteId}
								onOpen={() =>
									trackEvent({
										name: "discover_route_opened",
										properties: {
											activity: route.activity ?? null,
											has_place: route.placeCity != null,
											result_count_bucket: countBucket(items.length),
										},
									})
								}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
