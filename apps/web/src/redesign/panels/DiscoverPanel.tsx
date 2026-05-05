import { ComingSoonState } from "../components/ComingSoonState";
import { RDS_COLORS, SecTitle } from "../components/primitives";

export function DiscoverPanel() {
	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					padding: "16px 20px 8px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<SecTitle>Discover</SecTitle>
			</div>
			<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
				<ComingSoonState
					icon="explore"
					title="Discover routes near you"
					body="Local route ranking, popular destinations, and curated picks land with the discovery backend."
				/>
			</div>
		</div>
	);
}
