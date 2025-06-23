import { INestApplication } from "@nestjs/common";
import supertest from "supertest";
import { createTestApp, closeTestApp } from "../utils";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it("/ (GET)", () => {
    return supertest(app.getHttpServer()).get("/").expect(200).expect("Hello World!");
  });
});
