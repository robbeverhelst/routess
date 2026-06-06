import { useLayoutEffect, useRef } from "react";
import { I } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { useWaypointDragStore } from "@/stores/waypointDragStore";

// Extra slop around the visual pill so the drop target forgives fat fingers.
const HIT_PADDING = 16;

// Drop zone shown while a waypoint is lifted by a touch drag: dropping the
// waypoint on it deletes instead of moving. Complements the tap popup as the
// fast path for deletion (see ADR-0028).
export function WaypointDragTrash() {
	const t = useT();
	const isDragging = useWaypointDragStore((s) => s.isTouchDragging);
	const isOver = useWaypointDragStore((s) => s.isOverTrash);
	const setTrashRect = useWaypointDragStore((s) => s.setTrashRect);
	const ref = useRef<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		if (!isDragging) return;
		const el = ref.current;
		if (!el) return;
		const measure = () => {
			const r = el.getBoundingClientRect();
			setTrashRect({
				left: r.left - HIT_PADDING,
				top: r.top - HIT_PADDING,
				right: r.right + HIT_PADDING,
				bottom: r.bottom + HIT_PADDING,
			});
		};
		measure();
		window.addEventListener("resize", measure);
		return () => {
			window.removeEventListener("resize", measure);
			setTrashRect(null);
		};
	}, [isDragging, setTrashRect]);

	if (!isDragging) return null;

	return (
		<div
			ref={ref}
			className="animate-in fade-in"
			style={{
				position: "absolute",
				left: "50%",
				transform: `translateX(-50%) scale(${isOver ? 1.12 : 1})`,
				bottom: "calc(var(--rds-bottom-tab-h, 0px) + 18px)",
				display: "inline-flex",
				alignItems: "center",
				gap: 8,
				padding: "10px 16px",
				borderRadius: 999,
				border: `1.5px solid ${isOver ? "var(--rds-danger)" : "var(--rds-border-strong)"}`,
				background: isOver
					? "color-mix(in oklch, var(--rds-danger) 22%, var(--rds-bg-panel-elev))"
					: "var(--rds-bg-panel-elev)",
				color: "var(--rds-danger)",
				fontSize: 12.5,
				fontWeight: 600,
				boxShadow: "var(--rds-shadow-lg)",
				zIndex: 6,
				pointerEvents: "none",
				transition: "transform 120ms, background 120ms, border-color 120ms",
			}}
		>
			<I.trash size={15} />
			<span>{t("mapPopup.button.removePoint")}</span>
		</div>
	);
}
