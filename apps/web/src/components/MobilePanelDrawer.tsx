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
}

const SNAP_POINTS = [...MOBILE_DRAWER_SNAPS] as (number | string)[];

export function MobilePanelDrawer({ title, open, onClose, children }: MobilePanelDrawerProps) {
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
			fadeFromIndex={2}
			modal={false}
			dismissible
			disablePreventScroll
		>
			<Drawer.Portal container={container}>
				<Drawer.Overlay
					style={{
						position: "fixed",
						inset: 0,
						background: "color-mix(in oklch, oklch(0 0 0) 32%, transparent)",
						zIndex: 9,
						pointerEvents: "none",
					}}
				/>
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
						<span style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2 }}>{title}</span>
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
