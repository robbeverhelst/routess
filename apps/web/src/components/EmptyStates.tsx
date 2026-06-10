import { useT } from "@/lib/i18n";
import { I } from "./icons";
import { RDS_COLORS, SecTitle } from "./primitives";

export function EmptySearch({
	query,
	suggestions,
	onSuggest,
}: {
	query: string;
	suggestions: string[];
	onSuggest: (s: string) => void;
}) {
	const t = useT();
	return (
		<div
			style={{
				flex: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 40,
			}}
		>
			<div style={{ maxWidth: 320, textAlign: "center" }}>
				<div
					style={{
						width: 80,
						height: 80,
						margin: "0 auto 16px",
						borderRadius: 20,
						background: RDS_COLORS.bgInput,
						color: RDS_COLORS.fgMuted,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<I.search size={32} />
				</div>
				<h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t("empty.noResults", { query })}</h3>
				<p
					style={{
						fontSize: 13,
						color: RDS_COLORS.fgMuted,
						margin: "8px 0 18px",
						lineHeight: 1.55,
					}}
				>
					{t("empty.checkSpelling")}
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
					<SecTitle>{t("empty.tryInstead")}</SecTitle>
					{suggestions.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => onSuggest(s)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								padding: "8px 12px",
								borderRadius: 8,
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								fontSize: 12.5,
								color: "inherit",
								cursor: "pointer",
								textAlign: "left",
							}}
						>
							<I.search size={12} />
							<span>{s}</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
