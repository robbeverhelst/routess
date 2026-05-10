import { createHash } from "node:crypto";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import * as argon2 from "argon2";

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

// argon2id is the modern default. Parameters tuned for ~250–500ms per hash on
// a typical API host; tune via env if you find them too aggressive on your
// hardware.
const ARGON2_OPTIONS: argon2.Options = {
	type: argon2.argon2id,
	memoryCost: 19_456,
	timeCost: 2,
	parallelism: 1,
};

@Injectable()
export class PasswordService {
	private readonly logger = new Logger(PasswordService.name);

	async hash(plain: string): Promise<string> {
		return argon2.hash(plain, ARGON2_OPTIONS);
	}

	async verify(hash: string, plain: string): Promise<boolean> {
		try {
			return await argon2.verify(hash, plain);
		} catch {
			return false;
		}
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
		try {
			const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
				headers: { "Add-Padding": "true" },
				signal: AbortSignal.timeout(3000),
			});
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
			this.logger.warn(`HIBP lookup failed: ${error instanceof Error ? error.message : String(error)}`);
			return 0;
		}
	}
}
