import { getRuntimeConfig } from "@/lib/runtime-config";

export function nodeNetworkOverlaysEnabled(): boolean {
	return getRuntimeConfig("VITE_ENABLE_NODE_NETWORK_OVERLAYS") === "true";
}
