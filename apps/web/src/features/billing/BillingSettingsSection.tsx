import { useNavigate } from "@tanstack/react-router";
import { Btn, RDS_COLORS } from "@/components/primitives";
import { SettingsBlock, SettingsRow, SettingsSection } from "@/components/settings";
import { useBillingStatus, useStartCheckout } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { formatDay } from "./format";

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
	const planSub = isPro
		? account.proExpiresAt
			? t("billing.proUntil", { date: formatDay(account.proExpiresAt, language) })
			: t("billing.proForever")
		: t("billing.freeSub");

	return (
		<SettingsSection title={t("billing.title")} footer={account.canBuy ? t("billing.footer") : undefined}>
			<SettingsRow
				label={isPro ? t("billing.plan.pro") : t("billing.plan.free")}
				sub={planSub}
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
					<div style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted, lineHeight: 1.45 }}>
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
				</SettingsBlock>
			) : null}
		</SettingsSection>
	);
}
