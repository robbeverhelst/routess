import { createFileRoute } from "@tanstack/react-router";
import { PublicProfileScreen } from "@/screens/PublicProfileScreen";

export const Route = createFileRoute("/u/$handle")({
	component: PublicProfilePage,
});

function PublicProfilePage() {
	const { handle } = Route.useParams();
	return <PublicProfileScreen handle={handle} />;
}
