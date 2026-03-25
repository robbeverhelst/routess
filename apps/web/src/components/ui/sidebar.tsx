import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { DE, FR, GB, NL } from "country-flag-icons/react/3x2";
import {
	AlertCircle,
	ArrowRightLeft,
	BookMarked,
	ChevronRight,
	Copy,
	FileDown,
	Focus,
	Globe,
	Lightbulb,
	Lock,
	LogIn,
	MapPin,
	Menu,
	RotateCcw,
	RotateCw,
	Save,
	Settings,
	Share2,
	Trash2,
	Unlock,
	Upload,
	User,
	X,
} from "lucide-react";
import type { Map as MapboxMap } from "mapbox-gl";
import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { Suspense, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsModal } from "@/components/ui/settings-modal";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthState } from "@/hooks/useAuthState";
import { googleAuth } from "../../lib/google-auth";
import type { SupportedLanguage } from "../../lib/i18n";
import { t } from "../../lib/i18n";
import { Logger } from "../../lib/logger";
import { exportRouteToGPX, importRouteFromGPX } from "../../lib/routing";
import { LoginModal } from "../auth/LoginModal";

interface SidebarProps {
	onUndo: () => void;
	onRedo: () => void;
	onReset: () => void;
	onReverseRoute: () => void;
	onZoomToRoute: () => void;
	onShare: () => void;
	canUndo: boolean;
	canRedo: boolean;
	hasRoute?: boolean;
	routeDistance?: string;
	routeDuration?: string;
	isLocked: boolean;
	onToggleLock: () => void;
	map: MapboxMap | null;
	accessToken: string | undefined;
	setRouteDistance: Dispatch<SetStateAction<string>>;
	setRouteDuration: Dispatch<SetStateAction<string>>;
	setHasRoute: Dispatch<SetStateAction<boolean>>;
	onImportError: (message: string) => void;
	displayedShareUrl: string | null;
	onCopySharedUrl: (url: string) => void;
	onClearShareDisplay?: () => void;
	onOpenRouteGenerator: () => void;
	currentLanguage: SupportedLanguage;
	onLanguageChange: (lang: SupportedLanguage) => void;
	showSunDirection: boolean;
	onToggleSunDirection: (enabled: boolean) => void;
	onOpenRouteLibrary: () => void;
	onSaveRoute: () => void;
}

export function Sidebar({
	onUndo,
	onRedo,
	onReset,
	onReverseRoute,
	onZoomToRoute,
	onShare,
	canUndo,
	canRedo,
	hasRoute = false,
	routeDistance = "",
	routeDuration = "",
	isLocked,
	onToggleLock,
	map,
	accessToken,
	setRouteDistance,
	setRouteDuration,
	setHasRoute,
	onImportError,
	displayedShareUrl,
	onCopySharedUrl,
	onClearShareDisplay,
	onOpenRouteGenerator,
	currentLanguage,
	onLanguageChange,
	showSunDirection,
	onToggleSunDirection,
	onOpenRouteLibrary,
	onSaveRoute,
}: SidebarProps) {
	void onOpenRouteGenerator;

	const authState = useAuthState();
	const isLoggedIn = authState.isAuthenticated;
	const currentUser = authState.user;

	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
	const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const [currentTipIndex, setCurrentTipIndex] = useState(0);

	const languages: Array<{
		code: SupportedLanguage;
		name: string;
		label: string;
		icon: React.ElementType;
	}> = [
		{ code: "en", name: "English", label: "EN", icon: GB },
		{ code: "nl", name: "Nederlands", label: "NL", icon: NL },
		{ code: "fr", name: "Français", label: "FR", icon: FR },
		{ code: "de", name: "Deutsch", label: "DE", icon: DE },
	];

	const tips = [
		{
			title: t("sidebar.proTip.routePlanning.title", currentLanguage),
			description: t("sidebar.proTip.routePlanning.description", currentLanguage),
			gradient: "from-purple-500 to-pink-500",
			icon: MapPin,
		},
		{
			title: t("sidebar.proTip.importGpx.title", currentLanguage),
			description: t("sidebar.proTip.importGpx.description", currentLanguage),
			gradient: "from-blue-500 to-cyan-500",
			icon: Upload,
		},
		{
			title: t("sidebar.proTip.lockRoute.title", currentLanguage),
			description: t("sidebar.proTip.lockRoute.description", currentLanguage),
			gradient: "from-emerald-500 to-teal-500",
			icon: Lock,
		},
		{
			title: t("sidebar.proTip.quickActions.title", currentLanguage),
			description: t("sidebar.proTip.quickActions.description", currentLanguage),
			gradient: "from-orange-500 to-red-500",
			icon: RotateCcw,
		},
	];

	const currentTip = tips[currentTipIndex];

	const handleLanguageChange = useCallback(
		(langCode: SupportedLanguage) => {
			onLanguageChange(langCode);
		},
		[onLanguageChange],
	);

	const handleExportGPX = useCallback(() => {
		const result = exportRouteToGPX();
		if (!result.success && result.message) {
			onImportError(result.message);
		}
	}, [onImportError]);

	const handleImportGPX = useCallback(() => {
		if (!map || !accessToken) {
			onImportError("Map or access token is not available for import.");
			return;
		}

		const fileInput = document.createElement("input");
		fileInput.type = "file";
		fileInput.accept = ".gpx";
		fileInput.style.display = "none";

		fileInput.onchange = (event: Event) => {
			const target = event.target as HTMLInputElement;
			if (target?.files && target.files.length > 0) {
				const file = target.files[0];
				const reader = new FileReader();
				reader.onload = async (e) => {
					try {
						const gpxString = e.target?.result as string;
						if (!gpxString) {
							onImportError("Failed to read GPX file.");
							return;
						}
						await importRouteFromGPX(
							gpxString,
							map,
							accessToken,
							setRouteDistance,
							setRouteDuration,
							setHasRoute,
							onImportError,
						);
					} catch (error) {
						Logger.error("Error processing GPX file:", error);
						onImportError(error instanceof Error ? error.message : "An unknown error occurred during GPX import.");
					}
				};
				reader.onerror = () => {
					onImportError("Error reading GPX file.");
				};
				reader.readAsText(file);
			}
			if (fileInput.parentElement) {
				document.body.removeChild(fileInput);
			}
		};
		document.body.appendChild(fileInput);
		fileInput.click();
		setTimeout(() => {
			if (fileInput.parentElement) {
				document.body.removeChild(fileInput);
			}
		}, 2000);
	}, [map, accessToken, onImportError, setRouteDistance, setRouteDuration, setHasRoute]);

	const handleSignOut = useCallback(async () => {
		try {
			await googleAuth.signOut();
			Logger.info("User signed out successfully");
		} catch (error) {
			Logger.error("Sign out failed:", error);
		}
	}, []);

	const nextTip = useCallback(() => {
		setCurrentTipIndex((prev) => (prev + 1) % tips.length);
	}, [tips.length]);

	return (
		<>
			<Sheet>
				<SheetTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="bg-white/90 dark:bg-black/80 hover:bg-white/70 dark:hover:bg-black/60 shadow-sm h-9 w-9"
					>
						<Menu size={18} />
					</Button>
				</SheetTrigger>
				<SheetContent className="p-0 w-[280px] border-l flex flex-col" hideCloseButton>
					<VisuallyHidden asChild>
						<SheetTitle>{t("sidebar.menuTitle", currentLanguage)}</SheetTitle>
					</VisuallyHidden>
					<VisuallyHidden asChild>
						<SheetDescription>{t("sidebar.menuDescription", currentLanguage)}</SheetDescription>
					</VisuallyHidden>

					{/* Branded Header */}
					<div className="px-3 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<img src="/logo.png" alt="Maps" className="w-8 h-8 rounded-lg" />
							<span className="text-lg font-semibold text-gray-900 dark:text-white">Maps</span>
						</div>

						<div className="flex items-center gap-1">
							<SheetClose
								className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								ref={closeButtonRef}
							>
								<X size={16} />
							</SheetClose>
						</div>
					</div>

					{/* Main Content Area */}
					<div className="flex-1 flex flex-col overflow-hidden">
						{/* Route Status - Compact */}
						{hasRoute ? (
							<div className="px-3 py-2.5 bg-blue-50 dark:bg-blue-950/20 border-b border-gray-200 dark:border-gray-800">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
										<span className="text-sm font-medium text-gray-900 dark:text-white">
											{t("sidebar.currentRoute", currentLanguage)}
										</span>
									</div>
									{isLocked && <Lock size={14} className="text-amber-600 dark:text-amber-400" />}
								</div>
								<div className="flex items-center gap-3 mt-1 text-xs text-gray-600 dark:text-gray-400">
									<span className="font-medium">{routeDistance}</span>
									<span>•</span>
									<span>{routeDuration}</span>
									{isLocked && (
										<>
											<span>•</span>
											<span className="text-amber-600 dark:text-amber-400">{t("sidebar.locked", currentLanguage)}</span>
										</>
									)}
								</div>
							</div>
						) : (
							<div className="px-3 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
								<div className="flex items-start gap-2">
									<AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
									<div>
										<p className="text-sm font-medium text-gray-900 dark:text-white">
											{t("sidebar.noRouteSet", currentLanguage)}
										</p>
										<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
											{t("sidebar.addWaypointsHelp", currentLanguage)}
										</p>
									</div>
								</div>
							</div>
						)}

						{/* Quick Actions Bar - Icon Only */}
						<div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">
							<TooltipProvider>
								<div className="flex items-center justify-center gap-1">
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={onUndo}
												disabled={!canUndo || isLocked}
												className="h-8 w-8"
											>
												<RotateCcw size={16} />
											</Button>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p className="text-xs">{t("sidebar.undo", currentLanguage)}</p>
										</TooltipContent>
									</Tooltip>

									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={onToggleLock}
												className={`h-8 w-8 ${
													isLocked ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" : ""
												}`}
											>
												{isLocked ? <Lock size={16} /> : <Unlock size={16} />}
											</Button>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p className="text-xs">
												{isLocked
													? t("sidebar.tooltip.unlockRoute", currentLanguage)
													: t("sidebar.tooltip.lockRoute", currentLanguage)}
											</p>
										</TooltipContent>
									</Tooltip>

									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={onRedo}
												disabled={!canRedo || isLocked}
												className="h-8 w-8"
											>
												<RotateCw size={16} />
											</Button>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p className="text-xs">{t("sidebar.redo", currentLanguage)}</p>
										</TooltipContent>
									</Tooltip>

									<div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />

									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={onReverseRoute}
												disabled={!hasRoute || isLocked}
												className="h-8 w-8"
											>
												<ArrowRightLeft size={16} />
											</Button>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p className="text-xs">{t("sidebar.reverseRoute", currentLanguage)}</p>
										</TooltipContent>
									</Tooltip>

									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={onZoomToRoute}
												disabled={!hasRoute}
												className="h-8 w-8"
											>
												<Focus size={16} />
											</Button>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p className="text-xs">{t("sidebar.zoomToRoute", currentLanguage)}</p>
										</TooltipContent>
									</Tooltip>

									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={onReset}
												disabled={!hasRoute || isLocked}
												className="h-8 w-8 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
											>
												<Trash2 size={16} />
											</Button>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p className="text-xs">{t("sidebar.resetRoute", currentLanguage)}</p>
										</TooltipContent>
									</Tooltip>
								</div>
							</TooltipProvider>
						</div>

						{/* Primary Actions */}
						<div className="px-3 py-3 border-b border-gray-200 dark:border-gray-800">
							<div className="space-y-2">
								<Button
									variant="outline"
									size="sm"
									disabled={!isLoggedIn || !hasRoute}
									onClick={onSaveRoute}
									className="w-full h-9 text-sm justify-start"
								>
									<Save size={14} className="mr-2" />
									{t("sidebar.save", currentLanguage)}
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={!isLoggedIn}
									onClick={onOpenRouteLibrary}
									className="w-full h-9 text-sm justify-start"
								>
									<BookMarked size={14} className="mr-2" />
									{t("sidebar.library", currentLanguage)}
								</Button>
							</div>
						</div>

						{/* Scrollable Options Area */}
						<div className="flex-1 overflow-y-auto px-3 py-2">
							{/* More Options - Always Expanded */}
							<div className="space-y-3">
								<div>
									<h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
										{t("sidebar.routeActions", currentLanguage)}
									</h3>
									<div className="space-y-1">
										<button
											type="button"
											onClick={handleExportGPX}
											disabled={!hasRoute}
											className="w-full h-9 px-3 flex items-center gap-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-left disabled:opacity-50"
										>
											<div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
												<FileDown size={14} className="text-blue-600 dark:text-blue-400" />
											</div>
											<span>{t("sidebar.exportRoute", currentLanguage)}</span>
										</button>

										<button
											type="button"
											onClick={handleImportGPX}
											disabled={isLocked}
											className="w-full h-9 px-3 flex items-center gap-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-left disabled:opacity-50"
										>
											<div className="w-6 h-6 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
												<Upload size={14} className="text-green-600 dark:text-green-400" />
											</div>
											<span>{t("sidebar.importRoute", currentLanguage)}</span>
										</button>

										{displayedShareUrl ? (
											<div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
												<p className="text-xs font-medium mb-2">{t("sidebar.shareableLink", currentLanguage)}</p>
												<div className="flex gap-2">
													<input
														type="text"
														readOnly
														value={displayedShareUrl}
														className="flex-1 px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
														onClick={(e) => (e.target as HTMLInputElement).select()}
													/>
													<Button
														size="icon"
														variant="ghost"
														className="h-7 w-7"
														onClick={() => onCopySharedUrl(displayedShareUrl)}
													>
														<Copy size={12} />
													</Button>
													<Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClearShareDisplay}>
														<X size={12} />
													</Button>
												</div>
											</div>
										) : (
											<button
												type="button"
												onClick={onShare}
												disabled={!hasRoute}
												className="w-full h-9 px-3 flex items-center gap-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-left disabled:opacity-50"
											>
												<div className="w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
													<Share2 size={14} className="text-purple-600 dark:text-purple-400" />
												</div>
												<span>{t("sidebar.shareRoute", currentLanguage)}</span>
											</button>
										)}
									</div>
								</div>

								<div>
									<h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
										{t("sidebar.settings", currentLanguage)}
									</h3>
									<div className="space-y-1">
										<button
											type="button"
											onClick={() => setIsSettingsModalOpen(true)}
											className="w-full h-9 px-3 flex items-center gap-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-left"
										>
											<div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
												<Settings size={14} className="text-gray-600 dark:text-gray-400" />
											</div>
											<span>{t("sidebar.settings", currentLanguage)}</span>
										</button>
									</div>
								</div>

								<div>
									<h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
										{t("sidebar.account", currentLanguage)}
									</h3>
									<div className="space-y-1">
										{isLoggedIn ? (
											<div className="w-full px-3 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
												<div className="flex items-center gap-3">
													<div className="relative">
														<div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
															<User size={18} />
														</div>
														<div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-700"></div>
													</div>
													<div className="min-w-0 flex-1">
														<p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
															{currentUser?.name || "User"}
														</p>
														<p className="text-xs text-gray-600 dark:text-gray-300 truncate mt-0.5">
															{currentUser?.email}
														</p>
													</div>
													<button
														type="button"
														onClick={handleSignOut}
														className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
													>
														<LogIn size={16} className="rotate-180" />
													</button>
												</div>
											</div>
										) : (
											<button
												type="button"
												onClick={() => setIsLoginModalOpen(true)}
												className="w-full h-10 px-3 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all text-white font-medium shadow-sm"
											>
												<LogIn size={16} />
												<span>{t("sidebar.signIn", currentLanguage)}</span>
											</button>
										)}
									</div>
								</div>

								{/* Pro Tip Card */}
								<div>
									<div
										className={`relative p-4 rounded-xl bg-gradient-to-br ${currentTip.gradient} text-white overflow-hidden`}
									>
										{/* Background decoration */}
										<div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-8 translate-x-8"></div>
										<div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-6 -translate-x-6"></div>

										<div className="relative z-10">
											<div className="flex items-center justify-between mb-3">
												<div className="flex items-center gap-2">
													<div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center">
														<Lightbulb size={14} className="text-white" />
													</div>
													<span className="text-xs font-semibold uppercase tracking-wider opacity-90">
														{t("sidebar.proTip", currentLanguage)}
													</span>
												</div>
												<button
													type="button"
													onClick={nextTip}
													className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
												>
													<ChevronRight size={12} className="text-white" />
												</button>
											</div>

											<h4 className="text-sm font-semibold mb-2">{currentTip.title}</h4>
											<p className="text-xs opacity-90 leading-relaxed">{currentTip.description}</p>

											<div className="flex items-center justify-between mt-3">
												<div className="flex gap-1">
													{tips.map((tip, index) => (
														<div
															key={tip.title}
															className={`w-1.5 h-1.5 rounded-full transition-opacity ${
																index === currentTipIndex ? "bg-white" : "bg-white/40"
															}`}
														/>
													))}
												</div>
												<div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
													<currentTip.icon size={16} className="text-white" />
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Footer - Fixed at bottom */}
					<div className="px-3 py-3 border-t border-gray-200 dark:border-gray-800 mt-auto">
						<div className="flex items-center justify-between">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
									>
										<Globe size={14} />
										<span>{languages.find((l) => l.code === currentLanguage)?.label}</span>
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent side="top" align="start">
									{languages.map((lang) => (
										<DropdownMenuItem key={lang.code} onClick={() => handleLanguageChange(lang.code)}>
											<lang.icon className="w-4 h-4 mr-2" />
											{lang.name}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>

							<a
								href={currentLanguage === "nl" ? "https://robbeverhelst.be" : "https://robbeverhelst.com"}
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
							>
								by robbeverhelst
							</a>
						</div>
					</div>
				</SheetContent>
			</Sheet>

			{/* Modals */}
			<LoginModal
				isOpen={isLoginModalOpen}
				onOpenChange={setIsLoginModalOpen}
				onLoginSuccess={() => setIsLoginModalOpen(false)}
				currentLanguage={currentLanguage}
			/>

			<Suspense fallback={null}>
				<SettingsModal
					isOpen={isSettingsModalOpen}
					onOpenChange={setIsSettingsModalOpen}
					currentLanguage={currentLanguage}
					onLanguageChange={onLanguageChange}
					isLoggedIn={isLoggedIn}
					currentUser={currentUser}
					showSunDirection={showSunDirection}
					onToggleSunDirection={onToggleSunDirection}
				/>
			</Suspense>
		</>
	);
}
