import { describe, expect, it } from "bun:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateRouteDto } from "../../../src/routes/dto/create-route.dto";

// Mirror the global ValidationPipe (transform + implicit conversion), then
// validate, and isolate the `tags` field so other required fields don't matter.
async function check(tags: unknown) {
	const dto = plainToInstance(CreateRouteDto, { tags }, { enableImplicitConversion: true });
	const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
	return { dto, tagError: errors.find((e) => e.property === "tags") };
}

describe("CreateRouteDto tags", () => {
	it("normalises case and whitespace server-side", async () => {
		const { dto, tagError } = await check(["Hilly", "Weekend Loop", "  Scenic  "]);
		expect(dto.tags).toEqual(["hilly", "weekend-loop", "scenic"]);
		expect(tagError).toBeUndefined();
	});

	it("rejects a tag that is still too long after normalising", async () => {
		const { tagError } = await check(["a".repeat(30)]);
		expect(tagError).toBeDefined();
	});

	it("rejects a tag that does not start with [a-z0-9]", async () => {
		const { tagError } = await check(["-nope"]);
		expect(tagError).toBeDefined();
	});

	it("rejects more than 10 tags", async () => {
		const { tagError } = await check(Array.from({ length: 11 }, (_, i) => `tag${i}`));
		expect(tagError).toBeDefined();
	});

	it("accepts an absent tags field", async () => {
		const { tagError } = await check(undefined);
		expect(tagError).toBeUndefined();
	});
});
