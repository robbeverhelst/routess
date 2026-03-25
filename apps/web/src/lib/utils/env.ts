/**
 * Environment utility that works in both development/production and test environments
 */

export const isDev = (): boolean => {
	// In tests, use a simple fallback
	if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
		return false;
	}

	// In normal runtime, use import.meta.env
	try {
		// Use dynamic access to avoid TypeScript parsing issues
		const importMeta = (globalThis as Record<string, Record<string, unknown>>).import?.meta as
			| Record<string, unknown>
			| undefined;
		if (importMeta?.env) {
			return ((importMeta.env as Record<string, unknown>).DEV as boolean) || false;
		}
	} catch {
		// Fallback for environments that don't support import.meta
	}

	// Only access process if it exists (not in browser)
	if (typeof process !== "undefined" && process.env) {
		return process.env.NODE_ENV === "development";
	}

	// Browser fallback - assume production
	return false;
};

export const getEnvVar = (key: string): string | undefined => {
	// In tests, use process.env
	if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
		return process.env[key];
	}

	// In normal runtime, use import.meta.env
	try {
		// Use dynamic access to avoid TypeScript parsing issues
		const importMeta = (globalThis as Record<string, Record<string, unknown>>).import?.meta as
			| Record<string, unknown>
			| undefined;
		if (importMeta?.env) {
			return (importMeta.env as Record<string, string>)[key];
		}
	} catch {
		// Fallback for environments that don't support import.meta
	}

	// Only access process if it exists (not in browser)
	if (typeof process !== "undefined" && process.env) {
		return process.env[key];
	}

	// Browser fallback - return undefined for missing env vars
	return undefined;
};
