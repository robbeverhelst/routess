import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { I, type IconKey } from "../../components/icons";
import { RDS_COLORS } from "../../components/primitives";

export function DropMenu({
	open,
	onClose,
	children,
	align = "right",
	width = 200,
	style,
}: {
	open: boolean;
	onClose: () => void;
	children: ReactNode;
	align?: "left" | "right";
	width?: number;
	style?: CSSProperties;
}) {
	const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) return;
		const onDocClick = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", onDocClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDocClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [open, onClose]);

	if (!open) return null;
	return (
		<div
			ref={ref}
			role="menu"
			style={{
				position: "absolute",
				top: "calc(100% + 4px)",
				...(align === "right" ? { right: 0 } : { left: 0 }),
				minWidth: width,
				background: RDS_COLORS.bgPanel,
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 8,
				padding: 4,
				boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
				zIndex: 30,
				...style,
			}}
		>
			{children}
		</div>
	);
}

export function MenuItem({
	icon,
	label,
	onClick,
	danger,
	disabled,
	checked,
	trailing,
}: {
	icon?: IconKey;
	label: ReactNode;
	onClick?: () => void;
	danger?: boolean;
	disabled?: boolean;
	checked?: boolean;
	trailing?: ReactNode;
}) {
	const Icon = icon ? I[icon] : null;
	return (
		<button
			type="button"
			role="menuitem"
			onClick={onClick}
			disabled={disabled}
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				width: "100%",
				padding: "8px 10px",
				background: "transparent",
				border: 0,
				borderRadius: 6,
				cursor: disabled ? "not-allowed" : "pointer",
				opacity: disabled ? 0.5 : 1,
				fontSize: 13,
				color: danger ? RDS_COLORS.danger : RDS_COLORS.fg,
				textAlign: "left",
			}}
			onMouseEnter={(e) => {
				if (!disabled) e.currentTarget.style.background = RDS_COLORS.bgHover;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.background = "transparent";
			}}
		>
			{Icon && <Icon size={14} style={{ flexShrink: 0 }} />}
			<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
			{checked && <I.check size={14} style={{ flexShrink: 0, color: RDS_COLORS.accent }} />}
			{trailing}
		</button>
	);
}

export function MenuDivider() {
	return <div style={{ height: 1, background: RDS_COLORS.border, margin: "4px 6px" }} />;
}
