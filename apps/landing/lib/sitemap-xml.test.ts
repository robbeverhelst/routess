import { describe, expect, it } from "bun:test";
import { localizedAlternates, sitemapIndexXml, urlsetXml, xmlEscape } from "./sitemap-xml";

describe("xmlEscape", () => {
	it("escapes the five XML special characters", () => {
		expect(xmlEscape(`Fish & chips <"d'or">`)).toBe("Fish &amp; chips &lt;&quot;d&apos;or&quot;&gt;");
	});
});

describe("urlsetXml", () => {
	it("renders loc, lastmod, changefreq, and priority", () => {
		const xml = urlsetXml([
			{ loc: "https://routess.com/r/foo-1", lastModified: "2026-06-01", changeFrequency: "monthly", priority: 0.7 },
		]);
		expect(xml).toContain("<loc>https://routess.com/r/foo-1</loc>");
		expect(xml).toContain("<lastmod>2026-06-01</lastmod>");
		expect(xml).toContain("<changefreq>monthly</changefreq>");
		expect(xml).toContain("<priority>0.7</priority>");
		expect(xml).toContain(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`);
	});

	it("renders hreflang alternates as xhtml:link elements", () => {
		const xml = urlsetXml([
			{
				loc: "https://routess.be/fietsroutes/gent",
				alternates: localizedAlternates("/cycling-routes/gent", "/fietsroutes/gent"),
			},
		]);
		expect(xml).toContain(`xmlns:xhtml="http://www.w3.org/1999/xhtml"`);
		expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="en" href="https://routess.com/cycling-routes/gent"/>`);
		expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="nl-BE" href="https://routess.be/fietsroutes/gent"/>`);
	});

	it("escapes URLs", () => {
		const xml = urlsetXml([{ loc: "https://routess.com/r/fish-&-chips-1" }]);
		expect(xml).toContain("<loc>https://routess.com/r/fish-&amp;-chips-1</loc>");
	});
});

describe("sitemapIndexXml", () => {
	it("renders one sitemap element per segment", () => {
		const xml = sitemapIndexXml(["https://routess.com/sitemaps/pages.xml", "https://routess.com/sitemaps/hubs.xml"]);
		expect(xml).toContain(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
		expect(xml).toContain("<sitemap><loc>https://routess.com/sitemaps/pages.xml</loc></sitemap>");
		expect(xml).toContain("<sitemap><loc>https://routess.com/sitemaps/hubs.xml</loc></sitemap>");
	});
});
