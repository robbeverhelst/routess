// Crawlers run the SPA in stripped-down environments where ordinary browser
// APIs fail: Googlebot rejects navigator.serviceWorker.register outright, which
// alone accounted for the single noisiest issue in GlitchTip. None of it is
// actionable, and no crawler is a user we can fix anything for.
const BOT_UA =
	/bot|crawl|spider|slurp|bingpreview|headlesschrome|lighthouse|pagespeed|gtmetrix|facebookexternalhit|embedly|preview|monitor|pingdom|uptime/i;

export function isBotUserAgent(userAgent: string | undefined): boolean {
	if (!userAgent) return false;
	return BOT_UA.test(userAgent);
}

export function isBotClient(): boolean {
	if (typeof navigator === "undefined") return false;
	if ((navigator as { webdriver?: boolean }).webdriver === true) return true;
	return isBotUserAgent(navigator.userAgent);
}
