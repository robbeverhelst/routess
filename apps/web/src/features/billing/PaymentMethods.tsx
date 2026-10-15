import { I } from "@/components/icons";
import { RDS_COLORS } from "@/components/primitives";
import { useT } from "@/lib/i18n";

import { PAYMENT_METHODS } from "./format";

// The Checkout payment methods (ADR 0039) as plain labelled chips, so buyers
// see Bancontact and iDEAL before they reach Stripe. Text, not brand logos.
export function PaymentMethods({ label }: { label?: string }) {
	const t = useT();
	return (
		<ul
			aria-label={label ?? t("billing.paymentMethods")}
			style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: 0, padding: 0, listStyle: "none" }}
		>
			{PAYMENT_METHODS.map((method) => (
				<li
					key={method}
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 5,
						height: 24,
						padding: "0 9px",
						borderRadius: 999,
						border: `1px solid ${RDS_COLORS.border}`,
						background: RDS_COLORS.bgInput,
						fontSize: 12,
						fontWeight: 600,
						color: RDS_COLORS.fg,
						whiteSpace: "nowrap",
					}}
				>
					{method === "card" ? <I.creditCard size={13} aria-hidden /> : null}
					{t(`upgrade.method.${method}`)}
				</li>
			))}
		</ul>
	);
}
