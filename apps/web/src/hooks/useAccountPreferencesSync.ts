import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { type ApiUser, apiService } from "@/lib/api";
import { authStorageKeys } from "@/lib/auth-state";
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
	const isAuthenticated = auth?.isAuthenticated ?? false;
	const authUser = auth?.user ?? null;
	const authUserId = authUser?.id ?? null;
	const authUserPreferences = authUser?.preferences ?? null;
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
	const normalizedServerPreferences = useMemo(
		() => (authUserPreferences ? normalizeRedesignSettings(authUserPreferences) : null),
		[authUserPreferences],
	);
	const serializedServerPreferences = useMemo(
		() => (normalizedServerPreferences ? JSON.stringify(normalizedServerPreferences) : null),
		[normalizedServerPreferences],
	);

	useEffect(() => {
		if (!isAuthenticated || !authUser) {
			lastSyncedPreferencesRef.current = null;
			bootstrappedUserIdRef.current = null;
			lastStoredUserRef.current = null;
			return;
		}

		const serializedUser = JSON.stringify(authUser);
		if (serializedUser !== lastStoredUserRef.current) {
			lastStoredUserRef.current = serializedUser;
			localStorage.setItem(authStorageKeys.user, serializedUser);
		}
	}, [authUser, isAuthenticated]);

	useEffect(() => {
		if (!isAuthenticated || authUserId === null) {
			return;
		}

		if (normalizedServerPreferences && serializedServerPreferences) {
			lastSyncedPreferencesRef.current = serializedServerPreferences;
			bootstrappedUserIdRef.current = authUserId;

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

		if (bootstrappedUserIdRef.current === authUserId) {
			return;
		}

		bootstrappedUserIdRef.current = authUserId;
	}, [
		authUserId,
		isAuthenticated,
		normalizedServerPreferences,
		replaceAllSettings,
		serializedPreferences,
		serializedServerPreferences,
	]);

	useEffect(() => {
		if (!isAuthenticated || authUserId === null) {
			return;
		}

		if (applyingServerStateRef.current) {
			return;
		}

		if (lastSyncedPreferencesRef.current === serializedPreferences) {
			return;
		}

		if (!authUserPreferences && serializedPreferences === serializedDefaultPreferences) {
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
		authUserId,
		authUserPreferences,
		isAuthenticated,
		preferences,
		queryClient,
		serializedDefaultPreferences,
		serializedPreferences,
	]);
}
