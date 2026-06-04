import { create } from "zustand";

export type PreferencesSyncStatus = "idle" | "saving" | "saved" | "error";

interface PreferencesSyncState {
	status: PreferencesSyncStatus;
	setStatus: (status: PreferencesSyncStatus) => void;
}

// Transient sync state for the debounced account-preferences save.
// Not persisted; drives the "Saving…"/"Saved" pill in the settings panel.
export const usePreferencesSyncStore = create<PreferencesSyncState>((set) => ({
	status: "idle",
	setStatus: (status) => set({ status }),
}));
