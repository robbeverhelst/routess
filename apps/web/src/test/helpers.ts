import { type Mock, vi } from "bun:test";

// Small stand-ins for the vitest helpers bun:test does not ship.

/** Types an already-mocked function as a Mock (vitest's vi.mocked). */
export function mocked<T extends (...args: never[]) => unknown>(fn: T): Mock<T> {
	return fn as unknown as Mock<T>;
}

/**
 * vitest's factory-less vi.mock: every function export becomes a bare vi.fn().
 * Use as vi.mock(path, async () => automock(await import(path))).
 */
export function automock<T extends object>(module: T): T {
	return Object.fromEntries(
		Object.entries(module).map(([name, value]) => [name, typeof value === "function" ? vi.fn() : value]),
	) as T;
}

const stubs: Array<{ target: object; name: PropertyKey; original: PropertyDescriptor | undefined }> = [];

/**
 * Replaces a property, getter or not, until unstubAll(). Covers vitest's
 * vi.stubGlobal and vi.spyOn(target, name, "get"), which bun:test cannot do.
 */
export function stubProperty(target: object, name: PropertyKey, value: unknown): void {
	if (!stubs.some((stub) => stub.target === target && stub.name === name)) {
		stubs.push({ target, name, original: Object.getOwnPropertyDescriptor(target, name) });
	}
	Object.defineProperty(target, name, { value, configurable: true, writable: true, enumerable: true });
}

/** Replaces a global until unstubAll() (vitest's vi.stubGlobal). */
export function stubGlobal(name: PropertyKey, value: unknown): void {
	stubProperty(globalThis, name, value);
}

/** Restores everything replaced by stubProperty() and stubGlobal(), newest first. */
export function unstubAll(): void {
	for (const { target, name, original } of stubs.reverse()) {
		if (original) {
			Object.defineProperty(target, name, original);
		} else {
			Reflect.deleteProperty(target, name);
		}
	}
	stubs.length = 0;
}
