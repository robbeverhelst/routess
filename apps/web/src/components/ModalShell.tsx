import { type ReactNode, useCallback, useEffect, useState } from "react";
import { t } from "@/lib/i18n";
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
	// Escape/backdrop/X play a short exit animation before unmounting; the
	// actual onClose fires from onAnimationEnd. Consumers that close via the
	// store directly (e.g. after a successful save) still unmount instantly.
	const [closing, setClosing] = useState(false);
	const requestClose = useCallback(() => setClosing(true), []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") requestClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [requestClose]);

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				zIndex: 60,
				display: "flex",
				alignItems: anchor === "top" ? "flex-start" : "center",
				justifyContent: "center",
				padding: anchor === "top" ? "max(8vh, 24px) 12px 12px" : 12,
				paddingTop: anchor === "top" ? "max(8vh, calc(24px + var(--rds-safe-top)))" : undefined,
				paddingBottom: "max(12px, var(--rds-safe-bottom))",
			}}
		>
			<button
				type="button"
				aria-label="Close modal"
				onClick={requestClose}
				style={{
					position: "absolute",
					inset: 0,
					background: "color-mix(in oklch, oklch(0 0 0) 38%, transparent)",
					backdropFilter: "blur(2px)",
					border: 0,
					padding: 0,
					cursor: "default",
					animation: closing
						? "rds-fade-out var(--rds-dur-fast) ease-out forwards"
						: "rds-fade-in var(--rds-dur-base) ease-out",
				}}
			/>
			<div
				onAnimationEnd={(e) => {
					if (closing && e.animationName === "rds-pop-out") onClose();
				}}
				style={{
					position: "relative",
					width: "100%",
					maxWidth: width,
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 14,
					boxShadow: "var(--rds-shadow-lg)",
					display: "flex",
					flexDirection: "column",
					maxHeight: "min(86dvh, calc(100dvh - 24px))",
					animation: closing
						? "rds-pop-out var(--rds-dur-fast) var(--rds-ease-out) forwards"
						: "rds-pop-in var(--rds-dur-base) var(--rds-ease-out)",
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
					<IconBtn title={t("common.close")} onClick={requestClose}>
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
