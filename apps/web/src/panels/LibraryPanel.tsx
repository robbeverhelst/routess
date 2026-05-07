import { useMemo, useState } from "react";
import { useIsAuthenticated } from "@/hooks/useAuthState";
import type { ApiRoute } from "@/lib/api";
import { useUserRoutes } from "@/lib/api-queries";
import { t, useT } from "@/lib/i18n";
import { useUnits } from "@/lib/units";
import { buildMapboxStaticPreviewUrl } from "@/lib/utils/mapboxStaticPreview";
import { useModalsStore } from "@/stores/modalsStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { type RedesignActivity, useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { Badge, Btn, IconBtn, Kbd, RDS_COLORS } from "../components/primitives";
import { SignInGate } from "../components/SignInGate";
import { RouteDetailPanel } from "./RouteDetailPanel";

const THUMB_DISPLAY = 48;
const THUMB_WIDTH = 96;
const THUMB_HEIGHT = 96;

type Filter = "all" | RedesignActivity | "favourites";

const FILTERS: { key: Filter; labelKey: string }[] = [
	{ key: "all", labelKey: "library.filter.all" },
	{ key: "cycle", labelKey: "library.filter.cycling" },
	{ key: "run", labelKey: "library.filter.running" },
	{ key: "favourites", labelKey: "library.filter.favourites" },
];

const TAG_COLOR: Record<RedesignActivity, string> = {
	run: RDS_COLORS.accent,
	cycle: RDS_COLORS.success,
	walk: RDS_COLORS.warn,
};

const TAG_BADGE_VARIANT: Record<RedesignActivity, "accent" | "success" | "warn"> = {
	run: "accent",
	cycle: "success",
	walk: "warn",
};

const TAG_LABEL_KEY: Record<RedesignActivity, string> = {
	run: "sport.short.run",
	cycle: "sport.short.cycle",
	walk: "sport.short.walk",
};

// Default-data: until backend tracks activity type per route, derive a stable
// pseudo-type from the route id so each row gets a coloured tag without churn.
function getActivityType(route: ApiRoute): RedesignActivity {
	const types: RedesignActivity[] = ["cycle", "run", "walk"];
	return types[route.id % 3];
}

function MiniRouteSvg({ route, color }: { route: ApiRoute; color: string }) {
	const VIEW_W = THUMB_WIDTH;
	const VIEW_H = THUMB_HEIGHT;
	const PAD_X = 8;
	const PAD_Y = 8;

	const projected = useMemo(() => {
		const coords: [number, number][] =
			route.geometry && route.geometry.length >= 2 ? route.geometry : (route.waypoints ?? []).map((w) => w.coord);
		if (coords.length < 2) return null;
		// Web Mercator y-projection so latitude bands at higher latitudes don't
		// look squashed; mini preview should resemble the real map shape.
		const projY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
		const xs = coords.map((c) => c[0]);
		const ys = coords.map((c) => projY(c[1]));
		const minX = Math.min(...xs);
		const maxX = Math.max(...xs);
		const minY = Math.min(...ys);
		const maxY = Math.max(...ys);
		const dX = Math.max(maxX - minX, 1e-9);
		const dY = Math.max(maxY - minY, 1e-9);
		const innerW = VIEW_W - PAD_X * 2;
		const innerH = VIEW_H - PAD_Y * 2;
		// Preserve aspect ratio: scale uniformly and center.
		const scale = Math.min(innerW / dX, innerH / dY);
		const drawnW = dX * scale;
		const drawnH = dY * scale;
		const offX = PAD_X + (innerW - drawnW) / 2;
		const offY = PAD_Y + (innerH - drawnH) / 2;
		const points = coords.map(([lng, lat]) => {
			const x = offX + (lng - minX) * scale;
			// Flip Y because SVG y-axis grows downward.
			const y = offY + drawnH - (projY(lat) - minY) * scale;
			return [Number(x.toFixed(2)), Number(y.toFixed(2))] as [number, number];
		});
		return points;
	}, [route]);

	if (!projected) return null;
	const path = projected.map(([x, y]) => `${x},${y}`).join(" L ");
	const [fx, fy] = projected[0];
	const [lx, ly] = projected[projected.length - 1];
	const hasGeometry = (route.geometry?.length ?? 0) >= 2;

	return (
		<svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ width: "100%", height: "100%" }} aria-hidden="true">
			<defs>
				<linearGradient id={`route-preview-${route.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="color-mix(in oklch, white 75%, transparent)" />
					<stop offset="100%" stopColor="color-mix(in oklch, white 25%, transparent)" />
				</linearGradient>
			</defs>
			<rect x="0" y="0" width={VIEW_W} height={VIEW_H} rx="10" fill={`url(#route-preview-${route.id})`} />
			<path
				d={`M ${path}`}
				stroke={color}
				strokeWidth="5"
				strokeOpacity="0.18"
				fill="none"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d={`M ${path}`}
				stroke={color}
				strokeWidth={hasGeometry ? 2.2 : 1.6}
				strokeDasharray={hasGeometry ? undefined : "2 2"}
				fill="none"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{!hasGeometry &&
				projected.slice(1, -1).map(([x, y], i) => (
					<circle
						// biome-ignore lint/suspicious/noArrayIndexKey: stable coord-derived index, fine for tiny preview
						key={i}
						cx={x}
						cy={y}
						r="1.4"
						fill={color}
					/>
				))}
			<circle cx={fx} cy={fy} r="2.2" fill={RDS_COLORS.bgPanel} stroke={RDS_COLORS.success} strokeWidth="1.5" />
			<circle cx={lx} cy={ly} r="2.4" fill={RDS_COLORS.danger} />
		</svg>
	);
}

function RouteThumb({ route, color }: { route: ApiRoute; color: string }) {
	const mapStyle = useRedesignSettingsStore((s) => s.mapStyle);
	const points = useMemo<[number, number][]>(() => {
		if (route.geometry && route.geometry.length >= 2) return route.geometry;
		return (route.waypoints ?? []).map((w) => w.coord);
	}, [route]);
	const staticUrl = useMemo(
		() =>
			buildMapboxStaticPreviewUrl(points, {
				width: THUMB_WIDTH,
				height: THUMB_HEIGHT,
				mapStyle,
				strokeWidth: 3,
				showPins: false,
				padding: 8,
				maxPoints: 60,
			}),
		[points, mapStyle],
	);
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const showStatic = staticUrl !== null && failedUrl !== staticUrl;

	if (showStatic && staticUrl) {
		return (
			<img
				src={staticUrl}
				alt=""
				onError={() => setFailedUrl(staticUrl)}
				style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
			/>
		);
	}
	return <MiniRouteSvg route={route} color={color} />;
}

function RouteCard({
	route,
	fav,
	formatDistance,
	onOpen,
	onToggleFavourite,
	onDelete,
}: {
	route: ApiRoute;
	fav: boolean;
	formatDistance: (km: number) => string;
	onOpen: () => void;
	onToggleFavourite: () => void;
	onDelete: () => void;
}) {
	const [hover, setHover] = useState(false);
	const tag = getActivityType(route);
	const dist = route.distance ? formatDistance(route.distance / 1000) : "—";
	const date = new Date(route.createdAt).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover-only visual feedback; primary actions are inside as buttons
		<div
			onClick={onOpen}
			onKeyDown={(e) => e.key === "Enter" && onOpen()}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			style={{
				position: "relative",
				display: "flex",
				alignItems: "flex-start",
				gap: 12,
				padding: 12,
				borderRadius: 14,
				cursor: "pointer",
				border: `1px solid ${hover ? RDS_COLORS.borderStrong : RDS_COLORS.border}`,
				background: hover ? RDS_COLORS.bgHover : RDS_COLORS.bgPanel,
				marginBottom: 8,
				transition: "background 120ms, border-color 120ms, transform 120ms",
				transform: hover ? "translateY(-1px)" : "translateY(0)",
			}}
		>
			<div
				style={{
					width: THUMB_DISPLAY,
					height: THUMB_DISPLAY,
					borderRadius: 10,
					background: RDS_COLORS.bgInput,
					border: `1px solid ${RDS_COLORS.border}`,
					flexShrink: 0,
					overflow: "hidden",
					position: "relative",
				}}
			>
				<RouteThumb route={route} color={TAG_COLOR[tag]} />
			</div>
			<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 6 }}>
				<div
					style={{
						fontSize: 14,
						fontWeight: 600,
						color: RDS_COLORS.fg,
						lineHeight: 1.3,
						display: "-webkit-box",
						WebkitLineClamp: 2,
						WebkitBoxOrient: "vertical",
						overflow: "hidden",
						wordBreak: "break-word",
						paddingRight: 56,
					}}
				>
					{route.name}
				</div>
				<div
					className="rds-mono"
					style={{
						display: "flex",
						alignItems: "center",
						gap: 6,
						fontSize: 11.5,
						color: RDS_COLORS.fgSubtle,
						minWidth: 0,
						overflow: "hidden",
						whiteSpace: "nowrap",
						textOverflow: "ellipsis",
					}}
				>
					<Badge variant={TAG_BADGE_VARIANT[tag]} dot style={{ flexShrink: 0 }}>
						{t(TAG_LABEL_KEY[tag])}
					</Badge>
					<span>{dist}</span>
					<span style={{ opacity: 0.5 }}>·</span>
					<span>
						{route.waypoints?.length ?? 0} {t("library.wp")}
					</span>
					<span style={{ opacity: 0.5 }}>·</span>
					<span>{date}</span>
				</div>
			</div>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: container only stops click bubbling so action buttons don't open detail */}
			<div
				style={{
					position: "absolute",
					top: 8,
					right: 8,
					display: "flex",
					gap: 4,
				}}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div
					style={{
						opacity: fav || hover ? 1 : 0,
						transition: "opacity 120ms",
						pointerEvents: fav || hover ? "auto" : "none",
					}}
				>
					<IconBtn
						title={fav ? t("route.removeFavourite") : t("library.markFavourite")}
						onClick={onToggleFavourite}
						pressed={fav}
					>
						<I.heart size={14} style={fav ? { color: RDS_COLORS.danger, fill: "currentColor" } : undefined} />
					</IconBtn>
				</div>
				<div
					style={{
						opacity: hover ? 1 : 0,
						transition: "opacity 120ms",
						pointerEvents: hover ? "auto" : "none",
					}}
				>
					<IconBtn
						title={t("library.deleteRoute")}
						onClick={onDelete}
						style={{ color: RDS_COLORS.fgSubtle, opacity: 0.72 }}
					>
						<I.trash size={14} />
					</IconBtn>
				</div>
			</div>
		</div>
	);
}

function EmptyLibrary({
	onPlan,
	onLoop,
	onImport,
}: {
	onPlan?: () => void;
	onLoop?: () => void;
	onImport?: () => void;
}) {
	const t = useT();
	return (
		<div
			style={{
				flex: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 40,
			}}
		>
			<div style={{ maxWidth: 320, textAlign: "center" }}>
				<div
					style={{
						width: 88,
						height: 88,
						margin: "0 auto 18px",
						borderRadius: 22,
						background: RDS_COLORS.accentSoft,
						color: RDS_COLORS.accent,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						position: "relative",
					}}
				>
					<I.library size={36} />
					<div
						style={{
							position: "absolute",
							top: -6,
							right: -6,
							width: 28,
							height: 28,
							borderRadius: 999,
							background: RDS_COLORS.bgPanel,
							border: `2px solid ${RDS_COLORS.accent}`,
							color: RDS_COLORS.accent,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<I.plus size={14} />
					</div>
				</div>
				<h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{t("library.empty.title")}</h3>
				<p
					style={{
						fontSize: 13,
						color: RDS_COLORS.fgMuted,
						margin: "8px 0 20px",
						lineHeight: 1.55,
					}}
				>
					{t("library.empty.subtitle")}
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<Btn variant="primary" style={{ width: "100%" }} onClick={onPlan}>
						<I.plus size={14} /> {t("library.empty.plan")}
					</Btn>
					<Btn style={{ width: "100%" }} onClick={onLoop}>
						<I.compass size={14} /> {t("library.empty.loop")}
					</Btn>
					<Btn variant="ghost" style={{ width: "100%", color: RDS_COLORS.fgMuted }} onClick={onImport}>
						<I.upload size={14} /> {t("library.empty.import")}
					</Btn>
				</div>
			</div>
		</div>
	);
}

export function LibraryPanel() {
	const isAuthenticated = useIsAuthenticated();
	const t = useT();
	if (!isAuthenticated) {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<SignInGate title={t("library.gate.title")} description={t("library.gate.body")} icon={I.library} />
			</div>
		);
	}
	return <LibraryPanelInner />;
}

function LibraryPanelInner() {
	const t = useT();
	const { data: routes = [], isLoading } = useUserRoutes();
	const { favouriteRouteIds, toggleFavourite, setContext } = useUiStore();
	const openModal = useModalsStore((s) => s.openModal);
	const openDelete = useModalsStore((s) => s.openDelete);
	const { formatDistance } = useUnits();
	const [filter, setFilter] = useState<Filter>("all");
	const [query, setQuery] = useState("");
	const [openedRouteId, setOpenedRouteId] = useState<number | null>(null);
	const hasActiveFilters = filter !== "all" || query.trim().length > 0;

	const counts = useMemo(() => {
		const c = { all: routes.length, run: 0, cycle: 0, walk: 0, favourites: favouriteRouteIds.length };
		for (const r of routes) c[getActivityType(r)] += 1;
		return c;
	}, [routes, favouriteRouteIds.length]);

	const filtered = useMemo(() => {
		let out = routes;
		if (filter === "favourites") {
			out = out.filter((r) => favouriteRouteIds.includes(r.id));
		} else if (filter !== "all") {
			out = out.filter((r) => getActivityType(r) === filter);
		}
		if (query.trim()) {
			const q = query.toLowerCase();
			out = out.filter((r) => r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q));
		}
		return out;
	}, [routes, filter, query, favouriteRouteIds]);

	const openedRoute = openedRouteId != null ? routes.find((r) => r.id === openedRouteId) : null;
	if (openedRoute) {
		return <RouteDetailPanel route={openedRoute} onBack={() => setOpenedRouteId(null)} />;
	}

	if (!isLoading && routes.length === 0) {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<EmptyLibrary
					onPlan={() => setContext("plan")}
					onLoop={() => openModal("loop")}
					onImport={() => openModal("import")}
				/>
			</div>
		);
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					padding: "16px 20px 12px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							flex: 1,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 8,
							height: 36,
							padding: "0 10px",
						}}
					>
						<I.search size={14} />
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							style={{
								background: "transparent",
								border: 0,
								outline: "none",
								flex: 1,
								fontSize: 13,
								color: "inherit",
							}}
							placeholder={t("library.searchPlaceholder")}
						/>
						<Kbd>/</Kbd>
					</div>
					<Btn variant="primary" onClick={() => setContext("plan")}>
						<I.plus size={14} /> {t("common.new")}
					</Btn>
				</div>
				<div
					style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
						{FILTERS.map((f) => {
							const on = filter === f.key;
							const count = counts[f.key];
							return (
								<button
									key={f.key}
									type="button"
									onClick={() => setFilter(f.key)}
									style={{
										height: 28,
										padding: "0 10px",
										borderRadius: 999,
										border: `1px solid ${on ? RDS_COLORS.borderStrong : RDS_COLORS.border}`,
										background: on ? RDS_COLORS.bgActive : "transparent",
										color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
										fontSize: 12,
										cursor: "pointer",
									}}
								>
									{t(f.labelKey)}
									{f.key !== "favourites" && ` · ${count}`}
								</button>
							);
						})}
					</div>
					<div className="rds-mono" style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>
						{filtered.length} {filtered.length === 1 ? t("library.routeSingular") : t("library.routePlural")}
					</div>
				</div>
			</div>

			<div style={{ padding: "8px 12px", overflow: "auto", flex: 1 }}>
				{isLoading && (
					<div
						style={{
							padding: 20,
							textAlign: "center",
							fontSize: 13,
							color: RDS_COLORS.fgSubtle,
						}}
					>
						{t("library.loading")}
					</div>
				)}
				{!isLoading && filtered.length === 0 && (
					<div
						style={{
							padding: 32,
							textAlign: "center",
							fontSize: 13,
							color: RDS_COLORS.fgSubtle,
						}}
					>
						<div style={{ marginBottom: hasActiveFilters ? 12 : 0 }}>{t("library.noMatch")}</div>
						{hasActiveFilters && (
							<Btn
								variant="ghost"
								onClick={() => {
									setFilter("all");
									setQuery("");
								}}
								style={{ color: RDS_COLORS.fgMuted, margin: "0 auto" }}
							>
								{t("library.clearFilters")}
							</Btn>
						)}
					</div>
				)}
				{filtered.map((r) => (
					<RouteCard
						key={r.id}
						route={r}
						fav={favouriteRouteIds.includes(r.id)}
						formatDistance={formatDistance}
						onOpen={() => setOpenedRouteId(r.id)}
						onToggleFavourite={() => toggleFavourite(r.id)}
						onDelete={() => openDelete(r.id)}
					/>
				))}
			</div>
		</div>
	);
}
