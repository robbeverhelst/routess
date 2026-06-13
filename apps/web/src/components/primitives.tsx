import type React from "react";
import type { CSSProperties, ReactNode } from "react";
import { Tooltip } from "./Tooltip";

export const RDS_COLORS = {
	bgCanvas: "var(--rds-bg-canvas)",
	bgPanel: "var(--rds-bg-panel)",
	bgPanelElev: "var(--rds-bg-panel-elev)",
	bgRail: "var(--rds-bg-rail)",
	bgInput: "var(--rds-bg-input)",
	bgHover: "var(--rds-bg-hover)",
	bgActive: "var(--rds-bg-active)",
	fg: "var(--rds-fg)",
	fgMuted: "var(--rds-fg-muted)",
	fgSubtle: "var(--rds-fg-subtle)",
	border: "var(--rds-border)",
	borderStrong: "var(--rds-border-strong)",
	accent: "var(--rds-accent)",
	accentSoft: "var(--rds-accent-soft)",
	accentDeep: "var(--rds-accent-deep)",
	accentFg: "var(--rds-accent-fg)",
	success: "var(--rds-success)",
	warn: "var(--rds-warn)",
	danger: "var(--rds-danger)",
} as const;

interface IconBtnProps {
	children: ReactNode;
	onClick?: () => void;
	title?: string;
	pressed?: boolean;
	// Pressed state uses accent colors, for toggles whose active state must stand out.
	pressedAccent?: boolean;
	style?: CSSProperties;
	disabled?: boolean;
	// Greyed-out + not clickable, but still hoverable so the tooltip explaining
	// why can show (a natively `disabled` button never fires the tooltip).
	inactive?: boolean;
	onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
	onPointerMove?: (e: React.PointerEvent<HTMLButtonElement>) => void;
	onPointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void;
	onPointerCancel?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

export function IconBtn({
	children,
	onClick,
	title,
	pressed,
	pressedAccent,
	style,
	disabled,
	inactive,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerCancel,
}: IconBtnProps) {
	const blocked = disabled || inactive;
	return (
		<Tooltip label={title}>
			<button
				type="button"
				onClick={inactive ? undefined : onClick}
				aria-label={title}
				aria-pressed={pressed}
				aria-disabled={blocked}
				disabled={disabled}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerCancel}
				className="rds-icon-btn"
				style={{
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					borderRadius: "var(--rds-radius-sm)",
					background: pressed ? (pressedAccent ? RDS_COLORS.accent : RDS_COLORS.bgActive) : "transparent",
					border: "1px solid transparent",
					color: pressed ? (pressedAccent ? RDS_COLORS.accentFg : RDS_COLORS.fg) : RDS_COLORS.fgMuted,
					transition: "background 120ms, color 120ms, border 120ms",
					cursor: blocked ? "not-allowed" : "pointer",
					opacity: blocked ? 0.5 : 1,
					flexShrink: 0,
					padding: 0,
					...style,
				}}
				onMouseEnter={(e) => {
					if (blocked || pressed) return;
					e.currentTarget.style.background = RDS_COLORS.bgHover;
					e.currentTarget.style.color = RDS_COLORS.fg;
				}}
				onMouseLeave={(e) => {
					if (blocked || pressed) return;
					e.currentTarget.style.background = "transparent";
					e.currentTarget.style.color = RDS_COLORS.fgMuted;
				}}
			>
				{children}
			</button>
		</Tooltip>
	);
}

interface BtnProps {
	children: ReactNode;
	onClick?: () => void;
	variant?: "default" | "primary" | "ghost" | "danger";
	style?: CSSProperties;
	disabled?: boolean;
	type?: "button" | "submit";
	title?: string;
}

export function Btn({ children, onClick, variant = "default", style, disabled, type = "button", title }: BtnProps) {
	const base: CSSProperties = {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		height: 36,
		padding: "0 14px",
		borderRadius: "var(--rds-radius-sm)",
		fontSize: 13.5,
		fontWeight: 500,
		transition: "background 120ms, filter 120ms",
		cursor: disabled ? "not-allowed" : "pointer",
		opacity: disabled ? 0.5 : 1,
		whiteSpace: "nowrap",
	};
	const variants: Record<NonNullable<BtnProps["variant"]>, CSSProperties> = {
		default: {
			background: RDS_COLORS.bgInput,
			color: RDS_COLORS.fg,
			border: `1px solid ${RDS_COLORS.border}`,
		},
		primary: {
			background: RDS_COLORS.accent,
			color: RDS_COLORS.accentFg,
			border: "1px solid transparent",
		},
		ghost: {
			background: "transparent",
			color: RDS_COLORS.fg,
			border: "1px solid transparent",
		},
		danger: {
			background: RDS_COLORS.danger,
			color: "white",
			border: "1px solid transparent",
		},
	};
	return (
		<Tooltip label={title}>
			<button
				type={type}
				onClick={onClick}
				aria-label={title}
				disabled={disabled}
				style={{ ...base, ...variants[variant], ...style }}
				onMouseEnter={(e) => {
					if (disabled) return;
					if (variant === "primary" || variant === "danger") e.currentTarget.style.filter = "brightness(1.06)";
					else e.currentTarget.style.background = RDS_COLORS.bgHover;
				}}
				onMouseLeave={(e) => {
					if (disabled) return;
					e.currentTarget.style.filter = "";
					if (variant !== "primary" && variant !== "danger") {
						e.currentTarget.style.background = variant === "ghost" ? "transparent" : RDS_COLORS.bgInput;
					}
				}}
			>
				{children}
			</button>
		</Tooltip>
	);
}

interface BadgeProps {
	children: ReactNode;
	variant?: "default" | "accent" | "success" | "warn";
	dot?: boolean;
	style?: CSSProperties;
	title?: string;
}

export function Badge({ children, variant = "default", dot, style, title }: BadgeProps) {
	const variants = {
		default: { bg: RDS_COLORS.bgInput, fg: RDS_COLORS.fgMuted },
		accent: { bg: RDS_COLORS.accentSoft, fg: RDS_COLORS.accent },
		success: { bg: `color-mix(in oklch, ${RDS_COLORS.success} 18%, transparent)`, fg: RDS_COLORS.success },
		warn: { bg: `color-mix(in oklch, ${RDS_COLORS.warn} 18%, transparent)`, fg: RDS_COLORS.warn },
	} as const;
	const v = variants[variant];
	return (
		<Tooltip label={title}>
			<span
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					padding: "2px 8px",
					height: 22,
					borderRadius: 999,
					background: v.bg,
					color: v.fg,
					fontSize: 11.5,
					fontWeight: 500,
					...style,
				}}
			>
				{dot && (
					<span
						style={{
							display: "inline-block",
							width: 6,
							height: 6,
							borderRadius: 999,
							background: "currentColor",
						}}
					/>
				)}
				{children}
			</span>
		</Tooltip>
	);
}

export function Kbd({ children }: { children: ReactNode }) {
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				minWidth: 18,
				height: 18,
				padding: "0 5px",
				border: `1px solid ${RDS_COLORS.border}`,
				borderBottomWidth: 2,
				borderRadius: 4,
				background: RDS_COLORS.bgPanelElev,
				color: RDS_COLORS.fgMuted,
				fontFamily: '"JetBrains Mono", monospace',
				fontSize: 10.5,
				lineHeight: 1,
			}}
		>
			{children}
		</span>
	);
}

export function PreviewBanner({
	title = "Preview · sample data",
	body,
	style,
}: {
	title?: string;
	body?: ReactNode;
	style?: CSSProperties;
}) {
	return (
		<div
			role="note"
			style={{
				display: "flex",
				alignItems: "flex-start",
				gap: 10,
				padding: "10px 14px",
				background: RDS_COLORS.accentSoft,
				color: RDS_COLORS.accent,
				border: `1px solid color-mix(in oklch, ${RDS_COLORS.accent} 35%, transparent)`,
				borderRadius: 10,
				fontSize: 12.5,
				lineHeight: 1.45,
				...style,
			}}
		>
			<span
				aria-hidden="true"
				style={{
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					width: 18,
					height: 18,
					borderRadius: 999,
					background: "currentColor",
					color: RDS_COLORS.bgPanel,
					fontSize: 11,
					fontWeight: 700,
					flexShrink: 0,
					marginTop: 1,
				}}
			>
				i
			</span>
			<div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
				<div style={{ fontWeight: 600 }}>{title}</div>
				{body && <div style={{ color: RDS_COLORS.fgMuted, fontWeight: 400 }}>{body}</div>}
			</div>
		</div>
	);
}

export function SecTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
	return (
		<div
			style={{
				fontSize: 11,
				fontWeight: 600,
				textTransform: "uppercase",
				letterSpacing: "0.08em",
				color: RDS_COLORS.fgSubtle,
				...style,
			}}
		>
			{children}
		</div>
	);
}

export function Toggle({
	on,
	onChange,
	disabled,
	label,
	title,
}: {
	on: boolean;
	onChange?: (v: boolean) => void;
	disabled?: boolean;
	label?: string;
	title?: string;
}) {
	return (
		<Tooltip label={title}>
			<button
				type="button"
				role="switch"
				aria-checked={on}
				aria-label={label}
				onClick={() => !disabled && onChange?.(!on)}
				disabled={disabled}
				style={{
					// transparent padding enlarges the hit area without changing the visual
					padding: 6,
					margin: -6,
					background: "transparent",
					border: 0,
					cursor: disabled ? "not-allowed" : "pointer",
					opacity: disabled ? 0.5 : 1,
					display: "inline-flex",
					flexShrink: 0,
				}}
			>
				<span
					style={{
						width: 32,
						height: 18,
						borderRadius: 999,
						background: on ? RDS_COLORS.accent : RDS_COLORS.borderStrong,
						position: "relative",
						transition: "background 120ms",
						display: "inline-block",
					}}
				>
					<span
						style={{
							position: "absolute",
							top: 2,
							left: on ? 16 : 2,
							width: 14,
							height: 14,
							borderRadius: 999,
							background: "white",
							transition: "left 120ms",
						}}
					/>
				</span>
			</button>
		</Tooltip>
	);
}
