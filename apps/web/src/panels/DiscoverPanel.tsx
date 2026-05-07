import { useT } from "@/lib/i18n";
import { ComingSoonState } from "../components/ComingSoonState";
import { RDS_COLORS, SecTitle } from "../components/primitives";

export function DiscoverPanel() {
	const t = useT();
	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					padding: "16px 20px 8px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<SecTitle>{t("nav.discover")}</SecTitle>
			</div>
			<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
				<ComingSoonState icon="explore" title={t("stub.discover.title")} body={t("stub.discover.body")} />
			</div>
		</div>
	);
}
