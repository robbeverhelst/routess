import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isDev } from "@/lib/utils/env";

interface SettingsState {
  // Error toast settings
  showErrorToasts: boolean;

  // Actions
  setShowErrorToasts: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default to enabled in dev, disabled in production
      showErrorToasts: isDev(),

      setShowErrorToasts: (enabled: boolean) => set({ showErrorToasts: enabled }),
    }),
    {
      name: "maps-settings",
      partialize: (state) => ({
        showErrorToasts: state.showErrorToasts,
      }),
    },
  ),
);
