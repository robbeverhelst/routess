import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { I, type IconKey } from "../../components/icons";
import { RDS_COLORS } from "../../components/primitives";

const VIEWPORT_MARGIN = 8;

// Rendered in a portal with fixed positioning so ancestors with
// overflow: hidden (e.g. rounded route cards) can't clip the menu.
// The marker span's parent element is the anchor the menu attaches to.
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
	const anchorRef = useRef<HTMLSpanElement | null>(null);
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
	// Theme tokens (--rds-bg-panel, etc.) are scoped to `[data-redesign]`; portal
	// inside it so the menu isn't see-through (same pattern as Tooltip).
	const [container, setContainer] = useState<HTMLElement | null>(null);
	useEffect(() => {
		setContainer(document.querySelector<HTMLElement>("[data-redesign]"));
	}, []);

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

	useLayoutEffect(() => {
		if (!open) {
			setPos(null);
			return;
		}
		const place = () => {
			const anchor = anchorRef.current?.parentElement;
			const menu = ref.current;
			if (!anchor || !menu) return;
			const rect = anchor.getBoundingClientRect();
			const menuRect = menu.getBoundingClientRect();

			let left = align === "right" ? rect.right - menuRect.width : rect.left;
			left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - menuRect.width - VIEWPORT_MARGIN));

			// Below the anchor by default; flip above when there's no room.
			let top = rect.bottom + 4;
			if (top + menuRect.height > window.innerHeight - VIEWPORT_MARGIN) {
				const above = rect.top - 4 - menuRect.height;
				top =
					above >= VIEWPORT_MARGIN
						? above
						: Math.max(VIEWPORT_MARGIN, window.innerHeight - menuRect.height - VIEWPORT_MARGIN);
			}
			setPos({ top, left });
		};
		place();
		// Re-place when the content resizes (e.g. submenu views) or the
		// anchor moves (panel scroll, window resize).
		const resizeObserver = ref.current ? new ResizeObserver(place) : null;
		if (ref.current) resizeObserver?.observe(ref.current);
		window.addEventListener("resize", place);
		window.addEventListener("scroll", place, true);
		return () => {
			resizeObserver?.disconnect();
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
		};
	}, [open, align]);

	return (
		<>
			<span ref={anchorRef} style={{ display: "none" }} />
			{open &&
				createPortal(
					<div
						ref={ref}
						role="menu"
						style={{
							position: "fixed",
							top: pos?.top ?? 0,
							left: pos?.left ?? 0,
							visibility: pos ? "visible" : "hidden",
							minWidth: width,
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 8,
							padding: 4,
							boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
							zIndex: 80,
							// translateY only: placement reads menuRect.width/height, which
							// a vertical shift can't disturb.
							animation: "rds-menu-in var(--rds-dur-fast) var(--rds-ease-out)",
							...style,
						}}
					>
						{children}
					</div>,
					container ?? document.body,
				)}
		</>
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
