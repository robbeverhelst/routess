import { useEffect, useRef, useState } from "react";
import type { ApiRoute } from "@/lib/api";
import { useSaveRoute } from "@/lib/api-queries";
import { I } from "../components/icons";
import { Btn, IconBtn, RDS_COLORS, SecTitle } from "../components/primitives";
import { useModalsStore } from "../stores/modalsStore";
import { useToastStore } from "../stores/toastStore";
import { useUiStore } from "../stores/uiStore";

export function RouteDetailPanel({ route, onBack }: { route: ApiRoute; onBack: () => void }) {
	const distanceKm = route.distance ? (route.distance / 1000).toFixed(1) : "—";
	const durationStr = route.duration ? `${Math.round(route.duration / 60)} min` : "—";
	const elevStr = route.elevationGain ? `${Math.round(route.elevationGain)}` : "—";
	const paceStr =
		route.distance && route.duration ? (route.distance / 1000 / (route.duration / 3600) || 0).toFixed(1) : "—";

	const [moreOpen, setMoreOpen] = useState(false);
	const moreRef = useRef<HTMLDivElement | null>(null);
	const saveRoute = useSaveRoute();
	const openDelete = useModalsStore((s) => s.openDelete);
	const pushToast = useToastStore((s) => s.push);
	const favouriteRouteIds = useUiStore((s) => s.favouriteRouteIds);
	const toggleFavourite = useUiStore((s) => s.toggleFavourite);
	const favorited = favouriteRouteIds.includes(route.id);

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
		window.dispatchEvent(
			new CustomEvent("routess:load-route", {
				detail: {
					routeId: route.id,
					name: route.name,
					waypoints: route.waypoints,
				},
			}),
		);
	};

	const dispatchShare = () => {
		window.dispatchEvent(new CustomEvent("routess:share-route"));
	};

	const dispatchFavorite = () => {
		toggleFavourite(route.id);
	};

	const dispatchDuplicate = () => {
		saveRoute.mutate(
			{
				name: `${route.name} (copy)`,
				description: route.description,
				waypoints: route.waypoints,
				distance: route.distance,
				duration: route.duration,
				elevationGain: route.elevationGain,
			},
			{
				onSuccess: (newRoute) => {
					pushToast({
						kind: "success",
						title: "Route duplicated",
						body: newRoute.name,
					});
					setMoreOpen(false);
				},
				onError: () => {
					pushToast({
						kind: "danger",
						title: "Duplicate failed",
						body: "Try again.",
					});
				},
			},
		);
	};

	const dispatchDelete = () => {
		openDelete(route.id);
		setMoreOpen(false);
	};

	const dispatchExport = () => {
		window.dispatchEvent(new CustomEvent("routess:export-gpx", { detail: { routeId: route.id } }));
	};

	const stats = [
		{ label: "Distance", value: distanceKm, unit: "km" },
		{ label: "Duration", value: durationStr, unit: "" },
		{ label: "Elev gain", value: elevStr, unit: "m" },
		{ label: "Avg speed", value: paceStr, unit: "km/h" },
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
								disabled={saveRoute.isPending}
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
								<I.copy size={14} /> {saveRoute.isPending ? "Duplicating…" : "Duplicate"}
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
				<h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, letterSpacing: -0.4 }}>{route.name}</h2>
				<p className="rds-mono" style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, margin: 0 }}>
					Created {new Date(route.createdAt).toLocaleDateString()} · {route.waypoints?.length ?? 0} waypoints
				</p>

				{route.description && (
					<p style={{ fontSize: 13, color: RDS_COLORS.fgMuted, margin: "12px 0 0", lineHeight: 1.5 }}>
						{route.description}
					</p>
				)}

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

				{(route.startAddress || route.endAddress) && (
					<div style={{ marginTop: 18 }}>
						<SecTitle style={{ marginBottom: 8 }}>Route</SecTitle>
						<div
							style={{
								background: RDS_COLORS.bgPanel,
								border: `1px solid ${RDS_COLORS.border}`,
								borderRadius: 10,
								overflow: "hidden",
							}}
						>
							{route.startAddress && (
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 10,
										padding: "10px 14px",
										borderBottom: route.endAddress ? `1px solid ${RDS_COLORS.border}` : "none",
									}}
								>
									<I.pin size={14} style={{ color: RDS_COLORS.fgSubtle }} />
									<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
										<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>Start</div>
										<div style={{ fontSize: 13, color: RDS_COLORS.fg, overflow: "hidden", textOverflow: "ellipsis" }}>
											{route.startAddress}
										</div>
									</div>
								</div>
							)}
							{route.endAddress && (
								<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
									<I.flag size={14} style={{ color: RDS_COLORS.fgSubtle }} />
									<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
										<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>End</div>
										<div style={{ fontSize: 13, color: RDS_COLORS.fg, overflow: "hidden", textOverflow: "ellipsis" }}>
											{route.endAddress}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
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
