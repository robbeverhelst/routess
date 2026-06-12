import type { ApiRoute } from "@routess/api-client";
import type { RouteActivity, RouteVisibility } from "@routess/core";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { useUnits } from "@/lib/units";
import { useLibraryStore } from "@/stores/libraryStore";
import { I, type IconKey } from "../../components/icons";
import { Btn, RDS_COLORS, Skeleton } from "../../components/primitives";
import { Tooltip } from "../../components/Tooltip";
import { DropMenu, MenuDivider, MenuItem } from "./DropMenu";
import { RouteCard } from "./RouteCard";

export type RouteSort = "recent" | "name" | "distance" | "elevation";
export type DistanceBand = "any" | "short" | "medium" | "long" | "epic";

const SORT_LABEL_KEY: Record<RouteSort, string> = {
	recent: "library.sort.recent",
	name: "library.sort.name",
	distance: "library.sort.distance",
	elevation: "library.sort.elevation",
};

const ACTIVITY_CHIPS: { key: "all" | RouteActivity; icon?: IconKey; labelKey: string }[] = [
	{ key: "all", labelKey: "library.filter.all" },
	{ key: "cycle", icon: "bike", labelKey: "library.filter.cycling" },
	{ key: "run", icon: "run", labelKey: "library.filter.running" },
	{ key: "walk", icon: "walk", labelKey: "library.filter.walking" },
];

// Bands in meters. Labels render via formatDistance so units follow the
// user's preference. Shared with the Discover panel's distance filter.
export const DISTANCE_BANDS: { key: DistanceBand; min: number; max: number }[] = [
	{ key: "any", min: 0, max: Number.POSITIVE_INFINITY },
	{ key: "short", min: 0, max: 25_000 },
	{ key: "medium", min: 25_000, max: 50_000 },
	{ key: "long", min: 50_000, max: 100_000 },
	{ key: "epic", min: 100_000, max: Number.POSITIVE_INFINITY },
];

const VISIBILITIES: ("any" | RouteVisibility)[] = ["any", "private", "unlisted", "public"];

function Chip({
	on,
	onClick,
	children,
	title,
}: {
	on: boolean;
	onClick: () => void;
	children: React.ReactNode;
	title?: string;
}) {
	return (
		<Tooltip label={title}>
			<button
				type="button"
				onClick={onClick}
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 5,
					height: 28,
					padding: "0 10px",
					borderRadius: 999,
					border: `1px solid ${on ? RDS_COLORS.borderStrong : RDS_COLORS.border}`,
					background: on ? RDS_COLORS.bgActive : "transparent",
					color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
					fontSize: 12,
					cursor: "pointer",
					whiteSpace: "nowrap",
				}}
			>
				{children}
			</button>
		</Tooltip>
	);
}

export function RoutesTab({
	routes,
	isLoading,
	query,
	onClearQuery,
	onOpen,
}: {
	routes: ApiRoute[];
	isLoading: boolean;
	query: string;
	onClearQuery: () => void;
	onOpen: (route: ApiRoute) => void;
}) {
	const t = useT();
	const { formatDistance } = useUnits();
	const selectedRoute = useLibraryStore((s) => s.selectedRoute);
	const selectRoute = useLibraryStore((s) => s.selectRoute);

	const [sort, setSort] = useState<RouteSort>("recent");
	const [sortOpen, setSortOpen] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [activity, setActivity] = useState<"all" | RouteActivity>("all");
	const [favouritesOnly, setFavouritesOnly] = useState(false);
	const [tagFilters, setTagFilters] = useState<string[]>([]);
	const [distanceBand, setDistanceBand] = useState<DistanceBand>("any");
	const [visibility, setVisibility] = useState<"any" | RouteVisibility>("any");

	const counts = useMemo(() => {
		const c: Record<"all" | RouteActivity, number> = { all: routes.length, cycle: 0, run: 0, walk: 0 };
		for (const r of routes) if (r.activity) c[r.activity] += 1;
		return c;
	}, [routes]);

	const allTags = useMemo(() => {
		const freq = new Map<string, number>();
		for (const r of routes) for (const tag of r.tags ?? []) freq.set(tag, (freq.get(tag) ?? 0) + 1);
		return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
	}, [routes]);

	const filtered = useMemo(() => {
		let out = routes;
		if (activity !== "all") out = out.filter((r) => r.activity === activity);
		if (favouritesOnly) out = out.filter((r) => r.favourite);
		if (tagFilters.length > 0) out = out.filter((r) => tagFilters.every((tag) => (r.tags ?? []).includes(tag)));
		if (distanceBand !== "any") {
			const band = DISTANCE_BANDS.find((b) => b.key === distanceBand);
			if (band) out = out.filter((r) => r.distance != null && r.distance >= band.min && r.distance < band.max);
		}
		if (visibility !== "any") out = out.filter((r) => r.visibility === visibility);
		if (query.trim()) {
			const q = query.toLowerCase();
			out = out.filter(
				(r) =>
					r.name.toLowerCase().includes(q) ||
					(r.description ?? "").toLowerCase().includes(q) ||
					(r.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
			);
		}
		const sorted = [...out];
		switch (sort) {
			case "recent":
				sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
				break;
			case "name":
				sorted.sort((a, b) => a.name.localeCompare(b.name));
				break;
			case "distance":
				sorted.sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0));
				break;
			case "elevation":
				sorted.sort((a, b) => (b.elevationGain ?? 0) - (a.elevationGain ?? 0));
				break;
		}
		return sorted;
	}, [routes, activity, favouritesOnly, tagFilters, distanceBand, visibility, query, sort]);

	const extraFilterCount = (distanceBand !== "any" ? 1 : 0) + (visibility !== "any" ? 1 : 0) + tagFilters.length;
	const hasActiveFilters = activity !== "all" || favouritesOnly || extraFilterCount > 0 || query.trim().length > 0;

	const clearAll = () => {
		setActivity("all");
		setFavouritesOnly(false);
		setTagFilters([]);
		setDistanceBand("any");
		setVisibility("any");
		onClearQuery();
	};

	const toggleTagFilter = (tag: string) => {
		setTagFilters((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));
	};

	const distanceBandLabel = (band: { key: DistanceBand; min: number; max: number }): string => {
		if (band.key === "any") return t("library.filter.any");
		if (band.max === Number.POSITIVE_INFINITY) return `> ${formatDistance(band.min / 1000)}`;
		if (band.min === 0) return `< ${formatDistance(band.max / 1000)}`;
		return `${formatDistance(band.min / 1000)} – ${formatDistance(band.max / 1000)}`;
	};

	return (
		<>
			<div style={{ padding: "10px 20px 12px", borderBottom: `1px solid ${RDS_COLORS.border}` }}>
				<div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
					{ACTIVITY_CHIPS.map((chip) => {
						const Icon = chip.icon ? I[chip.icon] : null;
						const count = counts[chip.key];
						return (
							<Chip
								key={chip.key}
								on={activity === chip.key}
								onClick={() => setActivity(chip.key)}
								title={t(chip.labelKey)}
							>
								{Icon ? <Icon size={13} /> : t(chip.labelKey)}
								{chip.key === "all" ? ` · ${count}` : count > 0 ? ` ${count}` : ""}
							</Chip>
						);
					})}
					<Chip on={favouritesOnly} onClick={() => setFavouritesOnly((v) => !v)} title={t("library.filter.favourites")}>
						<I.heart size={13} style={favouritesOnly ? { fill: "currentColor" } : undefined} />
					</Chip>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
					<div style={{ position: "relative" }}>
						<Chip on={sortOpen} onClick={() => setSortOpen((v) => !v)} title={t("library.sort.label")}>
							<I.sliders size={13} />
							{t(SORT_LABEL_KEY[sort])}
						</Chip>
						<DropMenu open={sortOpen} onClose={() => setSortOpen(false)} align="left" width={170}>
							{(Object.keys(SORT_LABEL_KEY) as RouteSort[]).map((key) => (
								<MenuItem
									key={key}
									label={t(SORT_LABEL_KEY[key])}
									checked={sort === key}
									onClick={() => {
										setSort(key);
										setSortOpen(false);
									}}
								/>
							))}
						</DropMenu>
					</div>
					<div style={{ position: "relative" }}>
						<Chip on={filtersOpen || extraFilterCount > 0} onClick={() => setFiltersOpen((v) => !v)}>
							{t("library.filter.more")}
							{extraFilterCount > 0 ? ` · ${extraFilterCount}` : ""}
						</Chip>
						<DropMenu
							open={filtersOpen}
							onClose={() => setFiltersOpen(false)}
							align="left"
							width={220}
							style={{ maxHeight: 360, overflowY: "auto" }}
						>
							<div style={{ padding: "6px 10px 2px", fontSize: 11, fontWeight: 600, color: RDS_COLORS.fgSubtle }}>
								{t("library.filter.distance")}
							</div>
							{DISTANCE_BANDS.map((band) => (
								<MenuItem
									key={band.key}
									label={distanceBandLabel(band)}
									checked={distanceBand === band.key}
									onClick={() => setDistanceBand(band.key)}
								/>
							))}
							<MenuDivider />
							<div style={{ padding: "6px 10px 2px", fontSize: 11, fontWeight: 600, color: RDS_COLORS.fgSubtle }}>
								{t("library.filter.visibility")}
							</div>
							{VISIBILITIES.map((v) => (
								<MenuItem
									key={v}
									label={v === "any" ? t("library.filter.any") : t(`library.visibility.${v}`)}
									checked={visibility === v}
									onClick={() => setVisibility(v)}
								/>
							))}
							{allTags.length > 0 && (
								<>
									<MenuDivider />
									<div style={{ padding: "6px 10px 2px", fontSize: 11, fontWeight: 600, color: RDS_COLORS.fgSubtle }}>
										{t("library.filter.tags")}
									</div>
									{allTags.slice(0, 12).map((tag) => (
										<MenuItem
											key={tag}
											label={`#${tag}`}
											checked={tagFilters.includes(tag)}
											onClick={() => toggleTagFilter(tag)}
										/>
									))}
								</>
							)}
						</DropMenu>
					</div>
					<span className="rds-mono" style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginLeft: "auto" }}>
						{filtered.length} {filtered.length === 1 ? t("library.routeSingular") : t("library.routePlural")}
					</span>
				</div>
				{tagFilters.length > 0 && (
					<div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
						{tagFilters.map((tag) => (
							<Chip key={tag} on onClick={() => toggleTagFilter(tag)}>
								#{tag} <I.close size={11} />
							</Chip>
						))}
					</div>
				)}
			</div>

			<div style={{ padding: "10px 14px", overflow: "auto", flex: 1 }}>
				{isLoading && (
					<div role="status" aria-busy="true" aria-label={t("library.loading")}>
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								style={{
									borderRadius: 14,
									border: `1px solid ${RDS_COLORS.border}`,
									background: RDS_COLORS.bgPanel,
									marginBottom: 10,
									overflow: "hidden",
									opacity: 1 - i * 0.3,
								}}
							>
								<Skeleton height={96} radius={0} style={{ borderRadius: 0 }} />
								<div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
									<Skeleton width="55%" />
									<Skeleton width="35%" height={10} />
								</div>
							</div>
						))}
					</div>
				)}
				{!isLoading && filtered.length === 0 && (
					<div style={{ padding: 32, textAlign: "center", fontSize: 13, color: RDS_COLORS.fgSubtle }}>
						<div style={{ marginBottom: hasActiveFilters ? 12 : 0 }}>{t("library.noMatch")}</div>
						{hasActiveFilters && (
							<Btn variant="ghost" onClick={clearAll} style={{ color: RDS_COLORS.fgMuted, margin: "0 auto" }}>
								{t("library.clearFilters")}
							</Btn>
						)}
					</div>
				)}
				{filtered.map((r, i) => (
					<div
						key={r.id}
						style={{
							animation: "rds-rise-in var(--rds-dur-slow) var(--rds-ease-out) both",
							// Stagger the first few cards only; the tail mounts together so
							// long lists never feel slow.
							animationDelay: `calc(var(--rds-stagger) * ${Math.min(i, 8)})`,
						}}
					>
						<RouteCard
							route={r}
							selected={selectedRoute?.id === r.id}
							onOpen={() => {
								// Keep the route selected so the map previews it behind the
								// details panel; selectRoute toggles, so skip when already set.
								if (selectedRoute?.id !== r.id) selectRoute(r);
								onOpen(r);
							}}
							onTagClick={(tag) => {
								if (!tagFilters.includes(tag)) toggleTagFilter(tag);
							}}
						/>
					</div>
				))}
			</div>
		</>
	);
}
