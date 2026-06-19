import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RDS_COLORS, SecTitle } from "@/components/primitives";
import { apiService } from "@/lib/api";

export const Route = createFileRoute("/admin/")({
	component: AdminOverviewPage,
});

function AdminOverviewPage() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["admin", "overview"],
		queryFn: () => apiService.adminGetOverview(),
		staleTime: 30_000,
	});
	const engagementQ = useQuery({
		queryKey: ["admin", "engagement"],
		queryFn: () => apiService.adminGetEngagement(),
		staleTime: 60_000,
	});

	if (isLoading) return <PageSkeleton title="Overview" />;
	if (error || !data) return <PageError title="Overview" error={error} />;

	const engagement = engagementQ.data;

	return (
		<div>
			<PageHeader eyebrow="Admin" title="Overview" subtitle="At-a-glance product and system health." />

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
					gap: 14,
					marginTop: 28,
				}}
			>
				<MetricCard label="Users" value={data.totalUsers} />
				<MetricCard label="Routes" value={data.totalRoutes} />
				<MetricCard label="Active sessions" value={data.activeSessions} />
				<MetricCard label="Signups today" value={data.signupsToday} />
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
					gap: 14,
					marginTop: 14,
				}}
			>
				<TimeseriesCard title="Signups, last 30 days" series={data.signupsLast30Days} />
				<TimeseriesCard title="Routes created, last 30 days" series={data.routesCreatedLast30Days} />
			</div>

			{engagement && (
				<section style={{ marginTop: 28 }}>
					<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
						<SecTitle>Engagement</SecTitle>
						<span style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>
							Postgres-derived. Behavioural funnels live in Umami (System tab).
						</span>
					</div>

					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
							gap: 14,
							marginTop: 12,
						}}
					>
						<MetricCard
							label="Made a route"
							value={`${engagement.signupToFirstRoute.conversionPct}%`}
							hint={`${engagement.signupToFirstRoute.usersWithRoute} of ${engagement.signupToFirstRoute.totalUsers} users`}
						/>
					</div>

					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
							gap: 14,
							marginTop: 14,
						}}
					>
						<DistributionCard title="Routes by distance" buckets={engagement.distanceDistribution} />
						<RegionsCard regions={engagement.topRegions} />
					</div>
				</section>
			)}
		</div>
	);
}

function DistributionCard({ title, buckets }: { title: string; buckets: Array<{ label: string; count: number }> }) {
	const max = Math.max(1, ...buckets.map((b) => b.count));
	return (
		<Card>
			<div style={{ fontSize: 13, fontWeight: 500, color: RDS_COLORS.fg, marginBottom: 14 }}>{title}</div>
			{buckets.length === 0 && <div style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>No routes yet.</div>}
			{buckets.map((bucket) => (
				<div key={bucket.label} style={{ marginBottom: 10 }}>
					<div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
						<span style={{ color: RDS_COLORS.fg }}>{bucket.label}</span>
						<span style={{ color: RDS_COLORS.fgMuted }}>{bucket.count}</span>
					</div>
					<div style={{ height: 6, background: RDS_COLORS.bgInput, borderRadius: 999, overflow: "hidden" }}>
						<div
							style={{
								width: `${(bucket.count / max) * 100}%`,
								height: "100%",
								background: RDS_COLORS.accent,
								borderRadius: 999,
							}}
						/>
					</div>
				</div>
			))}
		</Card>
	);
}

function RegionsCard({
	regions,
}: {
	regions: Array<{ city: string | null; region: string | null; countryCode: string | null; count: number }>;
}) {
	return (
		<Card>
			<div style={{ fontSize: 13, fontWeight: 500, color: RDS_COLORS.fg, marginBottom: 14 }}>Top regions</div>
			{regions.length === 0 && (
				<div style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>No place data derived yet.</div>
			)}
			{regions.map((r) => (
				<div
					key={`${r.city}-${r.region}-${r.countryCode}`}
					style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0" }}
				>
					<span style={{ color: RDS_COLORS.fg }}>
						{[r.city, r.region, r.countryCode].filter(Boolean).join(", ") || "(unknown)"}
					</span>
					<span style={{ color: RDS_COLORS.fgMuted }}>{r.count}</span>
				</div>
			))}
		</Card>
	);
}

export function PageHeader({
	eyebrow,
	title,
	subtitle,
	right,
}: {
	eyebrow?: string;
	title: string;
	subtitle?: string;
	right?: ReactNode;
}) {
	return (
		<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
			<div>
				{eyebrow && <SecTitle>{eyebrow}</SecTitle>}
				<h1
					style={{
						fontSize: 26,
						fontWeight: 600,
						margin: "4px 0 0",
						letterSpacing: -0.5,
						color: RDS_COLORS.fg,
					}}
				>
					{title}
				</h1>
				{subtitle && <div style={{ marginTop: 4, fontSize: 13.5, color: RDS_COLORS.fgMuted }}>{subtitle}</div>}
			</div>
			{right && <div style={{ flexShrink: 0 }}>{right}</div>}
		</div>
	);
}

export function Card({ children, padding = 20 }: { children: ReactNode; padding?: number }) {
	return (
		<div
			style={{
				background: RDS_COLORS.bgPanel,
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 12,
				padding,
			}}
		>
			{children}
		</div>
	);
}

export function MetricCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
	return (
		<Card padding={18}>
			<div
				style={{
					fontSize: 11,
					fontWeight: 600,
					textTransform: "uppercase",
					letterSpacing: "0.08em",
					color: RDS_COLORS.fgSubtle,
				}}
			>
				{label}
			</div>
			<div
				style={{
					marginTop: 6,
					fontSize: 26,
					fontWeight: 600,
					letterSpacing: -0.5,
					color: RDS_COLORS.fg,
				}}
			>
				{value}
			</div>
			{hint && <div style={{ marginTop: 4, fontSize: 12, color: RDS_COLORS.fgMuted }}>{hint}</div>}
		</Card>
	);
}

export function TimeseriesCard({ title, series }: { title: string; series: Array<{ date: string; count: number }> }) {
	const max = Math.max(1, ...series.map((p) => p.count));
	const total = series.reduce((acc, p) => acc + p.count, 0);
	return (
		<Card>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
				<div style={{ fontSize: 13, fontWeight: 500, color: RDS_COLORS.fg }}>{title}</div>
				<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{total} total</div>
			</div>
			<div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 84, marginTop: 14 }}>
				{series.map((point) => {
					const heightPct = (point.count / max) * 100;
					return (
						<div
							key={point.date}
							title={`${point.date}: ${point.count}`}
							style={{
								flex: 1,
								height: `${Math.max(3, heightPct)}%`,
								background:
									point.count > 0 ? `color-mix(in oklch, ${RDS_COLORS.accent} 65%, transparent)` : RDS_COLORS.border,
								borderRadius: 2,
							}}
						/>
					);
				})}
			</div>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					marginTop: 8,
					fontSize: 10.5,
					color: RDS_COLORS.fgSubtle,
				}}
			>
				<span>{series[0]?.date}</span>
				<span>{series.at(-1)?.date}</span>
			</div>
		</Card>
	);
}

export function PageSkeleton({ title }: { title: string }) {
	return (
		<div>
			<PageHeader eyebrow="Admin" title={title} />
			<div style={{ marginTop: 28, fontSize: 13, color: RDS_COLORS.fgMuted }}>Loading…</div>
		</div>
	);
}

export function PageError({ title, error }: { title: string; error: unknown }) {
	const message = error instanceof Error ? error.message : "Unknown error";
	return (
		<div>
			<PageHeader eyebrow="Admin" title={title} />
			<div
				style={{
					marginTop: 24,
					padding: 16,
					borderRadius: 10,
					background: `color-mix(in oklch, ${RDS_COLORS.danger} 10%, ${RDS_COLORS.bgPanel})`,
					border: `1px solid color-mix(in oklch, ${RDS_COLORS.danger} 35%, ${RDS_COLORS.border})`,
					color: RDS_COLORS.danger,
					fontSize: 13,
				}}
			>
				Failed to load: {message}
			</div>
		</div>
	);
}
