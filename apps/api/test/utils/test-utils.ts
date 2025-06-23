import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { MikroORM, RequestContext } from "@mikro-orm/core";
import { AppModule } from "src/app.module";
import { JwtService } from "@nestjs/jwt";

export async function createTestApp(): Promise<INestApplication> {
  process.env.NODE_ENV = "test";
  process.env.DB_NAME = "maps_db_test"; // Use test database
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id"; // Mock Google Client ID
  process.env.JWT_SECRET = "test-secret-key"; // Ensure JWT secret is set

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
  });

  await app.init();
  return app;
}

export async function clearDatabase(app: INestApplication) {
  const orm = app.get(MikroORM);
  await RequestContext.create(orm.em, async () => {
    const generator = orm.getSchemaGenerator();
    await generator.refreshDatabase();
  });
}

export async function closeTestApp(app: INestApplication) {
  await app.close();
}

export function generateTestJWT(userId: number, email: string, app: INestApplication): string {
  const jwtService = app.get(JwtService);
  return jwtService.sign({ sub: userId, email });
}

export async function withRequestContext<T>(
  app: INestApplication,
  callback: () => Promise<T>,
): Promise<T> {
  const orm = app.get(MikroORM);
  return RequestContext.create(orm.em, callback);
}
