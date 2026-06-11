import type { Metadata } from "next";
import { hubMetadata, RegionalHubPage } from "../../components/RegionalHubPage";

interface Params {
	place: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
	const { place } = await params;
	return hubMetadata("cycle", "en", place);
}

export default async function CyclingRoutesHub({ params }: { params: Promise<Params> }) {
	const { place } = await params;
	return <RegionalHubPage activity="cycle" expectedLocale="en" rawSlug={place} />;
}
