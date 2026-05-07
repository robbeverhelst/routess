import { useT } from "@/lib/i18n";
import { ComingSoonState } from "../components/ComingSoonState";
import { RDS_COLORS } from "../components/primitives";

export function ProfileScreen() {
	const t = useT();
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
			<ComingSoonState icon="social" title={t("profile.title")} body={t("profile.body")} />
		</div>
	);
}
