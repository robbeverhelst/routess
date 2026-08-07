import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { type ApiUser, apiService } from "@/lib/api";
import { authStorageKeys } from "@/lib/auth-state";
import { t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-client";
import { usePreferencesSyncStore } from "@/stores/preferencesSyncStore";
import {
	DEFAULT_REDESIGN_SETTINGS,
	normalizeRedesignSettings,
	useRedesignSettingsStore,
} from "@/stores/redesignSettingsStore";
import { useToastStore } from "@/stores/toastStore";

const SAVE_DEBOUNCE_MS = 750;

interface AuthStatusSnapshot {
	isAuthenticated: boolean;
	user: ApiUser | null;
}

export function useUserPreferencesSync(auth: AuthStatusSnapshot | undefined) {
	const queryClient = useQueryClient();
	const isAuthenticated = auth?.isAuthenticated ?? false;
	const authUser = auth?.user ?? null;
	const authUserId = authUser?.id ?? null;
	const authUserPreferences = authUser?.preferences ?? null;
	const units = useRedesignSettingsStore((state) => state.units);
	const showPois = useRedesignSettingsStore((state) => state.showPois);
	const terrain3d = useRedesignSettingsStore((state) => state.terrain3d);
	const autoSnap = useRedesignSettingsStore((state) => state.autoSnap);
	const defaultActivity = useRedesignSettingsStore((state) => state.defaultActivity);
	const selectedSports = useRedesignSettingsStore((state) => state.selectedSports);
	const sportSpeeds = useRedesignSettingsStore((state) => state.sportSpeeds);
	const mapStyle = useRedesignSettingsStore((state) => state.mapStyle);
	const overlays = useRedesignSettingsStore((state) => state.overlays);
	const defaultRouteVisibility = useRedesignSettingsStore((state) => state.defaultRouteVisibility);
	const replaceAllSettings = useRedesignSettingsStore((state) => state.replaceAllSettings);
	const setSyncStatus = usePreferencesSyncStore((state) => state.setStatus);
	const pushToast = useToastStore((state) => state.push);

	const applyingServerStateRef = useRef(false);
	const statusResetTimerRef = useRef<number | null>(null);
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
				defaultActivity,
				selectedSports,
				sportSpeeds,
				mapStyle,
				overlays,
				defaultRouteVisibility,
			}),
		[
			autoSnap,
			defaultActivity,
			defaultRouteVisibility,
			mapStyle,
			overlays,
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
			const isNewUser = bootstrappedUserIdRef.current !== authUserId;
			const localMatchesLastSynced =
				lastSyncedPreferencesRef.current !== null && serializedPreferences === lastSyncedPreferencesRef.current;
			const localIsStillDefault = serializedPreferences === serializedDefaultPreferences;
			const shouldApplyServerPreferences = isNewUser || localMatchesLastSynced || localIsStillDefault;

			bootstrappedUserIdRef.current = authUserId;

			if (shouldApplyServerPreferences) {
				lastSyncedPreferencesRef.current = serializedServerPreferences;

				if (serializedServerPreferences !== serializedPreferences) {
					applyingServerStateRef.current = true;
					replaceAllSettings(normalizedServerPreferences);
					queueMicrotask(() => {
						applyingServerStateRef.current = false;
					});
				} else {
					applyingServerStateRef.current = false;
				}
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
		serializedDefaultPreferences,
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

		const scheduleStatusReset = (status: "saved" | "error", revertAfterMs: number) => {
			setSyncStatus(status);
			if (statusResetTimerRef.current !== null) {
				window.clearTimeout(statusResetTimerRef.current);
			}
			statusResetTimerRef.current = window.setTimeout(() => {
				setSyncStatus("idle");
				statusResetTimerRef.current = null;
			}, revertAfterMs);
		};

		const saveTimer = window.setTimeout(() => {
			setSyncStatus("saving");
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
					scheduleStatusReset("saved", 2000);
				})
				.catch((error) => {
					Logger.error("[useUserPreferencesSync] Failed to sync user preferences:", error);
					scheduleStatusReset("error", 4000);
					pushToast({ kind: "danger", title: t("settings.sync.failed") });
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
		pushToast,
		queryClient,
		serializedDefaultPreferences,
		serializedPreferences,
		setSyncStatus,
	]);
}
