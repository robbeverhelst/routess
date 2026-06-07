import { isDomainErrorPayload } from "@routess/core";
import { CliError, EXIT_CODES } from "./output";

export interface ClientOptions {
	apiUrl: string;
	token: string | null;
}

export interface RequestOptions {
	method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
	body?: unknown;
	confirm?: boolean;
}

async function send(client: ClientOptions, path: string, options: RequestOptions, accept: string): Promise<Response> {
	const url = new URL(path.startsWith("/") ? path.slice(1) : path, `${client.apiUrl.replace(/\/$/, "")}/`);
	const headers: Record<string, string> = {
		Accept: accept,
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

	if (!response.ok) {
		// Error bodies are JSON DomainErrorPayloads even on binary endpoints.
		const contentType = response.headers.get("content-type") ?? "";
		const payload = contentType.includes("application/json") ? ((await response.json()) as unknown) : undefined;
		if (isDomainErrorPayload(payload)) {
			throw new CliError(payload.message, EXIT_CODES[payload.code], payload);
		}
		throw new CliError(
			`Request failed: ${response.status} ${response.statusText}`,
			response.status === 401 ? EXIT_CODES.UNAUTHORIZED : EXIT_CODES.GENERIC,
		);
	}

	return response;
}

export interface ResponseWithHeaders<T> {
	data: T;
	headers: Headers;
}

// Minimal HTTP client around fetch. Translates DomainError responses
// into CliError with the right exit code so callers can throw and the
// command runner exits cleanly.
export async function requestWithHeaders<T>(
	client: ClientOptions,
	path: string,
	options: RequestOptions = {},
): Promise<ResponseWithHeaders<T>> {
	const response = await send(client, path, options, "application/json");
	if (response.status === 204) {
		return { data: undefined as unknown as T, headers: response.headers };
	}
	const contentType = response.headers.get("content-type") ?? "";
	const payload = contentType.includes("application/json") ? ((await response.json()) as unknown) : undefined;
	return { data: payload as T, headers: response.headers };
}

export async function request<T>(client: ClientOptions, path: string, options: RequestOptions = {}): Promise<T> {
	const { data } = await requestWithHeaders<T>(client, path, options);
	return data;
}

export interface RawResponse {
	bytes: Uint8Array;
	contentType: string;
	// Parsed from Content-Disposition when the server suggests one.
	filename: string | null;
}

// For non-JSON payloads: GPX documents, the account-export ZIP.
export async function requestRaw(
	client: ClientOptions,
	path: string,
	options: RequestOptions = {},
): Promise<RawResponse> {
	const response = await send(client, path, options, "*/*");
	const bytes = new Uint8Array(await response.arrayBuffer());
	const disposition = response.headers.get("content-disposition") ?? "";
	const match = disposition.match(/filename="([^"]+)"/);
	return {
		bytes,
		contentType: response.headers.get("content-type") ?? "application/octet-stream",
		filename: match ? match[1] : null,
	};
}
