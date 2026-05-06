import type { CSSProperties, ReactNode } from "react";
import { t } from "@/lib/i18n";
import { useUiStore } from "@/stores/uiStore";
import { I, type IconKey } from "./icons";
import { RDS_COLORS } from "./primitives";

interface ComingSoonStateProps {
	icon?: IconKey;
	title: string;
	body?: string;
	style?: CSSProperties;
	action?: ReactNode;
}

export function ComingSoonState({ icon = "compass", title, body, style, action }: ComingSoonStateProps) {
	const Icon = I[icon];
	const language = useUiStore((s) => s.language);
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				textAlign: "center",
				padding: "48px 24px",
				gap: 14,
				color: RDS_COLORS.fgMuted,
				...style,
			}}
		>
			<div
				style={{
					width: 56,
					height: 56,
					borderRadius: 16,
					background: RDS_COLORS.bgInput,
					border: `1px solid ${RDS_COLORS.border}`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: RDS_COLORS.fgSubtle,
				}}
			>
				<Icon size={22} />
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 320 }}>
				<div style={{ fontSize: 14, fontWeight: 600, color: RDS_COLORS.fg }}>{title}</div>
				{body && <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{body}</div>}
			</div>
			<div
				style={{
					fontSize: 10.5,
					fontWeight: 600,
					letterSpacing: 0.4,
					textTransform: "uppercase",
					padding: "4px 10px",
					borderRadius: 999,
					background: RDS_COLORS.accentSoft,
					color: RDS_COLORS.accent,
				}}
			>
				{t("common.comingSoon", language)}
			</div>
			{action}
		</div>
	);
}
