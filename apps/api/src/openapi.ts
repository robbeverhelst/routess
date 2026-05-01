import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { createOpenApiDocument } from "./app/app-setup";
import { getAppConfig, loadEnvironment } from "./config/app-config";

async function generateOpenApi() {
	loadEnvironment();
	process.env.OPENAPI_GENERATE = "true";
	process.env.SWAGGER_ENABLED = "true";

	const { AppModule } = await import("./app.module");
	const app = await NestFactory.create(AppModule, { logger: false });
	const document = createOpenApiDocument(app, getAppConfig());
	const outputPath = resolve(process.cwd(), "../../apps/docs/openapi/routess.openapi.json");

	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
	await app.close();

	console.log(`OpenAPI spec written to ${outputPath}`);
}

void generateOpenApi();
