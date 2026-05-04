import { useMemo } from "react";
import { useIsAuthenticated } from "@/hooks/useAuthState";
import type { ApiRoute } from "@/lib/api";
import { useUserRoutes } from "@/lib/api-queries";
import { formatDistance, formatDuration } from "@/lib/utils/formatting";
import { I } from "../components/icons";
import { Badge, Btn, PreviewBanner, RDS_COLORS, SecTitle } from "../components/primitives";
import { useModalsStore } from "../stores/modalsStore";
import { useUiStore } from "../stores/uiStore";

type LocalRoute = {
	name: string;
	area: string;
	distanceKm: number;
	durationMinutes: number;
	saves: number;
	tags: string[];
};

type DestinationRoute = {
	name: string;
	location: string;
	distanceKm: number;
	durationMinutes: number;
	note: string;
};

const LOCAL_ROUTES: LocalRoute[] = [
	{
		name: "Franklin foothills loop",
		area: "West side",
		distanceKm: 26.2,
		durationMinutes: 88,
		saves: 41,
		tags: ["loop", "climb", "sunrise"],
	},
	{
		name: "Mission valley spin",
		area: "Lower valley",
		distanceKm: 42.7,
		durationMinutes: 132,
		saves: 28,
		tags: ["flat", "road", "weekend"],
	},
];

const DESTINATION_ROUTES: DestinationRoute[] = [
	{
		name: "Old town river path",
		location: "Downtown",
		distanceKm: 9.8,
		durationMinutes: 58,
		note: "Easy to pick up if you're visiting and want a short route near the center.",
	},
	{
		name: "Scenic airport connector",
		location: "East side",
		distanceKm: 18.3,
		durationMinutes: 64,
		note: "A practical route if you're staying near the airport and want a quick spin.",
	},
];

function loadRouteIntoPlan(route: ApiRoute, setContext: (context: "plan") => void) {
	window.dispatchEvent(
		new CustomEvent("routess:load-route", {
			detail: {
				routeId: route.id,
				name: route.name,
				waypoints: route.waypoints,
			},
		}),
	);
	setContext("plan");
}

function formatRoute(route: ApiRoute) {
	const distance = route.distance ? formatDistance(route.distance / 1000, { precision: 1 }) : "—";
	const duration = route.duration ? formatDuration(route.duration / 60) : "—";
	return `${distance} · ${duration}`;
}

export function DiscoverPanel() {
	const isAuthenticated = useIsAuthenticated();
	const { data: routes = [] } = useUserRoutes();
	const setContext = useUiStore((s) => s.setContext);
	const openModal = useModalsStore((s) => s.openModal);

	const routesReadyToShare = useMemo(
		() =>
			routes
				.filter((route) => route.waypoints.length >= 2)
				.slice()
				.sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0))
				.slice(0, 3),
		[routes],
	);

	const openRoute = (route: ApiRoute) => {
		loadRouteIntoPlan(route, setContext);
	};

	const shareRoute = (route: ApiRoute) => {
		loadRouteIntoPlan(route, setContext);
		window.setTimeout(() => openModal("share"), 0);
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					padding: "16px 20px 12px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
					<div style={{ fontSize: 13, fontWeight: 600, color: RDS_COLORS.fg }}>Discover</div>
					<Badge variant="accent">Places</Badge>
				</div>
				<div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.4, marginTop: 8 }}>
					Nearby routes and routes at a location.
				</div>
				<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
					<Badge variant="default">{LOCAL_ROUTES.length} popular nearby</Badge>
					<Badge variant="default">{DESTINATION_ROUTES.length} destination picks</Badge>
					<Badge variant={routesReadyToShare.length > 0 ? "success" : "default"}>
						{routesReadyToShare.length} routes ready to share
					</Badge>
				</div>
			</div>

			<div style={{ padding: "14px 20px 20px", flex: 1, overflow: "auto" }}>
				<PreviewBanner
					style={{ marginBottom: 18 }}
					title="Preview · place discovery"
					body="Popularity, destination search, and local ranking are still preview data for now, but this panel is now strictly about finding routes by place."
				/>

				<SecTitle style={{ marginBottom: 10 }}>Popular nearby</SecTitle>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
						gap: 10,
						marginBottom: 22,
					}}
				>
					{LOCAL_ROUTES.map((route) => (
						<div
							key={route.name}
							style={{
								padding: 14,
								borderRadius: 12,
								border: `1px solid ${RDS_COLORS.border}`,
								background: RDS_COLORS.bgPanel,
							}}
						>
							<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
								<Badge variant="success">{route.saves} saves</Badge>
								<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>
									{route.area}
								</div>
							</div>
							<div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>{route.name}</div>
							<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 4 }}>
								{formatDistance(route.distanceKm, { precision: 1 })} · {formatDuration(route.durationMinutes)}
							</div>
							<div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12, marginBottom: 12 }}>
								{route.tags.map((tag) => (
									<Badge key={tag} variant="default">
										{tag}
									</Badge>
								))}
							</div>
							<Btn variant="primary" style={{ width: "100%" }} onClick={() => setContext("plan")}>
								<I.route size={14} /> Open in planner
							</Btn>
						</div>
					))}
				</div>

				<SecTitle style={{ marginBottom: 10 }}>Browse by location</SecTitle>
				<div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
					{DESTINATION_ROUTES.map((route) => (
						<div
							key={`${route.location}-${route.name}`}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: 14,
								borderRadius: 12,
								border: `1px solid ${RDS_COLORS.border}`,
								background: RDS_COLORS.bgPanel,
							}}
						>
							<div
								style={{
									width: 42,
									height: 42,
									borderRadius: 12,
									background: RDS_COLORS.accentSoft,
									color: RDS_COLORS.accent,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
								}}
							>
								<I.pin size={18} />
							</div>
							<div style={{ minWidth: 0, flex: 1 }}>
								<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
									<div style={{ fontSize: 13, fontWeight: 600 }}>{route.name}</div>
									<Badge variant="default">{route.location}</Badge>
								</div>
								<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
									{formatDistance(route.distanceKm, { precision: 1 })} · {formatDuration(route.durationMinutes)}
								</div>
								<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted, marginTop: 6 }}>{route.note}</div>
							</div>
							<Btn onClick={() => setContext("plan")}>Plan similar</Btn>
						</div>
					))}
				</div>

				<SecTitle style={{ marginBottom: 10 }}>From your library</SecTitle>
				{routesReadyToShare.length > 0 ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
						{routesReadyToShare.map((route) => (
							<div
								key={route.id}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 12,
									padding: 14,
									borderRadius: 12,
									border: `1px solid ${RDS_COLORS.border}`,
									background: RDS_COLORS.bgPanel,
								}}
							>
								<div
									style={{
										width: 42,
										height: 42,
										borderRadius: 12,
										background: RDS_COLORS.bgInput,
										color: RDS_COLORS.fg,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										flexShrink: 0,
									}}
								>
									<I.share size={16} />
								</div>
								<div style={{ minWidth: 0, flex: 1 }}>
									<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
										<div style={{ fontSize: 13, fontWeight: 600 }}>{route.name}</div>
										<Badge variant="success">Ready to share</Badge>
									</div>
									<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 3 }}>
										{formatRoute(route)}
									</div>
								</div>
								<div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
									<Btn onClick={() => openRoute(route)}>Open</Btn>
									<Btn variant="primary" onClick={() => shareRoute(route)}>
										<I.share size={14} /> Share
									</Btn>
								</div>
							</div>
						))}
					</div>
				) : (
					<div
						style={{
							borderRadius: 12,
							border: `1px solid ${RDS_COLORS.border}`,
							background: RDS_COLORS.bgPanel,
							padding: 16,
						}}
					>
						<div style={{ fontSize: 14, fontWeight: 600 }}>
							{isAuthenticated
								? "Save a couple of routes to build your local shelf."
								: "Sign in to save and share routes."}
						</div>
						<p
							style={{
								fontSize: 12.5,
								lineHeight: 1.5,
								color: RDS_COLORS.fgMuted,
								margin: "8px 0 14px",
							}}
						>
							{isAuthenticated
								? "Once routes are in your library, this section becomes the fastest way to reopen them in the planner or turn them into share links."
								: "Discover stays useful without an account, but saving found routes and managing private links still needs a session."}
						</p>
						<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
							<Btn variant="primary" onClick={() => setContext("plan")}>
								<I.plus size={14} /> Plan a route
							</Btn>
							{!isAuthenticated && (
								<Btn onClick={() => window.dispatchEvent(new CustomEvent("routess:open-login"))}>
									<I.user size={14} /> Sign in
								</Btn>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
