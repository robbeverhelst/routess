import { loader } from "fumadocs-core/source";
import { apiReference, developerDocs, guide } from "@/.source/server";
import { i18n } from "@/lib/i18n";

export const guideSource = loader({
	baseUrl: "/guide",
	i18n,
	source: guide.toFumadocsSource(),
});

export const docsSource = loader({
	baseUrl: "/docs",
	i18n,
	source: developerDocs.toFumadocsSource(),
});

export const apiSource = loader({
	baseUrl: "/api-reference",
	i18n,
	source: apiReference.toFumadocsSource(),
});
