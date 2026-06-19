import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { I } from "@/components/icons";
import { Badge, Btn, RDS_COLORS, SecTitle } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { Card, MetricCard, PageError, PageHeader, PageSkeleton, TimeseriesCard } from "./admin.index";
import { formatDate } from "./admin.users.index";

export const Route = createFileRoute("/admin/routes/")({
	component: AdminRoutesPage,
});

function AdminRoutesPage() {
	const navigate = useNavigate();
	const [routesPage, setRoutesPage] = useState(1);
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [visibility, setVisibility] = useState<string[]>([]);
	const [problemsOnly, setProblemsOnly] = useState(false);
	const [deletedOnly, setDeletedOnly] = useState(false);
	const pageSize = 20;

	const statsQ = useQuery({
		queryKey: ["admin", "stats", "routes"],
		queryFn: () => apiService.adminGetRouteStats(),
		staleTime: 30_000,
	});
	const listQ = useQuery({
		queryKey: ["admin", "routes", { page: routesPage, pageSize, search, visibility, problemsOnly, deletedOnly }],
		queryFn: () =>
			apiService.adminListRoutes({
				page: routesPage,
				pageSize,
				search: search || undefined,
				visibility: visibility.length ? visibility : undefined,
				problemsOnly: problemsOnly || undefined,
				deletedOnly: deletedOnly || undefined,
			}),
		staleTime: 30_000,
	});

	const setVisibilityFilter = (value: string[]) => {
		setVisibility(value);
		setProblemsOnly(false);
		setDeletedOnly(false);
		setRoutesPage(1);
	};
	const toggleProblems = () => {
		setProblemsOnly((p) => !p);
		setDeletedOnly(false);
		setVisibility([]);
		setRoutesPage(1);
	};
	const toggleDeleted = () => {
		setDeletedOnly((d) => !d);
		setProblemsOnly(false);
		setVisibility([]);
		setRoutesPage(1);
	};

	if (statsQ.isLoading) return <PageSkeleton title="Routes" />;
	if (statsQ.error || !statsQ.data) return <PageError title="Routes" error={statsQ.error} />;

	const data = statsQ.data;
	const list = listQ.data;
	const totalActive = data.byActivity.reduce((acc, x) => acc + x.count, 0);
	const totalPages = list ? Math.max(1, Math.ceil(list.total / pageSize)) : 1;

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
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 12,
						marginBottom: 10,
						flexWrap: "wrap",
					}}
				>
					<SecTitle>All routes {list ? `(${list.total})` : ""}</SecTitle>
					<div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
						<FilterChip
							active={visibility.length === 0 && !problemsOnly && !deletedOnly}
							onClick={() => setVisibilityFilter([])}
						>
							All
						</FilterChip>
						<FilterChip active={visibility.length === 2} onClick={() => setVisibilityFilter(["public", "unlisted"])}>
							Exposed
						</FilterChip>
						<FilterChip
							active={visibility.length === 1 && visibility[0] === "public"}
							onClick={() => setVisibilityFilter(["public"])}
						>
							Public
						</FilterChip>
						<FilterChip
							active={visibility.length === 1 && visibility[0] === "unlisted"}
							onClick={() => setVisibilityFilter(["unlisted"])}
						>
							Unlisted
						</FilterChip>
						<FilterChip active={problemsOnly} danger onClick={toggleProblems}>
							Problems
						</FilterChip>
						<FilterChip active={deletedOnly} danger onClick={toggleDeleted}>
							Deleted
						</FilterChip>
					</div>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							setSearch(searchInput);
							setRoutesPage(1);
						}}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 8,
							padding: "0 10px",
							height: 32,
							minWidth: 240,
						}}
					>
						<I.search size={13} />
						<input
							type="text"
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							placeholder="Search route name…"
							style={{
								flex: 1,
								border: 0,
								outline: 0,
								background: "transparent",
								color: RDS_COLORS.fg,
								fontSize: 12.5,
							}}
						/>
						{searchInput && (
							<button
								type="button"
								onClick={() => {
									setSearchInput("");
									setSearch("");
									setRoutesPage(1);
								}}
								style={{
									border: 0,
									background: "transparent",
									color: RDS_COLORS.fgSubtle,
									cursor: "pointer",
									padding: 0,
									display: "inline-flex",
								}}
								aria-label="Clear"
							>
								<I.close size={13} />
							</button>
						)}
					</form>
				</div>
				<Card padding={0}>
					<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
						<thead>
							<tr style={{ background: RDS_COLORS.bgPanelElev }}>
								<Th>Name</Th>
								<Th>Activity</Th>
								<Th>Visibility</Th>
								<Th align="right">Distance</Th>
								<Th>Owner</Th>
								<Th>Created</Th>
							</tr>
						</thead>
						<tbody>
							{!list && (
								<tr>
									<td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: RDS_COLORS.fgSubtle }}>
										Loading…
									</td>
								</tr>
							)}
							{list && list.items.length === 0 && (
								<tr>
									<td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: RDS_COLORS.fgSubtle }}>
										No routes match.
									</td>
								</tr>
							)}
							{list?.items.map((route, idx) => (
								<tr
									key={route.id}
									style={{
										borderTop: idx === 0 ? "none" : `1px solid ${RDS_COLORS.border}`,
										cursor: "pointer",
									}}
									onClick={() =>
										navigate({
											to: "/admin/routes/$routeId",
											params: { routeId: route.id.toString() },
										})
									}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = RDS_COLORS.bgHover;
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "transparent";
									}}
								>
									<Td>
										<span style={{ color: RDS_COLORS.fg, fontWeight: 500 }}>{route.name}</span>
									</Td>
									<Td muted>{route.activity ?? "—"}</Td>
									<Td>
										<Badge variant={route.visibility === "public" ? "accent" : "default"}>{route.visibility}</Badge>
									</Td>
									<Td muted align="right">
										{formatDistance(route.distance)}
									</Td>
									<Td muted>
										<Link
											to="/admin/users/$userId"
											params={{ userId: route.owner.id.toString() }}
											onClick={(e) => e.stopPropagation()}
											style={{ color: RDS_COLORS.fgMuted, textDecoration: "none" }}
										>
											{route.owner.email}
										</Link>
									</Td>
									<Td muted>{formatDate(route.createdAt)}</Td>
								</tr>
							))}
						</tbody>
					</table>
				</Card>
				{list && list.total > pageSize && (
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginTop: 14,
							fontSize: 12.5,
							color: RDS_COLORS.fgSubtle,
						}}
					>
						<span>
							Page {list.page} of {totalPages}
						</span>
						<div style={{ display: "flex", gap: 8 }}>
							<Btn
								variant="default"
								disabled={routesPage <= 1}
								onClick={() => setRoutesPage((p) => Math.max(1, p - 1))}
								style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}
							>
								<I.chevronL size={14} /> Previous
							</Btn>
							<Btn
								variant="default"
								disabled={routesPage >= totalPages}
								onClick={() => setRoutesPage((p) => Math.min(totalPages, p + 1))}
								style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}
							>
								Next <I.chevronR size={14} />
							</Btn>
						</div>
					</div>
				)}
			</section>

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
										cursor: "pointer",
									}}
									onClick={() =>
										navigate({
											to: "/admin/users/$userId",
											params: { userId: creator.userId.toString() },
										})
									}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = RDS_COLORS.bgHover;
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "transparent";
									}}
								>
									<Td>
										<span style={{ color: RDS_COLORS.fg, fontWeight: 500 }}>{creator.email}</span>
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

function FilterChip({
	children,
	active,
	danger,
	onClick,
}: {
	children: React.ReactNode;
	active: boolean;
	danger?: boolean;
	onClick: () => void;
}) {
	const accent = danger ? RDS_COLORS.danger : RDS_COLORS.accent;
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				height: 28,
				padding: "0 10px",
				fontSize: 12,
				cursor: "pointer",
				borderRadius: 999,
				border: `1px solid ${active ? accent : RDS_COLORS.border}`,
				background: active ? `color-mix(in oklch, ${accent} 16%, transparent)` : "transparent",
				color: active ? accent : RDS_COLORS.fgMuted,
			}}
		>
			{children}
		</button>
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

export function formatDistance(meters: number | null): string {
	if (meters == null) return "—";
	if (meters < 1000) return `${Math.round(meters)} m`;
	return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`;
}

export function formatDuration(seconds: number | null): string {
	if (seconds == null) return "—";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

export function formatElevation(meters: number | null): string {
	if (meters == null) return "—";
	return `${Math.round(meters)} m`;
}
