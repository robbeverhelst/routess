import { EmptyActivity } from "../components/EmptyStates";
import { I } from "../components/icons";
import { Badge, RDS_COLORS, SecTitle } from "../components/primitives";
import { useActivities } from "../hooks/useActivities";

export function ActivityPanel() {
	const data = useActivities();
	const max = Math.max(...data.weeklyHistory, 1);

	if (data.recent.length === 0) {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<EmptyActivity />
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
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<div style={{ fontSize: 13, fontWeight: 600, color: RDS_COLORS.fg }}>This week</div>
					{data.__source === "mock" && (
						<Badge variant="default" style={{ height: 18, fontSize: 10 }}>
							preview
						</Badge>
					)}
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "baseline",
						gap: 6,
						marginTop: 6,
					}}
				>
					<span className="rds-mono" style={{ fontSize: 32, fontWeight: 600 }}>
						{data.weekDistanceKm.toFixed(1)}
					</span>
					<span style={{ fontSize: 13, color: RDS_COLORS.fgSubtle }}>km · across {data.weekSessions} sessions</span>
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "flex-end",
						gap: 6,
						marginTop: 12,
						height: 56,
					}}
				>
					{data.weeklyHistory.map((v, i) => {
						const last = i === data.weeklyHistory.length - 1;
						return (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: weekly histogram bars are positional
								key={`week-${i}`}
								style={{
									flex: 1,
									height: `${Math.max((v / max) * 100, 6)}%`,
									background: last ? RDS_COLORS.accent : RDS_COLORS.bgActive,
									borderRadius: 3,
								}}
							/>
						);
					})}
				</div>
				<div
					className="rds-mono"
					style={{
						display: "flex",
						justifyContent: "space-between",
						fontSize: 10,
						color: RDS_COLORS.fgSubtle,
						marginTop: 4,
					}}
				>
					<span>12 wk ago</span>
					<span>now</span>
				</div>
			</div>

			<div style={{ padding: "14px 20px", flex: 1, overflow: "auto" }}>
				<SecTitle style={{ marginBottom: 10 }}>Recent sessions</SecTitle>
				{data.recent.map((s, i) => (
					<div
						key={s.id}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 12,
							padding: "10px 0",
							borderBottom: i < data.recent.length - 1 ? `1px solid ${RDS_COLORS.border}` : "none",
						}}
					>
						<div
							style={{
								width: 32,
								height: 32,
								borderRadius: 8,
								background: RDS_COLORS.accentSoft,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								color: RDS_COLORS.accent,
							}}
						>
							<I.activity size={16} />
						</div>
						<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
							<div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
							<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
								{s.when}
							</div>
						</div>
						<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
							<div className="rds-mono" style={{ fontSize: 13, fontWeight: 600 }}>
								{s.distance}
							</div>
							<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>
								{s.pace}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
