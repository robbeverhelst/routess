import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { I } from "@/components/icons";
import { AdminRouteMap } from "@/components/map/AdminRouteMap";
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

	const restore = useMutation({
		mutationFn: () => apiService.adminRestoreRoute(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin", "routes"] });
			queryClient.invalidateQueries({ queryKey: ["admin", "routes", id] });
			queryClient.invalidateQueries({ queryKey: ["admin", "stats", "routes"] });
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
					isDeleted ? (
						<Btn
							onClick={() => restore.mutate()}
							disabled={restore.isPending}
							style={{
								background: "transparent",
								color: RDS_COLORS.accent,
								border: `1px solid color-mix(in oklch, ${RDS_COLORS.accent} 40%, ${RDS_COLORS.border})`,
							}}
						>
							<I.refresh size={14} />
							{restore.isPending ? "Restoring…" : "Restore"}
						</Btn>
					) : (
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
				<Badge variant={data.visibility === "public" ? "accent" : "default"}>{data.visibility}</Badge>
				{data.tags.map((tag) => (
					<Badge key={tag} variant="default">
						#{tag}
					</Badge>
				))}
				{data.favourite && <Badge variant="default">favourite</Badge>}
				{isDeleted && (
					<Badge variant="warn" dot>
						soft-deleted
					</Badge>
				)}
			</div>

			<section style={{ marginTop: 22 }}>
				<SecTitle style={{ marginBottom: 10 }}>RoutePath</SecTitle>
				<AdminRouteMap geometry={data.geometry} waypoints={data.waypoints} bbox={data.bbox} />
			</section>

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
						<KV label="Place" value={formatPlace(data.placeCity, data.placeRegion, data.placeCountryCode)} />
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
				<SecTitle style={{ marginBottom: 10 }}>Routing &amp; surface</SecTitle>
				<Card>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
							gap: 16,
						}}
					>
						<KV label="Provenance" value={<Badge variant="default">{data.provenance}</Badge>} />
						<KV label="Surface preference" value={data.routingPreferences?.surfacePreference ?? "—"} />
						<KV label="Avoid ferries" value={yesNo(data.routingPreferences?.avoidFerries)} />
						<KV label="Avoid highways" value={yesNo(data.routingPreferences?.avoidHighways)} />
					</div>
					{data.surfaceComposition && (
						<div style={{ marginTop: 16 }}>
							<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginBottom: 8 }}>Surface composition</div>
							<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
								{surfaceBreakdown(data.surfaceComposition).map((b) => (
									<Badge key={b.bucket} variant="default">
										{b.bucket} {b.pct}%
									</Badge>
								))}
							</div>
						</div>
					)}
				</Card>
			</section>

			<section style={{ marginTop: 28 }}>
				<SecTitle style={{ marginBottom: 10 }}>Sharing &amp; lineage</SecTitle>
				<Card>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
							gap: 16,
						}}
					>
						<KV
							label="Visibility"
							value={<Badge variant={data.visibility === "public" ? "accent" : "default"}>{data.visibility}</Badge>}
						/>
						<KV label="Published at" value={data.publishedAt ? formatDate(data.publishedAt) : "—"} />
						<KV
							label="Share token"
							value={<span style={{ fontFamily: "monospace", fontSize: 11.5 }}>{data.shareToken}</span>}
						/>
						{data.copiedFromRouteId != null && (
							<KV
								label="Copied from"
								value={
									<Link
										to="/admin/routes/$routeId"
										params={{ routeId: data.copiedFromRouteId.toString() }}
										style={{ color: RDS_COLORS.accent, textDecoration: "none" }}
									>
										route #{data.copiedFromRouteId}
									</Link>
								}
							/>
						)}
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

function yesNo(value: boolean | undefined): string {
	if (value === undefined) return "—";
	return value ? "Yes" : "No";
}

function formatPlace(city: string | null, region: string | null, country: string | null): string {
	const parts = [city, region, country].filter(Boolean);
	return parts.length ? parts.join(", ") : "—";
}

function surfaceBreakdown(composition: {
	meters: Record<string, number>;
	total: number;
}): Array<{ bucket: string; pct: number }> {
	const total = composition.total || Object.values(composition.meters).reduce((a, b) => a + b, 0);
	if (!total) return [];
	return Object.entries(composition.meters)
		.filter(([, meters]) => meters > 0)
		.map(([bucket, meters]) => ({ bucket, pct: Math.round((meters / total) * 100) }))
		.sort((a, b) => b.pct - a.pct);
}
