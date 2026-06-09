import { parseRouteSlugId } from "@routess/core";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ExternalRouteScreen } from "@/screens/ExternalRouteScreen";
import { PublicRouteScreen } from "@/screens/PublicRouteScreen";

export const Route = createFileRoute("/r/$slugId")({
	component: PublicRoutePage,
	notFoundComponent: () => (
		<div style={{ padding: 40, textAlign: "center" }}>
			<h1 style={{ fontSize: 22, fontWeight: 600 }}>Route not found</h1>
			<p style={{ marginTop: 8 }}>
				<a href="/">Back to routess</a>
			</p>
		</div>
	),
});

function PublicRoutePage() {
	const { slugId } = Route.useParams();
	const parsed = parseRouteSlugId(slugId);
	if (!parsed) throw notFound();
	if (parsed.externalId !== undefined) {
		return <ExternalRouteScreen slug={parsed.slug} externalId={parsed.externalId} />;
	}
	return <PublicRouteScreen slug={parsed.slug} routeRef={parsed.token ?? parsed.id} />;
}
