import type { AdminMetrics } from "@routess/api-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RDS_COLORS, SecTitle } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { MetricCard, PageError, PageHeader, PageSkeleton, TimeseriesCard } from "./admin.index";

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
				<MetricCard label="Pro users" value={payingUsers.proUsers} hint="Paid, OG grant or manual" />
			</TileGrid>
			<ChartGrid>
				<TimeseriesCard title="Payments per day" series={payingUsers.paymentsDaily} />
			</ChartGrid>
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
