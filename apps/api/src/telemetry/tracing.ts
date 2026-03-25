import { metrics, trace } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

// Initialize OpenTelemetry
export function initializeOpenTelemetry() {
	// Resource attributes for future use
	// const resourceAttributes = {
	//   [ATTR_SERVICE_NAME]: serviceName,
	//   [ATTR_SERVICE_VERSION]: serviceVersion,
	//   environment: process.env.NODE_ENV || "development",
	//   "deployment.environment": process.env.NODE_ENV || "development",
	// };

	// Prometheus exporter for metrics
	const prometheusExporter = new PrometheusExporter(
		{
			port: 9464, // Default Prometheus metrics port
			endpoint: "/metrics",
		},
		() => {
			console.log("Prometheus metrics server started on port 9464");
		},
	);

	// Create meter provider
	const meterProvider = new MeterProvider({
		readers: [prometheusExporter],
	});

	// Set global meter provider
	metrics.setGlobalMeterProvider(meterProvider);

	// OTLP trace exporter (optional, can be configured via env)
	const traceExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
		? new OTLPTraceExporter({
				url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
				headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS) : {},
			})
		: undefined;

	// Initialize SDK
	const sdk = new NodeSDK({
		instrumentations: [
			getNodeAutoInstrumentations({
				"@opentelemetry/instrumentation-fs": {
					enabled: false, // Disable fs instrumentation to reduce noise
				},
			}),
		],
		traceExporter,
	});

	// Initialize the SDK
	sdk.start();

	// Graceful shutdown
	process.on("SIGTERM", () => {
		sdk
			.shutdown()
			.then(() => console.log("OpenTelemetry terminated successfully"))
			.catch((error) => console.error("Error terminating OpenTelemetry", error))
			.finally(() => process.exit(0));
	});

	return { meterProvider };
}

// Get meter for creating custom metrics
export function getMeter(name = "maps-api") {
	return metrics.getMeter(name);
}

// Get tracer for creating custom spans
export function getTracer(name = "maps-api") {
	return trace.getTracer(name);
}
