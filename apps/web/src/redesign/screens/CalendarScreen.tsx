import { ComingSoonState } from "../components/ComingSoonState";
import { RDS_COLORS } from "../components/primitives";

export function CalendarScreen() {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: RDS_COLORS.bgCanvas,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<ComingSoonState
				icon="activity"
				title="Activity calendar"
				body="Your activity heatmap and monthly distance totals will appear here once the activities backend is live."
			/>
		</div>
	);
}
