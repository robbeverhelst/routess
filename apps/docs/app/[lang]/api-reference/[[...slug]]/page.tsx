import { notFound, permanentRedirect } from "next/navigation";
import { i18n } from "@/lib/i18n";

// The API reference is English-only; locale-prefixed URLs used to 404.
export default async function LocaleApiRedirect(props: { params: Promise<{ lang: string; slug?: string[] }> }) {
	const { lang, slug } = await props.params;
	if (!(i18n.languages as readonly string[]).includes(lang)) notFound();
	permanentRedirect(["/api-reference", ...(slug ?? [])].join("/"));
}
