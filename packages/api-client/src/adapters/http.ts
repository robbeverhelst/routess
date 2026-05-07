import { errorFromResponse } from "../errors";
import type { HttpClient, RequestOptions } from "../types";

interface FetchHttpClientOptions {
	defaultTimeoutMs?: number;
	credentials?: "omit" | "same-origin" | "include";
}

// Single fetch-based HttpClient. Works in both browser and React Native
// (RN has fetch + AbortController). Web previously had no default timeout
// while mobile had 10s; the default here is opt-in via constructor.
export class FetchHttpClient implements HttpClient {
	private readonly defaultTimeoutMs: number | undefined;
	private readonly credentials: "omit" | "same-origin" | "include" | undefined;

	constructor(options: FetchHttpClientOptions = {}) {
		this.defaultTimeoutMs = options.defaultTimeoutMs;
		this.credentials = options.credentials;
	}

	async get<T>(url: string, options: RequestOptions = {}): Promise<T> {
		return this.request<T>(url, "GET", undefined, options);
	}

	async post<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
		return this.request<T>(url, "POST", body, options);
	}

	async patch<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
		return this.request<T>(url, "PATCH", body, options);
	}

	async delete<T>(url: string, options: RequestOptions = {}): Promise<T> {
		return this.request<T>(url, "DELETE", undefined, options);
	}

	private async request<T>(
		url: string,
		method: "GET" | "POST" | "PATCH" | "DELETE",
		body: unknown,
		options: RequestOptions,
	): Promise<T> {
		const { headers = {}, timeout } = options;
		const effectiveTimeout = timeout ?? this.defaultTimeoutMs;

		const controller = new AbortController();
		const timeoutId = effectiveTimeout ? setTimeout(() => controller.abort(), effectiveTimeout) : undefined;

		try {
			const response = await fetch(url, {
				method,
				headers,
				body: body !== undefined ? JSON.stringify(body) : undefined,
				signal: controller.signal,
				credentials: this.credentials,
			});

			if (!response.ok) {
				throw await errorFromResponse(response);
			}

			return await response.json();
		} finally {
			if (timeoutId) clearTimeout(timeoutId);
		}
	}
}
