import { useT } from "@/lib/i18n";
import { ComingSoonState } from "../components/ComingSoonState";
import { I } from "../components/icons";
import { IconBtn, RDS_COLORS } from "../components/primitives";

export function CompareScreen({ onClose }: { onClose?: () => void }) {
	const t = useT();
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
					<IconBtn title={t("common.close")} onClick={onClose}>
						<I.close size={16} />
					</IconBtn>
					<span style={{ fontSize: 14, fontWeight: 600 }}>{t("compare.heading")}</span>
				</div>
			)}
			<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
				<ComingSoonState icon="layers" title={t("compare.title")} body={t("compare.body")} />
			</div>
		</div>
	);
}
