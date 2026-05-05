import { ComingSoonState } from "../components/ComingSoonState";
import { RDS_COLORS, SecTitle } from "../components/primitives";

export function ActivityPanel() {
	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					padding: "16px 20px 8px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<SecTitle>Activity</SecTitle>
			</div>
			<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
				<ComingSoonState
					icon="bell"
					title="Your activity feed"
					body="Your recorded sessions, distance trends, and pace summaries arrive with the activities backend."
				/>
			</div>
		</div>
	);
}
