import type { CreationSource } from "@/lib/analytics/events";
import type { CreateRouteRequest } from "@/lib/api";
import { Logger } from "@/lib/logger";

// A LocalRoute is a Route saved on this device by someone without an account.
// The payload is exactly what POST /routes takes, so claiming it into an
// account on sign-in is a straight replay. It never leaves the device until
// that claim runs.
export interface LocalRoute {
	// Random UUID minted on the device. Doubles as the idempotency key when the
	// route is claimed into an account.
	localId: string;
	route: CreateRouteRequest;
	creationSource: CreationSource;
	createdAt: string;
	updatedAt: string;
}

// Where LocalRoutes live. IndexedDB in the browser (a routed polyline can hold
// thousands of points, too much for the localStorage quota); an in-memory map
// in tests and when IndexedDB is unavailable.
export interface LocalRouteBackend {
	list(): Promise<LocalRoute[]>;
	put(route: LocalRoute): Promise<void>;
	delete(localId: string): Promise<void>;
}

const DB_NAME = "routess-local";
const DB_VERSION = 1;
const STORE = "routes";

const promisify = <T>(request: IDBRequest<T>): Promise<T> =>
	new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});

const openDb = (): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "localId" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});

export function createIndexedDbBackend(): LocalRouteBackend {
	let dbPromise: Promise<IDBDatabase> | null = null;
	const db = () => {
		dbPromise ??= openDb();
		return dbPromise;
	};
	const run = async <T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
		const tx = (await db()).transaction(STORE, mode);
		return promisify(op(tx.objectStore(STORE)));
	};

	return {
		list: () => run("readonly", (store) => store.getAll() as IDBRequest<LocalRoute[]>),
		put: async (route) => {
			await run("readwrite", (store) => store.put(route));
		},
		delete: async (localId) => {
			await run("readwrite", (store) => store.delete(localId));
		},
	};
}

export function createMemoryBackend(initial: LocalRoute[] = []): LocalRouteBackend {
	const routes = new Map(initial.map((r) => [r.localId, r]));
	return {
		list: async () => [...routes.values()].map((r) => structuredClone(r)),
		put: async (route) => {
			routes.set(route.localId, structuredClone(route));
		},
		delete: async (localId) => {
			routes.delete(localId);
		},
	};
}

export function createDefaultBackend(): LocalRouteBackend {
	if (typeof indexedDB === "undefined") {
		Logger.warn("[localRoutes] IndexedDB unavailable; routes saved on this device last only for this tab");
		return createMemoryBackend();
	}
	return createIndexedDbBackend();
}
