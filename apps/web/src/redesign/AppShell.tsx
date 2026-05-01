import { lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import { useAuthStatus } from "@/lib/api-queries";
import { useModalsStore } from "@/redesign/stores/modalsStore";
import { type RedesignContext, useUiStore } from "@/redesign/stores/uiStore";
import {
	useCanRedo,
	useCanUndo,
	useHasRoute,
	useIsMapLocked,
	useRedo,
	useRouteDistance,
	useRouteDuration,
	useSetIsMapLocked,
	useUndo,
} from "@/stores/routingStore";
import { I, RoutessMark } from "./components/icons";
import { MapToolbar } from "./components/MapToolbar";
import { Badge, IconBtn, RDS_COLORS } from "./components/primitives";
import { RailNav } from "./components/RailNav";
import { RouteChip } from "./components/RouteChip";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
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
import { ActivityPanel } from "./panels/ActivityPanel";
import { LibraryPanel } from "./panels/LibraryPanel";
import { PlanPanel } from "./panels/PlanPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
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

const MapWithRouting = lazy(() => import("@/components/MapWithRouting"));

const SCREEN_TITLES: Record<RedesignContext, string> = {
	plan: "Plan",
	library: "Library",
	activity: "Activity",
	settings: "Settings",
};

const NAV: { key: RedesignContext; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
	{ key: "plan", icon: I.route, label: "Plan" },
	{ key: "library", icon: I.library, label: "Library" },
	{ key: "activity", icon: I.activity, label: "Activity" },
	{ key: "settings", icon: I.settings, label: "Settings" },
];

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
	const {
		context,
		setContext,
		theme,
		accent,
		density,
		layout,
		panelCollapsed,
		togglePanel,
		welcomeCompleted,
		completeWelcome,
		toggleTheme,
	} = useUiStore();
	const { modal, overlay, openModal, openOverlay, closeOverlay } = useModalsStore();
	const { data: auth } = useAuthStatus();
	const online = useOnlineStatus();
	const hasRoute = useHasRoute();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const canUndo = useCanUndo();
	const canRedo = useCanRedo();
	const undo = useUndo();
	const redo = useRedo();
	const isLocked = useIsMapLocked();
	const setIsLocked = useSetIsMapLocked();

	const [authView, setAuthView] = useState<AuthView>("app");
	const [skippedAuth, setSkippedAuth] = useState(false);
	const [offlineDismissed, setOfflineDismissed] = useState(false);
	const [devScreen, setDevScreen] = useState<DevScreen | null>(getDevScreen);

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

	const isAuthenticated = !!auth?.isAuthenticated;
	const showLogin = !isAuthenticated && !skippedAuth && authView === "login";
	const showSignup = !isAuthenticated && !skippedAuth && authView === "signup";
	const showWelcome = isAuthenticated && !welcomeCompleted;

	if (showLogin) {
		return (
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
			</>
		);
	}

	if (showSignup) {
		return (
			<>
				<SignUpScreen onSwitchToLogin={() => setAuthView("login")} />
				<ToastStack />
			</>
		);
	}

	if (showWelcome) {
		return (
			<>
				<WelcomeScreen onComplete={completeWelcome} />
				<ToastStack />
			</>
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
				data-density={density}
				className={theme === "dark" ? "dark" : undefined}
				style={{ position: "fixed", inset: 0, background: RDS_COLORS.bgCanvas, color: RDS_COLORS.fg }}
			>
				{devScreen === "livenav" && <LiveNavScreen onClose={close} />}
				{devScreen === "recording" && <RecordingScreen onStop={close} />}
				{devScreen === "postactivity" && <PostActivityScreen />}
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
			case "activity":
				return <ActivityPanel />;
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
			{layout === "sidebar" && (
				<IconBtn title="Collapse panel" onClick={togglePanel}>
					<I.chevronL size={16} />
				</IconBtn>
			)}
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
				hideOverlays
			/>
		</Suspense>
	);

	const Toolbar = (
		<MapToolbar
			canUndo={canUndo}
			canRedo={canRedo}
			onUndo={undo}
			onRedo={redo}
			isLocked={isLocked}
			onLock={() => setIsLocked(!isLocked)}
			onSearch={() => openModal("search")}
			onLayers={() => (overlay === "layers" ? closeOverlay() : openOverlay("layers"))}
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
			data-density={density}
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

	// ===== Layout: SIDEBAR (default) =====
	if (layout === "sidebar") {
		return sharedRoot(
			<div style={{ position: "absolute", inset: 0, display: "flex" }}>
				<RailNav />
				<aside
					style={{
						width: panelCollapsed ? 0 : "var(--rds-panel-w)",
						background: RDS_COLORS.bgPanel,
						borderRight: panelCollapsed ? "none" : `1px solid ${RDS_COLORS.border}`,
						display: "flex",
						flexDirection: "column",
						flexShrink: 0,
						zIndex: 4,
						overflow: "hidden",
						transition: "width 200ms ease, border-color 200ms ease",
					}}
				>
					{PanelHeader}
					<div style={{ flex: 1, minHeight: 0, overflow: "hidden", width: "var(--rds-panel-w)" }}>
						{renderPanelContent()}
					</div>
				</aside>
				<main style={{ flex: 1, position: "relative" }}>
					{MapNode}
					{Toolbar}
					{Chip}
					{panelCollapsed && (
						<button
							type="button"
							onClick={togglePanel}
							title="Expand panel"
							style={{
								position: "absolute",
								left: 0,
								top: "50%",
								transform: "translateY(-50%)",
								width: 18,
								height: 64,
								borderRadius: "0 8px 8px 0",
								background: RDS_COLORS.bgPanel,
								border: `1px solid ${RDS_COLORS.border}`,
								borderLeft: 0,
								color: RDS_COLORS.fgMuted,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								cursor: "pointer",
								boxShadow: "var(--rds-shadow-sm)",
								zIndex: 6,
							}}
						>
							<I.chevronR size={14} />
						</button>
					)}
					{renderOverlay()}
					{renderModal()}
					{Offline}
				</main>
			</div>,
		);
	}

	// ===== Layout: FLOATING (glass over full-bleed map) =====
	if (layout === "floating") {
		return sharedRoot(
			<div style={{ position: "absolute", inset: 0 }}>
				<div style={{ position: "absolute", inset: 0 }}>{MapNode}</div>

				{/* Floating rail */}
				<div
					className="rds-glass"
					style={{
						position: "absolute",
						top: 16,
						left: 16,
						padding: 6,
						display: "flex",
						flexDirection: "column",
						gap: 2,
						borderRadius: 14,
						boxShadow: "var(--rds-shadow-md)",
						zIndex: 5,
					}}
				>
					<div style={{ color: RDS_COLORS.accent, padding: 6 }}>
						<RoutessMark size={20} />
					</div>
					<div style={{ height: 1, background: RDS_COLORS.border, margin: "4px 6px" }} />
					{NAV.map((n) => {
						const Icon = n.icon;
						const on = context === n.key;
						return (
							<IconBtn
								key={n.key}
								title={n.label}
								onClick={() => setContext(n.key)}
								style={{
									background: on ? RDS_COLORS.bgActive : "transparent",
									color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
									width: 36,
									height: 36,
								}}
							>
								<Icon size={18} />
							</IconBtn>
						);
					})}
				</div>

				{/* Floating panel */}
				<aside
					className="rds-glass"
					style={{
						position: "absolute",
						top: 16,
						left: 80,
						bottom: 16,
						width: 360,
						borderRadius: 16,
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
						boxShadow: "var(--rds-shadow-lg)",
						zIndex: 5,
					}}
				>
					{PanelHeader}
					<div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{renderPanelContent()}</div>
				</aside>

				{/* Top-right profile pill */}
				<div
					className="rds-glass"
					style={{
						position: "absolute",
						top: 16,
						right: 16,
						display: "flex",
						alignItems: "center",
						gap: 10,
						padding: "6px 10px 6px 6px",
						borderRadius: 999,
						boxShadow: "var(--rds-shadow-sm)",
						zIndex: 5,
					}}
				>
					<div
						style={{
							width: 28,
							height: 28,
							borderRadius: 999,
							background: `linear-gradient(135deg, ${RDS_COLORS.accent}, oklch(0.65 0.15 200))`,
							color: "white",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 11,
							fontWeight: 600,
						}}
					>
						RV
					</div>
					<span style={{ fontSize: 13, fontWeight: 500 }}>Robbe</span>
					<IconBtn title="Toggle theme" onClick={toggleTheme}>
						{theme === "dark" ? <I.sun size={14} /> : <I.moon size={14} />}
					</IconBtn>
					<IconBtn
						title="Notifications"
						pressed={overlay === "notifications"}
						onClick={() => (overlay === "notifications" ? closeOverlay() : openOverlay("notifications"))}
					>
						<I.bell size={14} />
					</IconBtn>
				</div>

				{Toolbar}
				{Chip}

				{/* Command hint chip */}
				<button
					type="button"
					className="rds-glass"
					onClick={() => openModal("palette")}
					style={{
						position: "absolute",
						left: 16,
						bottom: 24,
						padding: "8px 12px",
						borderRadius: 10,
						display: "flex",
						alignItems: "center",
						gap: 8,
						boxShadow: "var(--rds-shadow-sm)",
						zIndex: 4,
						color: "inherit",
						cursor: "pointer",
					}}
				>
					<I.command size={14} />
					<span style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>Search, jump to, command</span>
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							minWidth: 18,
							height: 18,
							padding: "0 5px",
							border: `1px solid ${RDS_COLORS.border}`,
							borderBottomWidth: 2,
							borderRadius: 4,
							background: RDS_COLORS.bgPanelElev,
							color: RDS_COLORS.fgMuted,
							fontFamily: '"JetBrains Mono", monospace',
							fontSize: 10.5,
							lineHeight: 1,
						}}
					>
						⌘K
					</span>
				</button>

				{renderOverlay()}
				{renderModal()}
				{Offline}
			</div>,
		);
	}

	// ===== Layout: BOTTOM (mobile-leaning) =====
	return sharedRoot(
		<div style={{ position: "absolute", inset: 0 }}>
			<div style={{ position: "absolute", inset: 0 }}>{MapNode}</div>

			{/* Top bar */}
			<div
				className="rds-glass"
				style={{
					position: "absolute",
					top: 12,
					left: 12,
					right: 12,
					height: 44,
					padding: "6px 6px 6px 14px",
					display: "flex",
					alignItems: "center",
					gap: 8,
					borderRadius: 999,
					boxShadow: "var(--rds-shadow-sm)",
					zIndex: 5,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8, color: RDS_COLORS.accent }}>
					<RoutessMark size={18} />
					<span style={{ fontSize: 14, fontWeight: 600, color: RDS_COLORS.fg }}>Routess</span>
				</div>
				<div style={{ flex: 1 }} />
				<IconBtn title="Search" onClick={() => openModal("search")}>
					<I.search size={16} />
				</IconBtn>
				<IconBtn title="Map style" onClick={() => (overlay === "layers" ? closeOverlay() : openOverlay("layers"))}>
					<I.layers size={16} />
				</IconBtn>
				<IconBtn title="Toggle theme" onClick={toggleTheme}>
					{theme === "dark" ? <I.sun size={16} /> : <I.moon size={16} />}
				</IconBtn>
				<div
					style={{
						width: 30,
						height: 30,
						borderRadius: 999,
						background: `linear-gradient(135deg, ${RDS_COLORS.accent}, oklch(0.65 0.15 200))`,
						color: "white",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 11,
						fontWeight: 600,
					}}
				>
					RV
				</div>
			</div>

			{/* Right zoom stack */}
			<div
				className="rds-glass"
				style={{
					position: "absolute",
					right: 16,
					top: 80,
					padding: 4,
					display: "flex",
					flexDirection: "column",
					gap: 2,
					borderRadius: 10,
					boxShadow: "var(--rds-shadow-sm)",
					zIndex: 5,
				}}
			>
				<IconBtn title="Zoom in">
					<I.plus size={14} />
				</IconBtn>
				<div style={{ height: 1, background: RDS_COLORS.border }} />
				<IconBtn title="Zoom out">
					<I.minus size={14} />
				</IconBtn>
				<div style={{ height: 1, background: RDS_COLORS.border }} />
				<IconBtn title="Locate">
					<I.target size={14} />
				</IconBtn>
			</div>

			{/* Bottom sheet */}
			<aside
				style={{
					position: "absolute",
					left: 12,
					right: 12,
					bottom: 12,
					maxHeight: "62%",
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 18,
					boxShadow: "var(--rds-shadow-lg)",
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
					zIndex: 5,
				}}
			>
				<div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
					<div
						style={{
							width: 36,
							height: 4,
							borderRadius: 999,
							background: RDS_COLORS.borderStrong,
						}}
					/>
				</div>
				<div
					style={{
						display: "flex",
						gap: 4,
						padding: "4px 12px 8px",
						borderBottom: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					{NAV.map((n) => {
						const Icon = n.icon;
						const on = context === n.key;
						return (
							<button
								key={n.key}
								type="button"
								onClick={() => setContext(n.key)}
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 6,
									height: 32,
									padding: "0 12px",
									background: on ? RDS_COLORS.bgActive : "transparent",
									color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
									border: 0,
									borderRadius: 999,
									fontSize: 12.5,
									fontWeight: 500,
									cursor: "pointer",
								}}
							>
								<Icon size={14} /> {n.label}
							</button>
						);
					})}
				</div>
				<div style={{ flex: 1, minHeight: 0, maxHeight: 480 }}>{renderPanelContent()}</div>
			</aside>

			{renderOverlay()}
			{renderModal()}
			{Offline}
		</div>,
	);
}
