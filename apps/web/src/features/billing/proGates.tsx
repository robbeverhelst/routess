import { ApiDomainError } from "@routess/api-client";
import { FREE_SAVED_ROUTE_LIMIT, type ProGatedFeature, proGateOf } from "@routess/core";
import { useNavigate } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { I } from "@/components/icons";
import { Btn, RDS_COLORS } from "@/components/primitives";
import { trackEvent } from "@/lib/analytics/track";
import { useBillingStatus, useStartCheckout } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useToastStore } from "@/stores/toastStore";
import { featureLockedIn } from "./featureLocks";

// The Pro gates in the web (ADR 0039): which Features the account may use,
// read from GET /billing. The API enforces every gate; this only lets a
// control show its Pro state instead of failing when pressed. While the
// status loads, and on instances without billing, nothing is locked.
export function useProGates() {
	const { data: status } = useBillingStatus();
	const enabled = status?.enabled === true;
	const account = status?.account ?? null;
	const locked = (feature: ProGatedFeature): boolean => featureLockedIn(status, feature);
	const savedRoutes = enabled && account ? account.savedRoutes : null;
	const atSavedRouteLimit = savedRoutes?.limit != null && savedRoutes.count >= savedRoutes.limit;
	return { locked, savedRoutes, atSavedRouteLimit };
}

// The ProductEvent for a free User trying to save past the cap, fired from
// the press that ran into it (never on render).
export function trackSavedRouteLimitHit(limit?: number | null): void {
	trackEvent({ name: "saved_route_limit_hit", properties: { limit: limit ?? FREE_SAVED_ROUTE_LIMIT } });
}

// "Go Pro": straight to checkout for a signed-in account that can buy,
// otherwise the upgrade page (which signs in first).
export function useGoPro() {
	const t = useT();
	const navigate = useNavigate();
	const pushToast = useToastStore((s) => s.push);
	const { data: status } = useBillingStatus();
	const checkout = useStartCheckout();
	return () => {
		if (status?.account?.canBuy) {
			checkout.mutate(
				{ isExtension: false },
				{ onError: () => pushToast({ kind: "danger", title: t("upgrade.checkoutFailed") }) },
			);
			return;
		}
		void navigate({ to: "/upgrade" });
	};
}

export function useProGateReason() {
	const t = useT();
	return (feature: ProGatedFeature, limit?: number) =>
		feature === "unlimited_saved_routes"
			? t("pro.gate.unlimited_saved_routes", { count: String(limit ?? 5) })
			: t(`pro.gate.${feature}`);
}

// A locked control pressed anyway (a menu item, an icon button): a toast
// with the reason and Go Pro.
export function useProGatePrompt() {
	const t = useT();
	const pushToast = useToastStore((s) => s.push);
	const goPro = useGoPro();
	const reason = useProGateReason();
	const { savedRoutes } = useProGates();
	return (feature: ProGatedFeature, limit = savedRoutes?.limit ?? undefined) => {
		if (feature === "unlimited_saved_routes") trackSavedRouteLimitHit(limit);
		pushToast({
			kind: "warn",
			title: reason(feature, limit),
			action: { label: t("pro.goPro"), onClick: goPro },
		});
	};
}

// For a mutation's onError: a Pro gate becomes the same toast, and the
// caller skips its generic failure toast. Covers the race where the status
// said unlocked but the API said no.
export function useProGateToast() {
	const prompt = useProGatePrompt();
	return (error: unknown): boolean => {
		const gate = error instanceof ApiDomainError ? proGateOf(error.payload) : null;
		if (!gate) return false;
		prompt(gate.feature, gate.reason === "saved_route_limit" ? gate.limit : undefined);
		return true;
	};
}

interface ProLockProps {
	feature: ProGatedFeature;
	// Inline row (a control's place in a list or form) or a full card.
	variant?: "inline" | "card";
	style?: CSSProperties;
}

// The Pro state of a gated control: a lock, one line saying why, and Go Pro.
export function ProLock({ feature, variant = "inline", style }: ProLockProps) {
	const t = useT();
	const goPro = useGoPro();
	const reason = useProGateReason();
	const { savedRoutes } = useProGates();
	const text = reason(feature, savedRoutes?.limit ?? undefined);
	const card = variant === "card";
	return (
		<div
			data-testid={`pro-lock-${feature}`}
			style={{
				display: "flex",
				alignItems: card ? "flex-start" : "center",
				flexDirection: card ? "column" : "row",
				gap: card ? 10 : 8,
				padding: card ? 14 : "8px 10px",
				borderRadius: "var(--rds-radius-sm)",
				border: `1px solid ${RDS_COLORS.border}`,
				background: RDS_COLORS.accentSoft,
				...style,
			}}
		>
			<span style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0 }}>
				<I.lock size={14} style={{ color: RDS_COLORS.accent, flexShrink: 0, marginTop: 2 }} aria-hidden />
				<span style={{ fontSize: 12.5, lineHeight: 1.45, color: RDS_COLORS.fg }}>{text}</span>
			</span>
			<Btn variant="primary" onClick={goPro} style={{ height: 30, padding: "0 12px", fontSize: 12.5, flexShrink: 0 }}>
				<I.zap size={13} aria-hidden />
				{t("pro.goPro")}
			</Btn>
		</div>
	);
}

// Marks a locked menu item or button: a lock and "Pro".
export function ProBadge() {
	const t = useT();
	return (
		<span
			data-testid="pro-badge"
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 3,
				fontSize: 10.5,
				fontWeight: 650,
				letterSpacing: 0.2,
				color: RDS_COLORS.accent,
				flexShrink: 0,
			}}
		>
			<I.lock size={11} aria-hidden />
			{t("pro.badge")}
		</span>
	);
}
