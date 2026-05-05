import { ComingSoonState } from "../components/ComingSoonState";
import { I } from "../components/icons";
import { IconBtn, RDS_COLORS } from "../components/primitives";

export function CompareScreen({ onClose }: { onClose?: () => void }) {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: RDS_COLORS.bgCanvas,
				display: "flex",
				flexDirection: "column",
			}}
		>
			{onClose && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						padding: "12px 16px",
						borderBottom: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					<IconBtn title="Close" onClick={onClose}>
						<I.close size={16} />
					</IconBtn>
					<span style={{ fontSize: 14, fontWeight: 600 }}>Compare routes</span>
				</div>
			)}
			<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
				<ComingSoonState
					icon="layers"
					title="Compare two routes side by side"
					body="Pick two routes from your library to compare distance, elevation, and pace once route comparison is wired up."
				/>
			</div>
		</div>
	);
}
