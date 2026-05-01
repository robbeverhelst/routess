import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AppService } from "./app.service";

@ApiTags("app")
@Controller({ version: VERSION_NEUTRAL })
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Get()
	getRoot() {
		return this.appService.getRoot();
	}
}
