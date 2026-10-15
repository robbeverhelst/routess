import { afterEach, describe, expect, it } from "bun:test";

import type { DomainErrorPayload } from "@routess/core";

import { CliError, EXIT_CODES, humanErrorLines, renderError, UPGRADE_URL } from "./output";

const savedRouteLimit: DomainErrorPayload = {
	statusCode: 403,
	code: "FORBIDDEN",
	message: "Free saves up to 5 routes. Go Pro for unlimited.",
	details: { reason: "saved_route_limit", feature: "unlimited_saved_routes", limit: 5, upgrade: "pro" },
};

const patsOffPro: DomainErrorPayload = {
	statusCode: 403,
	code: "FORBIDDEN",
	message: "CLI and agent access is part of Pro.",
	details: { reason: "pro_required", feature: "personal_access_tokens", upgrade: "pro" },
};

describe("Pro gate errors (ADR 0039)", () => {
	const write = process.stderr.write.bind(process.stderr);
	let stderr = "";

	afterEach(() => {
		process.stderr.write = write;
		stderr = "";
	});

	function captureStderr() {
		process.stderr.write = ((chunk: string | Uint8Array) => {
			stderr += String(chunk);
			return true;
		}) as typeof process.stderr.write;
	}

	it("prints the saved-route cap with where to go Pro", () => {
		expect(humanErrorLines(savedRouteLimit)).toEqual([
			"error: Free saves up to 5 routes. Go Pro for unlimited.",
			`Go Pro: ${UPGRADE_URL}`,
		]);
	});

	it("tells a free account its tokens are kept", () => {
		captureStderr();
		const code = renderError({ json: false }, new CliError(patsOffPro.message, EXIT_CODES.FORBIDDEN, patsOffPro));
		expect(code).toBe(EXIT_CODES.FORBIDDEN);
		expect(stderr).toBe(
			[
				"error: CLI and agent access is part of Pro.",
				"Your tokens are kept and work again once the account is on Pro.",
				`Go Pro: ${UPGRADE_URL}`,
				"",
			].join("\n"),
		);
	});

	it("keeps the payload verbatim in JSON mode", () => {
		captureStderr();
		renderError({ json: true }, new CliError(savedRouteLimit.message, EXIT_CODES.FORBIDDEN, savedRouteLimit));
		expect(JSON.parse(stderr)).toEqual(savedRouteLimit);
	});

	it("leaves other forbidden errors as one line", () => {
		const scope: DomainErrorPayload = {
			statusCode: 403,
			code: "FORBIDDEN",
			message: 'This personal access token has scope "read" but the endpoint requires "write"',
		};
		expect(humanErrorLines(scope)).toEqual([`error: ${scope.message}`]);
	});
});
