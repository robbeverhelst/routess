import type { ReactNode } from "react";
import { I } from "./icons";
import { IconBtn, RDS_COLORS } from "./primitives";

interface MobilePanelDrawerProps {
	title: string;
	onClose: () => void;
	children: ReactNode;
}

export function MobilePanelDrawer({ title, onClose, children }: MobilePanelDrawerProps) {
	return (
		<>
			<button
				type="button"
				aria-label="Close panel"
				onClick={onClose}
				style={{
					position: "absolute",
					inset: 0,
					background: "color-mix(in oklch, oklch(0 0 0) 32%, transparent)",
					border: 0,
					padding: 0,
					zIndex: 9,
					animation: "rds-fade-in 180ms ease-out",
					cursor: "default",
				}}
			/>
			<aside
				role="dialog"
				aria-label={title}
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					bottom: "var(--rds-bottom-tab-h)",
					maxHeight: "calc(100dvh - var(--rds-bottom-tab-h) - var(--rds-top-bar-h))",
					height: "calc(100dvh - var(--rds-bottom-tab-h) - var(--rds-top-bar-h))",
					background: RDS_COLORS.bgPanel,
					borderTop: `1px solid ${RDS_COLORS.border}`,
					borderTopLeftRadius: 18,
					borderTopRightRadius: 18,
					boxShadow: "var(--rds-shadow-lg)",
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
					zIndex: 10,
					animation: "rds-sheet-in 220ms cubic-bezier(0.32, 0.72, 0, 1)",
				}}
			>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close drawer"
					style={{
						alignSelf: "center",
						margin: "8px 0 4px",
						width: 40,
						height: 4,
						borderRadius: 999,
						background: RDS_COLORS.borderStrong,
						border: 0,
						padding: 0,
						cursor: "pointer",
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
				<div style={{ flex: 1, minHeight: 0, overflow: "auto", width: "100%" }}>{children}</div>
			</aside>
		</>
	);
}
