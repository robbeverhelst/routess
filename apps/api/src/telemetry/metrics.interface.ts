/**
 * Public surface of the metrics recorder.
 *
 * Exists so consumer tests can type fakes against this interface
 * instead of depending on MetricsService and (transitively) on
 * OpenTelemetry's Histogram/Counter types, which are awkward to mock.
 */
export interface Metrics {
	recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void;
	recordUserRegistration(registrationType: "google" | "email"): void;
	recordRouteCreated(userId: number): void;
	recordRouteDeleted(userId: number): void;
	setActiveUsers(count: number): void;
	recordDbQuery(operation: string, duration: number): void;
}
