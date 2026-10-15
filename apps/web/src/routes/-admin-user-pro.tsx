import type {
	AdminAuditEntry,
	AdminEntitlementSource,
	AdminPlanKind,
	AdminUserBilling,
	AdminUserPro,
} from "@routess/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { I } from "@/components/icons";
import { Badge, Btn, RDS_COLORS, SecTitle } from "@/components/primitives";
import { apiService } from "@/lib/api";

import { Card, Td, Th } from "./admin.index";
import { formatDate, formatProUntil, PLAN_LABELS, PlanBadge } from "./admin.users.index";

const SOURCE_LABELS: Record<AdminEntitlementSource, string> = {
	billing: "Paid",
	"og-grant": "OG grant",
	admin: "Admin grant",
	manual: "Operator grant",
};

const ACTION_LABELS: Record<AdminAuditEntry["action"], string> = {
	"pro.grant": "Granted Pro",
	"pro.extend": "Extended Pro",
	"pro.revoke": "Revoked Pro",
};

const DEFAULT_GRANT_DAYS = 30;

// Minor units to a display amount; falls back to the raw figure when the
// currency code is not one the browser knows.
export function formatMoney(amount: number | null, currency: string | null): string {
	if (amount === null) return "—";
	if (!currency) return (amount / 100).toFixed(2);
	try {
		return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(
			amount / 100,
		);
	} catch {
		return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
	}
}

// Where the Pro in effect comes from: every running grant's source, plus a
// stored Pro Plan (an operator comp with no row).
function activeSources(pro: AdminUserPro): string {
	const sources = pro.grants.filter((g) => g.active).map((g) => SOURCE_LABELS[g.source]);
	if (pro.storedPlan === "pro") sources.unshift("Stored Plan (comp)");
	return sources.length ? sources.join(", ") : "—";
}

export function UserProSection({ userId, billing }: { userId: number; billing: AdminUserBilling }) {
	const { pro, savedRoutes, generationToday } = billing;
	const used =
		generationToday.limit === null ? generationToday.used : Math.min(generationToday.used, generationToday.limit);
	const refused = generationToday.limit === null ? 0 : Math.max(0, generationToday.used - generationToday.limit);

	return (
		<>
			<section style={{ marginTop: 28 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
					<SecTitle>Plan</SecTitle>
					<PlanBadge plan={pro} />
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
						gap: 14,
					}}
				>
					<Card padding={16}>
						<KV label="Plan" value={PLAN_LABELS[pro.kind]} />
					</Card>
					<Card padding={16}>
						<KV label="Source" value={activeSources(pro)} />
					</Card>
					<Card padding={16}>
						<KV label={pro.kind === "pro_expired" ? "Pro ended" : "Pro until"} value={formatProUntil(pro)} />
					</Card>
					<Card padding={16}>
						<KV
							label="Saved routes"
							value={
								savedRoutes.limit === null
									? `${savedRoutes.count} (no cap)`
									: `${savedRoutes.count} of ${savedRoutes.limit}`
							}
						/>
					</Card>
					<Card padding={16}>
						<KV
							label="Generations today (UTC)"
							value={generationToday.limit === null ? `${used} (no cap)` : `${used} of ${generationToday.limit}`}
							hint={refused > 0 ? `${refused} refused over the quota` : undefined}
						/>
					</Card>
				</div>
			</section>

			<ProActions userId={userId} pro={pro} />

			<section style={{ marginTop: 28 }}>
				<SecTitle style={{ marginBottom: 10 }}>Pro grants</SecTitle>
				<Card padding={0}>
					<div style={{ overflowX: "auto" }}>
						<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
							<thead>
								<tr style={{ background: RDS_COLORS.bgPanelElev }}>
									<Th>Source</Th>
									<Th>Status</Th>
									<Th>Ends</Th>
									<Th>Granted</Th>
									<Th>Last changed</Th>
								</tr>
							</thead>
							<tbody>
								{pro.grants.length === 0 && <EmptyRow colSpan={5}>No Pro grants.</EmptyRow>}
								{pro.grants.map((g, idx) => (
									<tr key={g.source} style={{ borderTop: idx === 0 ? "none" : `1px solid ${RDS_COLORS.border}` }}>
										<Td>{SOURCE_LABELS[g.source]}</Td>
										<Td>
											{g.active ? (
												<Badge variant="success">active</Badge>
											) : g.revokedAt ? (
												<Badge variant="warn">revoked {formatDate(g.revokedAt)}</Badge>
											) : (
												<Badge>expired</Badge>
											)}
										</Td>
										<Td muted>{g.expiresAt ? formatDate(g.expiresAt) : "Never"}</Td>
										<Td muted>{formatDate(g.createdAt)}</Td>
										<Td muted>{formatDate(g.updatedAt)}</Td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>
			</section>

			<section style={{ marginTop: 28 }}>
				<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
					<SecTitle style={{ marginBottom: 10 }}>Payments ({billing.payments.length})</SecTitle>
					<span style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>Refunds are made in Stripe</span>
				</div>
				<Card padding={0}>
					<div style={{ overflowX: "auto" }}>
						<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
							<thead>
								<tr style={{ background: RDS_COLORS.bgPanelElev }}>
									<Th>Paid</Th>
									<Th align="right">Amount</Th>
									<Th>Offer</Th>
									<Th>Pass until</Th>
									<Th align="right" />
								</tr>
							</thead>
							<tbody>
								{billing.payments.length === 0 && <EmptyRow colSpan={5}>No payments.</EmptyRow>}
								{billing.payments.map((p, idx) => (
									<tr key={p.id} style={{ borderTop: idx === 0 ? "none" : `1px solid ${RDS_COLORS.border}` }}>
										<Td>{formatDate(p.paidAt)}</Td>
										<Td align="right">{formatMoney(p.amountTotal, p.currency)}</Td>
										<Td muted>{p.offer}</Td>
										<Td muted>{p.passExpiresAt ? formatDate(p.passExpiresAt) : "—"}</Td>
										<Td align="right">
											{p.dashboardUrl ? (
												<a
													href={p.dashboardUrl}
													target="_blank"
													rel="noopener noreferrer"
													style={{
														display: "inline-flex",
														alignItems: "center",
														gap: 4,
														color: RDS_COLORS.accent,
														fontSize: 12.5,
														textDecoration: "none",
													}}
												>
													Open in Stripe <I.externalLink size={12} aria-hidden />
												</a>
											) : (
												<span style={{ color: RDS_COLORS.fgSubtle }}>{p.provider}</span>
											)}
										</Td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>
			</section>

			<section style={{ marginTop: 28 }}>
				<SecTitle style={{ marginBottom: 10 }}>Admin actions</SecTitle>
				<Card padding={0}>
					<div style={{ overflowX: "auto" }}>
						<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
							<thead>
								<tr style={{ background: RDS_COLORS.bgPanelElev }}>
									<Th>When</Th>
									<Th>Admin</Th>
									<Th>Action</Th>
									<Th>Change</Th>
									<Th>Reason</Th>
								</tr>
							</thead>
							<tbody>
								{billing.auditLog.length === 0 && <EmptyRow colSpan={5}>No admin actions.</EmptyRow>}
								{billing.auditLog.map((entry, idx) => (
									<tr key={entry.id} style={{ borderTop: idx === 0 ? "none" : `1px solid ${RDS_COLORS.border}` }}>
										<Td muted>{new Date(entry.createdAt).toLocaleString()}</Td>
										<Td muted>{entry.actorEmail}</Td>
										<Td>{ACTION_LABELS[entry.action]}</Td>
										<Td muted>{describeChange(entry)}</Td>
										<Td>{entry.reason}</Td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>
			</section>
		</>
	);
}

type PlanSnapshot = { kind?: AdminPlanKind; proUntil?: string | null; permanent?: boolean };

function describeSnapshot(snapshot: PlanSnapshot | undefined): string {
	if (!snapshot?.kind) return "?";
	const label = PLAN_LABELS[snapshot.kind];
	if (snapshot.permanent) return `${label}, never expires`;
	return snapshot.proUntil ? `${label} until ${formatDate(snapshot.proUntil)}` : label;
}

function describeChange(entry: AdminAuditEntry): string {
	const details = entry.details as { before?: PlanSnapshot; after?: PlanSnapshot };
	return `${describeSnapshot(details.before)} → ${describeSnapshot(details.after)}`;
}

function ProActions({ userId, pro }: { userId: number; pro: AdminUserPro }) {
	const queryClient = useQueryClient();
	const [reason, setReason] = useState("");
	const [days, setDays] = useState(String(DEFAULT_GRANT_DAYS));

	const done = () => {
		setReason("");
		queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
		queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
	};
	const grant = useMutation({
		mutationFn: (permanent: boolean) =>
			apiService.adminGrantPro(
				userId,
				permanent ? { permanent: true, reason } : { days: Number.parseInt(days, 10), reason },
			),
		onSuccess: done,
	});
	const extend = useMutation({ mutationFn: () => apiService.adminExtendPro(userId, reason), onSuccess: done });
	const revoke = useMutation({ mutationFn: () => apiService.adminRevokePro(userId, reason), onSuccess: done });

	const pending = grant.isPending || extend.isPending || revoke.isPending;
	const error = grant.error ?? extend.error ?? revoke.error;
	const reasonOk = reason.trim().length >= 3;
	const daysValue = Number.parseInt(days, 10);
	const daysOk = Number.isInteger(daysValue) && daysValue >= 1 && daysValue <= 3650;
	const isPro = pro.plan === "pro";
	const storedPro = pro.storedPlan === "pro";

	const reset = () => {
		grant.reset();
		extend.reset();
		revoke.reset();
	};

	return (
		<section style={{ marginTop: 28 }}>
			<SecTitle style={{ marginBottom: 10 }}>Change Pro</SecTitle>
			<Card padding={16}>
				<label style={{ display: "block", fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>
					Reason (kept in the audit log)
					<input
						type="text"
						value={reason}
						maxLength={500}
						onChange={(e) => {
							setReason(e.target.value);
							reset();
						}}
						placeholder="e.g. Comp for support case #123"
						style={inputStyle({ width: "100%", marginTop: 6 })}
					/>
				</label>
				<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}>
					<input
						type="number"
						min={1}
						max={3650}
						value={days}
						onChange={(e) => setDays(e.target.value)}
						aria-label="Days of Pro"
						style={inputStyle({ width: 84 })}
					/>
					<Btn
						variant="primary"
						disabled={pending || !reasonOk || !daysOk || storedPro}
						onClick={() => grant.mutate(false)}
						style={ACTION_BTN}
					>
						Grant {daysOk ? daysValue : "N"} days
					</Btn>
					<Btn disabled={pending || !reasonOk || storedPro} onClick={() => grant.mutate(true)} style={ACTION_BTN}>
						Grant permanently
					</Btn>
					<Btn disabled={pending || !reasonOk || pro.permanent} onClick={() => extend.mutate()} style={ACTION_BTN}>
						Extend by a year
					</Btn>
					<Btn
						variant="danger"
						disabled={pending || !reasonOk || !isPro}
						onClick={() => {
							if (confirm("Revoke Pro now? Every running Pro grant ends. Refund the payment in Stripe if needed.")) {
								revoke.mutate();
							}
						}}
						style={{
							...ACTION_BTN,
							background: "transparent",
							color: RDS_COLORS.danger,
							border: `1px solid color-mix(in oklch, ${RDS_COLORS.danger} 40%, ${RDS_COLORS.border})`,
						}}
					>
						Revoke Pro
					</Btn>
				</div>
				<div style={{ marginTop: 10, fontSize: 12, color: RDS_COLORS.fgMuted }}>
					A grant sets this account's admin grant to that many days from now (or never expiring); time from other
					sources is kept. Extending adds a year to the end of their Pro time. There is no refund here: refund in
					Stripe.
				</div>
				{error && (
					<div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: RDS_COLORS.danger }}>
						{error instanceof Error ? error.message : "The action failed."}
					</div>
				)}
			</Card>
		</section>
	);
}

const ACTION_BTN = { height: 32, padding: "0 12px", fontSize: 12.5 } as const;

function inputStyle(extra: React.CSSProperties): React.CSSProperties {
	return {
		height: 32,
		padding: "0 10px",
		borderRadius: 8,
		border: `1px solid ${RDS_COLORS.border}`,
		background: RDS_COLORS.bgInput,
		color: RDS_COLORS.fg,
		fontSize: 13,
		boxSizing: "border-box",
		...extra,
	};
}

function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
	return (
		<tr>
			<td colSpan={colSpan} style={{ padding: "24px 16px", textAlign: "center", color: RDS_COLORS.fgSubtle }}>
				{children}
			</td>
		</tr>
	);
}

function KV({ label, value, hint }: { label: string; value: string; hint?: string }) {
	return (
		<div>
			<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{label}</div>
			<div style={{ marginTop: 4, fontSize: 14, fontWeight: 500, color: RDS_COLORS.fg }}>{value}</div>
			{hint && <div style={{ marginTop: 2, fontSize: 11.5, color: RDS_COLORS.fgMuted }}>{hint}</div>}
		</div>
	);
}
