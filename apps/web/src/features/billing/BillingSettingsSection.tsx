import { FREE_SAVED_ROUTE_LIMIT } from "@routess/core";
import { useNavigate } from "@tanstack/react-router";

import { I } from "@/components/icons";
import { Btn, RDS_COLORS } from "@/components/primitives";
import { SettingsBlock, SettingsRow, SettingsSection } from "@/components/settings";
import { useBillingStatus, useStartCheckout } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";

import { daysLeft, formatDay } from "./format";
import { PaymentMethods } from "./PaymentMethods";

// Settings → Plan & billing (ADR 0039): the Plan in effect, when Pro ends,
// the daily generation allowance, and buying or extending the year pass.
// Renders nothing on instances without billing.
export function BillingSettingsSection() {
	const t = useT();
	const navigate = useNavigate();
	const language = useUiStore((s) => s.language);
	const pushToast = useToastStore((s) => s.push);
	const { data: status } = useBillingStatus();
	const checkout = useStartCheckout();

	const account = status?.account;
	if (!status?.enabled || !account) return null;

	const isPro = account.plan === "pro";
	const allowance = status.generationPerDay?.[account.plan] ?? 0;
	let planSub = t("billing.freeSub", { limit: String(account.savedRoutes.limit ?? FREE_SAVED_ROUTE_LIMIT) });
	if (isPro && account.proExpiresAt) {
		const left = daysLeft(account.proExpiresAt);
		const remaining = left === 1 ? t("upgrade.dayLeft") : t("upgrade.daysLeft", { count: String(left) });
		planSub = `${t("billing.proUntil", { date: formatDay(account.proExpiresAt, language) })} · ${remaining}`;
	} else if (isPro) {
		planSub = t("billing.proForever");
	}

	return (
		<SettingsSection title={t("billing.title")} footer={account.canBuy ? t("billing.footer") : undefined}>
			<SettingsRow
				label={
					<span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
						{isPro ? <I.zap size={13} style={{ color: RDS_COLORS.accent }} aria-hidden /> : null}
						{isPro ? t("billing.plan.pro") : t("billing.plan.free")}
					</span>
				}
				sub={<span data-testid="billing-plan-sub">{planSub}</span>}
				control={
					<Btn variant="ghost" onClick={() => navigate({ to: "/upgrade" })}>
						{t("billing.compare")}
					</Btn>
				}
			/>
			<SettingsRow
				label={t("billing.generationAllowance")}
				control={
					<span style={{ fontSize: 13, color: RDS_COLORS.fgMuted, fontVariantNumeric: "tabular-nums" }}>
						{allowance > 0 ? t("billing.perDay", { count: String(allowance) }) : t("billing.unlimited")}
					</span>
				}
			/>
			{account.ogGrantExpiresAt ? (
				<SettingsBlock>
					<div style={{ display: "flex", gap: 8, fontSize: 12.5, color: RDS_COLORS.fgMuted, lineHeight: 1.45 }}>
						<I.gift size={14} style={{ color: RDS_COLORS.accent, flexShrink: 0, marginTop: 1 }} aria-hidden />
						{t("billing.ogNote", { date: formatDay(account.ogGrantExpiresAt, language) })}
					</div>
				</SettingsBlock>
			) : null}
			{account.canBuy ? (
				<SettingsBlock>
					<Btn
						variant="primary"
						disabled={checkout.isPending}
						onClick={() =>
							checkout.mutate(
								{ isExtension: isPro },
								{ onError: () => pushToast({ kind: "danger", title: t("upgrade.checkoutFailed") }) },
							)
						}
						style={{ width: "100%", height: 38 }}
					>
						{isPro ? t("upgrade.extend") : t("upgrade.buy")}
					</Btn>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							flexWrap: "wrap",
							gap: 8,
							marginTop: 10,
						}}
					>
						<span style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{t("billing.paymentMethods")}</span>
						<PaymentMethods />
					</div>
				</SettingsBlock>
			) : null}
		</SettingsSection>
	);
}
