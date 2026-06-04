"use client";

import { useEffect } from "react";

// The root layout renders <html lang="en"> for every route; this keeps the
// attribute in sync on localized guide pages without restructuring the app
// directory around a [lang] root segment.
export function LangAttribute({ lang }: { lang: string }) {
	useEffect(() => {
		document.documentElement.lang = lang;
		return () => {
			document.documentElement.lang = "en";
		};
	}, [lang]);

	return null;
}
