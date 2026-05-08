import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { apiService } from "@/lib/api";
import { PageError, PageSkeleton } from "./admin.index";
import { formatDate, formatRelative } from "./admin.users";

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
		<div className="max-w-4xl">
			<Link to="/admin/users" className="text-sm text-neutral-500 hover:text-neutral-700">
				← All users
			</Link>
			<div className="mt-4 mb-8 flex items-start justify-between">
				<div>
					<h1 className="text-2xl font-semibold">{data.name}</h1>
					<div className="mt-1 text-neutral-500">{data.email}</div>
					<div className="mt-2 flex gap-2 text-xs">
						<span
							className={
								data.role === "admin"
									? "rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800"
									: "rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700"
							}
						>
							{data.role}
						</span>
						<span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
							{data.isEmailVerified ? "verified" : "unverified"}
						</span>
					</div>
				</div>
				<button
					type="button"
					onClick={() => {
						if (confirm(`Soft-delete ${data.email}? Their routes and sessions will be hidden. They can recover by logging in again.`)) {
							softDelete.mutate();
						}
					}}
					disabled={softDelete.isPending}
					className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
				>
					{softDelete.isPending ? "Deleting…" : "Soft-delete user"}
				</button>
			</div>

			<div className="mb-8 grid grid-cols-3 gap-4 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
				<div>
					<div className="text-xs text-neutral-500">Joined</div>
					<div className="mt-0.5 text-neutral-900">{formatDate(data.createdAt)}</div>
				</div>
				<div>
					<div className="text-xs text-neutral-500">Last active</div>
					<div className="mt-0.5 text-neutral-900">
						{data.lastActiveAt ? formatRelative(data.lastActiveAt) : "Never"}
					</div>
				</div>
				<div>
					<div className="text-xs text-neutral-500">Total routes</div>
					<div className="mt-0.5 text-neutral-900">{data.routeCount}</div>
				</div>
			</div>

			<section className="mb-8">
				<h2 className="mb-3 text-lg font-medium">Active sessions ({data.activeSessions.length})</h2>
				<div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
					<table className="w-full text-sm">
						<thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
							<tr>
								<th className="px-4 py-2">User agent</th>
								<th className="px-4 py-2">IP</th>
								<th className="px-4 py-2">Last activity</th>
								<th className="px-4 py-2">Expires</th>
								<th className="px-4 py-2"></th>
							</tr>
						</thead>
						<tbody>
							{data.activeSessions.length === 0 && (
								<tr>
									<td colSpan={5} className="px-4 py-4 text-center text-neutral-500">
										No active sessions.
									</td>
								</tr>
							)}
							{data.activeSessions.map((s) => (
								<tr key={s.id} className="border-t border-neutral-100">
									<td className="max-w-xs truncate px-4 py-2 text-neutral-700">
										{s.userAgent ?? "—"}
									</td>
									<td className="px-4 py-2 text-neutral-500">{s.ipAddress ?? "—"}</td>
									<td className="px-4 py-2 text-neutral-500">
										{s.lastActivity ? formatRelative(s.lastActivity) : "—"}
									</td>
									<td className="px-4 py-2 text-neutral-500">{formatDate(s.expiresAt)}</td>
									<td className="px-4 py-2 text-right">
										<button
											type="button"
											onClick={() => revoke.mutate(s.id)}
											disabled={revoke.isPending}
											className="text-xs text-red-700 hover:underline disabled:opacity-50"
										>
											Revoke
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<section>
				<h2 className="mb-3 text-lg font-medium">Recent routes</h2>
				<div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
					<table className="w-full text-sm">
						<thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
							<tr>
								<th className="px-4 py-2">Name</th>
								<th className="px-4 py-2">Activity</th>
								<th className="px-4 py-2">Created</th>
							</tr>
						</thead>
						<tbody>
							{data.recentRoutes.length === 0 && (
								<tr>
									<td colSpan={3} className="px-4 py-4 text-center text-neutral-500">
										No routes.
									</td>
								</tr>
							)}
							{data.recentRoutes.map((r) => (
								<tr key={r.id} className="border-t border-neutral-100">
									<td className="px-4 py-2 text-neutral-900">{r.name}</td>
									<td className="px-4 py-2 text-neutral-500">{r.activity ?? "—"}</td>
									<td className="px-4 py-2 text-neutral-500">{formatDate(r.createdAt)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}
