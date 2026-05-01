import { useEffect, useRef, useState } from "react";
import type { ApiRoute } from "@/lib/api";
import { I } from "../components/icons";
import { Badge, Btn, IconBtn, RDS_COLORS, SecTitle } from "../components/primitives";

// TODO: replace SEGMENTS and HISTORY with real data once route-detail backend lands
const SEGMENTS = [
	{ name: "Schelde dijkpad", km: "0.0 – 2.1", elev: "+12 m", surface: "Asphalt" },
	{ name: "Bornem stretch", km: "2.1 – 4.6", elev: "+34 m", surface: "Mixed" },
	{ name: "Heidestraat climb", km: "4.6 – 7.8", elev: "+88 m", surface: "Asphalt" },
	{ name: "Return via dijk", km: "7.8 – 12.4", elev: "−128 m", surface: "Asphalt" },
];

const HISTORY = [
	{ date: "Apr 28", time: "1:04", pace: "27 km/h", note: "PB!" },
	{ date: "Apr 14", time: "1:09", pace: "26 km/h", note: "" },
	{ date: "Apr 04", time: "1:11", pace: "25 km/h", note: "Headwind" },
	{ date: "Mar 22", time: "1:14", pace: "24 km/h", note: "" },
];

export function RouteDetailPanel({ route, onBack }: { route: ApiRoute; onBack: () => void }) {
	const distanceKm = route.distance ? (route.distance / 1000).toFixed(1) : "—";
	const durationStr = route.duration ? `${Math.round(route.duration / 60)} min` : "—";
	const elevStr = route.elevationGain ? `${Math.round(route.elevationGain)}` : "—";

	const [favorited, setFavorited] = useState(false);
	const [moreOpen, setMoreOpen] = useState(false);
	const moreRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!moreOpen) return;
		const onDocClick = (e: MouseEvent) => {
			if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
				setMoreOpen(false);
			}
		};
		document.addEventListener("mousedown", onDocClick);
		return () => document.removeEventListener("mousedown", onDocClick);
	}, [moreOpen]);

	const dispatchLoadRoute = () => {
		const directFlags = (route.waypoints ?? []).map((w) => w.type === "direct");
		window.dispatchEvent(
			new CustomEvent("routess:load-route", {
				detail: {
					routeId: route.id,
					name: route.name,
					waypoints: route.waypoints,
					directFlags,
				},
			}),
		);
	};

	const dispatchShare = () => {
		window.dispatchEvent(new CustomEvent("routess:share-route"));
	};

	const dispatchFavorite = () => {
		setFavorited((v) => !v);
		window.dispatchEvent(new CustomEvent("routess:toggle-favorite", { detail: { routeId: route.id } }));
	};

	const dispatchDuplicate = () => {
		window.dispatchEvent(new CustomEvent("routess:duplicate-route", { detail: { routeId: route.id } }));
		setMoreOpen(false);
	};

	const dispatchDelete = () => {
		window.dispatchEvent(new CustomEvent("routess:delete-route", { detail: { routeId: route.id } }));
		setMoreOpen(false);
	};

	const dispatchExport = () => {
		window.dispatchEvent(new CustomEvent("routess:export-gpx", { detail: { routeId: route.id } }));
	};

	const dispatchOpenActivity = (activityId: string) => {
		window.dispatchEvent(new CustomEvent("routess:open-activity", { detail: { activityId } }));
	};

	const stats = [
		{ label: "Distance", value: distanceKm, unit: "km" },
		{ label: "Avg time", value: durationStr, unit: "" },
		{ label: "Elev gain", value: elevStr, unit: "m" },
		{ label: "Avg pace", value: "—", unit: "km/h" },
	];

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "12px 20px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<IconBtn title="Back" onClick={onBack}>
					<I.chevronL size={16} />
				</IconBtn>
				<span style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>Library</span>
				<I.chevronR size={12} />
				<span
					style={{
						fontSize: 13,
						fontWeight: 600,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{route.name}
				</span>
				<div style={{ flex: 1 }} />
				<IconBtn title={favorited ? "Remove favourite" : "Favourite"} onClick={dispatchFavorite}>
					<I.heart size={14} style={favorited ? { color: RDS_COLORS.danger, fill: "currentColor" } : undefined} />
				</IconBtn>
				<IconBtn title="Share" onClick={dispatchShare}>
					<I.share size={14} />
				</IconBtn>
				<div ref={moreRef} style={{ position: "relative" }}>
					<IconBtn title="More" onClick={() => setMoreOpen((v) => !v)} pressed={moreOpen}>
						<I.more size={14} />
					</IconBtn>
					{moreOpen && (
						<div
							style={{
								position: "absolute",
								top: "calc(100% + 4px)",
								right: 0,
								minWidth: 160,
								background: RDS_COLORS.bgPanel,
								border: `1px solid ${RDS_COLORS.border}`,
								borderRadius: 8,
								padding: 4,
								boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
								zIndex: 10,
							}}
						>
							<button
								type="button"
								onClick={dispatchDuplicate}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									width: "100%",
									padding: "8px 10px",
									background: "transparent",
									border: 0,
									borderRadius: 6,
									cursor: "pointer",
									fontSize: 13,
									color: RDS_COLORS.fg,
									textAlign: "left",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = RDS_COLORS.bgHover;
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = "transparent";
								}}
							>
								<I.copy size={14} /> Duplicate
							</button>
							<button
								type="button"
								onClick={dispatchDelete}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									width: "100%",
									padding: "8px 10px",
									background: "transparent",
									border: 0,
									borderRadius: 6,
									cursor: "pointer",
									fontSize: 13,
									color: RDS_COLORS.danger,
									textAlign: "left",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = RDS_COLORS.bgHover;
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = "transparent";
								}}
							>
								<I.trash size={14} /> Delete
							</button>
						</div>
					)}
				</div>
			</div>

			<div style={{ flex: 1, overflow: "auto", padding: 20 }}>
				<div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
					<Badge variant="accent" dot>
						Cycling
					</Badge>
					<Badge>Public</Badge>
					<Badge>recovery</Badge>
				</div>

				<h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, letterSpacing: -0.4 }}>{route.name}</h2>
				<p className="rds-mono" style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, margin: 0 }}>
					Created {new Date(route.createdAt).toLocaleDateString()} · {route.waypoints?.length ?? 0} waypoints
				</p>

				{/* Stat strip */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(4, 1fr)",
						marginTop: 18,
						padding: 14,
						background: RDS_COLORS.bgPanelElev,
						borderRadius: 10,
						border: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					{stats.map((s, i) => (
						<div
							key={s.label}
							style={{
								borderLeft: i ? `1px solid ${RDS_COLORS.border}` : "none",
								paddingLeft: i ? 14 : 0,
							}}
						>
							<SecTitle>{s.label}</SecTitle>
							<div className="rds-mono" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1, marginTop: 4 }}>
								{s.value}
								{s.unit && (
									<span
										style={{
											fontSize: 11,
											color: RDS_COLORS.fgSubtle,
											marginLeft: 3,
											fontWeight: 400,
										}}
									>
										{s.unit}
									</span>
								)}
							</div>
						</div>
					))}
				</div>

				{/* Elevation */}
				<div style={{ marginTop: 18 }}>
					<SecTitle style={{ marginBottom: 8 }}>Elevation</SecTitle>
					<div
						style={{
							height: 100,
							background: RDS_COLORS.bgPanelElev,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 10,
							padding: 10,
						}}
					>
						<svg
							viewBox="0 0 600 80"
							preserveAspectRatio="none"
							style={{ width: "100%", height: "100%" }}
							aria-hidden="true"
						>
							<defs>
								<linearGradient id="rds-elev-detail" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0" stopColor="var(--rds-accent)" stopOpacity="0.4" />
									<stop offset="1" stopColor="var(--rds-accent)" stopOpacity="0" />
								</linearGradient>
							</defs>
							<path
								d="M0 70 L 50 60 L 100 64 L 160 38 L 220 50 L 300 24 L 380 36 L 450 16 L 520 30 L 580 22 L 600 28 L 600 80 L 0 80 Z"
								fill="url(#rds-elev-detail)"
							/>
							<path
								d="M0 70 L 50 60 L 100 64 L 160 38 L 220 50 L 300 24 L 380 36 L 450 16 L 520 30 L 580 22 L 600 28"
								stroke="var(--rds-accent)"
								strokeWidth="1.6"
								fill="none"
							/>
						</svg>
					</div>
				</div>

				{/* Segments */}
				<div style={{ marginTop: 18 }}>
					<SecTitle style={{ marginBottom: 8 }}>Segments · {SEGMENTS.length}</SecTitle>
					<div
						style={{
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 10,
							overflow: "hidden",
						}}
					>
						{SEGMENTS.map((s, i) => (
							<div
								key={s.name}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 12,
									padding: "12px 14px",
									borderBottom: i < SEGMENTS.length - 1 ? `1px solid ${RDS_COLORS.border}` : "none",
								}}
							>
								<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, width: 18 }}>
									{i + 1}
								</div>
								<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
									<div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
									<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
										{s.km} km · {s.surface}
									</div>
								</div>
								<div className="rds-mono" style={{ fontSize: 12, fontWeight: 600, color: RDS_COLORS.fgMuted }}>
									{s.elev}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* History */}
				<div style={{ marginTop: 18 }}>
					<SecTitle style={{ marginBottom: 8 }}>Ride history</SecTitle>
					<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
						{HISTORY.map((r, i) => (
							<div
								key={r.date}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 12,
									padding: "10px 0",
									borderBottom: i < HISTORY.length - 1 ? `1px solid ${RDS_COLORS.border}` : "none",
								}}
							>
								<div className="rds-mono" style={{ fontSize: 12, color: RDS_COLORS.fgMuted, width: 56 }}>
									{r.date}
								</div>
								<div className="rds-mono" style={{ fontSize: 13, fontWeight: 600, width: 56 }}>
									{r.time}
								</div>
								<div className="rds-mono" style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>
									{r.pace}
								</div>
								<div style={{ flex: 1 }} />
								{r.note && <Badge variant="accent">{r.note}</Badge>}
								<IconBtn title="Open" onClick={() => dispatchOpenActivity(r.date)}>
									<I.chevronR size={14} />
								</IconBtn>
							</div>
						))}
					</div>
				</div>
			</div>

			<div
				style={{
					display: "flex",
					gap: 8,
					padding: "12px 20px",
					borderTop: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<Btn variant="primary" style={{ flex: 1 }} onClick={dispatchLoadRoute}>
					<I.play size={12} /> Load on map
				</Btn>
				<Btn onClick={dispatchExport} title="Download GPX">
					<I.download size={14} />
				</Btn>
				<Btn onClick={dispatchShare} title="Share">
					<I.share size={14} />
				</Btn>
			</div>
		</div>
	);
}
