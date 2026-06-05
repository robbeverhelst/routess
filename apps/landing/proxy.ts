import { type NextRequest, NextResponse } from "next/server";
import { LOCALE_HEADER, localeFromHost } from "@/lib/i18n";

export function proxy(request: NextRequest) {
	const host = request.headers.get("host");

	if (host?.toLowerCase().startsWith("www.")) {
		const apex = host.slice(4);
		const url = new URL(request.url);
		url.host = apex;
		return NextResponse.redirect(url, 301);
	}

	const locale = localeFromHost(host);
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set(LOCALE_HEADER, locale);

	return NextResponse.next({
		request: { headers: requestHeaders },
	});
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
