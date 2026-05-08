import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { I } from "@/components/icons";
import { Badge, Btn, RDS_COLORS } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { Card, PageError, PageHeader, PageSkeleton } from "./admin.index";

export const Route = createFileRoute("/admin/users/")({
	component: AdminUsersPage,
});

function AdminUsersPage() {
	const navigate = useNavigate();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const pageSize = 20;

	const { data, isLoading, error } = useQuery({
		queryKey: ["admin", "users", { page, pageSize, search }],
		queryFn: () => apiService.adminListUsers({ page, pageSize, search: search || undefined }),
		staleTime: 30_000,
	});

	if (isLoading) return <PageSkeleton title="Users" />;
	if (error || !data) return <PageError title="Users" error={error} />;

	const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

	return (
		<div>
			<PageHeader
				eyebrow="Admin"
				title={`Users (${data.total})`}
				subtitle="Search, drill in, and manage individual users."
				right={
					<form
						onSubmit={(e) => {
							e.preventDefault();
							setSearch(searchInput);
							setPage(1);
						}}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 8,
							padding: "0 10px",
							height: 36,
							minWidth: 280,
						}}
					>
						<I.search size={14} />
						<input
							type="text"
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							placeholder="Search email or name…"
							style={{
								flex: 1,
								border: 0,
								outline: 0,
								background: "transparent",
								color: RDS_COLORS.fg,
								fontSize: 13,
							}}
						/>
						{searchInput && (
							<button
								type="button"
								onClick={() => {
									setSearchInput("");
									setSearch("");
									setPage(1);
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
								<I.close size={14} />
							</button>
						)}
					</form>
				}
			/>

			<div style={{ marginTop: 22 }}>
				<Card padding={0}>
					<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
						<thead>
							<tr style={{ background: RDS_COLORS.bgPanelElev }}>
								<HeaderCell>Email</HeaderCell>
								<HeaderCell>Name</HeaderCell>
								<HeaderCell>Role</HeaderCell>
								<HeaderCell align="right">Routes</HeaderCell>
								<HeaderCell>Joined</HeaderCell>
								<HeaderCell>Last active</HeaderCell>
							</tr>
						</thead>
						<tbody>
							{data.items.length === 0 && (
								<tr>
									<td
										colSpan={6}
										style={{
											padding: "32px 18px",
											textAlign: "center",
											color: RDS_COLORS.fgSubtle,
											fontSize: 13,
										}}
									>
										No users match.
									</td>
								</tr>
							)}
							{data.items.map((user, idx) => (
								<tr
									key={user.id}
									style={{
										borderTop: idx === 0 ? "none" : `1px solid ${RDS_COLORS.border}`,
										cursor: "pointer",
									}}
									onClick={() => navigate({ to: "/admin/users/$userId", params: { userId: user.id.toString() } })}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = RDS_COLORS.bgHover;
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "transparent";
									}}
								>
									<Cell>
										<span style={{ color: RDS_COLORS.fg, fontWeight: 500 }}>{user.email}</span>
									</Cell>
									<Cell muted>{user.name}</Cell>
									<Cell>
										<Badge variant={user.role === "admin" ? "accent" : "default"}>{user.role}</Badge>
									</Cell>
									<Cell align="right" muted>
										{user.routeCount}
									</Cell>
									<Cell muted>{formatDate(user.createdAt)}</Cell>
									<Cell muted>{user.lastActiveAt ? formatRelative(user.lastActiveAt) : "—"}</Cell>
								</tr>
							))}
						</tbody>
					</table>
				</Card>
			</div>

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
					Page {data.page} of {totalPages}
				</span>
				<div style={{ display: "flex", gap: 8 }}>
					<Btn
						variant="default"
						disabled={page <= 1}
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}
					>
						<I.chevronL size={14} /> Previous
					</Btn>
					<Btn
						variant="default"
						disabled={page >= totalPages}
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}
					>
						Next <I.chevronR size={14} />
					</Btn>
				</div>
			</div>
		</div>
	);
}

function HeaderCell({ children, align }: { children: React.ReactNode; align?: "right" }) {
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

function Cell({ children, muted, align }: { children: React.ReactNode; muted?: boolean; align?: "right" }) {
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

export function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString();
}

export function formatRelative(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const minutes = Math.floor(diffMs / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(iso).toLocaleDateString();
}
