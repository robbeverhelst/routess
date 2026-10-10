import { useState } from "react";
import { I } from "@/components/icons";
import { RDS_COLORS } from "@/components/primitives";
import { useT } from "@/lib/i18n";
import { useLlmFeatureEnabled } from "./useLlmFeature";

// The ✦ natural-language entry for the Generate modal. Renders NOTHING unless
// an LLM provider is configured (useLlmFeatureEnabled). NL only ever fills the
// deterministic form below it; it never becomes a required path. Parsing is
// wired in #312 — this is the gated entry surface.
export function GenerateNlLayer() {
	const enabled = useLlmFeatureEnabled();
	const t = useT();
	const [value, setValue] = useState("");

	if (!enabled) return null;

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 8,
				padding: "11px 13px",
				borderRadius: 12,
				background: `color-mix(in oklch, ${RDS_COLORS.accent} 10%, ${RDS_COLORS.bgPanel})`,
				border: `1px solid color-mix(in oklch, ${RDS_COLORS.accent} 40%, transparent)`,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
				<I.sparkles size={15} style={{ color: RDS_COLORS.accent, flexShrink: 0 }} />
				<input
					type="text"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					aria-label={t("generate.nl.label")}
					placeholder={t("generate.nl.placeholder")}
					style={{
						flex: 1,
						minWidth: 0,
						background: "transparent",
						border: 0,
						outline: "none",
						color: RDS_COLORS.fg,
						fontSize: 13,
					}}
				/>
				<kbd
					className="rds-mono"
					style={{
						fontSize: 10,
						color: RDS_COLORS.fgSubtle,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 5,
						padding: "1px 5px",
						flexShrink: 0,
					}}
				>
					<I.cornerDownLeft size={10} />
				</kbd>
			</div>
			<div style={{ fontSize: 10.5, color: RDS_COLORS.fgSubtle, paddingLeft: 23 }}>{t("generate.nl.hint")}</div>
		</div>
	);
}
