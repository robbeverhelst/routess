interface Entry<T> {
	value: T;
	expiresAt: number;
}

export class TtlCache<K extends string, V> {
	private store = new Map<K, Entry<V>>();
	constructor(private readonly ttlMs: number) {}

	async get(key: K, loader: () => Promise<V>): Promise<V> {
		const now = Date.now();
		const hit = this.store.get(key);
		if (hit && hit.expiresAt > now) {
			return hit.value;
		}
		const value = await loader();
		this.store.set(key, { value, expiresAt: now + this.ttlMs });
		return value;
	}

	invalidate(key?: K) {
		if (key === undefined) {
			this.store.clear();
		} else {
			this.store.delete(key);
		}
	}
}
