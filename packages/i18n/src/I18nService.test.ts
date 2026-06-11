import { describe, expect, it } from "bun:test";
import { I18nService } from "./I18nService";

const service = new I18nService({
	translations: {
		"toast.routeSaved": { en: "Saved {name} to your library" },
		"toast.shared": { en: "{name} shared with {count} people" },
	},
	defaultLanguage: "en",
	fallbackLanguage: "en",
});

describe("I18nService.t interpolation", () => {
	it("replaces every occurrence of a placeholder", () => {
		expect(service.t("toast.shared", "en", { name: "Coast loop", count: "3" })).toBe("Coast loop shared with 3 people");
	});

	it("keeps $-patterns in values literal", () => {
		expect(service.t("toast.routeSaved", "en", { name: "Big $$ Loop" })).toBe("Saved Big $$ Loop to your library");
		expect(service.t("toast.routeSaved", "en", { name: "$&" })).toBe("Saved $& to your library");
		expect(service.t("toast.routeSaved", "en", { name: "$'" })).toBe("Saved $' to your library");
	});

	it("returns the key when no translation exists", () => {
		expect(service.t("missing.key", "en")).toBe("missing.key");
	});
});
