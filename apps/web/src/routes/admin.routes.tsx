import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RDS_COLORS, SecTitle } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { Card, MetricCard, PageError, PageHeader, PageSkeleton, TimeseriesCard } from "./admin.index";

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

	const totalActive = data.byActivity.reduce((acc, x) => acc + x.count, 0);

	return (
		<div>
			<PageHeader eyebrow="Admin" title="Routes" subtitle="What people are creating, by whom, and when." />

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
					gap: 14,
					marginTop: 28,
				}}
			>
				<MetricCard label="Total" value={data.totalRoutes} />
				{data.byActivity.slice(0, 3).map((entry) => (
					<MetricCard
						key={entry.activity ?? "unspecified"}
						label={entry.activity ? entry.activity : "unspecified"}
						value={entry.count}
					/>
				))}
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
					gap: 14,
					marginTop: 14,
				}}
			>
				<TimeseriesCard title="Routes created, last 30 days" series={data.createdLast30Days} />
				<Card>
					<div
						style={{
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							marginBottom: 14,
						}}
					>
						<div style={{ fontSize: 13, fontWeight: 500, color: RDS_COLORS.fg }}>By activity</div>
						<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{totalActive} routes</div>
					</div>
					{data.byActivity.length === 0 && (
						<div style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>No routes yet.</div>
					)}
					{data.byActivity.map((entry) => {
						const pct = totalActive > 0 ? (entry.count / totalActive) * 100 : 0;
						return (
							<div key={entry.activity ?? "_"} style={{ marginBottom: 10 }}>
								<div
									style={{
										display: "flex",
										justifyContent: "space-between",
										fontSize: 12.5,
										marginBottom: 4,
									}}
								>
									<span style={{ color: RDS_COLORS.fg }}>{entry.activity ?? "(unspecified)"}</span>
									<span style={{ color: RDS_COLORS.fgMuted }}>{entry.count}</span>
								</div>
								<div
									style={{
										height: 6,
										background: RDS_COLORS.bgInput,
										borderRadius: 999,
										overflow: "hidden",
									}}
								>
									<div
										style={{
											width: `${pct}%`,
											height: "100%",
											background: RDS_COLORS.accent,
											borderRadius: 999,
										}}
									/>
								</div>
							</div>
						);
					})}
				</Card>
			</div>

			<section style={{ marginTop: 28 }}>
				<SecTitle style={{ marginBottom: 10 }}>Top creators</SecTitle>
				<Card padding={0}>
					<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
						<thead>
							<tr style={{ background: RDS_COLORS.bgPanelElev }}>
								<Th>Email</Th>
								<Th>Name</Th>
								<Th align="right">Routes</Th>
							</tr>
						</thead>
						<tbody>
							{data.topCreators.length === 0 && (
								<tr>
									<td
										colSpan={3}
										style={{
											padding: "24px 16px",
											textAlign: "center",
											color: RDS_COLORS.fgSubtle,
										}}
									>
										No data yet.
									</td>
								</tr>
							)}
							{data.topCreators.map((creator, idx) => (
								<tr
									key={creator.userId}
									style={{
										borderTop: idx === 0 ? "none" : `1px solid ${RDS_COLORS.border}`,
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = RDS_COLORS.bgHover;
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "transparent";
									}}
								>
									<Td>
										<Link
											to="/admin/users/$userId"
											params={{ userId: creator.userId.toString() }}
											style={{ color: RDS_COLORS.fg, textDecoration: "none", fontWeight: 500 }}
										>
											{creator.email}
										</Link>
									</Td>
									<Td muted>{creator.name}</Td>
									<Td muted align="right">
										<span style={{ fontWeight: 500, color: RDS_COLORS.fg }}>{creator.routeCount}</span>
									</Td>
								</tr>
							))}
						</tbody>
					</table>
				</Card>
			</section>
		</div>
	);
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
	return (
		<th
			style={{
				textAlign: align ?? "left",
				padding: "10px 16px",
				fontSize: 11,
				fontWeight: 600,
				textTransform: "uppercase",
				letterSpacing: "0.06em",
				color: RDS_COLORS.fgSubtle,
				borderBottom: `1px solid ${RDS_COLORS.border}`,
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
				padding: "12px 16px",
				color: muted ? RDS_COLORS.fgMuted : RDS_COLORS.fg,
				textAlign: align ?? "left",
				verticalAlign: "middle",
			}}
		>
			{children}
		</td>
	);
}
