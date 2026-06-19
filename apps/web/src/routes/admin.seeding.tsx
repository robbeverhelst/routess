import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import { I } from "@/components/icons";
import { Badge, Btn, RDS_COLORS } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { Card, PageError, PageHeader, PageSkeleton } from "./admin.index";
import { formatDate } from "./admin.users.index";

export const Route = createFileRoute("/admin/seeding")({
	component: AdminSeedingPage,
});

// Seeded route inventory per SeedSource (ADR 0035): counts, last sync, and
// the projected next automatic sync. Manual sources show "manual".
function AdminSeedingPage() {
	const queryClient = useQueryClient();
	const q = useQuery({
		queryKey: ["admin", "stats", "seed-sources"],
		queryFn: () => apiService.adminGetSeedSources(),
		staleTime: 30_000,
	});

	const resync = useMutation({
		mutationFn: (key: string) => apiService.adminRefreshSeedSource(key),
		onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin", "stats", "seed-sources"] }),
	});

	if (q.isLoading) return <PageSkeleton title="Seeding" />;
	if (q.isError) return <PageError title="Seeding" error={q.error} />;
	const items = q.data?.items ?? [];

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
			<PageHeader
				title="Seeding"
				subtitle="ExternalRoute inventory per SeedSource: counts, licenses, and sync schedule."
			/>
			{items.length === 0 ? (
				<Card>
					<div style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>
						No SeedSources registered yet. Run a seed script (e.g. <code>bun run seed:eurovelo</code>) to create one.
					</div>
				</Card>
			) : (
				<Card padding={0}>
					<div style={{ width: "100%", overflowX: "auto" }}>
						<table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 13 }}>
							<thead>
								<tr style={{ background: RDS_COLORS.bgPanelElev }}>
									<Th>Source</Th>
									<Th>License</Th>
									<Th>Status</Th>
									<Th align="right">Routes</Th>
									<Th align="right">Removed</Th>
									<Th>Last sync</Th>
									<Th>Last result</Th>
									<Th>Next sync</Th>
									<Th align="right">Actions</Th>
								</tr>
							</thead>
							<tbody>
								{items.map((source, idx) => (
									<tr key={source.key} style={{ borderTop: idx === 0 ? "none" : `1px solid ${RDS_COLORS.border}` }}>
										<Td>
											<span style={{ color: RDS_COLORS.fg, fontWeight: 500 }}>{source.displayName}</span>
											<span style={{ color: RDS_COLORS.fgSubtle, marginLeft: 8, fontSize: 11.5 }}>{source.key}</span>
										</Td>
										<Td muted>{source.license}</Td>
										<Td>
											<Badge variant={source.status === "green" ? "accent" : "default"}>{source.status}</Badge>
										</Td>
										<Td align="right">{source.routeCount}</Td>
										<Td align="right" muted>
											{source.removedCount}
										</Td>
										<Td muted>{source.lastRefreshedAt ? formatDate(source.lastRefreshedAt) : "never"}</Td>
										<Td muted>
											{source.lastRefreshError ? (
												<span title={source.lastRefreshError}>
													<Badge variant="default" dot>
														failed
													</Badge>
												</span>
											) : source.lastRefreshStats ? (
												`+${source.lastRefreshStats.inserted} ~${source.lastRefreshStats.updated} −${source.lastRefreshStats.removed}`
											) : (
												"—"
											)}
										</Td>
										<Td muted>
											{source.automatic
												? source.nextRefreshAt
													? `${formatDate(source.nextRefreshAt)} (every ${source.refreshIntervalDays}d)`
													: "on next run"
												: "manual"}
										</Td>
										<Td align="right">
											{source.automatic && (
												<Btn
													variant="default"
													onClick={() => resync.mutate(source.key)}
													disabled={resync.isPending && resync.variables === source.key}
													style={{ height: 28, padding: "0 10px", fontSize: 12 }}
												>
													<I.refresh size={13} />
													{resync.isPending && resync.variables === source.key ? "Syncing…" : "Re-sync"}
												</Btn>
											)}
										</Td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>
			)}
		</div>
	);
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
	return (
		<th
			style={{
				textAlign: align ?? "left",
				padding: "10px 14px",
				fontSize: 11.5,
				fontWeight: 600,
				color: RDS_COLORS.fgSubtle,
				textTransform: "uppercase",
				letterSpacing: 0.4,
			}}
		>
			{children}
		</th>
	);
}

function Td({ children, muted, align }: { children: React.ReactNode; muted?: boolean; align?: "right" }) {
	return (
		<td
			style={{
				padding: "10px 14px",
				textAlign: align ?? "left",
				color: muted ? RDS_COLORS.fgMuted : RDS_COLORS.fg,
				whiteSpace: "nowrap",
			}}
		>
			{children}
		</td>
	);
}
