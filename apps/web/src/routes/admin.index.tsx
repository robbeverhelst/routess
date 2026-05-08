import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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

	if (isLoading) return <PageSkeleton title="Overview" />;
	if (error || !data) return <PageError title="Overview" error={error} />;

	return (
		<div>
			<h1 className="mb-6 text-2xl font-semibold">Overview</h1>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<MetricCard label="Users" value={data.totalUsers} />
				<MetricCard label="Routes" value={data.totalRoutes} />
				<MetricCard label="Active sessions" value={data.activeSessions} />
				<MetricCard label="Signups today" value={data.signupsToday} />
			</div>
			<div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
				<TimeseriesCard title="Signups (last 30 days)" series={data.signupsLast30Days} />
				<TimeseriesCard title="Routes created (last 30 days)" series={data.routesCreatedLast30Days} />
			</div>
		</div>
	);
}

export function MetricCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
	return (
		<div className="rounded-lg border border-neutral-200 bg-white p-4">
			<div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
			<div className="mt-1 text-2xl font-semibold text-neutral-900">{value}</div>
			{hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
		</div>
	);
}

export function TimeseriesCard({ title, series }: { title: string; series: Array<{ date: string; count: number }> }) {
	const max = Math.max(1, ...series.map((p) => p.count));
	return (
		<div className="rounded-lg border border-neutral-200 bg-white p-4">
			<div className="mb-3 text-sm font-medium text-neutral-700">{title}</div>
			<div className="flex h-24 items-end gap-px">
				{series.map((point) => {
					const heightPct = (point.count / max) * 100;
					return (
						<div
							key={point.date}
							className="flex-1 bg-neutral-200 hover:bg-neutral-400"
							style={{ height: `${Math.max(2, heightPct)}%` }}
							title={`${point.date}: ${point.count}`}
						/>
					);
				})}
			</div>
			<div className="mt-2 flex justify-between text-[10px] text-neutral-400">
				<span>{series[0]?.date}</span>
				<span>{series.at(-1)?.date}</span>
			</div>
		</div>
	);
}

export function PageSkeleton({ title }: { title: string }) {
	return (
		<div>
			<h1 className="mb-6 text-2xl font-semibold">{title}</h1>
			<div className="text-sm text-neutral-500">Loading…</div>
		</div>
	);
}

export function PageError({ title, error }: { title: string; error: unknown }) {
	const message = error instanceof Error ? error.message : "Unknown error";
	return (
		<div>
			<h1 className="mb-6 text-2xl font-semibold">{title}</h1>
			<div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
				Failed to load: {message}
			</div>
		</div>
	);
}
