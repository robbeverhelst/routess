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
	onLayers?: () => void;
	onLock?: () => void;
	onFocusRoute?: () => void;
	onZoomIn?: () => void;
	onZoomOut?: () => void;
	hasRoute?: boolean;
	isLocked?: boolean;
	isMobile?: boolean;
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
					<IconBtn title={t("toolbar.centerOnMe")} onClick={props.onLocate} style={btnStyle}>
						<I.target size={18} />
					</IconBtn>
					<IconBtn title={t("toolbar.mapStyle")} onClick={props.onLayers} style={btnStyle}>
						<I.layers size={18} />
					</IconBtn>
					<IconBtn
						title={props.isLocked ? t("toolbar.unlock") : t("toolbar.lock")}
						onClick={props.onLock}
						pressed={props.isLocked}
						style={btnStyle}
					>
						<I.lock size={18} />
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
				{(props.canUndo || props.canRedo || props.hasRoute) && (
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
							disabled={!props.hasRoute}
							style={btnStyle}
						>
							<I.trash size={18} />
						</IconBtn>
					</Group>
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
				<IconBtn title={t("toolbar.searchLocation")} onClick={props.onSearch}>
					<I.search size={16} />
				</IconBtn>
				<IconBtn title={t("toolbar.centerOnMe")} onClick={props.onLocate}>
					<I.target size={16} />
				</IconBtn>
			</Group>
			<Group>
				<IconBtn title={t("toolbar.undo")} onClick={props.onUndo} disabled={!props.canUndo}>
					<I.undo size={16} />
				</IconBtn>
				<IconBtn title={t("toolbar.redo")} onClick={props.onRedo} disabled={!props.canRedo}>
					<I.redo size={16} />
				</IconBtn>
				<IconBtn title={t("toolbar.removeRoute")} onClick={props.onRemoveRoute} disabled={!props.hasRoute}>
					<I.trash size={16} />
				</IconBtn>
			</Group>
			<Group>
				<IconBtn title={t("toolbar.mapStyle")} onClick={props.onLayers}>
					<I.layers size={16} />
				</IconBtn>
				<IconBtn
					title={props.isLocked ? t("toolbar.unlock") : t("toolbar.lock")}
					onClick={props.onLock}
					pressed={props.isLocked}
				>
					<I.lock size={16} />
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
