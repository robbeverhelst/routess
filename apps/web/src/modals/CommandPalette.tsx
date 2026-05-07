import { useMemo, useState } from "react";
import type { ApiRoute } from "@/lib/api";
import { useUserRoutes } from "@/lib/api-queries";
import { emitAppEvent, routeToLoadDetail } from "@/lib/app-events";
import { t } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import type { RedesignContext } from "@/stores/uiStore";
import { useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { Kbd, RDS_COLORS, SecTitle } from "../components/primitives";

interface CmdItem {
	id: string;
	icon: React.ComponentType<{ size?: number }>;
	label: string;
	hint?: string;
	kbd?: string;
	run: () => void;
}

function loadRouteIntoPlan(route: ApiRoute, setContext: (value: RedesignContext) => void) {
	emitAppEvent("routess:load-route", routeToLoadDetail(route));
	setContext("plan");
}

export function CommandPalette() {
	const close = useModalsStore((s) => s.closeModal);
	const openModal = useModalsStore((s) => s.openModal);
	const setContext = useUiStore((s) => s.setContext);
	const toggleTheme = useUiStore((s) => s.toggleTheme);
	const _language = useUiStore((s) => s.language);
	const { data: routes = [] } = useUserRoutes();
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);

	const groups = useMemo<{ title: string; items: CmdItem[] }[]>(
		() => [
			{
				title: t("cmd.group.navigate"),
				items: [
					{
						id: "nav-plan",
						icon: I.route,
						label: t("cmd.nav.plan"),
						kbd: "G P",
						run: () => setContext("plan"),
					},
					{
						id: "nav-lib",
						icon: I.library,
						label: t("cmd.nav.library"),
						kbd: "G L",
						run: () => setContext("library"),
					},
					{
						id: "nav-dis",
						icon: I.explore,
						label: t("cmd.nav.discover"),
						kbd: "G D",
						run: () => setContext("discover"),
					},
					{
						id: "nav-soc",
						icon: I.social,
						label: t("cmd.nav.social"),
						kbd: "G S",
						run: () => setContext("social"),
					},
				],
			},
			{
				title: t("cmd.group.actions"),
				items: [
					{
						id: "act-save",
						icon: I.save,
						label: t("cmd.action.save"),
						kbd: "S",
						run: () => openModal("save"),
					},
					{
						id: "act-loop",
						icon: I.compass,
						label: t("cmd.action.loop"),
						kbd: "L",
						run: () => openModal("loop"),
					},
					{
						id: "act-routing",
						icon: I.sliders,
						label: t("cmd.action.routing"),
						kbd: "R",
						run: () => openModal("routing"),
					},
					{
						id: "act-import",
						icon: I.upload,
						label: t("cmd.action.import"),
						kbd: "I",
						run: () => openModal("import"),
					},
					{
						id: "act-share",
						icon: I.share,
						label: t("cmd.action.share"),
						kbd: "⇧ S",
						run: () => openModal("share"),
					},
					{
						id: "act-account",
						icon: I.user,
						label: t("cmd.action.account"),
						run: () => emitAppEvent("routess:open-account"),
					},
					{ id: "act-theme", icon: I.moon, label: t("cmd.action.theme"), kbd: "⌘ D", run: toggleTheme },
				],
			},
			{
				title: t("cmd.group.recent"),
				items: routes.slice(0, 5).map((r) => ({
					id: `route-${r.id}`,
					icon: I.pin,
					label: r.name,
					hint: r.distance ? `${(r.distance / 1000).toFixed(1)} km` : undefined,
					run: () => loadRouteIntoPlan(r, setContext),
				})),
			},
		],
		[routes, openModal, setContext, toggleTheme],
	);

	const filtered = useMemo(() => {
		if (!query.trim()) return groups;
		const q = query.toLowerCase();
		return groups
			.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
			.filter((g) => g.items.length > 0);
	}, [groups, query]);

	const flat = filtered.flatMap((g) => g.items);

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			const item = flat[activeIndex];
			if (item) {
				item.run();
				close();
			}
		} else if (e.key === "Escape") {
			close();
		}
	};

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				zIndex: 70,
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "center",
				padding: "max(6vh, calc(16px + var(--rds-safe-top))) 12px 12px",
			}}
		>
			<button
				type="button"
				aria-label={t("cmd.closeAria")}
				onClick={close}
				style={{
					position: "absolute",
					inset: 0,
					background: "color-mix(in oklch, oklch(0 0 0) 30%, transparent)",
					border: 0,
					padding: 0,
				}}
			/>
			<div
				style={{
					position: "relative",
					width: "100%",
					maxWidth: 600,
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 14,
					boxShadow: "var(--rds-shadow-lg)",
					display: "flex",
					flexDirection: "column",
					maxHeight: "calc(100dvh - max(6vh, 16px) - 24px)",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						padding: "14px 16px",
						borderBottom: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					<I.command size={16} />
					<input
						// biome-ignore lint/a11y/noAutofocus: command palette opens on user action; auto-focusing the input is the expected interaction
						autoFocus
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setActiveIndex(0);
						}}
						onKeyDown={onKeyDown}
						placeholder={t("cmd.placeholder")}
						style={{
							flex: 1,
							background: "transparent",
							border: 0,
							outline: "none",
							fontSize: 15,
							color: "inherit",
						}}
					/>
					<Kbd>{t("search.esc")}</Kbd>
				</div>
				<div style={{ padding: 6, flex: 1, minHeight: 0, overflow: "auto" }}>
					{filtered.length === 0 && (
						<div
							style={{
								padding: 28,
								textAlign: "center",
								fontSize: 13,
								color: RDS_COLORS.fgSubtle,
							}}
						>
							{t("cmd.noResults", { query })}
						</div>
					)}
					{filtered.map((g, gi) => {
						let runningIndex = filtered.slice(0, gi).reduce((a, x) => a + x.items.length, 0);
						return (
							<div key={g.title}>
								<SecTitle style={{ padding: "10px 14px 6px" }}>{g.title}</SecTitle>
								{g.items.map((it) => {
									const idx = runningIndex++;
									const Icon = it.icon;
									const on = idx === activeIndex;
									return (
										<button
											key={it.id}
											type="button"
											onMouseEnter={() => setActiveIndex(idx)}
											onClick={() => {
												it.run();
												close();
											}}
											style={{
												display: "flex",
												alignItems: "center",
												gap: 12,
												width: "100%",
												padding: "9px 12px",
												borderRadius: 8,
												cursor: "pointer",
												background: on ? RDS_COLORS.bgHover : "transparent",
												border: 0,
												color: "inherit",
												textAlign: "left",
											}}
										>
											<div
												style={{
													width: 22,
													height: 22,
													borderRadius: 5,
													background: RDS_COLORS.bgInput,
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													color: RDS_COLORS.fgMuted,
												}}
											>
												<Icon size={13} />
											</div>
											<span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{it.label}</span>
											{it.hint && (
												<span className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>
													{it.hint}
												</span>
											)}
											{it.kbd && <Kbd>{it.kbd}</Kbd>}
										</button>
									);
								})}
							</div>
						);
					})}
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						padding: "10px 16px",
						borderTop: `1px solid ${RDS_COLORS.border}`,
						fontSize: 11,
						color: RDS_COLORS.fgSubtle,
						fontFamily: '"JetBrains Mono", monospace',
					}}
				>
					<span>
						<Kbd>↑</Kbd>
						<Kbd>↓</Kbd> {t("cmd.kbd.navigate")}
					</span>
					<span>
						<Kbd>↵</Kbd> {t("cmd.kbd.run")}
					</span>
					<div style={{ flex: 1 }} />
					<span>
						<Kbd>⌘</Kbd>
						<Kbd>K</Kbd> {t("cmd.kbd.toggle")}
					</span>
				</div>
			</div>
		</div>
	);
}
