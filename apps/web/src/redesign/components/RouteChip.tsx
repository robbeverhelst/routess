import { RDS_COLORS, SecTitle } from "./primitives";

interface RouteChipProps {
	distance: string;
	time: string;
	elevation?: string;
}

export function RouteChip({ distance, time, elevation = "—" }: RouteChipProps) {
	return (
		<div
			style={{
				position: "absolute",
				right: 16,
				bottom: 24,
				padding: "10px 14px",
				borderRadius: 12,
				background: RDS_COLORS.bgPanel,
				border: `1px solid ${RDS_COLORS.border}`,
				boxShadow: "var(--rds-shadow-md)",
				display: "flex",
				alignItems: "center",
				gap: 14,
				zIndex: 4,
			}}
		>
			<Stat label="Distance" value={distance} />
			<div style={{ width: 1, height: 28, background: RDS_COLORS.border }} />
			<Stat label="Time" value={time} />
			<div style={{ width: 1, height: 28, background: RDS_COLORS.border }} />
			<Stat label="Elev" value={elevation} />
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div style={{ display: "flex", flexDirection: "column" }}>
			<SecTitle>{label}</SecTitle>
			<div className="rds-mono" style={{ fontSize: 16, fontWeight: 600, color: RDS_COLORS.fg }}>
				{value}
			</div>
		</div>
	);
}
