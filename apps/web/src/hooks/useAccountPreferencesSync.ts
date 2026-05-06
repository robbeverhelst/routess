import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { authStorageKeys } from "@/lib/auth-state";
import { type ApiUser, apiService } from "@/lib/api";
import { Logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-client";
import {
	DEFAULT_REDESIGN_SETTINGS,
	normalizeRedesignSettings,
	useRedesignSettingsStore,
} from "@/stores/redesignSettingsStore";

const SAVE_DEBOUNCE_MS = 750;

interface AuthStatusSnapshot {
	isAuthenticated: boolean;
	user: ApiUser | null;
}

export function useAccountPreferencesSync(auth: AuthStatusSnapshot | undefined) {
	const queryClient = useQueryClient();
	const units = useRedesignSettingsStore((state) => state.units);
	const showPois = useRedesignSettingsStore((state) => state.showPois);
	const terrain3d = useRedesignSettingsStore((state) => state.terrain3d);
	const autoSnap = useRedesignSettingsStore((state) => state.autoSnap);
	const publicProfile = useRedesignSettingsStore((state) => state.publicProfile);
	const hidePrivacy = useRedesignSettingsStore((state) => state.hidePrivacy);
	const defaultActivity = useRedesignSettingsStore((state) => state.defaultActivity);
	const selectedSports = useRedesignSettingsStore((state) => state.selectedSports);
	const sportSpeeds = useRedesignSettingsStore((state) => state.sportSpeeds);
	const mapStyle = useRedesignSettingsStore((state) => state.mapStyle);
	const overlays = useRedesignSettingsStore((state) => state.overlays);
	const locationPermission = useRedesignSettingsStore((state) => state.locationPermission);
	const replaceAllSettings = useRedesignSettingsStore((state) => state.replaceAllSettings);

	const applyingServerStateRef = useRef(false);
	const lastSyncedPreferencesRef = useRef<string | null>(null);
	const bootstrappedUserIdRef = useRef<number | null>(null);
	const lastStoredUserRef = useRef<string | null>(null);

	const preferences = useMemo(
		() =>
			normalizeRedesignSettings({
				units,
				showPois,
				terrain3d,
				autoSnap,
				publicProfile,
				hidePrivacy,
				defaultActivity,
				selectedSports,
				sportSpeeds,
				mapStyle,
				overlays,
				locationPermission,
			}),
		[
			autoSnap,
			defaultActivity,
			hidePrivacy,
			locationPermission,
			mapStyle,
			overlays,
			publicProfile,
			selectedSports,
			showPois,
			sportSpeeds,
			terrain3d,
			units,
		],
	);
	const serializedPreferences = JSON.stringify(preferences);
	const serializedDefaultPreferences = useMemo(
		() => JSON.stringify(normalizeRedesignSettings(DEFAULT_REDESIGN_SETTINGS)),
		[],
	);
	const serializedServerPreferences = useMemo(() => {
		if (!auth?.user?.preferences) {
			return null;
		}

		return JSON.stringify(normalizeRedesignSettings(auth.user.preferences));
	}, [auth?.user?.preferences]);

	useEffect(() => {
		if (!auth?.isAuthenticated || !auth.user) {
			lastSyncedPreferencesRef.current = null;
			bootstrappedUserIdRef.current = null;
			lastStoredUserRef.current = null;
			return;
		}

		const serializedUser = JSON.stringify(auth.user);
		if (serializedUser !== lastStoredUserRef.current) {
			lastStoredUserRef.current = serializedUser;
			localStorage.setItem(authStorageKeys.user, serializedUser);
		}
	}, [auth?.isAuthenticated, auth?.user]);

	useEffect(() => {
		if (!auth?.isAuthenticated || !auth.user) {
			return;
		}

		if (serializedServerPreferences) {
			const normalizedServerPreferences = JSON.parse(serializedServerPreferences);

			lastSyncedPreferencesRef.current = serializedServerPreferences;
			bootstrappedUserIdRef.current = auth.user.id;

			if (serializedServerPreferences !== serializedPreferences) {
				applyingServerStateRef.current = true;
				replaceAllSettings(normalizedServerPreferences);
				queueMicrotask(() => {
					applyingServerStateRef.current = false;
				});
			} else {
				applyingServerStateRef.current = false;
			}

			return;
		}

		if (bootstrappedUserIdRef.current === auth.user.id) {
			return;
		}

		bootstrappedUserIdRef.current = auth.user.id;
	}, [auth?.isAuthenticated, auth?.user?.id, replaceAllSettings, serializedServerPreferences]);

	useEffect(() => {
		if (!auth?.isAuthenticated || !auth.user) {
			return;
		}

		if (applyingServerStateRef.current) {
			return;
		}

		if (lastSyncedPreferencesRef.current === serializedPreferences) {
			return;
		}

		if (!auth.user.preferences && serializedPreferences === serializedDefaultPreferences) {
			return;
		}

		const saveTimer = window.setTimeout(() => {
			void apiService
				.updateCurrentUser({ preferences })
				.then((updatedUser) => {
					const serialized = JSON.stringify(preferences);
					lastSyncedPreferencesRef.current = serialized;

					queryClient.setQueryData(queryKeys.auth.session(), {
						isAuthenticated: true,
						user: updatedUser,
					});
					queryClient.setQueryData(queryKeys.user.profile(), updatedUser);

					localStorage.setItem(authStorageKeys.user, JSON.stringify(updatedUser));
				})
				.catch((error) => {
					Logger.error("[useAccountPreferencesSync] Failed to sync account preferences:", error);
				});
		}, SAVE_DEBOUNCE_MS);

		return () => {
			window.clearTimeout(saveTimer);
		};
	}, [
		auth?.isAuthenticated,
		auth?.user?.id,
		auth?.user?.preferences,
		preferences,
		queryClient,
		serializedDefaultPreferences,
		serializedPreferences,
	]);
}
