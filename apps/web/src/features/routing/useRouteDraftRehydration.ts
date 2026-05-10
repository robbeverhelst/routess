import { useEffect, useRef } from "react";
import { useUserRoutes } from "@/lib/api-queries";
import { hasStoredUser } from "@/lib/auth-state";
import { useT } from "@/lib/i18n";
import { useDraftMode, useSetMode } from "@/stores/routingStore";
import { useToastStore } from "@/stores/toastStore";

// Validates the persisted RouteDraft.mode binding on app boot. If the editing
// draft points at a saved Route the user no longer has access to (deleted on
// another device, signed out, etc.), the binding is dropped to `unsaved` so
// the next Save creates a fresh Route instead of failing or, worse, silently
// targeting the wrong id. Idempotent across re-renders via a ref guard.
export function useRouteDraftRehydration(): void {
	const t = useT();
	const mode = useDraftMode();
	const setMode = useSetMode();
	const pushToast = useToastStore((s) => s.push);
	const isAuthenticated = hasStoredUser();
	const { data: routes, isSuccess } = useUserRoutes();
	const checkedRef = useRef(false);

	useEffect(() => {
		if (checkedRef.current) return;
		if (mode.kind !== "editing") {
			checkedRef.current = true;
			return;
		}
		// Unauthenticated: the binding can't be honoured (PATCH would 401).
		// Drop it so the user starts in unsaved mode with their waypoints.
		if (!isAuthenticated) {
			checkedRef.current = true;
			setMode({ kind: "unsaved" });
			pushToast({ kind: "info", title: t("plan.bindingDropped"), body: t("plan.bindingDroppedSignedOut") });
			return;
		}
		if (!isSuccess || !routes) return;
		const stillExists = routes.some((r) => r.id === mode.routeId);
		checkedRef.current = true;
		if (stillExists) return;
		setMode({ kind: "unsaved" });
		pushToast({ kind: "info", title: t("plan.bindingDropped"), body: t("plan.bindingDroppedMissing") });
	}, [mode, isAuthenticated, isSuccess, routes, setMode, pushToast, t]);
}
