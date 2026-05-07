import { useT } from "@/lib/i18n";
import { ComingSoonState } from "../components/ComingSoonState";
import { RDS_COLORS, SecTitle } from "../components/primitives";

export function ActivityPanel() {
	const t = useT();
	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					padding: "16px 20px 8px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<SecTitle>{t("stub.activity.label")}</SecTitle>
			</div>
			<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
				<ComingSoonState icon="bell" title={t("stub.activity.title")} body={t("stub.activity.body")} />
			</div>
		</div>
	);
}
