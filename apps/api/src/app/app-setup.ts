import type { INestApplication } from "@nestjs/common";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { GlobalExceptionFilter } from "../common/filters/global-exception.filter";
import type { AppConfig } from "../config/app-config";
import { getAppConfig } from "../config/app-config";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require("compression");

export function configureApplication(app: INestApplication, config: AppConfig = getAppConfig()): void {
	app.use(
		compression({
			filter: (req, res) => {
				if (req.headers["x-no-compression"]) {
					return false;
				}

				return compression.filter(req, res);
			},
			threshold: 1024,
		}),
	);

	app.use(
		helmet({
			contentSecurityPolicy: false,
			crossOriginEmbedderPolicy: false,
		}),
	);

	app.enableVersioning({
		type: VersioningType.URI,
		defaultVersion: "1",
		prefix: "api/v",
	});

	app.useGlobalFilters(new GlobalExceptionFilter());

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
			transformOptions: {
				enableImplicitConversion: true,
			},
			disableErrorMessages: config.app.isProduction,
		}),
	);

	const allowedOrigins = new Set(config.app.frontendUrls);

	app.enableCors({
		origin: (origin, callback) => {
			if (!origin || allowedOrigins.has(origin)) {
				callback(null, true);
				return;
			}

			callback(new Error(`Origin ${origin} not allowed by CORS`), false);
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
	});

	if (!config.docs.enabled) {
		return;
	}

	const document = createOpenApiDocument(app, config);

	SwaggerModule.setup(config.docs.path.replace(/^\//, ""), app, document, {
		swaggerOptions: {
			persistAuthorization: true,
			tagsSorter: "alpha",
			operationsSorter: "alpha",
		},
		customSiteTitle: `${config.app.name} Docs`,
	});
}

export function createOpenApiDocument(app: INestApplication, config: AppConfig = getAppConfig()): OpenAPIObject {
	return SwaggerModule.createDocument(
		app,
		new DocumentBuilder()
			.setTitle(config.app.name)
			.setDescription(config.app.description)
			.setVersion(config.app.version)
			.addBearerAuth(
				{
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
					in: "header",
				},
				"JWT-auth",
			)
			.addServer(`http://localhost:${config.app.port}`, "Local development")
			.addServer("https://routess-api.robbeverhelst.com", "Production")
			.addServer("https://api.routess.com", "Future canonical domain")
			.addTag("auth", "Authentication endpoints")
			.addTag("routes", "Route management")
			.addTag("users", "User profile management")
			.addTag("app", "API root metadata")
			.addTag("health", "Health and monitoring")
			.addTag("metrics", "Prometheus metrics")
			.build(),
	);
}
