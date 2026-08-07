// UMAMI_URL is the tracker origin; the loadable script lives at /script.js on it.
export function umamiScriptSrc(baseUrl: string): string {
	return `${baseUrl.replace(/\/+$/, "")}/script.js`;
}
