import type { Logger } from "@routess/core";
import { InMemoryAuthState } from "./adapters/auth";
import { FetchHttpClient } from "./adapters/http";
import { ApiClient } from "./services";
import type { AuthStateManager, ErrorHandler, HttpClient } from "./types";

export interface CreateApiClientOptions {
	baseUrl: string;
	httpClient?: HttpClient;
	authStateManager?: AuthStateManager;
	errorHandler?: ErrorHandler;
	logger?: Logger;
}

const defaultErrorHandler: ErrorHandler = {
	handleError(_error, _context) {
		// no-op: callers wire up their own logger/reporter
	},
};

const defaultHttpClient = (): HttpClient => new FetchHttpClient({ credentials: "include" });

// In-memory by default: the httpOnly session cookie carries auth across
// reloads in browsers; persisting the Bearer JWT would expose it to XSS.
const defaultAuthStateManager = (): AuthStateManager => new InMemoryAuthState();

// Single entry point for the web client. The previous "platform" branch
// for mobile was a one-adapter seam (no second concrete adapter ever shipped);
// when mobile becomes real, reintroduce a `platform` parameter alongside a
// real second adapter. See ADR-0010.
export function createApiClient(options: CreateApiClientOptions): ApiClient {
	return new ApiClient({
		baseUrl: options.baseUrl,
		httpClient: options.httpClient ?? defaultHttpClient(),
		authStateManager: options.authStateManager ?? defaultAuthStateManager(),
		errorHandler: options.errorHandler ?? defaultErrorHandler,
		logger: options.logger,
	});
}
