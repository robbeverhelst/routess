import type { CSSProperties, ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { I } from "./icons";
import { IconBtn, RDS_COLORS } from "./primitives";

interface MapToolbarProps {
	canUndo?: boolean;
	canRedo?: boolean;
	onUndo?: () => void;
	onRedo?: () => void;
	onRemoveRoute?: () => void;
	onSearch?: () => void;
	onLocate?: () => void;
	onGenerateLoop?: () => void;
	onLayers?: () => void;
	onLock?: () => void;
	onFocusRoute?: () => void;
	onZoomIn?: () => void;
	onZoomOut?: () => void;
	// A manual locate request is in flight (shows a spinner on the button).
	isLocating?: boolean;
	// Reason the locate button is greyed out, or null/undefined when usable.
	locateUnavailable?: "denied" | "unsupported" | null;
	hasRoute?: boolean;
	// True when there is anything to clear — at least one waypoint, even if
	// the route polyline hasn't been computed yet (a single Start counts).
	// Defaults to hasRoute for backwards-compat at call sites that don't pass it.
	canRemoveRoute?: boolean;
	isLocked?: boolean;
	isMobile?: boolean;
}

// Animated show/hide that keeps children mounted; collapses a grid track to 0
// so width/height tween instead of snapping. collapsedMargin cancels the
// parent's flex gap while collapsed.
function Collapse({
	open,
	vertical,
	collapsedMargin = 0,
	children,
}: {
	open: boolean;
	vertical?: boolean;
	collapsedMargin?: number;
	children: ReactNode;
}) {
	return (
		<div
			aria-hidden={!open}
			style={{
				display: "grid",
				...(vertical
					? { gridTemplateRows: open ? "1fr" : "0fr", marginTop: open ? 0 : -collapsedMargin }
					: { gridTemplateColumns: open ? "1fr" : "0fr", marginLeft: open ? 0 : -collapsedMargin }),
				opacity: open ? 1 : 0,
				visibility: open ? "visible" : "hidden",
				pointerEvents: open ? undefined : "none",
				transition:
					"grid-template-columns 200ms ease, grid-template-rows 200ms ease, margin 200ms ease, opacity 150ms ease, visibility 200ms",
			}}
		>
			<div style={{ display: "flex", overflow: "hidden", minWidth: 0, minHeight: 0 }}>{children}</div>
		</div>
	);
}

function Group({ children, vertical }: { children: ReactNode; vertical?: boolean }) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: vertical ? "column" : "row",
				background: RDS_COLORS.bgPanel,
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 10,
				padding: 3,
				gap: 2,
				boxShadow: "var(--rds-shadow-sm)",
			}}
		>
			{children}
		</div>
	);
}

export function MapToolbar(props: MapToolbarProps) {
	const t = useT();
	const canRemoveRoute = props.canRemoveRoute ?? props.hasRoute;
	const locateReason =
		props.locateUnavailable === "denied"
			? t("toolbar.locateDenied")
			: props.locateUnavailable === "unsupported"
				? t("toolbar.locateUnsupported")
				: undefined;
	const renderLocateBtn = (size: number, style?: CSSProperties) => (
		<IconBtn
			title={locateReason ?? t("toolbar.centerOnMe")}
			onClick={props.onLocate}
			inactive={Boolean(props.locateUnavailable)}
			style={style}
		>
			{props.isLocating ? (
				<span style={{ display: "inline-flex", animation: "rds-spin 0.8s linear infinite" }}>
					<I.refresh size={size} />
				</span>
			) : (
				<I.target size={size} />
			)}
		</IconBtn>
	);
	if (props.isMobile) {
		const btnStyle: CSSProperties = { width: 40, height: 40 };
		return (
			<div
				style={{
					position: "absolute",
					right: "max(12px, var(--rds-safe-right))",
					top: "var(--rds-top-bar-h)",
					display: "flex",
					flexDirection: "column",
					gap: 8,
					zIndex: 4,
				}}
			>
				<Group vertical>
					<Collapse open={!props.isLocked} vertical collapsedMargin={2}>
						<IconBtn title={t("loop.title")} onClick={props.onGenerateLoop} style={btnStyle}>
							<I.compass size={18} />
						</IconBtn>
					</Collapse>
					{renderLocateBtn(18, btnStyle)}
					<IconBtn title={t("toolbar.mapStyle")} onClick={props.onLayers} style={btnStyle}>
						<I.layers size={18} />
					</IconBtn>
					<IconBtn
						title={props.isLocked ? t("toolbar.unlock") : t("toolbar.lock")}
						onClick={props.onLock}
						pressed={props.isLocked}
						pressedAccent
						style={btnStyle}
					>
						{props.isLocked ? <I.lock size={18} /> : <I.unlock size={18} />}
					</IconBtn>
					<IconBtn
						title={t("toolbar.focusRoute")}
						onClick={props.onFocusRoute}
						disabled={!props.hasRoute}
						style={btnStyle}
					>
						<I.maximize size={18} />
					</IconBtn>
				</Group>
				<Group vertical>
					<IconBtn title={t("toolbar.zoomIn")} onClick={props.onZoomIn} style={btnStyle}>
						<I.plus size={18} />
					</IconBtn>
					<IconBtn title={t("toolbar.zoomOut")} onClick={props.onZoomOut} style={btnStyle}>
						<I.minus size={18} />
					</IconBtn>
				</Group>
				{(props.canUndo || props.canRedo || canRemoveRoute) && (
					<Collapse open={!props.isLocked} vertical collapsedMargin={8}>
						<Group vertical>
							<IconBtn title={t("toolbar.undo")} onClick={props.onUndo} disabled={!props.canUndo} style={btnStyle}>
								<I.undo size={18} />
							</IconBtn>
							<IconBtn title={t("toolbar.redo")} onClick={props.onRedo} disabled={!props.canRedo} style={btnStyle}>
								<I.redo size={18} />
							</IconBtn>
							<IconBtn
								title={t("toolbar.removeRoute")}
								onClick={props.onRemoveRoute}
								disabled={!canRemoveRoute}
								style={btnStyle}
							>
								<I.trash size={18} />
							</IconBtn>
						</Group>
					</Collapse>
				)}
			</div>
		);
	}

	return (
		<div
			style={{
				position: "absolute",
				top: 16,
				left: "50%",
				transform: "translateX(-50%)",
				display: "flex",
				gap: 8,
				zIndex: 4,
				maxWidth: "calc(100% - 24px)",
				flexWrap: "wrap",
				justifyContent: "center",
			}}
		>
			<Group>
				<Collapse open={!props.isLocked} collapsedMargin={2}>
					<IconBtn title={t("loop.title")} onClick={props.onGenerateLoop}>
						<I.compass size={16} />
					</IconBtn>
				</Collapse>
				<IconBtn title={t("toolbar.searchLocation")} onClick={props.onSearch}>
					<I.search size={16} />
				</IconBtn>
				{renderLocateBtn(16)}
			</Group>
			<Collapse open={!props.isLocked} collapsedMargin={8}>
				<Group>
					<IconBtn title={t("toolbar.undo")} onClick={props.onUndo} disabled={!props.canUndo}>
						<I.undo size={16} />
					</IconBtn>
					<IconBtn title={t("toolbar.redo")} onClick={props.onRedo} disabled={!props.canRedo}>
						<I.redo size={16} />
					</IconBtn>
					<IconBtn title={t("toolbar.removeRoute")} onClick={props.onRemoveRoute} disabled={!canRemoveRoute}>
						<I.trash size={16} />
					</IconBtn>
				</Group>
			</Collapse>
			<Group>
				<IconBtn title={t("toolbar.mapStyle")} onClick={props.onLayers}>
					<I.layers size={16} />
				</IconBtn>
				<IconBtn
					title={props.isLocked ? t("toolbar.unlock") : t("toolbar.lock")}
					onClick={props.onLock}
					pressed={props.isLocked}
					pressedAccent
				>
					{props.isLocked ? <I.lock size={16} /> : <I.unlock size={16} />}
				</IconBtn>
				<IconBtn title={t("toolbar.focusRoute")} onClick={props.onFocusRoute} disabled={!props.hasRoute}>
					<I.maximize size={16} />
				</IconBtn>
			</Group>
			<Group>
				<IconBtn title={t("toolbar.zoomIn")} onClick={props.onZoomIn}>
					<I.plus size={16} />
				</IconBtn>
				<IconBtn title={t("toolbar.zoomOut")} onClick={props.onZoomOut}>
					<I.minus size={16} />
				</IconBtn>
			</Group>
		</div>
	);
}
