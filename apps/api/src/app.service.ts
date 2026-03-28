import { Injectable } from "@nestjs/common";
import { getAppConfig } from "./config/app-config";

@Injectable()
export class AppService {
	getRoot() {
		const config = getAppConfig();
		return {
			name: config.app.name,
			version: config.app.version,
			status: "ok",
		};
	}
}
