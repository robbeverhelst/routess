import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { apiService } from "@/lib/api";
import { PageError, PageSkeleton } from "./admin.index";

export const Route = createFileRoute("/admin/system")({
	component: AdminSystemPage,
});

function AdminSystemPage() {
	const healthQ = useQuery({
		queryKey: ["admin", "system", "health"],
		queryFn: () => apiService.adminGetSystemHealth(),
		refetchInterval: 30_000,
	});
	const configQ = useQuery({
		queryKey: ["admin", "system", "config"],
		queryFn: () => apiService.adminGetConfigSummary(),
		staleTime: 5 * 60 * 1000,
	});

	if (healthQ.isLoading || configQ.isLoading) return <PageSkeleton title="System" />;
	if (healthQ.error || !healthQ.data) return <PageError title="System" error={healthQ.error} />;
	if (configQ.error || !configQ.data) return <PageError title="System" error={configQ.error} />;

	const health = healthQ.data;
	const config = configQ.data;
	const grafanaEntries = Object.entries(config.grafanaUrls).filter(([, url]) => Boolean(url));

	return (
		<div className="max-w-4xl">
			<h1 className="mb-6 text-2xl font-semibold">System</h1>

			<section className="mb-8">
				<h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Health</h2>
				<div className="grid grid-cols-2 gap-4 rounded-lg border border-neutral-200 bg-white p-4 text-sm sm:grid-cols-4">
					<KV label="Status" value={<StatusPill status={health.status} />} />
					<KV label="Version" value={health.version} />
					<KV label="Environment" value={health.nodeEnv} />
					<KV label="Uptime" value={formatDuration(health.uptimeSeconds)} />
					<KV label="Database" value={health.databaseReachable ? "reachable" : "unreachable"} />
				</div>
			</section>

			<section className="mb-8">
				<h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Configuration</h2>
				<div className="grid grid-cols-2 gap-4 rounded-lg border border-neutral-200 bg-white p-4 text-sm sm:grid-cols-3">
					<KV label="Telemetry" value={config.telemetryEnabled ? "enabled" : "disabled"} />
					<KV label="Metrics endpoint" value={config.metricsEnabled ? "enabled" : "disabled"} />
					<KV label="OTLP traces" value={config.otlpExportConfigured ? "configured" : "off"} />
					<KV label="Admin emails" value={`${config.adminEmailsCount} configured`} />
				</div>
			</section>

			<section className="mb-8">
				<h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Dashboards</h2>
				<div className="rounded-lg border border-neutral-200 bg-white p-4">
					{grafanaEntries.length === 0 ? (
						<p className="text-sm text-neutral-600">
							Set <code className="rounded bg-neutral-100 px-1">monitoring.grafanaUrls.*</code> in your Helm values
							to surface Grafana dashboards here.
						</p>
					) : (
						<ul className="flex flex-col gap-2 text-sm">
							{grafanaEntries.map(([key, url]) => (
								<li key={key}>
									<a
										href={url}
										target="_blank"
										rel="noreferrer"
										className="text-blue-700 hover:underline"
									>
										{prettify(key)} ↗
									</a>
								</li>
							))}
						</ul>
					)}
				</div>
			</section>

			<section>
				<h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Errors</h2>
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
					Browser + API error reporting is not yet wired. Tracked as a follow-up issue. For now, errors live in the
					API logs (Pino) and the app console (frontend Logger).
				</div>
			</section>
		</div>
	);
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div>
			<div className="text-xs text-neutral-500">{label}</div>
			<div className="mt-0.5 text-neutral-900">{value}</div>
		</div>
	);
}

function StatusPill({ status }: { status: "ok" | "degraded" | "down" }) {
	const colour =
		status === "ok"
			? "bg-green-100 text-green-800"
			: status === "degraded"
				? "bg-amber-100 text-amber-800"
				: "bg-red-100 text-red-800";
	return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colour}`}>{status}</span>;
}

function formatDuration(seconds: number): string {
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${mins}m`;
	return `${mins}m`;
}

function prettify(key: string): string {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (c) => c.toUpperCase())
		.trim();
}
