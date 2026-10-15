import { createHash } from "node:crypto";

import { BadRequestException, Injectable, Logger } from "@nestjs/common";

import { MetricsService } from "../telemetry/metrics.service";

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

// argon2id is the modern default. Parameters tuned for ~250–500ms per hash on
// a typical API host; tune via env if you find them too aggressive on your
// hardware. Bun.password always hashes with parallelism 1 (p=1).
const ARGON2_OPTIONS = {
	algorithm: "argon2id",
	memoryCost: 19_456,
	timeCost: 2,
} as const;

// A real argon2id hash at ARGON2_OPTIONS' cost (of a random, discarded
// password), so verifying against it does the same work as a wrong-password
// check on a stored hash.
export const DUMMY_HASH =
	"$argon2id$v=19$m=19456,t=2,p=1$72VpDGFLIZw2p4EmIPGSW/qq2fRRQIYWySKClAkOcUI$LOXk3N0LNNn1wyzHBGI8Y3I0oflHce2esVKfpJNguq4";

// Bun.password only parses an argon2 hash whose parameters are in the PHC
// order m,t,p. Hashes written before the move to Bun.password came from the
// argon2 npm package, which orders them m,p,t: same parameters, same digest,
// so reorder them before verifying.
export function toCanonicalArgon2Hash(hash: string): string {
	const fields = hash.split("$");
	if (fields.length !== 6 || !fields[1].startsWith("argon2")) return hash;
	const params = new Map(fields[3].split(",").map((param) => param.split("=", 2) as [string, string]));
	if (params.size !== 3 || !params.has("m") || !params.has("t") || !params.has("p")) return hash;
	fields[3] = `m=${params.get("m")},t=${params.get("t")},p=${params.get("p")}`;
	return fields.join("$");
}

@Injectable()
export class PasswordService {
	private readonly logger = new Logger(PasswordService.name);

	constructor(private readonly metrics: MetricsService) {}

	async hash(plain: string): Promise<string> {
		return Bun.password.hash(plain, ARGON2_OPTIONS);
	}

	async verify(hash: string, plain: string): Promise<boolean> {
		try {
			return await Bun.password.verify(plain, toCanonicalArgon2Hash(hash));
		} catch {
			return false;
		}
	}

	// Burns one argon2 verify so failures without a stored hash take as long
	// as a wrong password. Always resolves false.
	async verifyDummy(plain: string): Promise<boolean> {
		return this.verify(DUMMY_HASH, plain);
	}

	// Validates a candidate password before hashing. Length-only per NIST
	// 800-63B — no composition rules — plus a HIBP Pwned Passwords k-anonymity
	// check. Throws BadRequestException with a UI-friendly message on failure.
	async validateOrThrow(plain: string): Promise<void> {
		if (plain.length < PASSWORD_MIN_LENGTH) {
			throw new BadRequestException(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
		}
		if (plain.length > PASSWORD_MAX_LENGTH) {
			throw new BadRequestException(`Password must be at most ${PASSWORD_MAX_LENGTH} characters.`);
		}
		const breachCount = await this.checkHibp(plain);
		if (breachCount > 0) {
			throw new BadRequestException("This password has appeared in known data breaches. Choose a different password.");
		}
	}

	// HIBP Pwned Passwords v3 with k-anonymity: only the first 5 hex chars of
	// the SHA-1 hash leave the server. Returns the breach count for this exact
	// password (0 if not found, or if the lookup fails — fail-open to avoid
	// blocking legitimate signups when HIBP is unreachable).
	private async checkHibp(plain: string): Promise<number> {
		const sha1 = createHash("sha1").update(plain).digest("hex").toUpperCase();
		const prefix = sha1.slice(0, 5);
		const suffix = sha1.slice(5);
		const start = Date.now();
		try {
			const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
				headers: { "Add-Padding": "true" },
				signal: AbortSignal.timeout(3000),
			});
			this.metrics.recordExternalRequest("hibp", response.ok ? "success" : "error", Date.now() - start);
			if (!response.ok) {
				this.logger.warn(`HIBP returned ${response.status}; allowing password through (fail-open)`);
				return 0;
			}
			const body = await response.text();
			for (const line of body.split("\n")) {
				const [hashSuffix, countStr] = line.trim().split(":");
				if (hashSuffix === suffix) {
					return Number.parseInt(countStr ?? "0", 10) || 0;
				}
			}
			return 0;
		} catch (error) {
			this.metrics.recordExternalRequest("hibp", "error", Date.now() - start);
			this.logger.warn(`HIBP lookup failed: ${error instanceof Error ? error.message : String(error)}`);
			return 0;
		}
	}
}
