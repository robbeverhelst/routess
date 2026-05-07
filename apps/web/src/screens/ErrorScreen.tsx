import { useT } from "@/lib/i18n";
import { I } from "../components/icons";
import { MapBackdrop } from "../components/MapBackdrop";
import { Btn, RDS_COLORS } from "../components/primitives";

export type ErrorKind = "offline" | "routefail" | "gps";

const VARIANTS: Record<
	ErrorKind,
	{
		icon: React.ComponentType<{ size?: number }>;
		titleKey: string;
		bodyKey: string;
		actionKey: string;
		fallbackKey: string;
	}
> = {
	offline: {
		icon: I.globe,
		titleKey: "error.offline.title",
		bodyKey: "error.offline.body",
		actionKey: "error.offline.retry",
		fallbackKey: "error.offline.continue",
	},
	routefail: {
		icon: I.refresh,
		titleKey: "error.routing.title",
		bodyKey: "error.routing.body",
		actionKey: "error.routing.adjust",
		fallbackKey: "error.routing.edit",
	},
	gps: {
		icon: I.target,
		titleKey: "error.gps.title",
		bodyKey: "error.gps.body",
		actionKey: "error.gps.resume",
		fallbackKey: "error.gps.stop",
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
	const t = useT();
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
					<h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>{t(v.titleKey)}</h2>
					<p
						style={{
							fontSize: 13.5,
							color: RDS_COLORS.fgMuted,
							margin: "10px 0 22px",
							lineHeight: 1.55,
						}}
					>
						{t(v.bodyKey)}
					</p>
					<Btn variant="primary" onClick={onAction} style={{ width: "100%", height: 42 }}>
						{t(v.actionKey)}
					</Btn>
					<Btn variant="ghost" onClick={onFallback} style={{ width: "100%", marginTop: 8, color: RDS_COLORS.fgMuted }}>
						{t(v.fallbackKey)}
					</Btn>
				</div>
			</div>
		</div>
	);
}
