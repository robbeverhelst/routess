import { t } from "@/lib/i18n";
import { useUiStore } from "@/stores/uiStore";
import { I } from "./icons";
import { Btn, RDS_COLORS, SecTitle } from "./primitives";

export function EmptyActivity({
	onStartRecording,
	onConnect,
}: {
	onStartRecording?: () => void;
	onConnect?: () => void;
}) {
	const language = useUiStore((s) => s.language);
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
			<div style={{ maxWidth: 340, textAlign: "center" }}>
				<div
					style={{
						width: 88,
						height: 88,
						margin: "0 auto 18px",
						borderRadius: 22,
						background: RDS_COLORS.accentSoft,
						color: RDS_COLORS.accent,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<I.activity size={36} />
				</div>
				<h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{t("empty.nothing.title", language)}</h3>
				<p
					style={{
						fontSize: 13,
						color: RDS_COLORS.fgMuted,
						margin: "8px 0 20px",
						lineHeight: 1.55,
					}}
				>
					{t("empty.nothing.body", language)}
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<Btn variant="primary" style={{ width: "100%" }} onClick={onStartRecording}>
						<I.play size={12} /> {t("empty.startRecording", language)}
					</Btn>
					<Btn style={{ width: "100%" }} onClick={onConnect} disabled>
						<I.refresh size={14} /> {t("empty.connectGarmin", language)}
					</Btn>
				</div>
				<div
					style={{
						marginTop: 18,
						padding: 12,
						background: RDS_COLORS.bgInput,
						borderRadius: 8,
						fontSize: 11.5,
						color: RDS_COLORS.fgSubtle,
					}}
				>
					{t("empty.orPrefix", language)}{" "}
					<button
						type="button"
						style={{
							color: RDS_COLORS.accent,
							fontWeight: 500,
							background: "transparent",
							border: 0,
							padding: 0,
							font: "inherit",
							cursor: "pointer",
						}}
					>
						{t("empty.uploadPast", language)}
					</button>{" "}
					{t("empty.bulkImportSuffix", language)}
				</div>
			</div>
		</div>
	);
}

export function EmptySearch({
	query,
	suggestions,
	onSuggest,
}: {
	query: string;
	suggestions: string[];
	onSuggest: (s: string) => void;
}) {
	const language = useUiStore((s) => s.language);
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
				<h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t("empty.noResults", language, { query })}</h3>
				<p
					style={{
						fontSize: 13,
						color: RDS_COLORS.fgMuted,
						margin: "8px 0 18px",
						lineHeight: 1.55,
					}}
				>
					{t("empty.checkSpelling", language)}
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
					<SecTitle>{t("empty.tryInstead", language)}</SecTitle>
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
