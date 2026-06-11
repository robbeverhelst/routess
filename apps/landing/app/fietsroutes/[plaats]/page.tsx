import type { Metadata } from "next";
import { hubMetadata, RegionalHubPage } from "../../components/RegionalHubPage";

interface Params {
	plaats: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
	const { plaats } = await params;
	return hubMetadata("cycle", "nl", plaats);
}

export default async function FietsroutesHub({ params }: { params: Promise<Params> }) {
	const { plaats } = await params;
	return <RegionalHubPage activity="cycle" expectedLocale="nl" rawSlug={plaats} />;
}
