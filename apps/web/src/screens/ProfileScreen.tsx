import { ComingSoonState } from "../components/ComingSoonState";
import { RDS_COLORS } from "../components/primitives";

export function ProfileScreen() {
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
				icon="social"
				title="Public profile"
				body="Stats, public routes, follower lists, and your activity feed arrive with the social and activities backends."
			/>
		</div>
	);
}
