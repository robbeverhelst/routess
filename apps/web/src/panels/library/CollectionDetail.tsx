import type { ApiRoute } from "@routess/api-client";
import type { RouteVisibility } from "@routess/core";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics/track";
import {
	useCollection,
	useDeleteCollection,
	useSetCollectionRoutes,
	useUpdateCollection,
	useUserRoutes,
} from "@/lib/api-queries";
import { emitAppEvent, routeToLoadDetail } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { useUnits } from "@/lib/units";
import { useLibraryStore } from "@/stores/libraryStore";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { EditableLabel } from "../../components/EditableLabel";
import { I, type IconKey } from "../../components/icons";
import { Btn, IconBtn, RDS_COLORS } from "../../components/primitives";
import { DropMenu, MenuDivider, MenuItem } from "./DropMenu";
import { RouteThumb } from "./RouteThumb";

const VISIBILITY_ICON: Record<RouteVisibility, IconKey> = { private: "lock", unlisted: "share", public: "globe" };

function RouteRow({
	route,
	index,
	selected,
	editable,
	dragging,
	dragTarget,
	formatDistance,
	onClick,
	onRemove,
	onLoad,
	onGripPointerDown,
	onGripPointerMove,
	onGripPointerEnd,
}: {
	route: ApiRoute;
	index: number;
	selected: boolean;
	editable: boolean;
	dragging: boolean;
	dragTarget: boolean;
	formatDistance: (km: number) => string;
	onClick: () => void;
	onRemove: () => void;
	onLoad: () => void;
	onGripPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
	onGripPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
	onGripPointerEnd: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
	const t = useT();
	const [hover, setHover] = useState(false);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: row click is selection-only; actionable controls are buttons inside
		<div
			data-collection-row={index}
			onClick={onClick}
			onKeyDown={(e) => e.key === "Enter" && onClick()}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			style={{
				display: "flex",
				alignItems: "center",
				gap: 10,
				padding: "8px 10px",
				borderRadius: 10,
				border: `1px solid ${selected ? RDS_COLORS.accent : "transparent"}`,
				background: dragTarget ? RDS_COLORS.bgActive : hover ? RDS_COLORS.bgHover : "transparent",
				opacity: dragging ? 0.4 : 1,
				cursor: "pointer",
				transition: "background 120ms",
			}}
		>
			{editable && (
				// biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops the post-drag click from selecting the row
				<div
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
					style={{ display: "inline-flex" }}
				>
					<IconBtn
						title={t("plan.dragToReorder")}
						onPointerDown={onGripPointerDown}
						onPointerMove={onGripPointerMove}
						onPointerUp={onGripPointerEnd}
						onPointerCancel={onGripPointerEnd}
						style={{
							cursor: dragging ? "grabbing" : "grab",
							color: RDS_COLORS.fgSubtle,
							touchAction: "none",
						}}
					>
						<I.grip size={14} />
					</IconBtn>
				</div>
			)}
			<div
				style={{
					width: 40,
					height: 40,
					borderRadius: 8,
					background: RDS_COLORS.bgInput,
					border: `1px solid ${RDS_COLORS.border}`,
					flexShrink: 0,
					overflow: "hidden",
				}}
			>
				<RouteThumb route={route} width={40} height={40} />
			</div>
			<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
				<div
					style={{
						fontSize: 13,
						fontWeight: 500,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{route.name}
				</div>
				<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
					{route.distance ? formatDistance(route.distance / 1000) : "—"}
				</div>
			</div>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: container only stops click bubbling */}
			<div
				style={{ display: "flex", gap: 2, opacity: hover || selected ? 1 : 0, transition: "opacity 120ms" }}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<IconBtn title={t("route.loadOnMap")} onClick={onLoad}>
					<I.play size={13} />
				</IconBtn>
				{editable && (
					<IconBtn title={t("library.collections.removeRoute")} onClick={onRemove}>
						<I.close size={13} />
					</IconBtn>
				)}
			</div>
		</div>
	);
}

export function CollectionDetail({
	collectionId,
	readOnly = false,
	onBack,
}: {
	collectionId: number;
	readOnly?: boolean;
	onBack: () => void;
}) {
	const t = useT();
	const { formatDistance } = useUnits();
	const { data: detail, isLoading } = useCollection(collectionId);
	const updateCollection = useUpdateCollection();
	const deleteCollection = useDeleteCollection();
	const setCollectionRoutes = useSetCollectionRoutes();
	const pushToast = useToastStore((s) => s.push);
	const setContext = useUiStore((s) => s.setContext);
	const selectedRoute = useLibraryStore((s) => s.selectedRoute);
	const selectRoute = useLibraryStore((s) => s.selectRoute);

	const [menuOpen, setMenuOpen] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [addingRoutes, setAddingRoutes] = useState(false);
	const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
	const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

	const editable = !readOnly;
	const routes = detail?.routes ?? [];

	const closeMenu = () => {
		setMenuOpen(false);
		setConfirmingDelete(false);
	};

	const setRouteIds = (routeIds: number[]) => {
		setCollectionRoutes.mutate(
			{ collectionId, routeIds },
			{ onError: () => pushToast({ kind: "danger", title: t("library.collections.updateFailed") }) },
		);
	};

	const setVisibility = (visibility: RouteVisibility) => {
		closeMenu();
		updateCollection.mutate({ collectionId, updates: { visibility } });
	};

	const copyShareLink = async () => {
		if (!detail) return;
		closeMenu();
		// Private collections aren't reachable by URL; flip to unlisted first.
		// The menu label spells this out for private collections.
		if (detail.visibility === "private") {
			updateCollection.mutate({ collectionId, updates: { visibility: "unlisted" } });
		}
		const url = `${window.location.origin}?collection=${collectionId}`;
		try {
			await navigator.clipboard.writeText(url);
			pushToast({ kind: "success", title: t("library.collections.shareCopied"), body: url });
			trackEvent({
				name: "collection_share_link_copied",
				properties: { visibility: detail.visibility === "private" ? "unlisted" : detail.visibility },
			});
		} catch {
			pushToast({ kind: "danger", title: t("common.tryAgain") });
		}
	};

	const removeCollection = () => {
		if (!confirmingDelete) {
			setConfirmingDelete(true);
			return;
		}
		closeMenu();
		deleteCollection.mutate(collectionId, {
			onSuccess: () => {
				pushToast({ kind: "success", title: t("library.collections.deleted") });
				onBack();
			},
		});
	};

	const loadOnMap = (route: ApiRoute) => {
		emitAppEvent("routess:load-route", routeToLoadDetail(route));
		setContext("plan");
		pushToast({ kind: "success", title: t("route.loaded"), body: route.name });
	};

	const reorder = (from: number, to: number) => {
		const ids = routes.map((r) => r.id);
		const [moved] = ids.splice(from, 1);
		ids.splice(to, 0, moved);
		setRouteIds(ids);
	};

	// Reorder via pointer events on the grip so it works for mouse and touch
	// alike (HTML5 drag-and-drop never fires on mobile browsers).
	const handleGripPointerDown = (index: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
		e.preventDefault();
		e.currentTarget.setPointerCapture(e.pointerId);
		setDraggingIdx(index);
	};

	const handleGripPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
		if (draggingIdx === null) return;
		const row = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-collection-row]");
		const target = row instanceof HTMLElement ? Number(row.dataset.collectionRow) : Number.NaN;
		setDragOverIdx(Number.isInteger(target) ? target : null);
	};

	const handleGripPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
		if (draggingIdx === null) return;
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId);
		}
		if (dragOverIdx !== null && dragOverIdx !== draggingIdx) {
			reorder(draggingIdx, dragOverIdx);
		}
		setDraggingIdx(null);
		setDragOverIdx(null);
	};

	const VisIcon = detail ? I[VISIBILITY_ICON[detail.visibility]] : null;

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "12px 16px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<IconBtn title={t("route.back")} onClick={onBack}>
					<I.chevronL size={16} />
				</IconBtn>
				<div style={{ flex: 1, minWidth: 0 }}>
					{detail &&
						(editable ? (
							<EditableLabel
								value={detail.name}
								onSave={(next) => {
									const name = next?.trim();
									if (name && name !== detail.name) updateCollection.mutate({ collectionId, updates: { name } });
								}}
								style={{ fontSize: 15, fontWeight: 600 }}
							/>
						) : (
							<span style={{ fontSize: 15, fontWeight: 600 }}>{detail.name}</span>
						))}
				</div>
				{detail && VisIcon && (
					<span
						title={t(`library.visibility.${detail.visibility}`)}
						style={{ color: RDS_COLORS.fgSubtle, display: "inline-flex" }}
					>
						<VisIcon size={13} />
					</span>
				)}
				{editable && detail && (
					<div style={{ position: "relative" }}>
						<IconBtn title={t("route.more")} onClick={() => setMenuOpen((v) => !v)} pressed={menuOpen}>
							<I.more size={14} />
						</IconBtn>
						<DropMenu open={menuOpen} onClose={closeMenu} width={230}>
							<MenuItem
								icon="share"
								label={
									detail.visibility === "private"
										? t("library.collections.shareMakesUnlisted")
										: t("library.collections.copyShareLink")
								}
								onClick={() => void copyShareLink()}
							/>
							<MenuDivider />
							<div style={{ padding: "6px 10px 2px", fontSize: 11, fontWeight: 600, color: RDS_COLORS.fgSubtle }}>
								{t("library.filter.visibility")}
							</div>
							{(["private", "unlisted", "public"] as const).map((v) => (
								<MenuItem
									key={v}
									icon={VISIBILITY_ICON[v]}
									label={t(`library.visibility.${v}`)}
									checked={detail.visibility === v}
									onClick={() => setVisibility(v)}
								/>
							))}
							<MenuDivider />
							<MenuItem
								icon="trash"
								label={confirmingDelete ? t("library.collections.confirmDelete") : t("library.collections.delete")}
								danger
								onClick={removeCollection}
							/>
						</DropMenu>
					</div>
				)}
			</div>

			{detail?.description && (
				<p style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted, margin: 0, padding: "10px 16px 0", lineHeight: 1.5 }}>
					{detail.description}
				</p>
			)}

			<div style={{ padding: "10px 10px", overflow: "auto", flex: 1 }}>
				{isLoading && (
					<div style={{ padding: 20, textAlign: "center", fontSize: 13, color: RDS_COLORS.fgSubtle }}>
						{t("library.loading")}
					</div>
				)}
				{!isLoading && routes.length === 0 && (
					<div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: RDS_COLORS.fgSubtle }}>
						{t("library.collections.emptyDetail")}
					</div>
				)}
				{routes.map((route, i) => (
					<RouteRow
						key={route.id}
						route={route}
						index={i}
						selected={selectedRoute?.id === route.id}
						editable={editable}
						dragging={draggingIdx === i}
						dragTarget={dragOverIdx === i && draggingIdx !== null && draggingIdx !== i}
						formatDistance={formatDistance}
						onClick={() => selectRoute(route)}
						onLoad={() => loadOnMap(route)}
						onRemove={() => setRouteIds(routes.filter((r) => r.id !== route.id).map((r) => r.id))}
						onGripPointerDown={handleGripPointerDown(i)}
						onGripPointerMove={handleGripPointerMove}
						onGripPointerEnd={handleGripPointerEnd}
					/>
				))}

				{editable && detail && (
					<AddRoutesSection
						open={addingRoutes}
						onToggle={() => setAddingRoutes((v) => !v)}
						existingIds={detail.routeIds}
						onAdd={(routeId) => setRouteIds([...detail.routeIds, routeId])}
						pending={setCollectionRoutes.isPending}
					/>
				)}
			</div>
		</div>
	);
}

function AddRoutesSection({
	open,
	onToggle,
	existingIds,
	onAdd,
	pending,
}: {
	open: boolean;
	onToggle: () => void;
	existingIds: number[];
	onAdd: (routeId: number) => void;
	pending: boolean;
}) {
	const t = useT();
	const { formatDistance } = useUnits();
	const { data: allRoutes = [] } = useUserRoutes();
	const candidates = allRoutes.filter((r) => !existingIds.includes(r.id));

	return (
		<div style={{ marginTop: 10 }}>
			<Btn variant="ghost" style={{ width: "100%", justifyContent: "flex-start" }} onClick={onToggle}>
				<I.plus size={14} /> {t("library.collections.addRoutes")}
			</Btn>
			{open && candidates.length === 0 && (
				<div style={{ padding: "12px 16px", fontSize: 12.5, color: RDS_COLORS.fgSubtle }}>
					{t("library.collections.noCandidates")}
				</div>
			)}
			{open &&
				candidates.map((route) => (
					<div
						key={route.id}
						style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 10 }}
					>
						<div
							style={{
								width: 32,
								height: 32,
								borderRadius: 8,
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								flexShrink: 0,
								overflow: "hidden",
							}}
						>
							<RouteThumb route={route} width={32} height={32} />
						</div>
						<div style={{ flex: 1, minWidth: 0 }}>
							<div style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
								{route.name}
							</div>
							<div className="rds-mono" style={{ fontSize: 10.5, color: RDS_COLORS.fgSubtle }}>
								{route.distance ? formatDistance(route.distance / 1000) : "—"}
							</div>
						</div>
						<IconBtn title={t("library.collections.addRoute")} onClick={() => onAdd(route.id)} disabled={pending}>
							<I.plus size={14} />
						</IconBtn>
					</div>
				))}
		</div>
	);
}
