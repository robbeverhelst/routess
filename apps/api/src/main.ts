import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { AppModule } from "./app.module";
import { config } from "dotenv";
import { join } from "path";
import helmet from "helmet";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require("compression");
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { initializeOpenTelemetry } from "./telemetry/tracing";
import { Logger } from "nestjs-pino";

// Load environment variables from root .env file
config({ path: join(__dirname, "../../../.env") });

// Initialize OpenTelemetry before app starts
initializeOpenTelemetry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Response compression for better performance
  app.use(
    compression({
      filter: (req, res) => {
        // Don't compress responses if this request has a 'x-no-compression' header
        if (req.headers["x-no-compression"]) {
          return false;
        }
        // Fall back to standard filter function
        return compression.filter(req, res);
      },
      threshold: 1024, // Only compress responses over 1KB
    }),
  );

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false, // Needed for some frontend frameworks
    }),
  );

  // Enable API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
    prefix: "api/v",
  });

  // Global exception filter (must be before validation pipe)
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true, // Automatically transform payloads
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
      disableErrorMessages: process.env.NODE_ENV === "production", // Hide detailed errors in production
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  await app.listen(3000);
}
bootstrap();
