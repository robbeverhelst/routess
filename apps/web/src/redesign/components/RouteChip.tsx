import { useViewport } from "../hooks/useViewport";
import { RDS_COLORS, SecTitle } from "./primitives";

interface RouteChipProps {
	distance: string;
	time: string;
	elevation?: string;
}

export function RouteChip({ distance, time, elevation = "—" }: RouteChipProps) {
	const { isMobile } = useViewport();

	if (isMobile) {
		return (
			<div
				style={{
					position: "absolute",
					left: "max(12px, var(--rds-safe-left))",
					right: "max(12px, var(--rds-safe-right))",
					bottom: "var(--rds-bottom-tab-h)",
					padding: "8px 12px",
					borderRadius: 12,
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					boxShadow: "var(--rds-shadow-md)",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-around",
					gap: 8,
					zIndex: 4,
				}}
			>
				<Stat label="Distance" value={distance} compact />
				<div style={{ width: 1, height: 24, background: RDS_COLORS.border }} />
				<Stat label="Time" value={time} compact />
				<div style={{ width: 1, height: 24, background: RDS_COLORS.border }} />
				<Stat label="Elev" value={elevation} compact />
			</div>
		);
	}

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

function Stat({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
	return (
		<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
			<SecTitle>{label}</SecTitle>
			<div
				className="rds-mono"
				style={{
					fontSize: compact ? 14 : 16,
					fontWeight: 600,
					color: RDS_COLORS.fg,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
				}}
			>
				{value}
			</div>
		</div>
	);
}
