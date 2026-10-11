import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AUTH_CARD_STYLE, AuthBackdrop, AuthCardAccentBar } from "@/components/auth-shared";
import { I } from "@/components/icons";
import { Btn, RDS_COLORS } from "@/components/primitives";
import { daysLeft, formatDay, formatPrice } from "@/features/billing/format";
import { PaymentMethods } from "@/features/billing/PaymentMethods";
import { useAuthState } from "@/hooks/useAuthState";
import { trackEvent } from "@/lib/analytics/track";
import { useBillingStatus, useStartCheckout } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-client";
import { LoginScreen } from "@/screens/LoginScreen";
import { useUiStore } from "@/stores/uiStore";

type CheckoutReturn = "success" | "cancelled";
// Where the visitor came from: "quota" is the generation picker's prompt
// after the daily allowance ran out.
type UpgradeSource = "quota";

// The webhook usually lands within seconds of the return from Stripe; poll
// the status for a minute so the new expiry shows up on its own.
const ACTIVATION_POLL_MS = 3000;
const ACTIVATION_POLL_WINDOW_MS = 60_000;

// The paywall / upgrade page for the Pro year pass (ADR 0039), and the page
// Stripe Checkout returns to (?checkout=success|cancelled).
export const Route = createFileRoute("/upgrade")({
	validateSearch: (search: Record<string, unknown>): { checkout?: CheckoutReturn; from?: UpgradeSource } => ({
		checkout: search.checkout === "success" || search.checkout === "cancelled" ? search.checkout : undefined,
		from: search.from === "quota" ? "quota" : undefined,
	}),
	component: UpgradePage,
});

function UpgradePage() {
	const { checkout: checkoutReturn, from } = Route.useSearch();
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

	const account = status?.account ?? null;
	const isPro = account?.plan === "pro";

	// Stop polling as soon as the webhook made the account Pro.
	useEffect(() => {
		if (polling && isPro) setPolling(false);
	}, [polling, isPro]);

	if (showLogin && !isAuthenticated) {
		return (
			<UpgradeScope>
				<LoginScreen
					onSuccess={() => {
						setShowLogin(false);
						void queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
					}}
				/>
			</UpgradeScope>
		);
	}

	const quotas = status?.generationPerDay;
	const price = status?.offer?.price ?? null;
	const backToMap = () => navigate({ to: "/" });

	const allowance = (count: number | undefined) => (count && count > 0 ? String(count) : t("billing.unlimited"));

	let body: ReactNode;
	if (isLoading) {
		body = <p style={{ fontSize: 14, color: RDS_COLORS.fgMuted }}>{t("upgrade.loading")}</p>;
	} else if (!status?.enabled) {
		body = <p style={{ fontSize: 14, color: RDS_COLORS.fgMuted, lineHeight: 1.5 }}>{t("upgrade.disabled")}</p>;
	} else {
		const currentPlan = account?.plan ?? null;
		body = (
			<>
				<h1 style={{ fontSize: 24, fontWeight: 650, letterSpacing: -0.4, lineHeight: 1.2, margin: "0 0 8px" }}>
					{t("upgrade.headline")}
				</h1>
				<p style={{ fontSize: 14, color: RDS_COLORS.fgMuted, margin: "0 0 18px", lineHeight: 1.5 }}>
					{t("upgrade.subtitle")}
				</p>

				{from === "quota" && account && !isPro && quotas?.free ? (
					<Notice tone="warn">
						{t("upgrade.quotaHit", { count: String(quotas.free), pro: allowance(quotas.pro) })}
					</Notice>
				) : null}
				{checkoutReturn === "success" ? (
					<Notice tone="success">{polling ? t("upgrade.success.pending") : t("upgrade.success.done")}</Notice>
				) : null}
				{checkoutReturn === "cancelled" ? <Notice tone="muted">{t("upgrade.cancelled")}</Notice> : null}

				{account && isPro ? (
					<ProStatus
						until={account.proExpiresAt}
						ogUntil={account.ogGrantExpiresAt}
						language={language}
						labels={{
							active: t("upgrade.proActive"),
							forever: t("billing.proForever"),
							until: (date) => t("billing.proUntil", { date }),
							daysLeft: (count) =>
								count === 1 ? t("upgrade.dayLeft") : t("upgrade.daysLeft", { count: String(count) }),
							ogIncluded: t("upgrade.ogIncluded"),
						}}
					/>
				) : null}

				{price ? (
					<div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 10px", marginBottom: 6 }}>
						<span
							data-testid="upgrade-price"
							style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.6, fontVariantNumeric: "tabular-nums" }}
						>
							{formatPrice(price, language)}
						</span>
						<span style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>{t("upgrade.priceSuffix")}</span>
					</div>
				) : null}
				<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
					<Tag>{t("upgrade.oneOff")}</Tag>
					<Tag>{t("upgrade.noSubscription")}</Tag>
				</div>

				<ComparisonTable
					currentPlan={currentPlan}
					rows={[
						{
							label: t("upgrade.compare.generation"),
							free: allowance(quotas?.free),
							pro: allowance(quotas?.pro),
							highlight: true,
						},
						{ label: t("upgrade.free.everything"), free: true, pro: true },
					]}
					labels={{
						feature: t("upgrade.compare.feature"),
						free: t("billing.plan.free"),
						pro: t("billing.plan.pro"),
						yourPlan: t("upgrade.yourPlan"),
					}}
				/>

				{!account ? (
					<Btn variant="primary" onClick={() => setShowLogin(true)} style={{ width: "100%", height: 44 }}>
						{t("upgrade.signInToBuy")}
					</Btn>
				) : account.canBuy ? (
					<Btn
						variant="primary"
						disabled={checkout.isPending}
						onClick={() => checkout.mutate({ isExtension: isPro })}
						style={{ width: "100%", height: 44, fontSize: 14.5, fontWeight: 600 }}
					>
						{isPro ? t("upgrade.extend") : t("upgrade.buy")}
						{price && !isPro ? ` · ${formatPrice(price, language)}` : ""}
					</Btn>
				) : account.proExpiresAt === null && isPro ? null : (
					<Notice tone="muted">{t("upgrade.pendingDeletion")}</Notice>
				)}
				{checkout.isError ? (
					<div style={{ marginTop: 10 }}>
						<Notice tone="danger">{t("upgrade.checkoutFailed")}</Notice>
					</div>
				) : null}

				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						flexWrap: "wrap",
						gap: 8,
						marginTop: 14,
					}}
				>
					<span style={{ fontSize: 12, fontWeight: 600, color: RDS_COLORS.fgMuted }}>{t("upgrade.payWith")}</span>
					<PaymentMethods label={t("upgrade.payWith")} />
				</div>
				<p
					style={{
						display: "flex",
						alignItems: "flex-start",
						gap: 6,
						fontSize: 12,
						color: RDS_COLORS.fgSubtle,
						margin: "10px 0 0",
						lineHeight: 1.45,
					}}
				>
					<I.lock size={12} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
					{t("upgrade.secure")}
				</p>

				<Faq
					title={t("upgrade.faq.title")}
					items={[
						{ q: t("upgrade.faq.renewQ"), a: t("upgrade.faq.renewA") },
						{ q: t("upgrade.faq.extendQ"), a: t("upgrade.extendNote") },
						{ q: t("upgrade.faq.endQ"), a: t("upgrade.faq.endA", { count: allowance(quotas?.free) }) },
					]}
				/>
			</>
		);
	}

	return (
		<UpgradeScope>
			<AuthBackdrop>
				<div style={{ ...AUTH_CARD_STYLE, width: "100%", maxWidth: 500, padding: "30px 26px 20px", margin: "auto" }}>
					<AuthCardAccentBar />
					<div
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							fontSize: 12,
							fontWeight: 650,
							letterSpacing: 0.4,
							textTransform: "uppercase",
							color: RDS_COLORS.accent,
							marginBottom: 10,
						}}
					>
						<I.zap size={14} aria-hidden />
						{t("upgrade.title")}
					</div>
					{body}
					<Btn variant="ghost" onClick={backToMap} style={{ width: "100%", marginTop: 14 }}>
						{account && !isPro && status?.enabled ? t("upgrade.continueFree") : t("upgrade.back")}
					</Btn>
				</div>
			</AuthBackdrop>
		</UpgradeScope>
	);
}

// /upgrade renders outside the app shell (Stripe returns here on a full page
// load), so it opens the design-system scope itself: every RDS token lives
// under [data-redesign], like the admin and public page shells.
function UpgradeScope({ children }: { children: ReactNode }) {
	const theme = useUiStore((s) => s.theme);
	const accent = useUiStore((s) => s.accent);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
	}, [theme]);

	return (
		<div
			data-redesign
			data-accent={accent}
			className={theme === "dark" ? "dark" : undefined}
			style={{ position: "fixed", inset: 0, background: RDS_COLORS.bgCanvas, color: RDS_COLORS.fg }}
		>
			{children}
		</div>
	);
}

function ProStatus({
	until,
	ogUntil,
	language,
	labels,
}: {
	until: string | null;
	ogUntil: string | null;
	language: string;
	labels: {
		active: string;
		forever: string;
		until: (date: string) => string;
		daysLeft: (count: number) => string;
		ogIncluded: string;
	};
}) {
	return (
		<div
			data-testid="pro-status"
			style={{
				display: "flex",
				alignItems: "flex-start",
				gap: 10,
				padding: "12px 14px",
				marginBottom: 16,
				borderRadius: 12,
				border: `1px solid color-mix(in oklch, ${RDS_COLORS.success} 40%, transparent)`,
				background: `color-mix(in oklch, ${RDS_COLORS.success} 10%, transparent)`,
			}}
		>
			<I.check size={16} style={{ color: RDS_COLORS.success, flexShrink: 0, marginTop: 2 }} aria-hidden />
			<div style={{ minWidth: 0, fontSize: 13, lineHeight: 1.45 }}>
				<div style={{ fontWeight: 650 }}>{labels.active}</div>
				<div style={{ color: RDS_COLORS.fgMuted }}>
					{until ? `${labels.until(formatDay(until, language))} · ${labels.daysLeft(daysLeft(until))}` : labels.forever}
				</div>
				{ogUntil ? <div style={{ color: RDS_COLORS.fgSubtle, fontSize: 12 }}>{labels.ogIncluded}</div> : null}
			</div>
		</div>
	);
}

type ComparisonCell = string | boolean;

function ComparisonTable({
	rows,
	currentPlan,
	labels,
}: {
	rows: { label: string; free: ComparisonCell; pro: ComparisonCell; highlight?: boolean }[];
	currentPlan: "free" | "pro" | null;
	labels: { feature: string; free: string; pro: string; yourPlan: string };
}) {
	const cell = (value: ComparisonCell, pro: boolean, highlight?: boolean) => (
		<td
			style={{
				padding: "10px 8px",
				textAlign: "center",
				fontVariantNumeric: "tabular-nums",
				fontWeight: highlight ? 700 : 500,
				fontSize: highlight ? 15 : 13,
				color: pro ? RDS_COLORS.accent : RDS_COLORS.fg,
				background: pro ? RDS_COLORS.accentSoft : undefined,
				verticalAlign: "middle",
			}}
		>
			{value === true ? (
				<I.check size={15} aria-label="✓" style={{ margin: "0 auto" }} />
			) : value === false ? (
				"—"
			) : (
				value
			)}
		</td>
	);
	const header = (label: string, plan: "free" | "pro") => (
		<th
			scope="col"
			style={{
				padding: "10px 8px 8px",
				width: 92,
				textAlign: "center",
				fontSize: 13,
				fontWeight: 650,
				color: plan === "pro" ? RDS_COLORS.accent : RDS_COLORS.fg,
				background: plan === "pro" ? RDS_COLORS.accentSoft : undefined,
				borderTopLeftRadius: plan === "pro" ? 10 : 0,
				borderTopRightRadius: plan === "pro" ? 10 : 0,
				verticalAlign: "bottom",
			}}
		>
			{currentPlan === plan ? (
				<div style={{ fontSize: 10.5, fontWeight: 600, color: RDS_COLORS.fgSubtle, marginBottom: 2 }}>
					{labels.yourPlan}
				</div>
			) : null}
			{label}
		</th>
	);
	return (
		<table
			style={{
				width: "100%",
				borderCollapse: "separate",
				borderSpacing: 0,
				marginBottom: 18,
				tableLayout: "fixed",
			}}
		>
			<thead>
				<tr>
					<th
						scope="col"
						style={{
							textAlign: "left",
							fontSize: 11,
							fontWeight: 600,
							letterSpacing: 0.3,
							textTransform: "uppercase",
							color: RDS_COLORS.fgSubtle,
							padding: "0 0 8px",
							verticalAlign: "bottom",
						}}
					>
						{labels.feature}
					</th>
					{header(labels.free, "free")}
					{header(labels.pro, "pro")}
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => (
					<tr key={row.label}>
						<th
							scope="row"
							style={{
								textAlign: "left",
								fontSize: 12.5,
								fontWeight: 500,
								color: RDS_COLORS.fgMuted,
								padding: "10px 8px 10px 0",
								borderTop: `1px solid ${RDS_COLORS.border}`,
								overflowWrap: "anywhere",
								lineHeight: 1.4,
							}}
						>
							{row.label}
						</th>
						{cell(row.free, false, row.highlight)}
						{cell(row.pro, true, row.highlight)}
					</tr>
				))}
			</tbody>
		</table>
	);
}

function Faq({ title, items }: { title: string; items: { q: string; a: string }[] }) {
	return (
		<section style={{ marginTop: 18, borderTop: `1px solid ${RDS_COLORS.border}`, paddingTop: 12 }}>
			<h2 style={{ fontSize: 13, fontWeight: 650, margin: "0 0 4px" }}>{title}</h2>
			{items.map((item) => (
				<details key={item.q} style={{ borderBottom: `1px solid ${RDS_COLORS.border}`, padding: "8px 0" }}>
					<summary style={{ fontSize: 13, cursor: "pointer", color: RDS_COLORS.fg }}>{item.q}</summary>
					<p style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted, margin: "6px 0 2px", lineHeight: 1.5 }}>{item.a}</p>
				</details>
			))}
		</section>
	);
}

function Tag({ children }: { children: ReactNode }) {
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				height: 22,
				padding: "0 8px",
				borderRadius: 999,
				fontSize: 11.5,
				fontWeight: 600,
				color: RDS_COLORS.accent,
				background: RDS_COLORS.accentSoft,
			}}
		>
			{children}
		</span>
	);
}

function Notice({ tone, children }: { tone: "success" | "muted" | "danger" | "warn"; children: ReactNode }) {
	const color = {
		success: RDS_COLORS.success,
		muted: RDS_COLORS.fgMuted,
		danger: RDS_COLORS.danger,
		warn: RDS_COLORS.warn,
	}[tone];
	return (
		<div
			role="status"
			style={{
				fontSize: 13,
				lineHeight: 1.45,
				color: tone === "warn" ? RDS_COLORS.fg : color,
				border: `1px solid color-mix(in oklch, ${color} 35%, transparent)`,
				background: `color-mix(in oklch, ${color} 10%, transparent)`,
				borderRadius: 10,
				padding: "9px 12px",
				marginBottom: 14,
			}}
		>
			{children}
		</div>
	);
}
