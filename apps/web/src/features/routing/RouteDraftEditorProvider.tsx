import { createContext, type ReactNode, useContext } from "react";
import type { RouteDraftEditor } from "./RouteDraftEditor";

const Ctx = createContext<RouteDraftEditor | null>(null);

interface ProviderProps {
	editor: RouteDraftEditor | null;
	children: ReactNode;
}

export function RouteDraftEditorProvider({ editor, children }: ProviderProps) {
	return <Ctx.Provider value={editor}>{children}</Ctx.Provider>;
}

// Returns the editor when the map+token are ready, otherwise null. Components
// that render before the map is mounted (e.g. side panels) should null-guard.
export function useRouteDraftEditor(): RouteDraftEditor | null {
	return useContext(Ctx);
}
