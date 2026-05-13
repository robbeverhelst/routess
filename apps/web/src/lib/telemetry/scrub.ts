import type { Breadcrumb } from "@sentry/react";

const SENSITIVE_QUERY_PARAMS = new Set([
	"access_token",
	"code",
	"state",
	"id_token",
	"token",
	"refresh_token",
	"client_secret",
]);

export function stripSensitiveQueryParams(url: string): string {
	const queryStart = url.indexOf("?");
	if (queryStart === -1) return url;

	const base = url.slice(0, queryStart);
	const query = url.slice(queryStart + 1);
	const hashStart = query.indexOf("#");
	const hash = hashStart === -1 ? "" : query.slice(hashStart);
	const pairs = (hashStart === -1 ? query : query.slice(0, hashStart)).split("&");

	const scrubbed = pairs
		.map((pair) => {
			const eq = pair.indexOf("=");
			const key = eq === -1 ? pair : pair.slice(0, eq);
			if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
				return `${key}=[redacted]`;
			}
			return pair;
		})
		.join("&");

	return `${base}?${scrubbed}${hash}`;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
	if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
		const url = breadcrumb.data?.url;
		if (typeof url === "string") {
			return {
				...breadcrumb,
				data: { ...breadcrumb.data, url: stripSensitiveQueryParams(url) },
			};
		}
	}
	return breadcrumb;
}
