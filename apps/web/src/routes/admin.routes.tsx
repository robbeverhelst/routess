import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { apiService } from "@/lib/api";
import { MetricCard, PageError, PageSkeleton, TimeseriesCard } from "./admin.index";

export const Route = createFileRoute("/admin/routes")({
	component: AdminRoutesPage,
});

function AdminRoutesPage() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["admin", "stats", "routes"],
		queryFn: () => apiService.adminGetRouteStats(),
		staleTime: 30_000,
	});

	if (isLoading) return <PageSkeleton title="Routes" />;
	if (error || !data) return <PageError title="Routes" error={error} />;

	return (
		<div>
			<h1 className="mb-6 text-2xl font-semibold">Routes</h1>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<MetricCard label="Total routes" value={data.totalRoutes} />
				{data.byActivity.slice(0, 3).map((entry) => (
					<MetricCard
						key={entry.activity ?? "unspecified"}
						label={entry.activity ? `${entry.activity} routes` : "unspecified activity"}
						value={entry.count}
					/>
				))}
			</div>

			<div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
				<TimeseriesCard title="Routes created (last 30 days)" series={data.createdLast30Days} />
				<div className="rounded-lg border border-neutral-200 bg-white p-4">
					<div className="mb-3 text-sm font-medium text-neutral-700">By activity</div>
					{data.byActivity.length === 0 && <div className="text-sm text-neutral-500">No routes yet.</div>}
					{data.byActivity.map((entry) => (
						<div key={entry.activity ?? "_"} className="flex items-center justify-between py-1.5 text-sm">
							<span className="text-neutral-700">{entry.activity ?? "(unspecified)"}</span>
							<span className="font-medium text-neutral-900">{entry.count}</span>
						</div>
					))}
				</div>
			</div>

			<div className="mt-8 rounded-lg border border-neutral-200 bg-white p-4">
				<div className="mb-3 text-sm font-medium text-neutral-700">Top creators</div>
				<table className="w-full text-sm">
					<thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
						<tr>
							<th className="py-2">Email</th>
							<th className="py-2">Name</th>
							<th className="py-2 text-right">Routes</th>
						</tr>
					</thead>
					<tbody>
						{data.topCreators.length === 0 && (
							<tr>
								<td colSpan={3} className="py-4 text-center text-neutral-500">
									No data yet.
								</td>
							</tr>
						)}
						{data.topCreators.map((creator) => (
							<tr key={creator.userId} className="border-t border-neutral-100">
								<td className="py-2">
									<Link
										to="/admin/users/$userId"
										params={{ userId: creator.userId.toString() }}
										className="text-neutral-900 hover:underline"
									>
										{creator.email}
									</Link>
								</td>
								<td className="py-2 text-neutral-700">{creator.name}</td>
								<td className="py-2 text-right font-medium text-neutral-900">{creator.routeCount}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
