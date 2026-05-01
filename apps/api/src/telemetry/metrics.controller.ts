import { Controller, Get, Req, Res, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { getPrometheusExporter } from "./tracing";

@ApiTags("metrics")
@Controller({ path: "metrics", version: VERSION_NEUTRAL })
export class MetricsController {
	@Get()
	getMetrics(@Req() req: Request, @Res() res: Response) {
		const exporter = getPrometheusExporter();
		if (!exporter) {
			res.status(503).type("text/plain").send("# metrics disabled\n");
			return;
		}

		exporter.getMetricsRequestHandler(req, res);
	}
}
