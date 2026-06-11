import { brusselsIcrAdapter } from "./adapters/brussels-icr";
import { euroVeloAdapter } from "./adapters/eurovelo";
import { osmBelgiumAdapter } from "./adapters/osm-routes";
import { ravelAdapter } from "./adapters/ravel";
import { toerismeVlaanderenIcoonroutesAdapter } from "./adapters/toerisme-vlaanderen";
import type { SeedAdapter } from "./types";

// Every known adapter. The refresh job and seed scripts resolve adapters by
// SeedSource key from here; adding a source = one adapter + one entry.
export const SEED_ADAPTERS: readonly SeedAdapter[] = [
	brusselsIcrAdapter,
	euroVeloAdapter,
	osmBelgiumAdapter,
	ravelAdapter,
	toerismeVlaanderenIcoonroutesAdapter,
];

export function seedAdapterByKey(key: string): SeedAdapter | undefined {
	return SEED_ADAPTERS.find((adapter) => adapter.meta.key === key);
}
