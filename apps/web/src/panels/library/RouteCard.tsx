import type { ApiRoute } from "@routess/api-client";
import type { RouteActivity, RouteVisibility } from "@routess/core";
import { useState } from "react";
import { exportRouteGpx } from "@/features/routing/services/exportRouteGpx";
import {
	useCollections,
	useSaveRoute,
	useSetCollectionRoutes,
	useToggleFavourite,
	useUpdateRoute,
} from "@/lib/api-queries";
import { emitAppEvent, routeToLoadDetail } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { formatDurationClockParts, useUnits } from "@/lib/units";
import { useModalsStore } from "@/stores/modalsStore";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { I, type IconKey } from "../../components/icons";
import { IconBtn, RDS_COLORS } from "../../components/primitives";
import { DropMenu, MenuDivider, MenuItem } from "./DropMenu";
import { RouteThumb } from "./RouteThumb";

const STRIP_WIDTH = 312;
const STRIP_HEIGHT = 96;

const ACTIVITY_ICON: Record<RouteActivity, IconKey> = { cycle: "bike", run: "run", walk: "walk" };

// No hover means no way to reveal a hover-only menu; keep it visible on touch.
const NO_HOVER = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

const VISIBILITY_META: Record<RouteVisibility, { icon: IconKey; titleKey: string }> = {
	private: { icon: "lock", titleKey: "library.visibility.private" },
	unlisted: { icon: "share", titleKey: "library.visibility.unlisted" },
	public: { icon: "globe", titleKey: "library.visibility.public" },
};

function StatItem({ icon, label, title }: { icon: IconKey; label: string; title?: string }) {
	const Icon = I[icon];
	return (
		<span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }} title={title}>
			<Icon size={12} style={{ opacity: 0.8 }} />
			{label}
		</span>
	);
}

function TagChipBtn({ tag, onClick }: { tag: string; onClick?: () => void }) {
	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onClick?.();
			}}
			style={{
				display: "inline-flex",
				alignItems: "center",
				padding: "2px 8px",
				height: 20,
				borderRadius: 999,
				background: RDS_COLORS.accentSoft,
				color: RDS_COLORS.accent,
				fontSize: 11,
				fontWeight: 500,
				border: 0,
				cursor: onClick ? "pointer" : "default",
				whiteSpace: "nowrap",
			}}
		>
			#{tag}
		</button>
	);
}

function TagsEditor({ route, onDone }: { route: ApiRoute; onDone: () => void }) {
	const t = useT();
	const updateRoute = useUpdateRoute();
	const [tags, setTags] = useState<string[]>(route.tags ?? []);
	const [input, setInput] = useState("");

	const commit = (next: string[]) => {
		setTags(next);
		updateRoute.mutate({ routeId: route.id, updates: { tags: next } });
	};

	const addTag = () => {
		const tag = input.trim().toLowerCase().replace(/^#/, "");
		if (!tag || tags.includes(tag) || tags.length >= 20) return;
		commit([...tags, tag]);
		setInput("");
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: container only stops click bubbling to the card
		<div
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
			style={{
				display: "flex",
				flexWrap: "wrap",
				gap: 6,
				alignItems: "center",
				padding: "8px 12px 10px",
				borderTop: `1px dashed ${RDS_COLORS.border}`,
			}}
		>
			{tags.map((tag) => (
				<span
					key={tag}
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 4,
						padding: "2px 6px 2px 8px",
						height: 22,
						borderRadius: 999,
						background: RDS_COLORS.accentSoft,
						color: RDS_COLORS.accent,
						fontSize: 11,
						fontWeight: 500,
					}}
				>
					#{tag}
					<button
						type="button"
						aria-label={t("library.tags.remove", { tag })}
						onClick={() => commit(tags.filter((x) => x !== tag))}
						style={{
							display: "inline-flex",
							background: "transparent",
							border: 0,
							color: "inherit",
							cursor: "pointer",
							padding: 0,
						}}
					>
						<I.close size={11} />
					</button>
				</span>
			))}
			<input
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						addTag();
					}
					if (e.key === "Escape") onDone();
				}}
				onBlur={() => {
					addTag();
					onDone();
				}}
				// biome-ignore lint/a11y/noAutofocus: editor only mounts on explicit user action
				autoFocus
				placeholder={t("library.tags.placeholder")}
				style={{
					flex: 1,
					minWidth: 90,
					background: "transparent",
					border: 0,
					outline: "none",
					fontSize: 12,
					color: "inherit",
					height: 22,
				}}
			/>
		</div>
	);
}

export function RouteCard({
	route,
	selected,
	onOpen,
	onTagClick,
}: {
	route: ApiRoute;
	selected: boolean;
	onOpen: () => void;
	onTagClick?: (tag: string) => void;
}) {
	const t = useT();
	const { formatDistance, formatElevationParts } = useUnits();
	const [hover, setHover] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [menuView, setMenuView] = useState<"root" | "collections">("root");
	const [renaming, setRenaming] = useState(false);
	const [renameValue, setRenameValue] = useState(route.name);
	const [editingTags, setEditingTags] = useState(false);

	const toggleFavourite = useToggleFavourite();
	const updateRoute = useUpdateRoute();
	const saveRoute = useSaveRoute();
	const setCollectionRoutes = useSetCollectionRoutes();
	const { data: collections = [] } = useCollections();
	const openDelete = useModalsStore((s) => s.openDelete);
	const openShareModal = useModalsStore((s) => s.openShare);
	const pushToast = useToastStore((s) => s.push);
	const setContext = useUiStore((s) => s.setContext);

	const dist = route.distance ? formatDistance(route.distance / 1000) : null;
	const elevParts = route.elevationGain ? formatElevationParts(route.elevationGain) : null;
	// Same clock format as the plan panel; cards must not invent their own.
	const durationParts = route.duration ? formatDurationClockParts(route.duration) : null;
	const duration = durationParts ? `${durationParts.value}${durationParts.unit}` : null;
	const date = new Date(route.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
	const visibilityMeta = VISIBILITY_META[route.visibility ?? "private"];
	const activityIcon: IconKey = route.activity ? ACTIVITY_ICON[route.activity] : "route";
	const tags = route.tags ?? [];

	const closeMenu = () => {
		setMenuOpen(false);
		setMenuView("root");
	};

	const editInPlanner = () => {
		closeMenu();
		emitAppEvent("routess:load-route", routeToLoadDetail(route));
		setContext("plan");
		pushToast({ kind: "success", title: t("route.loaded"), body: route.name });
	};

	const commitRename = () => {
		const name = renameValue.trim();
		setRenaming(false);
		if (!name || name === route.name) {
			setRenameValue(route.name);
			return;
		}
		updateRoute.mutate(
			{ routeId: route.id, updates: { name } },
			{
				onError: () => {
					setRenameValue(route.name);
					pushToast({ kind: "danger", title: t("route.renameFailed"), body: t("common.tryAgain") });
				},
			},
		);
	};

	const duplicate = () => {
		closeMenu();
		saveRoute.mutate(
			{
				name: `${route.name} (copy)`,
				description: route.description,
				activity: route.activity,
				tags: route.tags,
				waypoints: route.waypoints,
				geometry: route.geometry,
				distance: route.distance,
				duration: route.duration,
				elevationGain: route.elevationGain,
				startAddress: route.startAddress,
				endAddress: route.endAddress,
				provenance: route.provenance,
				...(route.routingPreferences ? { routingPreferences: route.routingPreferences } : {}),
			},
			{
				onSuccess: (newRoute) => pushToast({ kind: "success", title: t("route.duplicated"), body: newRoute.name }),
				onError: () => pushToast({ kind: "danger", title: t("route.duplicateFailed"), body: t("common.tryAgain") }),
			},
		);
	};

	const share = () => {
		closeMenu();
		// Share this route directly; loading it into the planner first would
		// clobber whatever draft the user is working on.
		openShareModal(route.id);
	};

	const exportGpx = () => {
		closeMenu();
		if (exportRouteGpx(route)) {
			pushToast({ kind: "success", title: t("library.card.gpxExported"), body: route.name });
		} else {
			pushToast({ kind: "danger", title: t("library.card.gpxExportFailed"), body: t("common.tryAgain") });
		}
	};

	const toggleInCollection = (collectionId: number, routeIds: number[]) => {
		const next = routeIds.includes(route.id) ? routeIds.filter((id) => id !== route.id) : [...routeIds, route.id];
		setCollectionRoutes.mutate(
			{ collectionId, routeIds: next },
			{
				onError: () => pushToast({ kind: "danger", title: t("library.collections.updateFailed") }),
			},
		);
	};

	const borderColor = selected ? RDS_COLORS.accent : hover ? RDS_COLORS.borderStrong : RDS_COLORS.border;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: card click opens details; all other actions are real buttons inside
		<div
			onClick={onOpen}
			onKeyDown={(e) => {
				if (e.key === "Enter") onOpen();
			}}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			data-selected={selected || undefined}
			style={{
				position: "relative",
				borderRadius: 14,
				cursor: "pointer",
				border: `1px solid ${borderColor}`,
				boxShadow: selected ? `0 0 0 1px ${RDS_COLORS.accent}` : undefined,
				background: hover && !selected ? RDS_COLORS.bgHover : RDS_COLORS.bgPanel,
				marginBottom: 10,
				overflow: "hidden",
				transition: "background 120ms, border-color 120ms, box-shadow 120ms",
			}}
		>
			<div
				style={{
					height: STRIP_HEIGHT,
					background: RDS_COLORS.bgInput,
					borderBottom: `1px solid ${RDS_COLORS.border}`,
					position: "relative",
				}}
			>
				<RouteThumb route={route} width={STRIP_WIDTH} height={STRIP_HEIGHT} />
				{/* biome-ignore lint/a11y/noStaticElementInteractions: container only stops click bubbling so actions don't toggle selection */}
				<div
					style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				>
					<div
						style={{
							opacity: route.favourite || hover || selected ? 1 : 0,
							transition: "opacity 120ms",
							pointerEvents: route.favourite || hover || selected ? "auto" : "none",
							background: "color-mix(in oklch, var(--rds-bg-panel) 80%, transparent)",
							borderRadius: 8,
							backdropFilter: "blur(4px)",
						}}
					>
						<IconBtn
							title={route.favourite ? t("route.removeFavourite") : t("library.markFavourite")}
							onClick={() => toggleFavourite.mutate({ routeId: route.id, favourite: !route.favourite })}
							pressed={route.favourite}
							style={{ width: 28, height: 28 }}
						>
							<I.heart
								size={14}
								style={route.favourite ? { color: RDS_COLORS.danger, fill: "currentColor" } : undefined}
							/>
						</IconBtn>
					</div>
					<div
						style={{
							opacity: NO_HOVER || hover || selected || menuOpen ? 1 : 0,
							transition: "opacity 120ms",
							pointerEvents: NO_HOVER || hover || selected || menuOpen ? "auto" : "none",
							background: "color-mix(in oklch, var(--rds-bg-panel) 80%, transparent)",
							borderRadius: 8,
							backdropFilter: "blur(4px)",
						}}
					>
						<IconBtn title={t("route.delete")} onClick={() => openDelete(route.id)} style={{ width: 28, height: 28 }}>
							<I.trash size={14} />
						</IconBtn>
					</div>
					<div
						style={{
							position: "relative",
							opacity: NO_HOVER || hover || selected || menuOpen ? 1 : 0,
							transition: "opacity 120ms",
							pointerEvents: NO_HOVER || hover || selected || menuOpen ? "auto" : "none",
							background: "color-mix(in oklch, var(--rds-bg-panel) 80%, transparent)",
							borderRadius: 8,
							backdropFilter: "blur(4px)",
						}}
					>
						<IconBtn
							title={t("route.more")}
							onClick={() => setMenuOpen((v) => !v)}
							pressed={menuOpen}
							style={{ width: 28, height: 28 }}
						>
							<I.more size={14} />
						</IconBtn>
						<DropMenu open={menuOpen} onClose={closeMenu} width={210}>
							{menuView === "root" ? (
								<>
									<MenuItem icon="route" label={t("library.card.editInPlanner")} onClick={editInPlanner} />
									<MenuItem
										icon="pencil"
										label={t("library.card.rename")}
										onClick={() => {
											closeMenu();
											setRenameValue(route.name);
											setRenaming(true);
										}}
									/>
									<MenuItem
										icon="copy"
										label={saveRoute.isPending ? t("route.duplicating") : t("route.duplicate")}
										onClick={duplicate}
										disabled={saveRoute.isPending}
									/>
									<MenuDivider />
									<MenuItem
										icon="folderPlus"
										label={t("library.card.addToCollection")}
										onClick={() => setMenuView("collections")}
										trailing={<I.chevronR size={13} style={{ color: RDS_COLORS.fgSubtle }} />}
									/>
									<MenuItem
										icon="tag"
										label={t("library.card.editTags")}
										onClick={() => {
											closeMenu();
											setEditingTags(true);
										}}
									/>
									<MenuDivider />
									<MenuItem icon="download" label={t("library.card.exportGpx")} onClick={exportGpx} />
									<MenuItem icon="share" label={t("route.share")} onClick={share} />
									<MenuDivider />
									<MenuItem
										icon="trash"
										label={t("route.delete")}
										danger
										onClick={() => {
											closeMenu();
											openDelete(route.id);
										}}
									/>
								</>
							) : (
								<>
									<MenuItem
										icon="chevronL"
										label={t("library.card.addToCollection")}
										onClick={() => setMenuView("root")}
									/>
									<MenuDivider />
									{collections.length === 0 && (
										<div style={{ padding: "8px 10px", fontSize: 12, color: RDS_COLORS.fgSubtle }}>
											{t("library.collections.noneYet")}
										</div>
									)}
									{collections.map((c) => (
										<MenuItem
											key={c.id}
											label={c.name}
											checked={c.routeIds.includes(route.id)}
											disabled={setCollectionRoutes.isPending}
											onClick={() => toggleInCollection(c.id, c.routeIds)}
										/>
									))}
								</>
							)}
						</DropMenu>
					</div>
				</div>
			</div>

			<div style={{ padding: "10px 12px 4px" }}>
				{renaming ? (
					<input
						value={renameValue}
						onChange={(e) => setRenameValue(e.target.value)}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => {
							e.stopPropagation();
							if (e.key === "Enter") commitRename();
							if (e.key === "Escape") {
								setRenameValue(route.name);
								setRenaming(false);
							}
						}}
						onBlur={commitRename}
						// biome-ignore lint/a11y/noAutofocus: input only mounts on explicit rename action
						autoFocus
						style={{
							width: "100%",
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.borderStrong}`,
							borderRadius: 6,
							padding: "4px 8px",
							fontSize: 14,
							fontWeight: 600,
							color: "inherit",
							outline: "none",
						}}
					/>
				) : (
					<div
						style={{
							fontSize: 14,
							fontWeight: 600,
							color: RDS_COLORS.fg,
							lineHeight: 1.3,
							display: "-webkit-box",
							WebkitLineClamp: 2,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
							wordBreak: "break-word",
						}}
					>
						{route.name}
					</div>
				)}
				<div
					className="rds-mono"
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						fontSize: 11.5,
						color: RDS_COLORS.fgSubtle,
						marginTop: 6,
						minWidth: 0,
						overflow: "hidden",
						whiteSpace: "nowrap",
					}}
				>
					<StatItem
						icon={activityIcon}
						label={dist ?? "—"}
						title={route.activity ? t(`sport.${route.activity}`) : undefined}
					/>
					{elevParts && <StatItem icon="trend" label={`${elevParts.value} ${elevParts.unit}`} />}
					{duration && <StatItem icon="activity" label={duration} />}
					<span style={{ flex: 1 }} />
					<StatItem icon={visibilityMeta.icon} label="" title={t(visibilityMeta.titleKey)} />
					<span>{date}</span>
				</div>
				{tags.length > 0 && !editingTags && (
					<div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
						{tags.map((tag) => (
							<TagChipBtn key={tag} tag={tag} onClick={onTagClick ? () => onTagClick(tag) : undefined} />
						))}
					</div>
				)}
			</div>

			{editingTags && <TagsEditor route={route} onDone={() => setEditingTags(false)} />}
			<div style={{ height: editingTags ? 0 : 8 }} />
		</div>
	);
}
