import { describe, expect, it } from "bun:test";
import { DUMMY_HASH, PasswordService, toCanonicalArgon2Hash } from "../../../src/auth/password.service";
import type { MetricsService } from "../../../src/telemetry/metrics.service";

// Written by the argon2 npm package (0.45.1) with the API's former options
// (argon2id, memoryCost 19456, timeCost 2, parallelism 1) for this password.
// Stored passwords look like this until their owners change them.
const LEGACY_PASSWORD = "correct horse battery staple";
const LEGACY_HASH = "$argon2id$v=19$m=19456,p=1,t=2$aMM9jOCe1FVsMRXtMri90w$E7peuBRevoIECHDv4gpgpQ00wHIL7qiHMPa0L4SorvA";

const passwords = new PasswordService({} as MetricsService);

describe("PasswordService", () => {
	it("verifies a hash written by the argon2 npm package", async () => {
		expect(await passwords.verify(LEGACY_HASH, LEGACY_PASSWORD)).toBe(true);
	});

	it("rejects the wrong password against a legacy hash", async () => {
		expect(await passwords.verify(LEGACY_HASH, "correct horse battery stapler")).toBe(false);
	});

	it("hashes with argon2id at the API's cost and verifies the result", async () => {
		const hash = await passwords.hash(LEGACY_PASSWORD);

		expect(hash).toStartWith("$argon2id$v=19$m=19456,t=2,p=1$");
		expect(await passwords.verify(hash, LEGACY_PASSWORD)).toBe(true);
		expect(await passwords.verify(hash, "something else entirely")).toBe(false);
	});

	it("treats a malformed hash as a failed match", async () => {
		expect(await passwords.verify("not-a-hash", LEGACY_PASSWORD)).toBe(false);
		expect(await passwords.verify("$argon2id$v=19$m=19456,t=2,p=1$AAAA$AAAA", LEGACY_PASSWORD)).toBe(false);
	});

	it("never matches any password against the timing dummy", async () => {
		for (const plain of ["", LEGACY_PASSWORD, "something else entirely"]) {
			expect(await passwords.verifyDummy(plain)).toBe(false);
		}
	});

	it("keeps the timing dummy a well-formed argon2id hash at the API's cost", async () => {
		const [, algorithm, version, params, salt, digest] = DUMMY_HASH.split("$");
		const [, , , apiParams] = (await passwords.hash(LEGACY_PASSWORD)).split("$");

		expect(algorithm).toBe("argon2id");
		expect(version).toBe("v=19");
		expect(params).toBe("m=19456,t=2,p=1");
		expect(params).toBe(apiParams);
		expect(Buffer.from(salt, "base64").length).toBeGreaterThanOrEqual(16);
		expect(Buffer.from(digest, "base64").length).toBe(32);
	});

	it("runs a real argon2 verify against the timing dummy instead of rejecting it", async () => {
		for (const plain of ["", LEGACY_PASSWORD, "something else entirely"]) {
			expect(await Bun.password.verify(plain, DUMMY_HASH)).toBe(false);
		}
	});
});

describe("toCanonicalArgon2Hash", () => {
	it("reorders argon2 parameters to m,t,p", () => {
		expect(toCanonicalArgon2Hash(LEGACY_HASH)).toBe(
			"$argon2id$v=19$m=19456,t=2,p=1$aMM9jOCe1FVsMRXtMri90w$E7peuBRevoIECHDv4gpgpQ00wHIL7qiHMPa0L4SorvA",
		);
	});

	it("leaves canonical and non-argon2 strings untouched", () => {
		const canonical = "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$ZGlnZXN0";
		expect(toCanonicalArgon2Hash(canonical)).toBe(canonical);
		expect(toCanonicalArgon2Hash("not-a-hash")).toBe("not-a-hash");
	});
});
