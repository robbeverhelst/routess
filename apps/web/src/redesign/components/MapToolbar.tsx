import type { ReactNode } from "react";
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
	onLayers?: () => void;
	onLock?: () => void;
	onFocusRoute?: () => void;
	onZoomIn?: () => void;
	onZoomOut?: () => void;
	hasRoute?: boolean;
	isLocked?: boolean;
}

function Group({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				display: "flex",
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
			}}
		>
			<Group>
				<IconBtn title="Search location" onClick={props.onSearch}>
					<I.search size={16} />
				</IconBtn>
				<IconBtn title="Center on me" onClick={props.onLocate}>
					<I.target size={16} />
				</IconBtn>
			</Group>
			<Group>
				<IconBtn title="Undo" onClick={props.onUndo} disabled={!props.canUndo}>
					<I.undo size={16} />
				</IconBtn>
				<IconBtn title="Redo" onClick={props.onRedo} disabled={!props.canRedo}>
					<I.redo size={16} />
				</IconBtn>
				<IconBtn title="Remove route" onClick={props.onRemoveRoute} disabled={!props.hasRoute}>
					<I.trash size={16} />
				</IconBtn>
			</Group>
			<Group>
				<IconBtn title="Map style" onClick={props.onLayers}>
					<I.layers size={16} />
				</IconBtn>
				<IconBtn title={props.isLocked ? "Unlock map" : "Lock map"} onClick={props.onLock} pressed={props.isLocked}>
					<I.lock size={16} />
				</IconBtn>
				<IconBtn title="Focus on route" onClick={props.onFocusRoute} disabled={!props.hasRoute}>
					<I.maximize size={16} />
				</IconBtn>
			</Group>
			<Group>
				<IconBtn title="Zoom in" onClick={props.onZoomIn}>
					<I.plus size={16} />
				</IconBtn>
				<IconBtn title="Zoom out" onClick={props.onZoomOut}>
					<I.minus size={16} />
				</IconBtn>
			</Group>
		</div>
	);
}
