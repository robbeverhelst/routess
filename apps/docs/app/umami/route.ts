// Serves a tiny loader script that injects the Umami tracker when the
// UMAMI_* env vars are present. Reading the env here (instead of in the
// root layout) keeps every page statically renderable while still letting
// Helm configure analytics at deploy time.
export const dynamic = "force-dynamic";

export function GET() {
	const url = process.env.UMAMI_URL;
	const id = process.env.UMAMI_WEBSITE_ID;

	const body =
		url && id
			? `(()=>{var s=document.createElement("script");s.defer=true;s.src=${JSON.stringify(url)};s.setAttribute("data-website-id",${JSON.stringify(id)});document.head.appendChild(s);})();`
			: "";

	return new Response(body, {
		headers: {
			"Content-Type": "application/javascript; charset=utf-8",
			"Cache-Control": "public, max-age=300",
		},
	});
}
