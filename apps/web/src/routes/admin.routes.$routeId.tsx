import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { I } from "@/components/icons";
import { Badge, Btn, RDS_COLORS, SecTitle } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { Card, PageError, PageHeader, PageSkeleton } from "./admin.index";
import { formatDistance, formatDuration, formatElevation } from "./admin.routes.index";
import { formatDate } from "./admin.users.index";

export const Route = createFileRoute("/admin/routes/$routeId")({
	component: AdminRouteDetailPage,
});

function AdminRouteDetailPage() {
	const { routeId } = Route.useParams();
	const id = Number.parseInt(routeId, 10);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data, isLoading, error } = useQuery({
		queryKey: ["admin", "routes", id],
		queryFn: () => apiService.adminGetRouteDetail(id),
		enabled: Number.isFinite(id),
	});

	const softDelete = useMutation({
		mutationFn: () => apiService.adminSoftDeleteRoute(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin", "routes"] });
			queryClient.invalidateQueries({ queryKey: ["admin", "stats", "routes"] });
			navigate({ to: "/admin/routes" });
		},
	});

	if (isLoading) return <PageSkeleton title="Route" />;
	if (error || !data) return <PageError title="Route" error={error} />;

	const isDeleted = data.deletedAt !== null;

	return (
		<div>
			<Link
				to="/admin/routes"
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
				<I.chevronL size={14} /> All routes
			</Link>

			<PageHeader
				eyebrow="Route"
				title={data.name}
				subtitle={
					<span>
						Owned by{" "}
						<Link
							to="/admin/users/$userId"
							params={{ userId: data.owner.id.toString() }}
							style={{ color: RDS_COLORS.accent, textDecoration: "none" }}
						>
							{data.owner.email}
						</Link>
					</span>
				}
				right={
					!isDeleted && (
						<Btn
							onClick={() => {
								if (confirm(`Soft-delete route "${data.name}"? It will be hidden from the owner.`)) {
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
					)
				}
			/>

			<div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
				{data.activity && <Badge variant="default">{data.activity}</Badge>}
				<Badge variant={data.privacy === "public" ? "accent" : "default"}>{data.privacy}</Badge>
				{data.tags.map((tag) => (
					<Badge key={tag} variant="default">
						#{tag}
					</Badge>
				))}
				{isDeleted && (
					<Badge variant="warn" dot>
						soft-deleted
					</Badge>
				)}
			</div>

			<div
				style={{
					marginTop: 22,
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
					gap: 14,
				}}
			>
				<Card padding={16}>
					<KV label="Distance" value={formatDistance(data.distance)} />
				</Card>
				<Card padding={16}>
					<KV label="Duration" value={formatDuration(data.duration)} />
				</Card>
				<Card padding={16}>
					<KV label="Elevation gain" value={formatElevation(data.elevationGain)} />
				</Card>
				<Card padding={16}>
					<KV label="Waypoints" value={data.waypointCount.toString()} />
				</Card>
			</div>

			{data.description && (
				<section style={{ marginTop: 28 }}>
					<SecTitle style={{ marginBottom: 10 }}>Description</SecTitle>
					<Card>
						<div style={{ fontSize: 13.5, color: RDS_COLORS.fg, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
							{data.description}
						</div>
					</Card>
				</section>
			)}

			<section style={{ marginTop: 28 }}>
				<SecTitle style={{ marginBottom: 10 }}>Geography</SecTitle>
				<Card>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
							gap: 16,
						}}
					>
						<KV label="Start" value={data.startAddress ?? "—"} />
						<KV label="End" value={data.endAddress ?? "—"} />
						<KV
							label="RoutePath"
							value={
								<Badge variant={data.hasGeometry ? "success" : "default"} dot>
									{data.hasGeometry ? "computed" : "missing"}
								</Badge>
							}
						/>
					</div>
				</Card>
			</section>

			<section style={{ marginTop: 28 }}>
				<SecTitle style={{ marginBottom: 10 }}>Metadata</SecTitle>
				<Card>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
							gap: 16,
						}}
					>
						<KV label="Created" value={formatDate(data.createdAt)} />
						<KV label="Updated" value={formatDate(data.updatedAt)} />
						<KV label="ID" value={<span style={{ fontFamily: "monospace" }}>{data.id}</span>} />
						{isDeleted && (
							<KV
								label="Deleted at"
								value={<span style={{ color: RDS_COLORS.danger }}>{data.deletedAt && formatDate(data.deletedAt)}</span>}
							/>
						)}
					</div>
				</Card>
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
