import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { getStoredUser } from "@/lib/auth-state";

export const Route = createFileRoute("/admin")({
	beforeLoad: () => {
		const user = getStoredUser();
		if (!user) {
			throw redirect({ to: "/" });
		}
		if (user.role !== "admin") {
			throw redirect({ to: "/" });
		}
	},
	component: AdminLayout,
});

function AdminLayout() {
	return (
		<div className="flex h-svh w-full bg-neutral-50">
			<aside className="w-56 border-r border-neutral-200 bg-white p-4">
				<div className="mb-6 px-2 py-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
					routess admin
				</div>
				<nav className="flex flex-col gap-1 text-sm">
					<AdminNavLink to="/admin">Overview</AdminNavLink>
					<AdminNavLink to="/admin/users">Users</AdminNavLink>
					<AdminNavLink to="/admin/routes">Routes</AdminNavLink>
					<AdminNavLink to="/admin/system">System</AdminNavLink>
				</nav>
				<div className="mt-8 border-t border-neutral-200 pt-4">
					<Link to="/" className="text-xs text-neutral-500 hover:text-neutral-700">
						← Back to app
					</Link>
				</div>
			</aside>
			<main className="flex-1 overflow-auto p-8">
				<Outlet />
			</main>
		</div>
	);
}

function AdminNavLink({ to, children }: { to: string; children: React.ReactNode }) {
	return (
		<Link
			to={to}
			activeOptions={{ exact: to === "/admin" }}
			className="rounded-md px-2 py-1.5 text-neutral-700 hover:bg-neutral-100 [&.active]:bg-neutral-900 [&.active]:text-white"
		>
			{children}
		</Link>
	);
}
