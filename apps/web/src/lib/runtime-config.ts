type RuntimeConfig = Partial<Record<`VITE_${string}`, string>>;

declare global {
	interface Window {
		__ROUTESS_CONFIG__?: RuntimeConfig;
	}
}

function normalize(value: string | undefined): string | undefined {
	if (!value || value.startsWith("__VITE_") || value.startsWith("%VITE_")) {
		return undefined;
	}
	return value;
}

export function getRuntimeConfig(key: `VITE_${string}`): string | undefined {
	if (typeof window !== "undefined") {
		const runtimeValue = normalize(window.__ROUTESS_CONFIG__?.[key]);
		if (runtimeValue) {
			return runtimeValue;
		}
	}

	return normalize(import.meta.env[key] as string | undefined);
}
