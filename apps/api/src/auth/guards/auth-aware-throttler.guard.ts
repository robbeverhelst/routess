import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { PAT_TOKEN_PREFIX } from "../personal-access-tokens.service";

// Drop-in ThrottlerGuard replacement that isolates PAT-authenticated
// requests into their own per-token bucket. The default tracker is IP
// per request; on a request carrying `Authorization: Bearer routess_pat_…`
// we instead bucket by a short SHA-256 fingerprint of the bearer value,
// so a runaway agent loop throttles itself without locking the owning
// user's cookie session out of the same IP. ADR-0022.
//
// The throttler global guard runs before auth strategies populate
// req.user, which is why we sniff the Authorization header here rather
// than read req.user.jti. The fingerprint is one-way (no plaintext in
// metrics / log lines) and stable per token.
@Injectable()
export class AuthAwareThrottlerGuard extends ThrottlerGuard {
	protected override getTracker(req: Record<string, unknown>): Promise<string> {
		const headers = req.headers as Record<string, unknown> | undefined;
		const authHeader = headers?.authorization;
		if (typeof authHeader === "string") {
			const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
			if (bearer.startsWith(PAT_TOKEN_PREFIX)) {
				const fingerprint = createHash("sha256").update(bearer).digest("hex").slice(0, 16);
				return Promise.resolve(`pat:${fingerprint}`);
			}
		}
		return super.getTracker(req);
	}
}
