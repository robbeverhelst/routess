import { isDomainErrorPayload } from "@routess/core";
import { CliError, EXIT_CODES } from "./output";

export interface ClientOptions {
	apiUrl: string;
	token: string | null;
}

export interface RequestOptions {
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	body?: unknown;
	confirm?: boolean;
}

// Minimal HTTP client around fetch. Translates DomainError responses
// into CliError with the right exit code so callers can throw and the
// command runner exits cleanly.
export async function request<T>(client: ClientOptions, path: string, options: RequestOptions = {}): Promise<T> {
	const url = new URL(path.startsWith("/") ? path.slice(1) : path, `${client.apiUrl.replace(/\/$/, "")}/`);
	const headers: Record<string, string> = {
		Accept: "application/json",
	};
	if (client.token) {
		headers.Authorization = `Bearer ${client.token}`;
	}
	if (options.body !== undefined) {
		headers["Content-Type"] = "application/json";
	}
	if (options.confirm) {
		headers["X-Routess-Confirm"] = "true";
	}

	let response: Response;
	try {
		response = await fetch(url, {
			method: options.method ?? "GET",
			headers,
			body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
		});
	} catch (cause) {
		throw new CliError(
			`Network error reaching ${url.origin}: ${cause instanceof Error ? cause.message : String(cause)}`,
			EXIT_CODES.NETWORK,
		);
	}

	if (response.status === 204) {
		return undefined as unknown as T;
	}

	const contentType = response.headers.get("content-type") ?? "";
	const payload = contentType.includes("application/json") ? ((await response.json()) as unknown) : undefined;

	if (!response.ok) {
		if (isDomainErrorPayload(payload)) {
			throw new CliError(payload.message, EXIT_CODES[payload.code], payload);
		}
		throw new CliError(
			`Request failed: ${response.status} ${response.statusText}`,
			response.status === 401 ? EXIT_CODES.UNAUTHORIZED : EXIT_CODES.GENERIC,
		);
	}

	return payload as T;
}
