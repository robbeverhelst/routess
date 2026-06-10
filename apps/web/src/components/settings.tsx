import {
	type ComponentType,
	type CSSProperties,
	cloneElement,
	type InputHTMLAttributes,
	type ReactElement,
	type ReactNode,
	type SelectHTMLAttributes,
	useId,
} from "react";
import { I } from "./icons";
import { IconBtn, RDS_COLORS, SecTitle } from "./primitives";
import { Tooltip } from "./Tooltip";

// Shared settings primitives. All settings UI (SettingsPanel, UserSettingsScreen,
// ApiTokensSection) must compose these instead of hand-rolling rows/cards.

interface SettingsSectionProps {
	title?: string;
	footer?: ReactNode;
	danger?: boolean;
	children: ReactNode;
}

export function SettingsSection({ title, footer, danger, children }: SettingsSectionProps) {
	return (
		<section style={{ marginBottom: 22 }}>
			{title && (
				<SecTitle style={{ marginBottom: 10, ...(danger ? { color: RDS_COLORS.danger } : null) }}>{title}</SecTitle>
			)}
			<div
				className="rds-settings-group"
				style={{
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${
						danger ? `color-mix(in oklch, ${RDS_COLORS.danger} 40%, ${RDS_COLORS.border})` : RDS_COLORS.border
					}`,
					borderRadius: 10,
					overflow: "hidden",
				}}
			>
				{children}
			</div>
			{footer && (
				<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 8, lineHeight: 1.45 }}>{footer}</div>
			)}
		</section>
	);
}

interface SettingsRowProps {
	label: ReactNode;
	sub?: ReactNode;
	control?: ReactNode;
}

export function SettingsRow({ label, sub, control }: SettingsRowProps) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, padding: "10px 14px" }}>
			<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
				<div style={{ fontSize: 13, color: RDS_COLORS.fg }}>{label}</div>
				{sub && <div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 2, lineHeight: 1.45 }}>{sub}</div>}
			</div>
			{control}
		</div>
	);
}

// Free-form content inside a SettingsSection (forms, avatar block, …).
export function SettingsBlock({ children, style }: { children: ReactNode; style?: CSSProperties }) {
	return <div style={{ padding: "14px 14px 16px", ...style }}>{children}</div>;
}

const controlStyle: CSSProperties = {
	height: 36,
	padding: "0 10px",
	borderRadius: "var(--rds-radius-sm)",
	background: RDS_COLORS.bgInput,
	border: `1px solid ${RDS_COLORS.border}`,
	color: RDS_COLORS.fg,
	fontSize: 13,
	outline: "none",
};

export function TextInput({ style, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
	return <input {...rest} style={{ ...controlStyle, ...style }} />;
}

export function Select({ style, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select {...rest} style={{ ...controlStyle, ...style }}>
			{children}
		</select>
	);
}

export function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
	const id = useId();
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
			<label htmlFor={id} style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>
				{label}
			</label>
			{cloneElement(children, { id })}
		</div>
	);
}

type SettingsNavRowProps = {
	icon: ComponentType<{ size?: number }>;
	label: string;
	sub?: string;
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never });

// Root-level section entry: icon + label + chevron, pushes a detail view.
// With href it opens an external link in a new tab instead.
export function SettingsNavRow({ icon: Icon, label, sub, onClick, href }: SettingsNavRowProps) {
	const rowStyle: CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 12,
		width: "100%",
		minHeight: 52,
		padding: "12px 14px",
		background: "transparent",
		border: 0,
		cursor: "pointer",
		textAlign: "left",
	};
	const content = (
		<>
			<span
				style={{
					width: 32,
					height: 32,
					borderRadius: 8,
					background: RDS_COLORS.accentSoft,
					color: RDS_COLORS.accent,
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
				}}
			>
				<Icon size={15} />
			</span>
			<span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
				<span style={{ fontSize: 13, fontWeight: 500, color: RDS_COLORS.fg }}>{label}</span>
				{sub && <span style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>{sub}</span>}
			</span>
			<span style={{ display: "inline-flex", color: RDS_COLORS.fgSubtle, flexShrink: 0 }}>
				{href ? <I.externalLink size={14} /> : <I.chevronR size={14} />}
			</span>
		</>
	);
	if (href) {
		return (
			<a
				href={href}
				target="_blank"
				rel="noreferrer"
				className="rds-settings-nav-row"
				style={{ ...rowStyle, textDecoration: "none" }}
			>
				{content}
			</a>
		);
	}
	return (
		<button type="button" onClick={onClick} className="rds-settings-nav-row" style={rowStyle}>
			{content}
		</button>
	);
}

interface SettingsDetailHeaderProps {
	title: string;
	backLabel: string;
	onBack: () => void;
}

export function SettingsDetailHeader({ title, backLabel, onBack }: SettingsDetailHeaderProps) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
			<IconBtn onClick={onBack} title={backLabel}>
				<I.chevronL size={16} />
			</IconBtn>
			<div style={{ fontSize: 15, fontWeight: 600, color: RDS_COLORS.fg }}>{title}</div>
		</div>
	);
}

interface SegmentedProps {
	value: string;
	onChange: (v: string) => void;
	options: { value: string; label: string; title?: string }[];
}

export function Segmented({ value, onChange, options }: SegmentedProps) {
	return (
		<div style={{ display: "flex", gap: 4, background: RDS_COLORS.bgInput, padding: 2, borderRadius: 6 }}>
			{options.map((o) => {
				const on = value === o.value;
				return (
					<Tooltip key={o.value} label={o.title}>
						<button
							type="button"
							onClick={() => onChange(o.value)}
							aria-pressed={on}
							style={{
								padding: "6px 12px",
								borderRadius: 4,
								background: on ? RDS_COLORS.bgPanel : "transparent",
								border: 0,
								fontSize: 12,
								fontWeight: 500,
								color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
								cursor: "pointer",
							}}
						>
							{o.label}
						</button>
					</Tooltip>
				);
			})}
		</div>
	);
}
