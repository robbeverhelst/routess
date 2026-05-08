import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { apiService } from "@/lib/api";
import { PageError, PageSkeleton } from "./admin.index";

export const Route = createFileRoute("/admin/users")({
	component: AdminUsersPage,
});

function AdminUsersPage() {
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
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Users ({data.total})</h1>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						setSearch(searchInput);
						setPage(1);
					}}
					className="flex gap-2"
				>
					<input
						type="text"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						placeholder="Search email or name…"
						className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
					/>
					<button
						type="submit"
						className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
					>
						Search
					</button>
				</form>
			</div>

			<div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
				<table className="w-full text-sm">
					<thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
						<tr>
							<th className="px-4 py-3">Email</th>
							<th className="px-4 py-3">Name</th>
							<th className="px-4 py-3">Role</th>
							<th className="px-4 py-3">Routes</th>
							<th className="px-4 py-3">Joined</th>
							<th className="px-4 py-3">Last active</th>
						</tr>
					</thead>
					<tbody>
						{data.items.length === 0 && (
							<tr>
								<td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
									No users match.
								</td>
							</tr>
						)}
						{data.items.map((user) => (
							<tr key={user.id} className="border-t border-neutral-100 hover:bg-neutral-50">
								<td className="px-4 py-3 font-medium">
									<Link
										to="/admin/users/$userId"
										params={{ userId: user.id.toString() }}
										className="text-neutral-900 hover:underline"
									>
										{user.email}
									</Link>
								</td>
								<td className="px-4 py-3 text-neutral-700">{user.name}</td>
								<td className="px-4 py-3">
									<span
										className={
											user.role === "admin"
												? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
												: "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700"
										}
									>
										{user.role}
									</span>
								</td>
								<td className="px-4 py-3 text-neutral-700">{user.routeCount}</td>
								<td className="px-4 py-3 text-neutral-500">{formatDate(user.createdAt)}</td>
								<td className="px-4 py-3 text-neutral-500">
									{user.lastActiveAt ? formatRelative(user.lastActiveAt) : "—"}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="mt-4 flex items-center justify-between text-sm text-neutral-600">
				<span>
					Page {data.page} of {totalPages}
				</span>
				<div className="flex gap-2">
					<button
						type="button"
						disabled={page <= 1}
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						className="rounded-md border border-neutral-300 px-3 py-1.5 disabled:opacity-50"
					>
						Previous
					</button>
					<button
						type="button"
						disabled={page >= totalPages}
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						className="rounded-md border border-neutral-300 px-3 py-1.5 disabled:opacity-50"
					>
						Next
					</button>
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
