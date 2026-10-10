import { getRuntimeConfig } from "@/lib/runtime-config";

// Gate for every natural-language (✦) surface. The LLM key itself stays
// server-side; the client only reads a runtime flag telling it whether the
// NL layer should render at all. Tracks #312 — NL is additive and must render
// NOTHING when no LLM provider is configured. Defaults to off.
export function useLlmFeatureEnabled(): boolean {
	return getRuntimeConfig("VITE_LLM_ENABLED") === "true";
}
