import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { I } from "@/components/icons";
import { Badge, Btn, RDS_COLORS, SecTitle } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { Card, PageError, PageHeader, PageSkeleton } from "./admin.index";
import { formatDate, formatRelative } from "./admin.users.index";

export const Route = createFileRoute("/admin/users/$userId")({
	component: AdminUserDetailPage,
});

function AdminUserDetailPage() {
	const { userId } = Route.useParams();
	const id = Number.parseInt(userId, 10);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data, isLoading, error } = useQuery({
		queryKey: ["admin", "users", id],
		queryFn: () => apiService.adminGetUserDetail(id),
		enabled: Number.isFinite(id),
	});

	const revoke = useMutation({
		mutationFn: (sessionId: string) => apiService.adminRevokeSession(id, sessionId),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users", id] }),
	});

	const softDelete = useMutation({
		mutationFn: () => apiService.adminSoftDeleteUser(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
			navigate({ to: "/admin/users" });
		},
	});

	if (isLoading) return <PageSkeleton title="User" />;
	if (error || !data) return <PageError title="User" error={error} />;

	return (
		<div>
			<Link
				to="/admin/users"
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 4,
					fontSize: 12.5,
					color: RDS_COLORS.fgSubtle,
					textDecoration: "none",
					marginBottom: 12,
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.color = RDS_COLORS.fg;
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.color = RDS_COLORS.fgSubtle;
				}}
			>
				<I.chevronL size={14} /> All users
			</Link>

			<PageHeader
				eyebrow="User"
				title={data.name}
				subtitle={data.email}
				right={
					<Btn
						variant="danger"
						onClick={() => {
							if (
								confirm(
									`Soft-delete ${data.email}? Their routes and sessions will be hidden. They can recover by logging in again.`,
								)
							) {
								softDelete.mutate();
							}
						}}
						disabled={softDelete.isPending}
						style={{
							background: "transparent",
							color: RDS_COLORS.danger,
							border: `1px solid color-mix(in oklch, ${RDS_COLORS.danger} 40%, ${RDS_COLORS.border})`,
						}}
					>
						<I.trash size={14} />
						{softDelete.isPending ? "Deleting…" : "Soft-delete"}
					</Btn>
				}
			/>

			<div style={{ marginTop: 12, display: "flex", gap: 8 }}>
				<Badge variant={data.role === "admin" ? "accent" : "default"}>{data.role}</Badge>
				<Badge variant={data.isEmailVerified ? "success" : "warn"}>
					{data.isEmailVerified ? "verified" : "unverified"}
				</Badge>
			</div>

			<div
				style={{
					marginTop: 22,
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
					gap: 14,
				}}
			>
				<Card padding={16}>
					<KV label="Joined" value={formatDate(data.createdAt)} />
				</Card>
				<Card padding={16}>
					<KV label="Last active" value={data.lastActiveAt ? formatRelative(data.lastActiveAt) : "Never"} />
				</Card>
				<Card padding={16}>
					<KV label="Total routes" value={data.routeCount.toString()} />
				</Card>
			</div>

			<section style={{ marginTop: 28 }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: 10,
					}}
				>
					<SecTitle>Active sessions ({data.activeSessions.length})</SecTitle>
				</div>
				<Card padding={0}>
					<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
						<thead>
							<tr style={{ background: RDS_COLORS.bgPanelElev }}>
								<Th>User agent</Th>
								<Th>IP</Th>
								<Th>Last activity</Th>
								<Th>Expires</Th>
								<Th align="right" />
							</tr>
						</thead>
						<tbody>
							{data.activeSessions.length === 0 && (
								<tr>
									<td
										colSpan={5}
										style={{
											padding: "24px 16px",
											textAlign: "center",
											color: RDS_COLORS.fgSubtle,
										}}
									>
										No active sessions.
									</td>
								</tr>
							)}
							{data.activeSessions.map((s, idx) => (
								<tr
									key={s.id}
									style={{
										borderTop: idx === 0 ? "none" : `1px solid ${RDS_COLORS.border}`,
									}}
								>
									<Td muted>
										<span
											style={{
												display: "inline-block",
												maxWidth: 280,
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
												verticalAlign: "middle",
											}}
											title={s.userAgent ?? undefined}
										>
											{s.userAgent ?? "—"}
										</span>
									</Td>
									<Td muted>{s.ipAddress ?? "—"}</Td>
									<Td muted>{s.lastActivity ? formatRelative(s.lastActivity) : "—"}</Td>
									<Td muted>{formatDate(s.expiresAt)}</Td>
									<Td align="right">
										<button
											type="button"
											onClick={() => revoke.mutate(s.id)}
											disabled={revoke.isPending}
											style={{
												border: 0,
												background: "transparent",
												color: RDS_COLORS.danger,
												fontSize: 12,
												cursor: revoke.isPending ? "not-allowed" : "pointer",
												opacity: revoke.isPending ? 0.5 : 1,
												padding: 0,
											}}
										>
											Revoke
										</button>
									</Td>
								</tr>
							))}
						</tbody>
					</table>
				</Card>
			</section>

			<section style={{ marginTop: 28 }}>
				<SecTitle style={{ marginBottom: 10 }}>Recent routes</SecTitle>
				<Card padding={0}>
					<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
						<thead>
							<tr style={{ background: RDS_COLORS.bgPanelElev }}>
								<Th>Name</Th>
								<Th>Activity</Th>
								<Th>Created</Th>
							</tr>
						</thead>
						<tbody>
							{data.recentRoutes.length === 0 && (
								<tr>
									<td
										colSpan={3}
										style={{
											padding: "24px 16px",
											textAlign: "center",
											color: RDS_COLORS.fgSubtle,
										}}
									>
										No routes.
									</td>
								</tr>
							)}
							{data.recentRoutes.map((r, idx) => (
								<tr
									key={r.id}
									style={{
										borderTop: idx === 0 ? "none" : `1px solid ${RDS_COLORS.border}`,
										cursor: "pointer",
									}}
									onClick={() =>
										navigate({
											to: "/admin/routes/$routeId",
											params: { routeId: r.id.toString() },
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
										<span style={{ color: RDS_COLORS.fg, fontWeight: 500 }}>{r.name}</span>
									</Td>
									<Td muted>{r.activity ?? "—"}</Td>
									<Td muted>{formatDate(r.createdAt)}</Td>
								</tr>
							))}
						</tbody>
					</table>
				</Card>
			</section>
		</div>
	);
}

function KV({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{label}</div>
			<div style={{ marginTop: 4, fontSize: 14, fontWeight: 500, color: RDS_COLORS.fg }}>{value}</div>
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
