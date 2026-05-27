import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { type ReactNode, useEffect, useState } from "react";
import { Drawer } from "vaul";
import { MOBILE_DRAWER_SNAPS, useMobileDrawerStore } from "../stores/mobileDrawerStore";
import { I } from "./icons";
import { IconBtn, RDS_COLORS } from "./primitives";

interface MobilePanelDrawerProps {
	title: string;
	open: boolean;
	onClose: () => void;
	children: ReactNode;
	// Replaces the plain title text in the visible header. The string `title`
	// is still used as the accessible label for the dialog.
	headerSlot?: ReactNode;
}

const SNAP_POINTS = [...MOBILE_DRAWER_SNAPS] as (number | string)[];

export function MobilePanelDrawer({ title, open, onClose, children, headerSlot }: MobilePanelDrawerProps) {
	const snap = useMobileDrawerStore((s) => s.snap);
	const setSnap = useMobileDrawerStore((s) => s.setSnap);

	// Vaul's portal defaults to document.body, but our theme tokens
	// (--rds-bg-panel, etc.) are scoped to `[data-redesign]`. Mounting the
	// drawer outside that scope leaves the panel with no background and
	// reads as transparent over the map. Anchor the portal inside the themed
	// root instead.
	const [container, setContainer] = useState<HTMLElement | null>(null);
	useEffect(() => {
		setContainer(document.querySelector<HTMLElement>("[data-redesign]"));
	}, []);

	// Vaul does not forward its `modal: false` prop to the underlying Radix
	// Dialog. Radix therefore always treats this as a modal and its
	// DismissableLayer sets `body { pointer-events: none }`, which kills map
	// gestures and any UI outside the sheet (bottom tab bar, etc.). Restore
	// pointer events on body while the drawer is open — the drawer Content
	// has its own explicit pointer-events: auto so the sheet keeps working.
	useEffect(() => {
		if (!open) return;
		const style = document.createElement("style");
		style.setAttribute("data-mobile-drawer-restore-pointer-events", "");
		style.textContent = "body { pointer-events: auto !important; }";
		document.head.appendChild(style);
		return () => {
			style.remove();
		};
	}, [open]);

	return (
		<Drawer.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			snapPoints={SNAP_POINTS}
			activeSnapPoint={snap}
			setActiveSnapPoint={(value) => {
				if (typeof value === "number") {
					const allowed = MOBILE_DRAWER_SNAPS.find((s) => s === value);
					if (allowed !== undefined) setSnap(allowed);
				}
			}}
			fadeFromIndex={1}
			modal={false}
			dismissible
			disablePreventScroll
			handleOnly
		>
			<Drawer.Portal container={container}>
				<Drawer.Content
					style={{
						position: "fixed",
						left: 0,
						right: 0,
						bottom: 0,
						height: "calc(100dvh - var(--rds-top-bar-h))",
						background: RDS_COLORS.bgPanel,
						borderTop: `1px solid ${RDS_COLORS.border}`,
						borderTopLeftRadius: 18,
						borderTopRightRadius: 18,
						boxShadow: "var(--rds-shadow-lg)",
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
						zIndex: 10,
						outline: "none",
					}}
				>
					<VisuallyHidden asChild>
						<Drawer.Title>{title}</Drawer.Title>
					</VisuallyHidden>
					<Drawer.Handle
						style={{
							margin: "8px auto 4px",
							background: RDS_COLORS.borderStrong,
							opacity: 0.9,
						}}
					/>
					<header
						style={{
							display: "flex",
							alignItems: "center",
							gap: 12,
							padding: "8px 16px 12px",
							borderBottom: `1px solid ${RDS_COLORS.border}`,
						}}
					>
						{headerSlot ?? (
							<span style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2 }}>{title}</span>
						)}
						<div style={{ flex: 1 }} />
						<IconBtn title="Close" onClick={onClose}>
							<I.close size={16} />
						</IconBtn>
					</header>
					<div
						style={{
							flex: 1,
							minHeight: 0,
							overflow: "auto",
							width: "100%",
							paddingBottom: "var(--rds-bottom-tab-h)",
						}}
					>
						{children}
					</div>
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.Root>
	);
}
