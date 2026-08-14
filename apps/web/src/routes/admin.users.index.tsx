import type { AdminSortDir, AdminUserSort, ApiUserRole } from "@routess/api-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { I } from "@/components/icons";
import { Badge, Btn, RDS_COLORS } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { Card, FilterChip, PageError, PageHeader, PageSkeleton, SortTh, Td } from "./admin.index";

export const Route = createFileRoute("/admin/users/")({
	component: AdminUsersPage,
});

function AdminUsersPage() {
	const navigate = useNavigate();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [deletedOnly, setDeletedOnly] = useState(false);
	const [role, setRole] = useState<ApiUserRole | undefined>();
	const [verified, setVerified] = useState<boolean | undefined>();
	const [sort, setSort] = useState<AdminUserSort>("createdAt");
	const [dir, setDir] = useState<AdminSortDir>("desc");
	const pageSize = 20;

	const { data, isLoading, error } = useQuery({
		queryKey: ["admin", "users", { page, pageSize, search, deletedOnly, role, verified, sort, dir }],
		queryFn: () =>
			apiService.adminListUsers({
				page,
				pageSize,
				search: search || undefined,
				deletedOnly: deletedOnly || undefined,
				role,
				verified,
				sort,
				dir,
			}),
		staleTime: 30_000,
	});

	const onSort = (key: AdminUserSort, nextDir: AdminSortDir) => {
		setSort(key);
		setDir(nextDir);
		setPage(1);
	};
	const setRoleFilter = (value: ApiUserRole | undefined) => {
		setRole(value);
		setPage(1);
	};

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
					<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
					</div>
				}
			/>

			<div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 22 }}>
				<FilterChip
					active={role === undefined && verified === undefined && !deletedOnly}
					onClick={() => {
						setRole(undefined);
						setVerified(undefined);
						setDeletedOnly(false);
						setPage(1);
					}}
				>
					All
				</FilterChip>
				<FilterChip active={role === "admin"} onClick={() => setRoleFilter(role === "admin" ? undefined : "admin")}>
					Admins
				</FilterChip>
				<FilterChip active={role === "user"} onClick={() => setRoleFilter(role === "user" ? undefined : "user")}>
					Members
				</FilterChip>
				<FilterChip
					active={verified === false}
					onClick={() => {
						setVerified(verified === false ? undefined : false);
						setPage(1);
					}}
				>
					Unverified
				</FilterChip>
				<FilterChip
					active={deletedOnly}
					danger
					onClick={() => {
						setDeletedOnly((d) => !d);
						setPage(1);
					}}
				>
					Deleted
				</FilterChip>
			</div>

			<div style={{ marginTop: 12 }}>
				<Card padding={0}>
					<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
						<thead>
							<tr style={{ background: RDS_COLORS.bgPanelElev }}>
								<SortTh sortKey="email" sort={sort} dir={dir} onSort={onSort} defaultDir="asc">
									Email
								</SortTh>
								<SortTh sortKey="name" sort={sort} dir={dir} onSort={onSort} defaultDir="asc">
									Name
								</SortTh>
								<SortTh sortKey="role" sort={sort} dir={dir} onSort={onSort} defaultDir="asc">
									Role
								</SortTh>
								<SortTh sortKey="routeCount" sort={sort} dir={dir} onSort={onSort} align="right">
									Routes
								</SortTh>
								<SortTh sortKey="createdAt" sort={sort} dir={dir} onSort={onSort}>
									Joined
								</SortTh>
								<SortTh sortKey="lastActiveAt" sort={sort} dir={dir} onSort={onSort}>
									Last active
								</SortTh>
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
									<Td>
										<span style={{ color: RDS_COLORS.fg, fontWeight: 500 }}>{user.email}</span>
									</Td>
									<Td muted>{user.name}</Td>
									<Td>
										<Badge variant={user.role === "admin" ? "accent" : "default"}>{user.role}</Badge>
									</Td>
									<Td align="right" muted>
										{user.routeCount}
									</Td>
									<Td muted>{formatDate(user.createdAt)}</Td>
									<Td muted>{user.lastActiveAt ? formatRelative(user.lastActiveAt) : "—"}</Td>
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
