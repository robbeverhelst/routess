import { llms } from "fumadocs-core/source";
import { SITE_URL } from "@/lib/site";
import { apiSource, docsSource, guideSource } from "@/lib/source";

// llms.txt: a Markdown index of the whole site for LLM consumption.
export function GET() {
	const sections = [
		"# routess documentation",
		"",
		"> Documentation, guides, and API reference for routess, an open-source route-planning app for cyclists, runners, and hikers.",
		"",
		"## User Guide",
		llms(guideSource).index("en"),
		"## Developer Docs",
		llms(docsSource).index(),
		"## API Reference",
		llms(apiSource).index(),
	];

	const body = sections.join("\n\n").replaceAll("](/", `](${SITE_URL}/`);

	return new Response(body, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}
