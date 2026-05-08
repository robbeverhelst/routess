import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { I } from "@/components/icons";
import { Badge, RDS_COLORS, SecTitle } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { Card, PageError, PageHeader, PageSkeleton } from "./admin.index";

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
		<div>
			<PageHeader eyebrow="Admin" title="System" subtitle="Health, configuration, and operational dashboards." />

			<section style={{ marginTop: 28 }}>
				<SecTitle style={{ marginBottom: 10 }}>Health</SecTitle>
				<Card>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
							gap: 16,
						}}
					>
						<KV label="Status" value={<StatusBadge status={health.status} />} />
						<KV label="Version" value={<span style={{ fontFamily: "monospace" }}>{health.version}</span>} />
						<KV label="Environment" value={health.nodeEnv} />
						<KV label="Uptime" value={formatDuration(health.uptimeSeconds)} />
						<KV
							label="Database"
							value={
								<Badge variant={health.databaseReachable ? "success" : "warn"} dot>
									{health.databaseReachable ? "reachable" : "unreachable"}
								</Badge>
							}
						/>
					</div>
				</Card>
			</section>

			<section style={{ marginTop: 22 }}>
				<SecTitle style={{ marginBottom: 10 }}>Configuration</SecTitle>
				<Card>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
							gap: 16,
						}}
					>
						<KV
							label="Telemetry"
							value={
								<Badge variant={config.telemetryEnabled ? "success" : "default"} dot>
									{config.telemetryEnabled ? "enabled" : "disabled"}
								</Badge>
							}
						/>
						<KV
							label="Metrics endpoint"
							value={
								<Badge variant={config.metricsEnabled ? "success" : "default"} dot>
									{config.metricsEnabled ? "enabled" : "disabled"}
								</Badge>
							}
						/>
						<KV
							label="OTLP traces"
							value={
								<Badge variant={config.otlpExportConfigured ? "success" : "default"} dot>
									{config.otlpExportConfigured ? "configured" : "off"}
								</Badge>
							}
						/>
						<KV label="Admin emails" value={`${config.adminEmailsCount} configured`} />
					</div>
				</Card>
			</section>

			<section style={{ marginTop: 22 }}>
				<SecTitle style={{ marginBottom: 10 }}>Dashboards</SecTitle>
				<Card>
					{grafanaEntries.length === 0 ? (
						<div style={{ fontSize: 13, color: RDS_COLORS.fgMuted, lineHeight: 1.55 }}>
							Set{" "}
							<code
								style={{
									background: RDS_COLORS.bgInput,
									padding: "1px 6px",
									borderRadius: 4,
									fontSize: 12,
								}}
							>
								monitoring.grafanaUrls.*
							</code>{" "}
							in your Helm values to surface Grafana dashboards here.
						</div>
					) : (
						<ul
							style={{
								margin: 0,
								padding: 0,
								listStyle: "none",
								display: "flex",
								flexDirection: "column",
								gap: 8,
							}}
						>
							{grafanaEntries.map(([key, url]) => (
								<li key={key}>
									<a
										href={url}
										target="_blank"
										rel="noreferrer"
										style={{
											display: "inline-flex",
											alignItems: "center",
											gap: 8,
											fontSize: 13,
											color: RDS_COLORS.accent,
											textDecoration: "none",
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.textDecoration = "underline";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.textDecoration = "none";
										}}
									>
										<I.trend size={14} />
										{prettify(key)}
										<I.chevronR size={12} />
									</a>
								</li>
							))}
						</ul>
					)}
				</Card>
			</section>

			<section style={{ marginTop: 22 }}>
				<SecTitle style={{ marginBottom: 10 }}>Errors</SecTitle>
				<div
					role="note"
					style={{
						display: "flex",
						alignItems: "flex-start",
						gap: 10,
						padding: "12px 14px",
						background: `color-mix(in oklch, ${RDS_COLORS.warn} 14%, transparent)`,
						color: RDS_COLORS.warn,
						border: `1px solid color-mix(in oklch, ${RDS_COLORS.warn} 35%, transparent)`,
						borderRadius: 10,
						fontSize: 12.5,
						lineHeight: 1.5,
					}}
				>
					<span
						aria-hidden="true"
						style={{
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							width: 18,
							height: 18,
							borderRadius: 999,
							background: "currentColor",
							color: RDS_COLORS.bgPanel,
							fontSize: 11,
							fontWeight: 700,
							flexShrink: 0,
							marginTop: 1,
						}}
					>
						!
					</span>
					<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
						<div style={{ fontWeight: 600 }}>Error reporting not yet configured</div>
						<div style={{ color: RDS_COLORS.fgMuted, fontWeight: 400 }}>
							Tracked as a follow-up issue. For now, errors live in the API logs (Pino) and the app console (frontend
							Logger).
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}

function KV({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div>
			<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{label}</div>
			<div style={{ marginTop: 4, fontSize: 13, color: RDS_COLORS.fg }}>{value}</div>
		</div>
	);
}

function StatusBadge({ status }: { status: "ok" | "degraded" | "down" }) {
	const variant = status === "ok" ? "success" : status === "degraded" ? "warn" : "default";
	return (
		<Badge variant={variant} dot>
			{status}
		</Badge>
	);
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
