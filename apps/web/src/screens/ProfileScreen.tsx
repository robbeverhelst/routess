import { t } from "@/lib/i18n";
import { useUiStore } from "@/stores/uiStore";
import { ComingSoonState } from "../components/ComingSoonState";
import { RDS_COLORS } from "../components/primitives";

export function ProfileScreen() {
	const language = useUiStore((s) => s.language);
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
			<ComingSoonState icon="social" title={t("profile.title", language)} body={t("profile.body", language)} />
		</div>
	);
}
