import { useModalsStore } from "@/redesign/stores/modalsStore";
import { type RedesignActivity, useUiStore } from "@/redesign/stores/uiStore";
import {
	useClearWaypoints,
	useHasRoute,
	useRouteDistance,
	useRouteDuration,
	useRoutePath,
	useWaypoints,
} from "@/stores/routingStore";
import { I } from "../components/icons";
import { Btn, IconBtn, Kbd, RDS_COLORS, SecTitle } from "../components/primitives";

const ACTIVITIES: { key: RedesignActivity; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
	{ key: "run", icon: I.run, label: "Run" },
	{ key: "cycle", icon: I.bike, label: "Cycle" },
	{ key: "walk", icon: I.walk, label: "Walk" },
];

function ElevationSparkline() {
	// Default-data placeholder — when we wire real elevation data we'll
	// derive the path from the routePath coordinates.
	return (
		<div
			style={{
				marginTop: 14,
				height: 56,
				position: "relative",
				background: RDS_COLORS.bgInput,
				borderRadius: 8,
				padding: 6,
			}}
		>
			<svg viewBox="0 0 300 44" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }} aria-hidden="true">
				<defs>
					<linearGradient id="rds-elev" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="var(--rds-accent)" stopOpacity="0.35" />
						<stop offset="1" stopColor="var(--rds-accent)" stopOpacity="0" />
					</linearGradient>
				</defs>
				<path
					d="M0 36 L 20 30 L 40 32 L 70 22 L 100 26 L 140 14 L 180 18 L 220 10 L 250 22 L 280 18 L 300 24 L 300 44 L 0 44 Z"
					fill="url(#rds-elev)"
				/>
				<path
					d="M0 36 L 20 30 L 40 32 L 70 22 L 100 26 L 140 14 L 180 18 L 220 10 L 250 22 L 280 18 L 300 24"
					stroke="var(--rds-accent)"
					strokeWidth="1.4"
					fill="none"
				/>
			</svg>
		</div>
	);
}

export function PlanPanel() {
	const waypoints = useWaypoints();
	const routePath = useRoutePath();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const hasRoute = useHasRoute();
	const clear = useClearWaypoints();

	const { activityType, setActivityType } = useUiStore();
	const openModal = useModalsStore((s) => s.openModal);

	const stats = [
		{
			label: "Distance",
			val: distance ? distance.split(" ")[0] : "—",
			unit: distance ? distance.split(" ")[1] || "km" : "km",
		},
		{ label: "Time", val: duration || "—", unit: "" },
		{ label: "Elev gain", val: hasRoute ? "—" : "—", unit: "m" },
		{ label: "Pace", val: "—", unit: "/km" },
	];

	const startWp = waypoints[0];
	const endWp = waypoints[waypoints.length - 1];

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			{/* Activity tabs + start/end */}
			<div
				style={{
					padding: "16px 20px 12px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
					{/* Activity tabs + reverse/loop affordances on the right.
					    Reverse opens the loop modal as the closest available action since
					    the in-place reverse-route handler isn't lifted into the redesign yet. */}
					{ACTIVITIES.map((a) => {
						const Icon = a.icon;
						const on = activityType === a.key;
						return (
							<button
								key={a.key}
								type="button"
								onClick={() => setActivityType(a.key)}
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 6,
									height: 32,
									padding: "0 12px",
									borderRadius: 999,
									border: `1px solid ${on ? RDS_COLORS.accent : RDS_COLORS.border}`,
									background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
									color: on ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
									fontSize: 12.5,
									fontWeight: 500,
									cursor: "pointer",
								}}
							>
								<Icon size={14} /> {a.label}
							</button>
						);
					})}
					<div style={{ flex: 1 }} />
					<IconBtn title="Routing preferences" onClick={() => openModal("routing")}>
						<I.swap size={16} />
					</IconBtn>
					<IconBtn title="Generate loop" onClick={() => openModal("loop")}>
						<I.refresh size={16} />
					</IconBtn>
				</div>

				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
					<EndpointInput dotColor={RDS_COLORS.success} label={startWp ? formatCoord(startWp) : "Add start point"} />
					<EndpointInput
						dotColor={RDS_COLORS.danger}
						label={endWp && waypoints.length > 1 ? formatCoord(endWp) : "Add end point"}
					/>
				</div>

				<button
					type="button"
					onClick={() => openModal("search")}
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						marginTop: 8,
						height: 32,
						padding: "0 10px",
						borderRadius: 8,
						border: `1px dashed ${RDS_COLORS.borderStrong}`,
						background: "transparent",
						color: RDS_COLORS.fgMuted,
						fontSize: 12.5,
						width: "100%",
						cursor: "pointer",
					}}
				>
					<I.plus size={14} /> Add waypoint
					<span style={{ flex: 1 }} />
					<Kbd>⌘</Kbd>
					<Kbd>K</Kbd>
				</button>
			</div>

			{/* Stats */}
			<div style={{ padding: "14px 20px", borderBottom: `1px solid ${RDS_COLORS.border}` }}>
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
					{stats.map((s) => (
						<div key={s.label}>
							<SecTitle>{s.label}</SecTitle>
							<div
								className="rds-mono"
								style={{
									fontSize: 20,
									fontWeight: 600,
									color: RDS_COLORS.fg,
									marginTop: 4,
									lineHeight: 1,
								}}
							>
								{s.val}
								{s.unit && <span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginLeft: 3 }}>{s.unit}</span>}
							</div>
						</div>
					))}
				</div>
				<ElevationSparkline />
			</div>

			{/* Waypoints list */}
			<div style={{ padding: "14px 20px", overflow: "auto", flex: 1 }}>
				<SecTitle style={{ marginBottom: 10 }}>Waypoints · {waypoints.length}</SecTitle>
				{waypoints.length === 0 ? (
					<div
						style={{
							padding: "24px 12px",
							textAlign: "center",
							fontSize: 13,
							color: RDS_COLORS.fgSubtle,
							lineHeight: 1.55,
						}}
					>
						Tap the map to add your first waypoint, or use <Kbd>⌘</Kbd>
						<Kbd>K</Kbd> to search a place.
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
						{waypoints.map((w, i) => {
							const isStart = i === 0;
							const isEnd = i === waypoints.length - 1;
							const dot = isStart ? RDS_COLORS.success : isEnd ? RDS_COLORS.danger : RDS_COLORS.accent;
							const label = isStart ? "Start" : isEnd ? "End" : `Waypoint ${i}`;
							return (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: waypoints can repeat coords; combine coord with index for stable key
									key={`${w[0]}-${w[1]}-${i}`}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 12,
										padding: "8px 10px",
										borderRadius: 8,
									}}
								>
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											alignItems: "center",
											width: 16,
										}}
									>
										<div
											style={{
												width: 10,
												height: 10,
												borderRadius: 999,
												background: dot,
												border: `2px solid ${RDS_COLORS.bgPanel}`,
												boxShadow: `0 0 0 1.5px ${dot}`,
											}}
										/>
										{!isEnd && (
											<div
												style={{
													width: 1.5,
													flex: 1,
													minHeight: 12,
													background: RDS_COLORS.borderStrong,
													marginTop: 2,
												}}
											/>
										)}
									</div>
									<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
										<div style={{ fontSize: 13, fontWeight: 500, color: RDS_COLORS.fg }}>{label}</div>
										<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
											{formatCoord(w)}
										</div>
									</div>
									<IconBtn title="More options">
										<I.more size={14} />
									</IconBtn>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Footer */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "12px 20px",
					borderTop: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<Btn variant="primary" style={{ flex: 1 }} disabled={!hasRoute} onClick={() => openModal("save")}>
					<I.save size={14} /> Save route
				</Btn>
				<Btn title="Share route" disabled={!hasRoute} onClick={() => openModal("share")}>
					<I.share size={14} />
				</Btn>
				<Btn
					title="Import GPX"
					disabled={routePath.length === 0 && waypoints.length === 0}
					onClick={() => openModal("import")}
				>
					<I.download size={14} />
				</Btn>
				<Btn title="Clear" variant="ghost" onClick={clear} disabled={waypoints.length === 0}>
					<I.trash size={14} />
				</Btn>
			</div>
		</div>
	);
}

function EndpointInput({ dotColor, label }: { dotColor: string; label: string }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				background: RDS_COLORS.bgInput,
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 8,
				height: 36,
				padding: "0 10px",
				minWidth: 0,
			}}
		>
			<div style={{ width: 8, height: 8, borderRadius: 999, background: dotColor, flexShrink: 0 }} />
			<span
				style={{
					fontSize: 13,
					color: RDS_COLORS.fg,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{label}
			</span>
		</div>
	);
}

function formatCoord(c: [number, number]) {
	return `${c[1].toFixed(4)}, ${c[0].toFixed(4)}`;
}
