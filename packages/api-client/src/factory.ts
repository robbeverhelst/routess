import type { Logger } from "@routess/core";
import { LocalStorageAuthState, StorageAdapterAuthState } from "./adapters/auth";
import { FetchHttpClient } from "./adapters/http";
import { ApiClient } from "./services";
import type { AuthStateManager, ErrorHandler, HttpClient, StorageAdapter } from "./types";

export interface CreateApiClientOptions {
	baseUrl: string;
	platform: "web" | "mobile";
	// Required when platform === "mobile" unless authStateManager is provided.
	storage?: StorageAdapter;
	httpClient?: HttpClient;
	authStateManager?: AuthStateManager;
	errorHandler?: ErrorHandler;
	logger?: Logger;
}

const defaultErrorHandler: ErrorHandler = {
	handleError(error, context) {
		console.error(`API Error in ${context}:`, error);
	},
};

function defaultHttpClient(platform: "web" | "mobile"): HttpClient {
	// Mobile previously defaulted to a 10s request timeout; web had none.
	return new FetchHttpClient({ defaultTimeoutMs: platform === "mobile" ? 10_000 : undefined });
}

function defaultAuthStateManager(platform: "web" | "mobile", storage?: StorageAdapter): AuthStateManager {
	if (platform === "mobile") {
		if (!storage) {
			throw new Error(
				"createApiClient: mobile platform requires a `storage` adapter or an explicit `authStateManager`.",
			);
		}
		return new StorageAdapterAuthState(storage);
	}
	return new LocalStorageAuthState();
}

// Single entry point for both web and mobile. The previous Web/Mobile
// PlatformAdapter classes were near-identical; the only real variation
// point is auth-token storage.
export function createApiClient(options: CreateApiClientOptions): ApiClient {
	return new ApiClient({
		baseUrl: options.baseUrl,
		httpClient: options.httpClient ?? defaultHttpClient(options.platform),
		authStateManager: options.authStateManager ?? defaultAuthStateManager(options.platform, options.storage),
		errorHandler: options.errorHandler ?? defaultErrorHandler,
		logger: options.logger,
	});
}
