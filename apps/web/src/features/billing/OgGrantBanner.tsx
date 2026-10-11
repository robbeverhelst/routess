import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { I } from "@/components/icons";
import { Btn, RDS_COLORS } from "@/components/primitives";
import { useAuthState } from "@/hooks/useAuthState";
import { useBillingStatus } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useUiStore } from "@/stores/uiStore";
import { formatDay } from "./format";

const SEEN_KEY_PREFIX = "routess:og-banner-seen:";

function hasSeen(userId: number): boolean {
	try {
		return localStorage.getItem(`${SEEN_KEY_PREFIX}${userId}`) !== null;
	} catch {
		return false;
	}
}

function markSeen(userId: number): void {
	try {
		localStorage.setItem(`${SEEN_KEY_PREFIX}${userId}`, new Date().toISOString());
	} catch {
		// Storage blocked: the banner simply shows again next time.
	}
}

// Announces the one-time OG grant (ADR 0039) after the login that applied it:
// pre-launch accounts get 3 months of Pro, and this tells them so. Shown until
// dismissed, once per account on this device; the grant itself is server-side.
export function OgGrantBanner() {
	const t = useT();
	const navigate = useNavigate();
	const language = useUiStore((s) => s.language);
	const { user } = useAuthState();
	const { data: status } = useBillingStatus();
	const [dismissedFor, setDismissedFor] = useState<number | null>(null);

	const ogUntil = status?.account?.ogGrantExpiresAt ?? null;
	const proUntil = status?.account?.proExpiresAt ?? null;
	if (!user || !ogUntil || dismissedFor === user.id || hasSeen(user.id)) return null;
	// An OG grant that already ran out is old news.
	if (new Date(ogUntil).getTime() <= Date.now()) return null;
	if (proUntil && new Date(proUntil).getTime() > new Date(ogUntil).getTime()) return null;

	const close = () => {
		markSeen(user.id);
		setDismissedFor(user.id);
	};

	return (
		<div
			role="status"
			data-testid="og-grant-banner"
			style={{
				position: "absolute",
				top: "calc(env(safe-area-inset-top, 0px) + 72px)",
				left: "50%",
				transform: "translateX(-50%)",
				zIndex: 90,
				display: "flex",
				alignItems: "flex-start",
				gap: 12,
				width: 440,
				maxWidth: "calc(100vw - 24px)",
				padding: "12px 14px",
				borderRadius: 14,
				background: RDS_COLORS.bgPanel,
				border: `1px solid color-mix(in oklch, ${RDS_COLORS.accent} 40%, ${RDS_COLORS.border})`,
				boxShadow: "var(--rds-shadow-lg)",
			}}
		>
			<div
				aria-hidden
				style={{
					display: "grid",
					placeItems: "center",
					width: 32,
					height: 32,
					flexShrink: 0,
					borderRadius: 10,
					color: RDS_COLORS.accent,
					background: RDS_COLORS.accentSoft,
				}}
			>
				<I.gift size={17} />
			</div>
			<div style={{ minWidth: 0, flex: 1 }}>
				<div style={{ fontSize: 13.5, fontWeight: 650 }}>{t("og.banner.title")}</div>
				<div style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted, lineHeight: 1.45, marginTop: 2 }}>
					{t("og.banner.body", { date: formatDay(ogUntil, language) })}
				</div>
				<Btn
					variant="primary"
					onClick={() => {
						close();
						void navigate({ to: "/upgrade" });
					}}
					style={{ height: 30, marginTop: 10, fontSize: 12.5 }}
				>
					{t("og.banner.cta")}
				</Btn>
			</div>
			<button
				type="button"
				aria-label={t("og.banner.dismiss")}
				onClick={close}
				style={{
					background: "transparent",
					border: 0,
					color: RDS_COLORS.fgMuted,
					cursor: "pointer",
					display: "inline-flex",
					padding: 2,
				}}
			>
				<I.close size={14} />
			</button>
		</div>
	);
}
