/**
 * Public surface of the metrics recorder.
 *
 * Exists so consumer tests can type fakes against this interface
 * instead of depending on MetricsService and (transitively) on
 * OpenTelemetry's Histogram/Counter types, which are awkward to mock.
 */
import type {
	AuthLoginResult,
	AuthProvider,
	RouteGenerationCompletedEvent,
	SessionRevocationReason,
} from "./domain-events";

export interface Metrics {
	recordRouteGeneration(event: RouteGenerationCompletedEvent): void;
	recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void;
	recordUserRegistration(registrationType: "google" | "email"): void;
	recordUserUndeleted(): void;
	recordRouteCreated(): void;
	recordRouteDeleted(): void;
	setActiveUsers(count: number): void;
	recordDbQuery(operation: string, duration: number): void;
	recordLoginAttempt(provider: AuthProvider, result: AuthLoginResult): void;
	recordSessionRevoked(reason: SessionRevocationReason, count: number): void;
	recordExternalRequest(provider: string, status: "success" | "error", duration: number): void;
	recordProviderCall(provider: string, endpoint: string, feature: string, outcome: "success" | "error"): void;
	recordCacheEvent(cache: string, result: "hit" | "miss"): void;
}
