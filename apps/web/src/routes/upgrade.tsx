import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AUTH_CARD_STYLE, AuthBackdrop, AuthCardAccentBar } from "@/components/auth-shared";
import { I } from "@/components/icons";
import { Btn, RDS_COLORS } from "@/components/primitives";
import { formatDay, formatPrice } from "@/features/billing/format";
import { useAuthState } from "@/hooks/useAuthState";
import { trackEvent } from "@/lib/analytics/track";
import { useBillingStatus, useStartCheckout } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-client";
import { LoginScreen } from "@/screens/LoginScreen";
import { useUiStore } from "@/stores/uiStore";

type CheckoutReturn = "success" | "cancelled";

// The webhook usually lands within seconds of the return from Stripe; poll
// the status for a minute so the new expiry shows up on its own.
const ACTIVATION_POLL_MS = 3000;
const ACTIVATION_POLL_WINDOW_MS = 60_000;

// The paywall / upgrade page for the Pro year pass (ADR 0039), and the page
// Stripe Checkout returns to (?checkout=success|cancelled).
export const Route = createFileRoute("/upgrade")({
	validateSearch: (search: Record<string, unknown>): { checkout?: CheckoutReturn } => ({
		checkout: search.checkout === "success" || search.checkout === "cancelled" ? search.checkout : undefined,
	}),
	component: UpgradePage,
});

function UpgradePage() {
	const { checkout: checkoutReturn } = Route.useSearch();
	const t = useT();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const language = useUiStore((s) => s.language);
	const { isAuthenticated } = useAuthState();
	const [showLogin, setShowLogin] = useState(false);
	const [polling, setPolling] = useState(checkoutReturn === "success");
	const { data: status, isLoading } = useBillingStatus({ refetchInterval: polling ? ACTIVATION_POLL_MS : false });
	const checkout = useStartCheckout();
	// The return from Stripe is the UI moment for payment_completed /
	// payment_cancelled; fire once per page load (StrictMode mounts twice).
	const trackedReturn = useRef(false);

	useEffect(() => {
		if (!checkoutReturn || trackedReturn.current) return;
		trackedReturn.current = true;
		trackEvent({
			name: checkoutReturn === "success" ? "payment_completed" : "payment_cancelled",
			properties: { plan: "pro", offer: "pro_year_pass" },
		});
	}, [checkoutReturn]);

	useEffect(() => {
		if (!polling) return;
		const timer = setTimeout(() => setPolling(false), ACTIVATION_POLL_WINDOW_MS);
		return () => clearTimeout(timer);
	}, [polling]);

	if (showLogin && !isAuthenticated) {
		return (
			<LoginScreen
				onSuccess={() => {
					setShowLogin(false);
					void queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
				}}
			/>
		);
	}

	const account = status?.account ?? null;
	const isPro = account?.plan === "pro";
	const quotas = status?.generationPerDay;
	const price = status?.offer?.price ?? null;

	const allowance = (count: number | undefined) =>
		count && count > 0 ? t("upgrade.generationPerDay", { count: String(count) }) : t("billing.unlimited");

	let body: ReactNode;
	if (isLoading) {
		body = <p style={{ fontSize: 14, color: RDS_COLORS.fgMuted }}>{t("upgrade.loading")}</p>;
	} else if (!status?.enabled) {
		body = <p style={{ fontSize: 14, color: RDS_COLORS.fgMuted, lineHeight: 1.5 }}>{t("upgrade.disabled")}</p>;
	} else {
		body = (
			<>
				<p style={{ fontSize: 14, color: RDS_COLORS.fgMuted, margin: "0 0 18px", lineHeight: 1.5 }}>
					{t("upgrade.subtitle")}
				</p>
				{price ? (
					<div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
						<span style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
							{formatPrice(price, language)}
						</span>
						<span style={{ fontSize: 13, color: RDS_COLORS.fgSubtle }}>{t("upgrade.priceSuffix")}</span>
					</div>
				) : null}
				<div
					style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 10, marginBottom: 18 }}
				>
					<PlanColumn
						title={t("billing.plan.free")}
						highlight={false}
						lines={[allowance(quotas?.free), t("upgrade.free.everything")]}
					/>
					<PlanColumn
						title={t("billing.plan.pro")}
						highlight
						lines={[allowance(quotas?.pro), t("upgrade.pro.everything")]}
					/>
				</div>
				{checkoutReturn === "success" ? (
					<Notice tone="success">{polling ? t("upgrade.success.pending") : t("upgrade.success.done")}</Notice>
				) : null}
				{checkoutReturn === "cancelled" ? <Notice tone="muted">{t("upgrade.cancelled")}</Notice> : null}
				{account && isPro ? (
					<Notice tone="accent">
						{account.proExpiresAt
							? t("billing.proUntil", { date: formatDay(account.proExpiresAt, language) })
							: t("billing.proForever")}
						{account.ogGrantExpiresAt ? ` · ${t("upgrade.ogIncluded")}` : ""}
					</Notice>
				) : null}
				{!account ? (
					<Btn variant="primary" onClick={() => setShowLogin(true)} style={{ width: "100%", height: 42 }}>
						{t("upgrade.signInToBuy")}
					</Btn>
				) : account.canBuy ? (
					<Btn
						variant="primary"
						disabled={checkout.isPending}
						onClick={() => checkout.mutate({ isExtension: isPro })}
						style={{ width: "100%", height: 42 }}
					>
						{isPro ? t("upgrade.extend") : t("upgrade.buy")}
					</Btn>
				) : account.proExpiresAt === null && isPro ? null : (
					<Notice tone="muted">{t("upgrade.pendingDeletion")}</Notice>
				)}
				{checkout.isError ? <Notice tone="danger">{t("upgrade.checkoutFailed")}</Notice> : null}
				<p style={{ fontSize: 12, color: RDS_COLORS.fgSubtle, margin: "12px 0 0", lineHeight: 1.5 }}>
					{isPro ? `${t("upgrade.extendNote")} ` : ""}
					{t("upgrade.methods")}
				</p>
			</>
		);
	}

	return (
		<AuthBackdrop>
			<div style={{ ...AUTH_CARD_STYLE, width: "100%", maxWidth: 480, padding: "34px 28px 24px" }}>
				<AuthCardAccentBar />
				<h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
					<I.zap size={18} />
					{t("upgrade.title")}
				</h1>
				{body}
				<Btn variant="ghost" onClick={() => navigate({ to: "/" })} style={{ width: "100%", marginTop: 14 }}>
					{t("upgrade.back")}
				</Btn>
			</div>
		</AuthBackdrop>
	);
}

function PlanColumn({ title, lines, highlight }: { title: string; lines: string[]; highlight: boolean }) {
	return (
		<div
			style={{
				minWidth: 0,
				padding: 12,
				borderRadius: 12,
				border: `1px solid ${highlight ? RDS_COLORS.accent : RDS_COLORS.border}`,
				background: highlight ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
			}}
		>
			<div
				style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: highlight ? RDS_COLORS.accent : RDS_COLORS.fg }}
			>
				{title}
			</div>
			<ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 6, fontSize: 12.5, color: RDS_COLORS.fgMuted }}>
				{lines.map((line) => (
					<li key={line} style={{ overflowWrap: "anywhere" }}>
						{line}
					</li>
				))}
			</ul>
		</div>
	);
}

function Notice({ tone, children }: { tone: "success" | "accent" | "muted" | "danger"; children: ReactNode }) {
	const color = {
		success: RDS_COLORS.success,
		accent: RDS_COLORS.accent,
		muted: RDS_COLORS.fgMuted,
		danger: RDS_COLORS.danger,
	}[tone];
	return (
		<div
			role="status"
			style={{
				fontSize: 13,
				lineHeight: 1.45,
				color,
				border: `1px solid color-mix(in oklch, ${color} 35%, transparent)`,
				background: `color-mix(in oklch, ${color} 10%, transparent)`,
				borderRadius: 10,
				padding: "9px 12px",
				marginBottom: 12,
			}}
		>
			{children}
		</div>
	);
}
