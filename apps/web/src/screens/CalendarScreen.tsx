import { useT } from "@/lib/i18n";
import { ComingSoonState } from "../components/ComingSoonState";
import { RDS_COLORS } from "../components/primitives";

export function CalendarScreen() {
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
			<ComingSoonState icon="activity" title={t("calendar.title")} body={t("calendar.body")} />
		</div>
	);
}
