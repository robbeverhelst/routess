import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppService } from "./app.service";

@ApiTags("app")
@Controller({ version: VERSION_NEUTRAL })
export class AppController {
	constructor(private readonly appService: AppService) {}

	@ApiOperation({
		summary: "API root metadata",
		description: "Returns the API name, version, and links. Useful as a smoke test that the API is up.",
	})
	@Get()
	getRoot() {
		return this.appService.getRoot();
	}
}
