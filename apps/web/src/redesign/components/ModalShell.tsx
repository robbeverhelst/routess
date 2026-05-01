import { type ReactNode, useEffect } from "react";
import { I } from "./icons";
import { IconBtn, RDS_COLORS } from "./primitives";

interface ModalShellProps {
	title: string;
	sub?: string;
	children: ReactNode;
	footer?: ReactNode;
	width?: number;
	onClose: () => void;
	anchor?: "center" | "top";
}

export function ModalShell({ title, sub, children, footer, width = 480, onClose, anchor = "center" }: ModalShellProps) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				zIndex: 60,
				display: "flex",
				alignItems: anchor === "top" ? "flex-start" : "center",
				justifyContent: "center",
				padding: anchor === "top" ? "10vh 24px 24px" : 24,
			}}
		>
			<button
				type="button"
				aria-label="Close modal"
				onClick={onClose}
				style={{
					position: "absolute",
					inset: 0,
					background: "color-mix(in oklch, oklch(0 0 0) 38%, transparent)",
					backdropFilter: "blur(2px)",
					border: 0,
					padding: 0,
					cursor: "default",
				}}
			/>
			<div
				style={{
					position: "relative",
					width,
					maxWidth: "100%",
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 14,
					boxShadow: "var(--rds-shadow-lg)",
					display: "flex",
					flexDirection: "column",
					maxHeight: "86vh",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						padding: "16px 20px",
						borderBottom: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
						<div
							style={{
								fontSize: 14.5,
								fontWeight: 600,
								color: RDS_COLORS.fg,
								letterSpacing: -0.1,
							}}
						>
							{title}
						</div>
						{sub && <div style={{ fontSize: 12, color: RDS_COLORS.fgSubtle, marginTop: 3 }}>{sub}</div>}
					</div>
					<IconBtn title="Close" onClick={onClose}>
						<I.close size={14} />
					</IconBtn>
				</div>
				<div style={{ padding: 20, overflow: "auto", flex: 1, minHeight: 0 }}>{children}</div>
				{footer && (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							padding: "12px 20px",
							borderTop: `1px solid ${RDS_COLORS.border}`,
						}}
					>
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}
