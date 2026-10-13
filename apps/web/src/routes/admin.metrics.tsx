import type { AdminMetrics } from "@routess/api-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RDS_COLORS, SecTitle } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { formatMoney } from "./-admin-user-pro";
import { Card, MetricCard, PageError, PageHeader, PageSkeleton, Td, Th, TimeseriesCard } from "./admin.index";
import { formatDate, PlanBadge } from "./admin.users.index";

export const Route = createFileRoute("/admin/metrics")({
	component: AdminMetricsPage,
});

function AdminMetricsPage() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["admin", "metrics"],
		queryFn: () => apiService.adminGetMetrics(),
		staleTime: 60_000,
	});

	if (isLoading) return <PageSkeleton title="Metrics" />;
	if (error || !data) return <PageError title="Metrics" error={error} />;

	return (
		<div>
			<PageHeader
				eyebrow="Admin"
				title="Metrics"
				subtitle={`Launch health over the last ${data.days} days. Days are UTC.`}
			/>
			<SignupsSection data={data} />
			<ActiveUsersSection data={data} />
			<GenerationsSection data={data} />
			<PayingUsersSection data={data} />
			<ProSection data={data} />
			<LimitsSection data={data} />
			<ProEndingSection data={data} />
		</div>
	);
}

function SignupsSection({ data }: { data: AdminMetrics }) {
	const { signups } = data;
	return (
		<Section title="Signups" note="Postgres">
			<TileGrid>
				<MetricCard label="Total users" value={signups.total} />
				<MetricCard label="Today" value={signups.today} />
				<MetricCard label="Last 7 days" value={signups.last7Days} />
				<MetricCard label="Last 30 days" value={signups.last30Days} />
			</TileGrid>
			<ChartGrid>
				<TimeseriesCard title="Signups per day" series={signups.daily} />
			</ChartGrid>
		</Section>
	);
}

function ActiveUsersSection({ data }: { data: AdminMetrics }) {
	const { activeUsers } = data;
	return (
		<Section title="Active users" note="Distinct users with session activity">
			<TileGrid>
				<MetricCard label="Last 24 hours" value={activeUsers.last24Hours} />
				<MetricCard label="Last 7 days" value={activeUsers.last7Days} />
				<MetricCard label="Last 30 days" value={activeUsers.last30Days} />
			</TileGrid>
		</Section>
	);
}

function GenerationsSection({ data }: { data: AdminMetrics }) {
	const { generations } = data;
	const totals = generations.daily.reduce(
		(acc, p) => ({
			started: acc.started + p.started,
			succeeded: acc.succeeded + p.succeeded,
			failed: acc.failed + p.failed,
		}),
		{ started: 0, succeeded: 0, failed: 0 },
	);
	const finished = totals.succeeded + totals.failed;
	const successRate = finished > 0 ? `${Math.round((totals.succeeded / finished) * 1000) / 10}%` : "–";

	return (
		<Section title="Route generations" note="Attempts from Umami ProductEvents; saves from Postgres">
			{generations.productEventsAvailable ? (
				<>
					<TileGrid>
						<MetricCard label="Attempts" value={totals.started} hint={`Last ${data.days} days`} />
						<MetricCard label="Succeeded" value={totals.succeeded} />
						<MetricCard label="Failed" value={totals.failed} hint="Includes quota hits" />
						<MetricCard label="Success rate" value={successRate} hint="Succeeded / (succeeded + failed)" />
					</TileGrid>
					<ChartGrid>
						<TimeseriesCard
							title="Generation attempts per day"
							series={generations.daily.map((p) => ({ date: p.date, count: p.started }))}
						/>
						<TimeseriesCard title="Generated routes saved per day" series={generations.savedDaily} />
					</ChartGrid>
				</>
			) : (
				<>
					<Notice>
						Generation attempts come from Umami, which is not configured or could not be reached. Set UMAMI_DATABASE_URL
						and UMAMI_WEBSITE_ID to see them. Saved generated routes are still shown.
					</Notice>
					<ChartGrid>
						<TimeseriesCard title="Generated routes saved per day" series={generations.savedDaily} />
					</ChartGrid>
				</>
			)}
		</Section>
	);
}

function PayingUsersSection({ data }: { data: AdminMetrics }) {
	const { payingUsers } = data;
	return (
		<Section title="Paying users" note="Postgres">
			{!payingUsers.billingEnabled && (
				<Notice>Billing is off (BILLING_ENABLED), so no new payments can come in.</Notice>
			)}
			<TileGrid>
				<MetricCard label="Paying now" value={payingUsers.active} hint="Unexpired paid Pro pass" />
				<MetricCard label="Ever paid" value={payingUsers.everPaid} />
				<MetricCard label="Pro users" value={payingUsers.proUsers} hint="Paid, OG grant or admin" />
			</TileGrid>
			<ChartGrid>
				<TimeseriesCard title="Payments per day" series={payingUsers.paymentsDaily} />
			</ChartGrid>
		</Section>
	);
}

function ProSection({ data }: { data: AdminMetrics }) {
	const { pro, payingUsers } = data;
	const proNow = pro.proUsersDaily.at(-1)?.count ?? 0;
	const purchases = payingUsers.paymentsDaily.reduce((acc, p) => acc + p.count, 0);
	const primary = pro.revenueTotals.find((t) => t.currency === pro.currency);
	const others = pro.revenueTotals.filter((t) => t.currency !== pro.currency);
	const money = (amount: number) => formatMoney(amount, pro.currency);
	return (
		<Section title="Pro" note="Postgres: Entitlements and Payments">
			<TileGrid>
				<MetricCard label="Pro users now" value={proNow} hint="Paid, OG grant or admin" />
				<MetricCard label="Purchases" value={purchases} hint={`Last ${data.days} days`} />
				<MetricCard
					label="Revenue"
					value={primary ? money(primary.amount) : "–"}
					hint={
						others.length
							? `Plus ${others.map((t) => formatMoney(t.amount, t.currency)).join(", ")}`
							: `Last ${data.days} days, VAT incl.`
					}
				/>
				<MetricCard label="Pro ending" value={pro.endingSoon.count} hint="In the next 30 days" />
			</TileGrid>
			<ChartGrid>
				<TimeseriesCard title="Pro users per day (approximate)" series={pro.proUsersDaily} summary={`${proNow} now`} />
				<TimeseriesCard title="Pro purchases per day" series={payingUsers.paymentsDaily} />
				<TimeseriesCard
					title={`Revenue per day${pro.currency ? ` (${pro.currency.toUpperCase()})` : ""}`}
					series={pro.revenueDaily.map((p) => ({ date: p.date, count: p.amount }))}
					format={money}
				/>
			</ChartGrid>
			<div style={{ marginTop: 8, fontSize: 12, color: RDS_COLORS.fgSubtle }}>
				Pro users per day is reconstructed from the current Entitlement rows, which keep only their latest grant. A User
				granted Pro again after a lapse or revocation also counts on the days in between, so past days can over-count.
			</div>
		</Section>
	);
}

function LimitsSection({ data }: { data: AdminMetrics }) {
	const { limits } = data.pro;
	return (
		<Section title="Free limits" note="Umami ProductEvents, matched to Payments">
			{limits.productEventsAvailable ? (
				<>
					{limits.conversion && (
						<TileGrid>
							<MetricCard
								label="Hit a limit"
								value={limits.conversion.hitUsers}
								hint={`Free users, last ${data.days} days`}
							/>
							<MetricCard
								label="Bought Pro"
								value={limits.conversion.converted}
								hint="Within 7 days of their first hit"
							/>
							<MetricCard
								label="Conversion"
								value={`${limits.conversion.conversionPct}%`}
								hint="Bought / hit a limit"
							/>
							<MetricCard
								label="Still deciding"
								value={limits.conversion.pending}
								hint="Hit under 7 days ago, not bought yet"
							/>
						</TileGrid>
					)}
					<ChartGrid>
						<TimeseriesCard
							title="Free users at the 5 saved routes cap per day"
							series={limits.daily.map((p) => ({ date: p.date, count: p.savedRoutes }))}
						/>
						<TimeseriesCard
							title="Free users at the daily generation quota per day"
							series={limits.daily.map((p) => ({ date: p.date, count: p.generationQuota }))}
						/>
					</ChartGrid>
				</>
			) : (
				<Notice>
					Limit hits come from Umami (saved_route_limit_hit and generation_quota_hit ProductEvents), which is not
					configured or could not be reached. Set UMAMI_DATABASE_URL and UMAMI_WEBSITE_ID to see them.
				</Notice>
			)}
		</Section>
	);
}

function ProEndingSection({ data }: { data: AdminMetrics }) {
	const { endingSoon } = data.pro;
	return (
		<Section title={`Pro ending in the next 30 days (${endingSoon.count})`}>
			<div style={{ marginTop: 12 }}>
				<Card padding={0}>
					<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
						<thead>
							<tr style={{ background: RDS_COLORS.bgPanelElev }}>
								<Th>User</Th>
								<Th>Plan</Th>
								<Th>Pro until</Th>
							</tr>
						</thead>
						<tbody>
							{endingSoon.users.length === 0 && (
								<tr>
									<td colSpan={3} style={{ padding: "24px 16px", textAlign: "center", color: RDS_COLORS.fgSubtle }}>
										No Pro ends in the next 30 days.
									</td>
								</tr>
							)}
							{endingSoon.users.map((u, idx) => (
								<tr key={u.id} style={{ borderTop: idx === 0 ? "none" : `1px solid ${RDS_COLORS.border}` }}>
									<Td>
										<Link
											to="/admin/users/$userId"
											params={{ userId: u.id.toString() }}
											style={{ color: RDS_COLORS.fg, fontWeight: 500, textDecoration: "none" }}
										>
											{u.email}
										</Link>
									</Td>
									<Td>
										<PlanBadge plan={u} />
									</Td>
									<Td muted>{formatDate(u.proUntil)}</Td>
								</tr>
							))}
						</tbody>
					</table>
				</Card>
			</div>
			{endingSoon.count > endingSoon.users.length && (
				<div style={{ marginTop: 8, fontSize: 12, color: RDS_COLORS.fgSubtle }}>
					Showing the {endingSoon.users.length} soonest.
				</div>
			)}
		</Section>
	);
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
	return (
		<section style={{ marginTop: 28 }}>
			<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
				<SecTitle>{title}</SecTitle>
				{note && <span style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{note}</span>}
			</div>
			{children}
		</section>
	);
}

function TileGrid({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
				gap: 14,
				marginTop: 12,
			}}
		>
			{children}
		</div>
	);
}

function ChartGrid({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))",
				gap: 14,
				marginTop: 14,
			}}
		>
			{children}
		</div>
	);
}

function Notice({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				marginTop: 12,
				padding: "10px 14px",
				borderRadius: 10,
				background: RDS_COLORS.bgPanel,
				border: `1px dashed ${RDS_COLORS.border}`,
				color: RDS_COLORS.fgMuted,
				fontSize: 12.5,
			}}
		>
			{children}
		</div>
	);
}
