import { ComingSoonState } from "../components/ComingSoonState";
import { RDS_COLORS, SecTitle } from "../components/primitives";

export function SocialPanel() {
	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					padding: "16px 20px 8px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<SecTitle>Social</SecTitle>
			</div>
			<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
				<ComingSoonState
					icon="social"
					title="Follow friends and share routes"
					body="Following, profile stats, and your shared-routes inbox arrive with the social backend."
				/>
			</div>
		</div>
	);
}
