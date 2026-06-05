import { useEffect, useState } from "react";
import { useIsAuthenticated } from "@/hooks/useAuthState";
import { useBackfillRouteGeometry } from "@/hooks/useBackfillRouteGeometry";
import { useFavouritesMigration } from "@/hooks/useFavouritesMigration";
import { useUserRoutes } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/libraryStore";
import { useModalsStore } from "@/stores/modalsStore";
import { useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { Btn, Kbd, RDS_COLORS } from "../components/primitives";
import { SignInGate } from "../components/SignInGate";
import { CollectionDetail } from "./library/CollectionDetail";
import { CollectionsTab } from "./library/CollectionsTab";
import { RoutesTab } from "./library/RoutesTab";
import { RouteDetailPanel } from "./RouteDetailPanel";

type LibraryTab = "routes" | "collections";

function EmptyLibrary({
	onPlan,
	onLoop,
	onImport,
}: {
	onPlan?: () => void;
	onLoop?: () => void;
	onImport?: () => void;
}) {
	const t = useT();
	return (
		<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
			<div style={{ maxWidth: 320, textAlign: "center" }}>
				<div
					style={{
						width: 88,
						height: 88,
						margin: "0 auto 18px",
						borderRadius: 22,
						background: RDS_COLORS.accentSoft,
						color: RDS_COLORS.accent,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						position: "relative",
					}}
				>
					<I.library size={36} />
					<div
						style={{
							position: "absolute",
							top: -6,
							right: -6,
							width: 28,
							height: 28,
							borderRadius: 999,
							background: RDS_COLORS.bgPanel,
							border: `2px solid ${RDS_COLORS.accent}`,
							color: RDS_COLORS.accent,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<I.plus size={14} />
					</div>
				</div>
				<h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{t("library.empty.title")}</h3>
				<p style={{ fontSize: 13, color: RDS_COLORS.fgMuted, margin: "8px 0 20px", lineHeight: 1.55 }}>
					{t("library.empty.subtitle")}
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<Btn variant="primary" style={{ width: "100%" }} onClick={onPlan}>
						<I.plus size={14} /> {t("library.empty.plan")}
					</Btn>
					<Btn style={{ width: "100%" }} onClick={onLoop}>
						<I.compass size={14} /> {t("library.empty.loop")}
					</Btn>
					<Btn variant="ghost" style={{ width: "100%", color: RDS_COLORS.fgMuted }} onClick={onImport}>
						<I.upload size={14} /> {t("library.empty.import")}
					</Btn>
				</div>
			</div>
		</div>
	);
}

export function LibraryPanel() {
	const isAuthenticated = useIsAuthenticated();
	const t = useT();
	const sharedCollectionId = useLibraryStore((s) => s.sharedCollectionId);
	const setSharedCollectionId = useLibraryStore((s) => s.setSharedCollectionId);
	const selectRoute = useLibraryStore((s) => s.selectRoute);
	const selectedRoute = useLibraryStore((s) => s.selectedRoute);

	// Legacy routes without stored geometry get their path computed and
	// persisted on first selection.
	useBackfillRouteGeometry(selectedRoute);

	// Clear the map preview when the panel unmounts (context switch).
	useEffect(() => () => selectRoute(null), [selectRoute]);

	// A shared-collection deep link renders before the sign-in gate so
	// recipients without an account can view unlisted/public collections.
	if (sharedCollectionId != null) {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<CollectionDetail
					collectionId={sharedCollectionId}
					readOnly
					onBack={() => {
						setSharedCollectionId(null);
						window.history.replaceState({}, "", window.location.pathname);
					}}
				/>
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<SignInGate title={t("library.gate.title")} description={t("library.gate.body")} icon={I.library} />
			</div>
		);
	}
	return <LibraryPanelInner />;
}

function LibraryPanelInner() {
	const t = useT();
	const { data: routes = [], isLoading } = useUserRoutes();
	const setContext = useUiStore((s) => s.setContext);
	const openModal = useModalsStore((s) => s.openModal);
	const [tab, setTab] = useState<LibraryTab>("routes");
	const [query, setQuery] = useState("");
	const [openedRouteId, setOpenedRouteId] = useState<number | null>(null);
	const [openedCollectionId, setOpenedCollectionId] = useState<number | null>(null);

	useFavouritesMigration(isLoading ? undefined : routes);

	const openedRoute = openedRouteId != null ? routes.find((r) => r.id === openedRouteId) : null;
	if (openedRoute) {
		return <RouteDetailPanel route={openedRoute} onBack={() => setOpenedRouteId(null)} />;
	}
	if (openedCollectionId != null) {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<CollectionDetail collectionId={openedCollectionId} onBack={() => setOpenedCollectionId(null)} />
			</div>
		);
	}

	if (!isLoading && routes.length === 0 && tab === "routes") {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<EmptyLibrary
					onPlan={() => setContext("plan")}
					onLoop={() => openModal("loop")}
					onImport={() => openModal("import")}
				/>
			</div>
		);
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div style={{ padding: "16px 20px 0" }}>
				<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							flex: 1,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 8,
							height: 36,
							padding: "0 10px",
						}}
					>
						<I.search size={14} />
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							style={{
								background: "transparent",
								border: 0,
								outline: "none",
								flex: 1,
								fontSize: 13,
								color: "inherit",
							}}
							placeholder={tab === "routes" ? t("library.searchPlaceholder") : t("library.searchCollections")}
						/>
						<Kbd>/</Kbd>
					</div>
					<Btn variant="primary" onClick={() => setContext("plan")}>
						<I.plus size={14} /> {t("common.new")}
					</Btn>
				</div>
				<div style={{ display: "flex", gap: 2 }}>
					{(["routes", "collections"] as const).map((key) => {
						const on = tab === key;
						return (
							<button
								key={key}
								type="button"
								role="tab"
								aria-selected={on}
								onClick={() => setTab(key)}
								style={{
									padding: "8px 14px",
									background: "transparent",
									border: 0,
									borderBottom: `2px solid ${on ? RDS_COLORS.accent : "transparent"}`,
									color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
									fontSize: 13,
									fontWeight: on ? 600 : 500,
									cursor: "pointer",
								}}
							>
								{t(key === "routes" ? "library.tab.routes" : "library.tab.collections")}
							</button>
						);
					})}
				</div>
			</div>

			{tab === "routes" ? (
				<RoutesTab
					routes={routes}
					isLoading={isLoading}
					query={query}
					onClearQuery={() => setQuery("")}
					onOpen={(route) => setOpenedRouteId(route.id)}
				/>
			) : (
				<CollectionsTab routes={routes} query={query} onOpenCollection={(id) => setOpenedCollectionId(id)} />
			)}
		</div>
	);
}
