import { permanentRedirect } from "next/navigation";

// Legacy unprefixed URLs from before the docs went multilingual.
export default async function LegacyDocsRedirect(props: { params: Promise<{ slug?: string[] }> }) {
	const { slug } = await props.params;
	permanentRedirect(["/en/docs", ...(slug ?? [])].join("/"));
}
