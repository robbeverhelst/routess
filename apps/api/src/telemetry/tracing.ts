import { metrics, trace } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { AppConfig } from "../config/app-config";

let sdk: NodeSDK | null = null;
let prometheusExporter: PrometheusExporter | null = null;

export function initializeOpenTelemetry(config: AppConfig) {
	if (sdk || !config.telemetry.enabled) {
		return { prometheusExporter };
	}

	prometheusExporter = config.telemetry.metricsEnabled
		? new PrometheusExporter({
				port: config.telemetry.metricsPort,
				endpoint: config.telemetry.metricsPath,
				preventServerStart: true,
			})
		: null;

	// Surfaces as the Prometheus `target_info` series, so dashboards can
	// answer "which version is affected" without a label on every metric.
	const resource = resourceFromAttributes({
		"service.name": "routess-api",
		"service.version": config.app.version,
	});

	const meterProvider = new MeterProvider({
		resource,
		readers: prometheusExporter ? [prometheusExporter] : [],
	});

	metrics.setGlobalMeterProvider(meterProvider);

	if (config.app.isTest) {
		return { prometheusExporter };
	}

	sdk = new NodeSDK({
		resource,
		instrumentations: [
			getNodeAutoInstrumentations({
				"@opentelemetry/instrumentation-fs": {
					enabled: false,
				},
			}),
			new RuntimeNodeInstrumentation(),
		],
		traceExporter: config.telemetry.otlpEndpoint
			? new OTLPTraceExporter({
					url: `${config.telemetry.otlpEndpoint}/v1/traces`,
					headers: config.telemetry.otlpHeaders,
				})
			: undefined,
	});

	void sdk.start();

	process.once("SIGTERM", () => {
		void sdk?.shutdown().finally(() => process.exit(0));
	});

	return { prometheusExporter };
}

export function getMeter(name = "maps-api") {
	return metrics.getMeter(name);
}

export function getTracer(name = "maps-api") {
	return trace.getTracer(name);
}

export function getPrometheusExporter(): PrometheusExporter | null {
	return prometheusExporter;
}
