import { I } from "../components/icons";
import { MapBackdrop } from "../components/MapBackdrop";
import { Btn, RDS_COLORS } from "../components/primitives";

export type ErrorKind = "offline" | "routefail" | "gps";

const VARIANTS: Record<
	ErrorKind,
	{
		icon: React.ComponentType<{ size?: number }>;
		title: string;
		body: string;
		action: string;
		fallback: string;
	}
> = {
	offline: {
		icon: I.globe,
		title: "You're offline",
		body: "We can't reach the map server. Cached tiles will still load. Recording continues — your activity will sync when you reconnect.",
		action: "Retry connection",
		fallback: "Continue offline",
	},
	routefail: {
		icon: I.refresh,
		title: "Couldn't build that route",
		body: "There's no continuous path between your waypoints with the current preferences. Try a different routing profile or move a waypoint.",
		action: "Adjust routing",
		fallback: "Edit waypoints",
	},
	gps: {
		icon: I.target,
		title: "GPS signal lost",
		body: "We've paused recording until we can reacquire your location. Move to an open area or check device permissions.",
		action: "Resume when ready",
		fallback: "Stop recording",
	},
};

export function ErrorScreen({
	kind,
	onAction,
	onFallback,
}: {
	kind: ErrorKind;
	onAction?: () => void;
	onFallback?: () => void;
}) {
	const v = VARIANTS[kind];
	const Icon = v.icon;
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				zIndex: 80,
			}}
		>
			<MapBackdrop showRoute={false} />
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: 24,
					background: `color-mix(in oklch, ${RDS_COLORS.bgCanvas} 78%, transparent)`,
					backdropFilter: "blur(8px)",
				}}
			>
				<div
					style={{
						maxWidth: 420,
						padding: 32,
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 16,
						boxShadow: "var(--rds-shadow-lg)",
						textAlign: "center",
					}}
				>
					<div
						style={{
							width: 56,
							height: 56,
							borderRadius: 16,
							background: RDS_COLORS.accentSoft,
							color: RDS_COLORS.accent,
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							marginBottom: 16,
						}}
					>
						<Icon size={26} />
					</div>
					<h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>{v.title}</h2>
					<p
						style={{
							fontSize: 13.5,
							color: RDS_COLORS.fgMuted,
							margin: "10px 0 22px",
							lineHeight: 1.55,
						}}
					>
						{v.body}
					</p>
					<Btn variant="primary" onClick={onAction} style={{ width: "100%", height: 42 }}>
						{v.action}
					</Btn>
					<Btn variant="ghost" onClick={onFallback} style={{ width: "100%", marginTop: 8, color: RDS_COLORS.fgMuted }}>
						{v.fallback}
					</Btn>
				</div>
			</div>
		</div>
	);
}
