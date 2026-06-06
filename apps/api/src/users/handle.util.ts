import { type EntityManager, UniqueConstraintViolationException } from "@mikro-orm/core";
import { handleBaseFromName } from "@routess/core";
import { randomHandle } from "../entities/user.entity";

// Generate a unique Handle for a new User (CONTEXT.md "Handle"): slugified
// display name, never the email; random fallback when the name yields nothing
// usable or would leak the email local-part into a public URL. Compared as
// slugs on both sides: "john.doe" and "john-doe" are the same leak.
export async function generateUniqueHandle(em: EntityManager, name: string, email: string): Promise<string> {
	const emailLocal = (email.split("@")[0] ?? "").toLowerCase();
	const base = handleBaseFromName(name);
	if (!base || base === emailLocal || base === handleBaseFromName(emailLocal)) return randomHandle();

	const taken = (await em
		.getConnection()
		.execute(`select 1 from "user" where "handle" = ? limit 1`, [base])) as unknown[];
	if (taken.length === 0) return base;
	return `${base}-${randomHandle().slice(-4)}`;
}

// The check-then-insert above races with concurrent signups/renames; the
// user_handle_unique constraint is the arbiter, so callers catch this and
// retry with a fresh handle (signup) or return 409 (rename).
export function isHandleUniqueViolation(error: unknown): boolean {
	return error instanceof UniqueConstraintViolationException && String(error.message).includes("user_handle_unique");
}
