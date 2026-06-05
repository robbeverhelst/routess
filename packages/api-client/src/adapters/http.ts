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
		const { data } = await this.request<T>(url, "GET", undefined, options);
		return data;
	}

	async getWithHeaders<T>(
		url: string,
		options: RequestOptions = {},
	): Promise<{ data: T; headers: Record<string, string> }> {
		return this.request<T>(url, "GET", undefined, options);
	}

	async post<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
		const { data } = await this.request<T>(url, "POST", body, options);
		return data;
	}

	async put<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
		const { data } = await this.request<T>(url, "PUT", body, options);
		return data;
	}

	async patch<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
		const { data } = await this.request<T>(url, "PATCH", body, options);
		return data;
	}

	async delete<T>(url: string, options: RequestOptions = {}): Promise<T> {
		const { data } = await this.request<T>(url, "DELETE", undefined, options);
		return data;
	}

	private async request<T>(
		url: string,
		method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
		body: unknown,
		options: RequestOptions,
	): Promise<{ data: T; headers: Record<string, string> }> {
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

			const responseHeaders: Record<string, string> = {};
			response.headers.forEach((value, key) => {
				responseHeaders[key.toLowerCase()] = value;
			});

			return { data: await response.json(), headers: responseHeaders };
		} finally {
			if (timeoutId) clearTimeout(timeoutId);
		}
	}
}
