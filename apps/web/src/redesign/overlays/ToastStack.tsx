import { I } from "../components/icons";
import { Btn, IconBtn, RDS_COLORS } from "../components/primitives";
import { type ToastKind, useToastStore } from "../stores/toastStore";

const ICONS: Record<ToastKind, React.ComponentType<{ size?: number }>> = {
	success: I.zap,
	info: I.refresh,
	warn: I.globe,
	danger: I.trash,
};

const COLORS: Record<ToastKind, { bg: string; fg: string }> = {
	success: {
		bg: `color-mix(in oklch, ${RDS_COLORS.success} 14%, ${RDS_COLORS.bgPanel})`,
		fg: RDS_COLORS.success,
	},
	info: { bg: RDS_COLORS.bgPanel, fg: RDS_COLORS.accent },
	warn: {
		bg: `color-mix(in oklch, ${RDS_COLORS.warn} 14%, ${RDS_COLORS.bgPanel})`,
		fg: RDS_COLORS.warn,
	},
	danger: {
		bg: `color-mix(in oklch, ${RDS_COLORS.danger} 14%, ${RDS_COLORS.bgPanel})`,
		fg: RDS_COLORS.danger,
	},
};

export function ToastStack() {
	const toasts = useToastStore((s) => s.toasts);
	const dismiss = useToastStore((s) => s.dismiss);

	if (toasts.length === 0) return null;

	return (
		<div
			style={{
				position: "absolute",
				right: "max(12px, var(--rds-safe-right))",
				bottom: "calc(var(--rds-bottom-tab-h) + max(12px, var(--rds-safe-bottom)))",
				left: "max(12px, var(--rds-safe-left))",
				display: "flex",
				flexDirection: "column",
				alignItems: "flex-end",
				gap: 10,
				zIndex: 70,
				pointerEvents: "none",
			}}
		>
			{toasts.map((t) => {
				const Icon = ICONS[t.kind];
				const c = COLORS[t.kind];
				return (
					<div
						key={t.id}
						style={{
							display: "flex",
							alignItems: "flex-start",
							gap: 12,
							padding: "12px 14px",
							background: c.bg,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 12,
							boxShadow: "var(--rds-shadow-md)",
							pointerEvents: "auto",
							width: "min(340px, 100%)",
						}}
					>
						<div
							style={{
								width: 28,
								height: 28,
								borderRadius: 8,
								background: RDS_COLORS.bgPanel,
								border: `1px solid ${RDS_COLORS.border}`,
								color: c.fg,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								flexShrink: 0,
							}}
						>
							<Icon size={14} />
						</div>
						<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
							<div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
							{t.body && (
								<div
									style={{
										fontSize: 11.5,
										color: RDS_COLORS.fgMuted,
										marginTop: 2,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{t.body}
								</div>
							)}
						</div>
						{t.action && (
							<Btn
								variant="ghost"
								onClick={() => {
									t.action?.onClick();
									dismiss(t.id);
								}}
								style={{ height: 26, padding: "0 8px", fontSize: 11.5, color: c.fg, fontWeight: 600 }}
							>
								{t.action.label}
							</Btn>
						)}
						<IconBtn title="Dismiss" onClick={() => dismiss(t.id)} style={{ width: 24, height: 24 }}>
							<I.close size={12} />
						</IconBtn>
					</div>
				);
			})}
		</div>
	);
}
