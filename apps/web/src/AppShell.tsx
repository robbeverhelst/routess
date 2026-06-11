import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import MapWithRouting from "@/components/MapWithRouting";
import { useRouteSurfaceSync } from "@/features/routing/services/useSurfaceBreakdown";
import { useRouteDraftRehydration } from "@/features/routing/useRouteDraftRehydration";
import { usePwaUpdateToast } from "@/hooks/usePwaUpdateToast";
import { apiService } from "@/lib/api";
import { useAuthStatus } from "@/lib/api-queries";
import { emitAppEvent, onAppEvent } from "@/lib/app-events";
import { hasStoredUser } from "@/lib/auth-state";
import { type SupportedLanguage, t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-client";
import { useUnits } from "@/lib/units";
import { useLibraryStore } from "@/stores/libraryStore";
import { useModalsStore } from "@/stores/modalsStore";
import {
	useCanRedo,
	useCanUndo,
	useElevationGain,
	useHasRoute,
	useIsMapLocked,
	useRouteDistance,
	useRouteDuration,
	useSetIsMapLocked,
	useWaypoints,
} from "@/stores/routingStore";
import { useToastStore } from "@/stores/toastStore";
import { type RedesignContext, useUiStore } from "@/stores/uiStore";
import { BottomTabBar } from "./components/BottomTabBar";
import { I } from "./components/icons";
import { MapToolbar } from "./components/MapToolbar";
import { MobilePanelDrawer } from "./components/MobilePanelDrawer";
import { MobilePlanTitle } from "./components/MobilePlanTitle";
import { MobileTopBar } from "./components/MobileTopBar";
import { Badge, IconBtn, RDS_COLORS } from "./components/primitives";
import { RailNav } from "./components/RailNav";
import { RouteChip } from "./components/RouteChip";
import { useLocateButtonState } from "./hooks/useLocateButtonState";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { useUserPreferencesSync } from "./hooks/useUserPreferencesSync";
import { useViewport } from "./hooks/useViewport";
import { CommandPalette } from "./modals/CommandPalette";
import { ConfirmDeleteModal } from "./modals/ConfirmDeleteModal";
import { ImportModal } from "./modals/ImportModal";
import { LoopModal } from "./modals/LoopModal";
import { RoutingModal } from "./modals/RoutingModal";
import { SaveModal } from "./modals/SaveModal";
import { SearchModal } from "./modals/SearchModal";
import { ShareModal } from "./modals/ShareModal";
import { LayerPicker } from "./overlays/LayerPicker";
import { NotificationCenter } from "./overlays/NotificationCenter";
import { ToastStack } from "./overlays/ToastStack";
import { DiscoverPanel } from "./panels/DiscoverPanel";
import { LibraryPanel } from "./panels/LibraryPanel";
import { PlanPanel } from "./panels/PlanPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { SocialPanel } from "./panels/SocialPanel";
import { CalendarScreen } from "./screens/CalendarScreen";
import { CoachmarksScreen } from "./screens/CoachmarksScreen";
import { CompareScreen } from "./screens/CompareScreen";
import { type ErrorKind, ErrorScreen } from "./screens/ErrorScreen";
import { LiveNavScreen } from "./screens/LiveNavScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MobileDrawer } from "./screens/MobileDrawer";
import { PostActivityScreen } from "./screens/PostActivityScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { RecordingScreen } from "./screens/RecordingScreen";
import { SignUpScreen } from "./screens/SignUpScreen";
import { UserSettingsScreen } from "./screens/UserSettingsScreen";

const SCREEN_TITLE_KEYS: Record<RedesignContext, string> = {
	plan: "nav.plan",
	library: "nav.library",
	discover: "nav.discover",
	social: "nav.social",
	settings: "nav.settings",
};

function screenTitle(context: RedesignContext, _language: SupportedLanguage): string {
	return t(SCREEN_TITLE_KEYS[context]);
}

interface AppShellProps {
	initialCenter?: [number, number];
	initialZoom?: number;
	routeId?: string;
}

type AuthView = "app" | "login" | "signup";

type DevScreen =
	| "livenav"
	| "recording"
	| "postactivity"
	| "profile"
	| "user-settings"
	| "compare"
	| "calendar"
	| "drawer"
	| "coachmarks"
	| "err-routefail"
	| "err-gps";

function getDevScreen(): DevScreen | null {
	if (typeof window === "undefined") return null;
	const value = new URLSearchParams(window.location.search).get("screen");
	if (!value) return null;
	const allowed: DevScreen[] = [
		"livenav",
		"recording",
		"postactivity",
		"profile",
		"user-settings",
		"compare",
		"calendar",
		"drawer",
		"coachmarks",
		"err-routefail",
		"err-gps",
	];
	return (allowed as string[]).includes(value) ? (value as DevScreen) : null;
}

const SKIPPED_AUTH_KEY = "routess.skippedAuth";

function readSkippedAuth(): boolean {
	if (typeof window === "undefined") return false;
	// Deep links into a shared or seeded route must never hit the sign-in
	// wall: the URL is the capability (ADR 0025), the wall would break it.
	const params = new URLSearchParams(window.location.search);
	if (params.has("route") || params.has("externalRoute")) return true;
	try {
		return localStorage.getItem(SKIPPED_AUTH_KEY) === "1";
	} catch {
		return false;
	}
}

function writeSkippedAuth(value: boolean): void {
	try {
		if (value) localStorage.setItem(SKIPPED_AUTH_KEY, "1");
		else localStorage.removeItem(SKIPPED_AUTH_KEY);
	} catch {
		// ignore storage failures (private mode, quota)
	}
}

export function AppShell({ initialCenter, initialZoom, routeId }: AppShellProps) {
	const { context, setContext, theme, accent, panelCollapsed, togglePanel, language } = useUiStore();
	const { modal, overlay, openModal, openOverlay, closeOverlay } = useModalsStore();
	const { data: auth } = useAuthStatus();
	const online = useOnlineStatus();
	const hasRoute = useHasRoute();
	const hasAnyWaypoint = useWaypoints().length > 0;
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const elevationGain = useElevationGain();
	const { formatElevationParts } = useUnits();
	const elevation = (() => {
		if (elevationGain == null) return undefined;
		const parts = formatElevationParts(elevationGain);
		return `${parts.value} ${parts.unit}`;
	})();
	const canUndo = useCanUndo();
	const canRedo = useCanRedo();
	const isLocked = useIsMapLocked();
	const setIsLocked = useSetIsMapLocked();

	useRouteSurfaceSync();
	useRouteDraftRehydration();
	usePwaUpdateToast();

	const queryClient = useQueryClient();
	const { isMobile } = useViewport();
	const locateButton = useLocateButtonState();
	const [authView, setAuthView] = useState<AuthView>("login");
	const [skippedAuth, setSkippedAuthState] = useState<boolean>(readSkippedAuth);
	const setSkippedAuth = useCallback((value: boolean) => {
		writeSkippedAuth(value);
		setSkippedAuthState(value);
	}, []);
	const [offlineDismissed, setOfflineDismissed] = useState(false);
	const [devScreen, setDevScreen] = useState<DevScreen | null>(getDevScreen);
	const wasMobileRef = useRef<boolean | null>(null);

	useUserPreferencesSync(auth);

	useEffect(() => {
		if (wasMobileRef.current === null) {
			wasMobileRef.current = isMobile;
			if (isMobile) useUiStore.getState().setPanelCollapsed(true);
			return;
		}
		if (isMobile && !wasMobileRef.current) {
			useUiStore.getState().setPanelCollapsed(true);
		}
		wasMobileRef.current = isMobile;
	}, [isMobile]);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
	}, [theme]);

	// ?collection=<id> deep link: open the shared-collection view in the
	// library panel. Works for anonymous visitors (unlisted/public collections).
	useEffect(() => {
		const raw = new URLSearchParams(window.location.search).get("collection");
		if (!raw) return;
		const id = Number.parseInt(raw, 10);
		if (Number.isNaN(id)) return;
		useLibraryStore.getState().setSharedCollectionId(id);
		setContext("library");
		useUiStore.getState().setPanelCollapsed(false);
	}, [setContext]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const meta = e.metaKey || e.ctrlKey;
			if (meta && e.key.toLowerCase() === "k") {
				e.preventDefault();
				openModal("palette");
			}
			if (meta && e.key.toLowerCase() === "d") {
				e.preventDefault();
				useUiStore.getState().toggleTheme();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [openModal]);

	useEffect(() => {
		const onAuthChange = () => {
			// Invalidate the auth-status cache so useAuthStatus re-evaluates after
			// sign-in/sign-out. Without this, the cached { isAuthenticated: true }
			// lingers and the UI never reflects a sign-out.
			queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
			const stillSignedIn = hasStoredUser();
			if (!stillSignedIn) {
				setSkippedAuth(false);
				setAuthView("login");
				setDevScreen(null);
			}
		};
		window.addEventListener("auth-change", onAuthChange);
		return () => window.removeEventListener("auth-change", onAuthChange);
	}, [queryClient, setSkippedAuth]);

	useEffect(() => {
		const pushToast = useToastStore.getState().push;
		const onOpenUserSettings = () => {
			setDevScreen("user-settings");
		};
		const onOpenLogin = () => {
			setSkippedAuth(false);
			setAuthView("login");
		};
		const onOpenSignup = () => {
			setSkippedAuth(false);
			setAuthView("signup");
		};
		const onOpenProfile = () => {
			setDevScreen("profile");
		};
		const onOpenDiscover = () => {
			setContext("discover");
		};
		const onOpenSocial = () => {
			setContext("social");
		};
		const onExportAll = async () => {
			if (!hasStoredUser()) {
				pushToast({
					kind: "info",
					title: t("account.signInToExport"),
					body: t("account.exportNeedsAuth"),
				});
				return;
			}
			try {
				const routes = await apiService.getRoutes();
				const bundle = {
					exportedAt: new Date().toISOString(),
					schema: "routess.export.v1",
					routes,
				};
				const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = `routess-export-${new Date().toISOString().slice(0, 10)}.json`;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				URL.revokeObjectURL(url);
				pushToast({
					kind: "success",
					title: t("account.exportReady"),
					body:
						routes.length === 1
							? t("account.downloadedSingular", { count: String(routes.length) })
							: t("account.downloadedPlural", { count: String(routes.length) }),
				});
			} catch (err) {
				Logger.error("[AppShell] export-all-data failed", err);
				pushToast({
					kind: "danger",
					title: t("account.exportFailed"),
					body: t("account.exportFailedSub"),
				});
			}
		};
		const unsubscribers = [
			onAppEvent("routess:open-user-settings", onOpenUserSettings),
			onAppEvent("routess:open-profile", onOpenProfile),
			onAppEvent("routess:open-login", onOpenLogin),
			onAppEvent("routess:open-signup", onOpenSignup),
			onAppEvent("routess:open-discover", onOpenDiscover),
			onAppEvent("routess:open-explore", onOpenDiscover),
			onAppEvent("routess:open-social", onOpenSocial),
			onAppEvent("routess:open-activity", onOpenSocial),
			onAppEvent("routess:export-all-data", () => void onExportAll()),
		];
		return () => {
			for (const unsubscribe of unsubscribers) {
				unsubscribe();
			}
		};
	}, [setContext, setSkippedAuth]);

	const isAuthenticated = !!auth?.isAuthenticated;
	const showLogin = !isAuthenticated && !skippedAuth && authView === "login";
	const showSignup = !isAuthenticated && !skippedAuth && authView === "signup";
	// The map shell + chrome mount whenever the user is past the login gate.
	// Auth screens render as overlays above this shell, so transitioning
	// from login → app no longer tears down the layout (or the Mapbox
	// instance behind it).
	const showApp = isAuthenticated || skippedAuth;

	if (devScreen) {
		const close = () => {
			setDevScreen(null);
			window.history.replaceState({}, "", window.location.pathname);
		};
		const errKind: ErrorKind | null =
			devScreen === "err-routefail" ? "routefail" : devScreen === "err-gps" ? "gps" : null;
		return (
			<div
				data-redesign
				data-accent={accent}
				className={theme === "dark" ? "dark" : undefined}
				style={{ position: "fixed", inset: 0, background: RDS_COLORS.bgCanvas, color: RDS_COLORS.fg }}
			>
				{devScreen === "livenav" && <LiveNavScreen onClose={close} />}
				{devScreen === "recording" && <RecordingScreen onStop={close} />}
				{devScreen === "postactivity" && <PostActivityScreen onClose={close} />}
				{devScreen === "profile" && <ProfileScreen />}
				{devScreen === "user-settings" && <UserSettingsScreen />}
				{devScreen === "compare" && <CompareScreen onClose={close} />}
				{devScreen === "calendar" && <CalendarScreen />}
				{devScreen === "drawer" && <MobileDrawer onClose={close} />}
				{devScreen === "coachmarks" && <CoachmarksScreen onComplete={close} />}
				{errKind && <ErrorScreen kind={errKind} onAction={close} onFallback={close} />}
				<button
					type="button"
					onClick={close}
					style={{
						position: "fixed",
						top: 16,
						right: 16,
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 999,
						padding: "6px 14px",
						fontSize: 12,
						color: RDS_COLORS.fgMuted,
						cursor: "pointer",
						zIndex: 200,
					}}
				>
					{t("appshell.backToApp")}
				</button>
				<ToastStack />
			</div>
		);
	}

	const renderPanelContent = (): ReactNode => {
		switch (context) {
			case "plan":
				return <PlanPanel />;
			case "library":
				return <LibraryPanel />;
			case "discover":
				return <DiscoverPanel />;
			case "social":
				return <SocialPanel />;
			case "settings":
				return <SettingsPanel />;
		}
	};

	const renderModal = (): ReactNode => {
		switch (modal) {
			case "save":
				return <SaveModal />;
			case "loop":
				return <LoopModal />;
			case "routing":
				return <RoutingModal />;
			case "share":
				return <ShareModal />;
			case "import":
				return <ImportModal />;
			case "confirm-delete":
				return <ConfirmDeleteModal />;
			case "palette":
				return <CommandPalette />;
			case "search":
				return <SearchModal />;
			default:
				return null;
		}
	};

	const renderOverlay = (): ReactNode => {
		switch (overlay) {
			case "layers":
				return <LayerPicker />;
			case "notifications":
				return <NotificationCenter />;
			default:
				return null;
		}
	};

	const PanelHeader = (
		<header
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "14px 20px",
				borderBottom: `1px solid ${RDS_COLORS.border}`,
				height: 56,
			}}
		>
			<span style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2 }}>{screenTitle(context, language)}</span>
			{context === "plan" && hasRoute && (
				<Badge variant="accent" dot>
					{t("drawer.activeRoute")}
				</Badge>
			)}
			<div style={{ flex: 1 }} />
			<IconBtn title={t("appshell.openPalette")} onClick={() => openModal("palette")}>
				<I.command size={16} />
			</IconBtn>
			<IconBtn title={t("appshell.collapsePanel")} onClick={togglePanel}>
				<I.chevronL size={16} />
			</IconBtn>
		</header>
	);

	const MapNode = (
		<MapWithRouting
			height="100%"
			width="100%"
			initialCenter={initialCenter}
			initialZoom={initialZoom}
			routeId={routeId}
			mapTheme={theme}
		/>
	);

	const Toolbar = (
		<MapToolbar
			canUndo={canUndo}
			canRedo={canRedo}
			onUndo={() => emitAppEvent("routess:undo")}
			onRedo={() => emitAppEvent("routess:redo")}
			onRemoveRoute={() => emitAppEvent("routess:reset-route")}
			canRemoveRoute={hasAnyWaypoint}
			hasRoute={hasRoute}
			isLocked={isLocked}
			onLock={() => setIsLocked(!isLocked)}
			onSearch={() => openModal("search")}
			onLocate={() => emitAppEvent("routess:locate")}
			isLocating={locateButton.isLocating}
			locateUnavailable={locateButton.unavailable}
			onGenerateLoop={() => openModal("loop")}
			onLayers={() => (overlay === "layers" ? closeOverlay() : openOverlay("layers"))}
			onFocusRoute={() => emitAppEvent("routess:focus-route")}
			onZoomIn={() => emitAppEvent("routess:zoom-in")}
			onZoomOut={() => emitAppEvent("routess:zoom-out")}
			isMobile={isMobile}
		/>
	);

	// The plan panel shows the same stats; only float the chip when they are
	// not already visible (panel collapsed or another context active).
	const planPanelVisible = !isMobile && !panelCollapsed && context === "plan";
	const Chip =
		hasRoute && !planPanelVisible ? (
			<RouteChip distance={distance || "—"} time={duration || "—"} elevation={elevation} />
		) : null;

	// A banner, not a blocking overlay: the app works offline (service worker,
	// cached tiles), so going offline must not wall off the canvas.
	const Offline =
		!online && !offlineDismissed ? (
			<div
				style={{
					position: "absolute",
					top: "calc(env(safe-area-inset-top, 0px) + 8px)",
					left: "50%",
					transform: "translateX(-50%)",
					zIndex: 300,
					display: "flex",
					alignItems: "center",
					gap: 10,
					padding: "8px 12px",
					borderRadius: 10,
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
					fontSize: 12.5,
					color: RDS_COLORS.fg,
					maxWidth: "calc(100vw - 24px)",
				}}
			>
				<I.wifiOff size={14} />
				<span>{t("error.offline.title")}</span>
				<button
					type="button"
					onClick={() => setOfflineDismissed(true)}
					aria-label={t("error.offline.continue")}
					style={{
						background: "transparent",
						border: 0,
						color: RDS_COLORS.fgMuted,
						cursor: "pointer",
						display: "inline-flex",
						padding: 2,
					}}
				>
					<I.close size={13} />
				</button>
			</div>
		) : null;

	const AuthOverlay =
		showLogin || showSignup ? (
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 200,
				}}
			>
				{showLogin && <LoginScreen onSuccess={() => setSkippedAuth(true)} />}
				{showSignup && <SignUpScreen onSwitchToLogin={() => setAuthView("login")} />}
			</div>
		) : null;

	const sharedRoot = (children: ReactNode) => (
		<div
			data-redesign
			data-accent={accent}
			className={theme === "dark" ? "dark" : undefined}
			style={{
				position: "fixed",
				inset: 0,
				background: RDS_COLORS.bgCanvas,
				color: RDS_COLORS.fg,
			}}
		>
			{children}
			<ToastStack />
		</div>
	);

	if (isMobile) {
		return sharedRoot(
			<div style={{ position: "absolute", inset: 0 }}>
				<main
					style={{
						position: "absolute",
						inset: 0,
						overflow: "hidden",
						background: RDS_COLORS.bgCanvas,
					}}
				>
					{showApp && MapNode}
					{showApp && Toolbar}
					{showApp && Chip}
					{showApp && renderOverlay()}
					{Offline}
				</main>
				{showApp && <MobileTopBar />}
				{showApp && (
					<MobilePanelDrawer
						title={screenTitle(context, language)}
						headerSlot={context === "plan" ? <MobilePlanTitle /> : undefined}
						// Close while a modal is open so the drawer's focus trap
						// doesn't steal focus from modal text inputs on mobile.
						open={!panelCollapsed && modal === null}
						onClose={() => useUiStore.getState().setPanelCollapsed(true)}
					>
						{renderPanelContent()}
					</MobilePanelDrawer>
				)}
				{showApp && <BottomTabBar />}
				{/* Modals must render above the side panel/drawer; keeping them
				   inside main would trap their z-index in main's stacking
				   context and let the drawer cover them. */}
				<div style={{ position: "absolute", inset: 0, zIndex: 100, pointerEvents: "none" }}>
					<div style={{ pointerEvents: "auto" }}>{renderModal()}</div>
				</div>
				{AuthOverlay}
			</div>,
		);
	}

	return sharedRoot(
		<div style={{ position: "absolute", inset: 0 }}>
			{showApp && <RailNav />}
			<main
				style={{
					position: "absolute",
					top: 0,
					right: 0,
					bottom: 0,
					left: showApp ? "var(--rds-rail-w)" : 0,
					overflow: "hidden",
					background: RDS_COLORS.bgCanvas,
					zIndex: 1,
				}}
			>
				{showApp && MapNode}
				{showApp && Toolbar}
				{showApp && Chip}
				{showApp && renderOverlay()}
				{Offline}
			</main>
			{showApp && (
				<aside
					aria-hidden={panelCollapsed}
					style={{
						position: "absolute",
						top: 0,
						bottom: 0,
						left: "var(--rds-rail-w)",
						width: "var(--rds-panel-w)",
						background: RDS_COLORS.bgPanel,
						borderRight: `1px solid ${RDS_COLORS.border}`,
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
						zIndex: 3,
						transform: panelCollapsed ? "translateX(-100%)" : "translateX(0)",
						boxShadow: panelCollapsed ? "none" : "var(--rds-shadow-md)",
						transition: "transform var(--rds-panel-anim), box-shadow var(--rds-panel-anim)",
						willChange: "transform",
						pointerEvents: panelCollapsed ? "none" : "auto",
					}}
				>
					{PanelHeader}
					<div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{renderPanelContent()}</div>
				</aside>
			)}
			{/* Modals render above main and aside; nesting them inside main would
			   trap their z-index in main's stacking context and let the open
			   sidebar cover them on narrow viewports. */}
			<div style={{ position: "absolute", inset: 0, zIndex: 100, pointerEvents: "none" }}>
				<div style={{ pointerEvents: "auto" }}>{renderModal()}</div>
			</div>
			{AuthOverlay}
		</div>,
	);
}
