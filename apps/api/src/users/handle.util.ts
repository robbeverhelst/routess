import type { EntityManager } from "@mikro-orm/core";
import { handleBaseFromName } from "@routess/core";
import { randomHandle } from "../entities/user.entity";

// Generate a unique Handle for a new User (CONTEXT.md "Handle"): slugified
// display name, never the email; random fallback when the name yields nothing
// usable or would leak the email local-part into a public URL.
export async function generateUniqueHandle(em: EntityManager, name: string, email: string): Promise<string> {
	const emailLocal = (email.split("@")[0] ?? "").toLowerCase();
	const base = handleBaseFromName(name);
	if (!base || base === emailLocal) return randomHandle();

	const taken = (await em
		.getConnection()
		.execute(`select 1 from "user" where "handle" = ? limit 1`, [base])) as unknown[];
	if (taken.length === 0) return base;
	return `${base}-${randomHandle().slice(-4)}`;
}
