// Escape < so user-supplied strings cannot break out of the <script> block.
export function serializeJsonLd(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}
