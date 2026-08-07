import React, { type CSSProperties, type ReactNode } from "react";
import { Marker } from "react-map-gl/mapbox";
import { I } from "@/components/icons";
import { type SupportedLanguage, tIn } from "@/lib/i18n";

export interface PopupInfo {
	longitude: number;
	latitude: number;
	type: "direct" | "remove" | "info" | "add_on_route";
	waypointIndex?: number;
	message?: string;
}

interface MapPopupProps {
	popupInfo: PopupInfo;
	onAddDirectWaypoint: () => void;
	onRemoveWaypoint: () => void;
	onAddWaypointOnRoute: () => void;
	currentLanguage: SupportedLanguage;
}

const CARD_STYLE: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	padding: 4,
	background: "var(--rds-bg-panel-elev)",
	border: "1px solid var(--rds-border)",
	borderRadius: 10,
	boxShadow: "var(--rds-shadow-lg)",
	color: "var(--rds-fg)",
};

const CARET_STYLE: CSSProperties = {
	position: "absolute",
	left: "50%",
	bottom: -5,
	width: 8,
	height: 8,
	transform: "translateX(-50%) rotate(45deg)",
	background: "var(--rds-bg-panel-elev)",
	borderRight: "1px solid var(--rds-border)",
	borderBottom: "1px solid var(--rds-border)",
};

interface PopupButtonProps {
	icon: ReactNode;
	label: string;
	onClick: () => void;
	tone?: "accent" | "success" | "danger";
}

function PopupButton({ icon, label, onClick, tone = "accent" }: PopupButtonProps) {
	const color =
		tone === "danger" ? "var(--rds-danger)" : tone === "success" ? "var(--rds-success)" : "var(--rds-accent)";
	const bgHover =
		tone === "danger"
			? "color-mix(in oklch, var(--rds-danger) 12%, transparent)"
			: tone === "success"
				? "color-mix(in oklch, var(--rds-success) 14%, transparent)"
				: "var(--rds-accent-soft)";

	return (
		<button
			type="button"
			onPointerDown={(e) => e.stopPropagation()}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 8,
				padding: "6px 10px",
				border: 0,
				background: "transparent",
				color,
				fontSize: 12.5,
				fontWeight: 600,
				borderRadius: 8,
				cursor: "pointer",
				whiteSpace: "nowrap",
				lineHeight: 1,
				transition: "background 120ms",
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.background = bgHover;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.background = "transparent";
			}}
		>
			<span style={{ display: "inline-flex" }}>{icon}</span>
			<span>{label}</span>
		</button>
	);
}

const MapPopupComponent: React.FC<MapPopupProps> = ({
	popupInfo,
	onAddDirectWaypoint,
	onRemoveWaypoint,
	onAddWaypointOnRoute,
	currentLanguage,
}) => {
	if (!popupInfo) return null;

	return (
		<Marker
			longitude={popupInfo.longitude}
			latitude={popupInfo.latitude}
			anchor="bottom"
			offset={[0, -12]}
			style={{ zIndex: 10, pointerEvents: "auto" }}
		>
			<div className="animate-in fade-in" style={{ position: "relative" }}>
				{popupInfo.type === "direct" && (
					<div style={CARD_STYLE}>
						<PopupButton
							tone="accent"
							icon={<I.flag size={13} />}
							label={tIn(currentLanguage, "mapPopup.button.addDirectWaypoint")}
							onClick={onAddDirectWaypoint}
						/>
					</div>
				)}

				{popupInfo.type === "remove" && (
					<div style={CARD_STYLE}>
						<PopupButton
							tone="danger"
							icon={<I.trash size={13} />}
							label={tIn(currentLanguage, "mapPopup.button.removePoint")}
							onClick={onRemoveWaypoint}
						/>
					</div>
				)}

				{popupInfo.type === "add_on_route" && (
					<div style={CARD_STYLE}>
						<PopupButton
							tone="success"
							icon={<I.plus size={13} />}
							label={tIn(currentLanguage, "mapPopup.button.addWaypointHere")}
							onClick={onAddWaypointOnRoute}
						/>
					</div>
				)}

				{popupInfo.type === "info" && popupInfo.message && (
					<div
						style={{
							...CARD_STYLE,
							padding: "8px 12px",
							fontSize: 12.5,
							color: "var(--rds-fg-muted)",
						}}
					>
						{popupInfo.message}
					</div>
				)}

				<div style={CARET_STYLE} aria-hidden="true" />
			</div>
		</Marker>
	);
};

export const MapPopup = React.memo(MapPopupComponent);
