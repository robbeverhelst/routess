import * as RadixTooltip from "@radix-ui/react-tooltip";
import { type ReactNode, useEffect, useState } from "react";

// Styled hover tooltip on top of Radix. Wrap any focusable trigger:
//   <Tooltip label={t("toolbar.undo")}><button>…</button></Tooltip>
// A nullish/empty label renders the child untouched, so callers can pass
// optional labels without branching.

export function TooltipProvider({ children }: { children: ReactNode }) {
	return (
		<RadixTooltip.Provider delayDuration={300} skipDelayDuration={400}>
			{children}
		</RadixTooltip.Provider>
	);
}

interface TooltipProps {
	label: ReactNode;
	children: ReactNode;
	side?: "top" | "bottom" | "left" | "right";
	align?: "start" | "center" | "end";
}

export function Tooltip({ label, children, side = "top", align = "center" }: TooltipProps) {
	// Theme tokens are scoped to `[data-redesign]`; portal inside it so the
	// tooltip picks up the active theme (same pattern as MobilePanelDrawer).
	const [container, setContainer] = useState<HTMLElement | null>(null);
	useEffect(() => {
		setContainer(document.querySelector<HTMLElement>("[data-redesign]"));
	}, []);

	if (!label) return <>{children}</>;
	return (
		<RadixTooltip.Root>
			<RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
			<RadixTooltip.Portal container={container}>
				<RadixTooltip.Content
					side={side}
					align={align}
					sideOffset={6}
					collisionPadding={8}
					style={{
						zIndex: 80,
						maxWidth: 260,
						padding: "5px 9px",
						borderRadius: "var(--rds-radius-xs)",
						// Inlined tokens (not RDS_COLORS) to avoid a primitives ↔ Tooltip import cycle.
						background: "var(--rds-bg-panel-elev)",
						border: "1px solid var(--rds-border-strong)",
						boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
						color: "var(--rds-fg)",
						fontSize: 11.5,
						fontWeight: 500,
						lineHeight: 1.4,
						animation: "rds-fade-in var(--rds-dur-fast) ease-out",
						pointerEvents: "none",
					}}
				>
					{label}
				</RadixTooltip.Content>
			</RadixTooltip.Portal>
		</RadixTooltip.Root>
	);
}
