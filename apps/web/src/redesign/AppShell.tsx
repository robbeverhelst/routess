import { useQueryClient } from "@tanstack/react-query";
import { lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import { useRouteSurfaceSync } from "@/features/routing/services/useSurfaceBreakdown";
import { apiService } from "@/lib/api";
import { useAuthStatus } from "@/lib/api-queries";
import { Logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-client";
import { useModalsStore } from "@/redesign/stores/modalsStore";
import { type RedesignContext, useUiStore } from "@/redesign/stores/uiStore";
import {
	useCanRedo,
	useCanUndo,
	useHasRoute,
	useIsMapLocked,
	useRouteDistance,
	useRouteDuration,
	useSetIsMapLocked,
} from "@/stores/routingStore";
import { BottomTabBar } from "./components/BottomTabBar";
import { I } from "./components/icons";
import { MapToolbar } from "./components/MapToolbar";
import { MobilePanelDrawer } from "./components/MobilePanelDrawer";
import { MobileTopBar } from "./components/MobileTopBar";
import { Badge, IconBtn, RDS_COLORS } from "./components/primitives";
import { RailNav } from "./components/RailNav";
import { RouteChip } from "./components/RouteChip";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
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
import { SocialPanel } from "./panels/SocialPanel";
import { AccountScreen } from "./screens/AccountScreen";
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
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { useToastStore } from "./stores/toastStore";

const MapWithRouting = lazy(() => import("@/components/MapWithRouting"));

const SCREEN_TITLES: Record<RedesignContext, string> = {
	plan: "Plan",
	library: "Library",
	discover: "Discover",
	social: "Social",
};

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
	| "account"
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
		"account",
		"compare",
		"calendar",
		"drawer",
		"coachmarks",
		"err-routefail",
		"err-gps",
	];
	return (allowed as string[]).includes(value) ? (value as DevScreen) : null;
}

export function AppShell({ initialCenter, initialZoom, routeId }: AppShellProps) {
	const { context, setContext, theme, accent, panelCollapsed, togglePanel, welcomeCompleted, completeWelcome } =
		useUiStore();
	const { modal, overlay, openModal, openOverlay, closeOverlay } = useModalsStore();
	const { data: auth, isLoading: authLoading } = useAuthStatus();
	const online = useOnlineStatus();
	const hasRoute = useHasRoute();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const canUndo = useCanUndo();
	const canRedo = useCanRedo();
	const isLocked = useIsMapLocked();
	const setIsLocked = useSetIsMapLocked();

	useRouteSurfaceSync();

	const queryClient = useQueryClient();
	const { isMobile } = useViewport();
	const [authView, setAuthView] = useState<AuthView>("login");
	const [skippedAuth, setSkippedAuth] = useState(false);
	const [offlineDismissed, setOfflineDismissed] = useState(false);
	const [devScreen, setDevScreen] = useState<DevScreen | null>(getDevScreen);
	const [mobileSyncedRef, setMobileSyncedRef] = useState(false);

	useEffect(() => {
		if (isMobile && !mobileSyncedRef) {
			useUiStore.getState().setPanelCollapsed(true);
			setMobileSyncedRef(true);
		}
	}, [isMobile, mobileSyncedRef]);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
	}, [theme]);

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
			const stillSignedIn = !!localStorage.getItem("access_token");
			if (!stillSignedIn) {
				setSkippedAuth(false);
				setAuthView("login");
				setDevScreen(null);
			}
		};
		window.addEventListener("auth-change", onAuthChange);
		return () => window.removeEventListener("auth-change", onAuthChange);
	}, [queryClient]);

	useEffect(() => {
		const pushToast = useToastStore.getState().push;
		const onOpenAccount = () => {
			setDevScreen("account");
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
			if (!localStorage.getItem("access_token")) {
				pushToast({
					kind: "info",
					title: "Sign in to export",
					body: "Account export needs an authenticated session.",
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
					title: "Export ready",
					body: `Downloaded ${routes.length} route${routes.length === 1 ? "" : "s"}.`,
				});
			} catch (err) {
				Logger.error("[AppShell] export-all-data failed", err);
				pushToast({
					kind: "danger",
					title: "Export failed",
					body: "Couldn't fetch your routes. Try again in a moment.",
				});
			}
		};
		const onDuplicate = () => {
			pushToast({
				kind: "info",
				title: "Duplicate coming soon",
				body: "Route duplication will be wired up with the route library backend.",
			});
		};
		const onDelete = () => {
			pushToast({
				kind: "info",
				title: "Delete coming soon",
				body: "Route deletion will be wired up with the route library backend.",
			});
		};
		const onToggleFavorite = () => {
			pushToast({
				kind: "info",
				title: "Favourite saved locally",
				body: "Favourite syncing will arrive with the backend.",
				durationMs: 2500,
			});
		};

		window.addEventListener("routess:open-account", onOpenAccount);
		window.addEventListener("routess:open-profile", onOpenProfile);
		window.addEventListener("routess:open-login", onOpenLogin);
		window.addEventListener("routess:open-signup", onOpenSignup);
		window.addEventListener("routess:open-discover", onOpenDiscover);
		window.addEventListener("routess:open-explore", onOpenDiscover);
		window.addEventListener("routess:open-social", onOpenSocial);
		window.addEventListener("routess:open-activity", onOpenSocial);
		window.addEventListener("routess:export-all-data", onExportAll);
		window.addEventListener("routess:duplicate-route", onDuplicate);
		window.addEventListener("routess:delete-route", onDelete);
		window.addEventListener("routess:toggle-favorite", onToggleFavorite);
		return () => {
			window.removeEventListener("routess:open-account", onOpenAccount);
			window.removeEventListener("routess:open-profile", onOpenProfile);
			window.removeEventListener("routess:open-login", onOpenLogin);
			window.removeEventListener("routess:open-signup", onOpenSignup);
			window.removeEventListener("routess:open-discover", onOpenDiscover);
			window.removeEventListener("routess:open-explore", onOpenDiscover);
			window.removeEventListener("routess:open-social", onOpenSocial);
			window.removeEventListener("routess:open-activity", onOpenSocial);
			window.removeEventListener("routess:export-all-data", onExportAll);
			window.removeEventListener("routess:duplicate-route", onDuplicate);
			window.removeEventListener("routess:delete-route", onDelete);
			window.removeEventListener("routess:toggle-favorite", onToggleFavorite);
		};
	}, [setContext]);

	const isAuthenticated = !!auth?.isAuthenticated;
	const authResolving = authLoading;
	const showLogin = !isAuthenticated && !authResolving && !skippedAuth && authView === "login";
	const showSignup = !isAuthenticated && !authResolving && !skippedAuth && authView === "signup";
	const showWelcome = isAuthenticated && !welcomeCompleted;

	const authRoot = (children: ReactNode) => (
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
		</div>
	);

	if (authResolving && !skippedAuth) {
		return authRoot(
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: RDS_COLORS.bgCanvas,
				}}
			>
				<div
					style={{
						width: 18,
						height: 18,
						borderRadius: 999,
						border: `2px solid ${RDS_COLORS.border}`,
						borderTopColor: RDS_COLORS.accent,
						animation: "rds-pulse 1s linear infinite",
					}}
				/>
			</div>,
		);
	}

	if (showLogin) {
		return authRoot(
			<>
				<LoginScreen onSuccess={() => setSkippedAuth(true)} />
				<button
					type="button"
					onClick={() => setAuthView("signup")}
					style={{
						position: "fixed",
						bottom: 16,
						right: 16,
						background: "transparent",
						border: 0,
						color: RDS_COLORS.fgMuted,
						fontSize: 12,
						cursor: "pointer",
						zIndex: 100,
					}}
				>
					New here? Create account
				</button>
				<ToastStack />
			</>,
		);
	}

	if (showSignup) {
		return authRoot(
			<>
				<SignUpScreen onSwitchToLogin={() => setAuthView("login")} />
				<ToastStack />
			</>,
		);
	}

	if (showWelcome) {
		return authRoot(
			<>
				<WelcomeScreen onComplete={completeWelcome} />
				<ToastStack />
			</>,
		);
	}

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
				{devScreen === "account" && <AccountScreen />}
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
					← Back to app
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
			<span style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2 }}>{SCREEN_TITLES[context]}</span>
			{context === "plan" && (
				<Badge variant="accent" dot>
					Active route
				</Badge>
			)}
			<div style={{ flex: 1 }} />
			<IconBtn title="Open command palette (⌘K)" onClick={() => openModal("palette")}>
				<I.command size={16} />
			</IconBtn>
			<IconBtn title="Collapse panel" onClick={togglePanel}>
				<I.chevronL size={16} />
			</IconBtn>
		</header>
	);

	const MapNode = (
		<Suspense
			fallback={
				<div
					style={{
						position: "absolute",
						inset: 0,
						background: RDS_COLORS.bgPanelElev,
					}}
				/>
			}
		>
			<MapWithRouting
				height="100%"
				width="100%"
				initialCenter={initialCenter}
				initialZoom={initialZoom}
				routeId={routeId}
				mapTheme={theme}
				hideOverlays
			/>
		</Suspense>
	);

	const Toolbar = (
		<MapToolbar
			canUndo={canUndo}
			canRedo={canRedo}
			onUndo={() => window.dispatchEvent(new CustomEvent("routess:undo"))}
			onRedo={() => window.dispatchEvent(new CustomEvent("routess:redo"))}
			onRemoveRoute={() => window.dispatchEvent(new CustomEvent("routess:reset-route"))}
			hasRoute={hasRoute}
			isLocked={isLocked}
			onLock={() => setIsLocked(!isLocked)}
			onSearch={() => openModal("search")}
			onLocate={() => window.dispatchEvent(new CustomEvent("routess:locate"))}
			onLayers={() => (overlay === "layers" ? closeOverlay() : openOverlay("layers"))}
			onFocusRoute={() => window.dispatchEvent(new CustomEvent("routess:focus-route"))}
			onZoomIn={() => window.dispatchEvent(new CustomEvent("routess:zoom-in"))}
			onZoomOut={() => window.dispatchEvent(new CustomEvent("routess:zoom-out"))}
			isMobile={isMobile}
		/>
	);

	const Chip = hasRoute ? <RouteChip distance={distance || "—"} time={duration || "—"} /> : null;

	const Offline =
		!online && !offlineDismissed ? (
			<ErrorScreen
				kind="offline"
				onAction={() => setOfflineDismissed(true)}
				onFallback={() => setOfflineDismissed(true)}
			/>
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
					{MapNode}
					{Toolbar}
					{Chip}
					{renderOverlay()}
					{Offline}
				</main>
				<MobileTopBar />
				{!panelCollapsed && (
					<MobilePanelDrawer
						title={SCREEN_TITLES[context]}
						onClose={() => useUiStore.getState().setPanelCollapsed(true)}
					>
						{renderPanelContent()}
					</MobilePanelDrawer>
				)}
				<BottomTabBar />
				{/* Modals must render above the side panel/drawer; keeping them
				   inside main would trap their z-index in main's stacking
				   context and let the drawer cover them. */}
				<div style={{ position: "absolute", inset: 0, zIndex: 100, pointerEvents: "none" }}>
					<div style={{ pointerEvents: "auto" }}>{renderModal()}</div>
				</div>
			</div>,
		);
	}

	return sharedRoot(
		<div style={{ position: "absolute", inset: 0 }}>
			<RailNav />
			<main
				style={{
					position: "absolute",
					top: 0,
					right: 0,
					bottom: 0,
					left: "var(--rds-rail-w)",
					overflow: "hidden",
					background: RDS_COLORS.bgCanvas,
					zIndex: 1,
				}}
			>
				{MapNode}
				{Toolbar}
				{Chip}
				{renderOverlay()}
				{Offline}
			</main>
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
			{/* Modals render above main and aside; nesting them inside main would
			   trap their z-index in main's stacking context and let the open
			   sidebar cover them on narrow viewports. */}
			<div style={{ position: "absolute", inset: 0, zIndex: 100, pointerEvents: "none" }}>
				<div style={{ pointerEvents: "auto" }}>{renderModal()}</div>
			</div>
		</div>,
	);
}
