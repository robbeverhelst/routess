import { Controller, Get, Res, VERSION_NEUTRAL } from "@nestjs/common";
import type { Response } from "express";

@Controller({ path: "metrics", version: VERSION_NEUTRAL })
export class MetricsController {
	@Get()
	async getMetrics(@Res() res: Response) {
		try {
			// Fetch metrics from OpenTelemetry Prometheus exporter
			const response = await fetch("http://localhost:9464/metrics");

			if (response.ok) {
				const metrics = await response.text();
				res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
				res.send(metrics);
			} else {
				res.status(503).send("Metrics service unavailable");
			}
		} catch {
			// Fallback if OpenTelemetry metrics server is not available
			res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
			res.send("# OpenTelemetry metrics server not available\n");
		}
	}
}
