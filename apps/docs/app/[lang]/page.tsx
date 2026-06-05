import { notFound, permanentRedirect } from "next/navigation";
import { i18n } from "@/lib/i18n";

// The docs home is English-only; locale-prefixed home URLs used to 404.
export default async function LocaleHomeRedirect(props: { params: Promise<{ lang: string }> }) {
	const { lang } = await props.params;
	if (!(i18n.languages as readonly string[]).includes(lang)) notFound();
	permanentRedirect("/");
}
