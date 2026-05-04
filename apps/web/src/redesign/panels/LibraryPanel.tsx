import { type ReactNode, useMemo, useState } from "react";
import { useIsAuthenticated } from "@/hooks/useAuthState";
import type { ApiRoute } from "@/lib/api";
import { useUserRoutes } from "@/lib/api-queries";
import { useModalsStore } from "@/redesign/stores/modalsStore";
import { type RedesignActivity, useUiStore } from "@/redesign/stores/uiStore";
import { I } from "../components/icons";
import { Badge, Btn, IconBtn, Kbd, RDS_COLORS } from "../components/primitives";
import { SignInGate } from "../components/SignInGate";
import { RouteDetailPanel } from "./RouteDetailPanel";

type Filter = "all" | RedesignActivity | "favourites";

const FILTERS: { key: Filter; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "cycle", label: "Cycling" },
	{ key: "run", label: "Running" },
	{ key: "favourites", label: "Favourites" },
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

const TAG_LABEL: Record<RedesignActivity, string> = {
	run: "Run",
	cycle: "Cycle",
	walk: "Walk",
};

// Default-data: until backend tracks activity type per route, derive a stable
// pseudo-type from the route id so each row gets a coloured tag without churn.
function getActivityType(route: ApiRoute): RedesignActivity {
	const types: RedesignActivity[] = ["cycle", "run", "walk"];
	return types[route.id % 3];
}

function MiniRouteSvg({ route, color }: { route: ApiRoute; color: string }) {
	const routePoints = useMemo(() => {
		const coords: [number, number][] =
			route.geometry && route.geometry.length >= 2
				? route.geometry
				: (route.waypoints ?? []).map((w) => [w.lng, w.lat] as [number, number]);
		if (coords.length < 2) return null;
		const lngs = coords.map((c) => c[0]);
		const lats = coords.map((c) => c[1]);
		const minLat = Math.min(...lats);
		const maxLat = Math.max(...lats);
		const minLng = Math.min(...lngs);
		const maxLng = Math.max(...lngs);
		const dLat = Math.max(maxLat - minLat, 1e-6);
		const dLng = Math.max(maxLng - minLng, 1e-6);
		const points = coords.map(([lng, lat]) => {
			const x = ((lng - minLng) / dLng) * 60 + 10;
			const y = 46 - ((lat - minLat) / dLat) * 32;
			return [Number(x.toFixed(1)), Number(y.toFixed(1))] as [number, number];
		});
		return points;
	}, [route]);

	if (!routePoints) return null;
	const path = routePoints.map(([x, y]) => `${x},${y}`).join(" L ");
	const [fx, fy] = routePoints[0];
	const [lx, ly] = routePoints[routePoints.length - 1];

	return (
		<svg viewBox="0 0 80 56" style={{ width: "100%", height: "100%" }} aria-hidden="true">
			<defs>
				<linearGradient id={`route-preview-${route.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="color-mix(in oklch, white 75%, transparent)" />
					<stop offset="100%" stopColor="color-mix(in oklch, white 25%, transparent)" />
				</linearGradient>
			</defs>
			<rect x="0" y="0" width="80" height="56" rx="10" fill={`url(#route-preview-${route.id})`} />
			<path d="M 7 17 H 73" stroke={RDS_COLORS.border} strokeWidth="1" opacity="0.45" />
			<path d="M 7 31 H 73" stroke={RDS_COLORS.border} strokeWidth="1" opacity="0.45" />
			<path d="M 22 6 V 50" stroke={RDS_COLORS.border} strokeWidth="1" opacity="0.35" />
			<path d="M 54 6 V 50" stroke={RDS_COLORS.border} strokeWidth="1" opacity="0.35" />
			<path
				d="M 8 45 C 18 35, 29 37, 40 28 S 63 13, 72 15"
				stroke={RDS_COLORS.border}
				strokeWidth="1.25"
				fill="none"
				opacity="0.35"
				strokeLinecap="round"
			/>
			<path
				d={`M ${path}`}
				stroke={color}
				strokeWidth="5.5"
				strokeOpacity="0.18"
				fill="none"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path d={`M ${path}`} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			<circle cx={fx} cy={fy} r="2" fill={RDS_COLORS.bgPanel} stroke={RDS_COLORS.success} strokeWidth="1.5" />
			<circle cx={lx} cy={ly} r="2.2" fill={RDS_COLORS.danger} />
		</svg>
	);
}

function MetaPill({ children }: { children: ReactNode }) {
	return (
		<span
			className="rds-mono"
			style={{
				display: "inline-flex",
				alignItems: "center",
				height: 22,
				padding: "0 8px",
				borderRadius: 999,
				background: RDS_COLORS.bgInput,
				border: `1px solid ${RDS_COLORS.border}`,
				fontSize: 11.5,
				color: RDS_COLORS.fgSubtle,
			}}
		>
			{children}
		</span>
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
				<h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>No routes yet</h3>
				<p
					style={{
						fontSize: 13,
						color: RDS_COLORS.fgMuted,
						margin: "8px 0 20px",
						lineHeight: 1.55,
					}}
				>
					Plan one on the map, generate a loop from your front door, or import a GPX from Strava.
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<Btn variant="primary" style={{ width: "100%" }} onClick={onPlan}>
						<I.plus size={14} /> Plan a route
					</Btn>
					<Btn style={{ width: "100%" }} onClick={onLoop}>
						<I.compass size={14} /> Generate a loop
					</Btn>
					<Btn variant="ghost" style={{ width: "100%", color: RDS_COLORS.fgMuted }} onClick={onImport}>
						<I.upload size={14} /> Import GPX
					</Btn>
				</div>
			</div>
		</div>
	);
}

export function LibraryPanel() {
	const isAuthenticated = useIsAuthenticated();
	if (!isAuthenticated) {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<SignInGate
					title="Sign in to see your library"
					description="Your saved routes live in your account. Sign in or create one to view, organise, and pick up where you left off."
					icon={I.library}
				/>
			</div>
		);
	}
	return <LibraryPanelInner />;
}

function LibraryPanelInner() {
	const { data: routes = [], isLoading } = useUserRoutes();
	const { favouriteRouteIds, toggleFavourite, setContext } = useUiStore();
	const openModal = useModalsStore((s) => s.openModal);
	const openDelete = useModalsStore((s) => s.openDelete);
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
							placeholder="Search routes…"
						/>
						<Kbd>/</Kbd>
					</div>
					<Btn variant="primary" onClick={() => setContext("plan")}>
						<I.plus size={14} /> New
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
									{f.label}
									{f.key !== "favourites" && ` · ${count}`}
								</button>
							);
						})}
					</div>
					<div className="rds-mono" style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>
						{filtered.length} route{filtered.length === 1 ? "" : "s"}
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
						Loading routes…
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
						<div style={{ marginBottom: hasActiveFilters ? 12 : 0 }}>No routes match your filter.</div>
						{hasActiveFilters && (
							<Btn
								variant="ghost"
								onClick={() => {
									setFilter("all");
									setQuery("");
								}}
								style={{ color: RDS_COLORS.fgMuted, margin: "0 auto" }}
							>
								Clear filters
							</Btn>
						)}
					</div>
				)}
				{filtered.map((r) => {
					const tag = getActivityType(r);
					const fav = favouriteRouteIds.includes(r.id);
					const dist = r.distance ? `${(r.distance / 1000).toFixed(1)} km` : "—";
					const date = new Date(r.createdAt).toLocaleDateString(undefined, {
						month: "short",
						day: "numeric",
					});
					return (
						// biome-ignore lint/a11y/noStaticElementInteractions: hover-only visual feedback; primary actions are inside as buttons
						<div
							key={r.id}
							onClick={() => setOpenedRouteId(r.id)}
							onKeyDown={(e) => e.key === "Enter" && setOpenedRouteId(r.id)}
							style={{
								display: "flex",
								alignItems: "stretch",
								gap: 12,
								padding: 12,
								borderRadius: 14,
								cursor: "pointer",
								border: `1px solid ${RDS_COLORS.border}`,
								background: RDS_COLORS.bgPanel,
								marginBottom: 8,
								transition: "background 120ms, border-color 120ms, transform 120ms",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background = RDS_COLORS.bgHover;
								e.currentTarget.style.borderColor = RDS_COLORS.borderStrong;
								e.currentTarget.style.transform = "translateY(-1px)";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = RDS_COLORS.bgPanel;
								e.currentTarget.style.borderColor = RDS_COLORS.border;
								e.currentTarget.style.transform = "translateY(0)";
							}}
						>
							<div
								style={{
									width: 80,
									height: 56,
									borderRadius: 10,
									background: RDS_COLORS.bgInput,
									border: `1px solid ${RDS_COLORS.border}`,
									flexShrink: 0,
									overflow: "hidden",
									position: "relative",
								}}
							>
								<MiniRouteSvg route={r} color={TAG_COLOR[tag]} />
							</div>
							<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
								<div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
									<div
										style={{
											fontSize: 14,
											fontWeight: 600,
											color: RDS_COLORS.fg,
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{r.name}
									</div>
									<Badge variant={TAG_BADGE_VARIANT[tag]} dot style={{ flexShrink: 0 }}>
										{TAG_LABEL[tag]}
									</Badge>
								</div>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 6,
										flexWrap: "wrap",
										marginTop: 8,
									}}
								>
									<MetaPill>{date}</MetaPill>
									<MetaPill>{dist}</MetaPill>
									<MetaPill>{r.waypoints?.length ?? 0} waypoints</MetaPill>
								</div>
							</div>
							{/* biome-ignore lint/a11y/noStaticElementInteractions: container only stops click bubbling so action buttons don't open detail */}
							<div
								style={{ display: "flex", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
								onClick={(e) => e.stopPropagation()}
								onKeyDown={(e) => e.stopPropagation()}
							>
								<IconBtn
									title={fav ? "Remove favourite" : "Mark favourite"}
									onClick={() => toggleFavourite(r.id)}
									pressed={fav}
								>
									<I.heart size={14} style={fav ? { color: RDS_COLORS.danger, fill: "currentColor" } : undefined} />
								</IconBtn>
								<IconBtn
									title="Delete route"
									onClick={() => openDelete(r.id)}
									style={{ color: RDS_COLORS.fgSubtle, opacity: 0.72 }}
								>
									<I.trash size={14} />
								</IconBtn>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
