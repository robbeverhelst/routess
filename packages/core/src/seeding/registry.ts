import { euroVeloAdapter } from "./adapters/eurovelo";
import type { SeedAdapter } from "./types";

// Every known adapter. The refresh job and seed scripts resolve adapters by
// SeedSource key from here; adding a source = one adapter + one entry.
export const SEED_ADAPTERS: readonly SeedAdapter[] = [euroVeloAdapter];

export function seedAdapterByKey(key: string): SeedAdapter | undefined {
	return SEED_ADAPTERS.find((adapter) => adapter.meta.key === key);
}
