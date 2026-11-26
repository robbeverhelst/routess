import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";

import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { MetricsService } from "../telemetry/metrics.service";
import { type EngineFeature, RoutingShedError, RoutingUpstreamError } from "./routing-engine";

const VALHALLA_TIMEOUT_MS = 8000;

// The routing endpoints are reachable without auth (planning works before
// sign-in), so per-IP throttling alone can be sidestepped with enough IPs.
// This cap bounds the total concurrent upstream work one API replica can
// drive into Valhalla; excess requests are shed with a 503 instead of queued.
const MAX_CONCURRENT_VALHALLA_CALLS = 32;

// The only HTTP path to Valhalla. ValhallaEngine is its sole caller, so every
// request shares one concurrency cap, one timeout and one set of metrics.
// RoutingModule does not export it.
@Injectable()
export class ValhallaHttp {
	private readonly logger = new Logger(ValhallaHttp.name);
	private inFlightValhallaCalls = 0;
	// Covers the whole call, body included. Tests shorten it.
	timeoutMs = VALHALLA_TIMEOUT_MS;

	constructor(
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
		private readonly metrics: MetricsService,
	) {}

	async post<T>(path: string, body: unknown, feature: EngineFeature): Promise<T> {
		const baseUrl = this.config.routing.valhallaUrl;
		if (!baseUrl) {
			throw new RoutingUpstreamError("Valhalla routing is not configured", HttpStatus.SERVICE_UNAVAILABLE);
		}

		if (this.inFlightValhallaCalls >= MAX_CONCURRENT_VALHALLA_CALLS) {
			this.logger.warn(`Valhalla concurrency cap (${MAX_CONCURRENT_VALHALLA_CALLS}) reached, shedding request`);
			throw new RoutingShedError();
		}

		// The slot and the timeout both last until the body is read: a Valhalla
		// that sends headers and then stalls must neither hold a request
		// forever nor drop out of the concurrency count.
		this.inFlightValhallaCalls++;
		const signal = AbortSignal.timeout(this.timeoutMs);
		const start = Date.now();
		try {
			let response: Response;
			try {
				response = await fetch(`${baseUrl}${path}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
					signal,
				});
			} catch (err) {
				const error = err as Error;
				this.metrics.recordExternalRequest("valhalla", "error", Date.now() - start);
				this.metrics.recordProviderCall("valhalla", path, feature, "error");
				this.logger.warn(`Valhalla request failed: ${error.message}`);
				throw new RoutingUpstreamError("Valhalla request failed", HttpStatus.SERVICE_UNAVAILABLE);
			}

			this.metrics.recordExternalRequest("valhalla", response.ok ? "success" : "error", Date.now() - start);
			this.metrics.recordProviderCall("valhalla", path, feature, response.ok ? "success" : "error");

			if (!response.ok) {
				this.logger.warn(`Valhalla returned ${response.status} for ${path}`);
				await response.body?.cancel().catch(() => undefined);
				// Surface 4xx/5xx as a generic upstream error; do not leak Valhalla's body.
				throw new RoutingUpstreamError("Valhalla returned an error", HttpStatus.BAD_GATEWAY);
			}

			try {
				return (await response.json()) as T;
			} catch (err) {
				this.logger.warn(`Valhalla response for ${path} failed: ${(err as Error).message}`);
				throw new RoutingUpstreamError("Valhalla response failed", HttpStatus.SERVICE_UNAVAILABLE);
			}
		} finally {
			this.inFlightValhallaCalls--;
		}
	}
}
