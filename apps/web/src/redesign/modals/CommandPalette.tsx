import { useMemo, useState } from "react";
import { useUserRoutes } from "@/lib/api-queries";
import { I } from "../components/icons";
import { Kbd, RDS_COLORS, SecTitle } from "../components/primitives";
import { useModalsStore } from "../stores/modalsStore";
import { useUiStore } from "../stores/uiStore";

interface CmdItem {
	id: string;
	icon: React.ComponentType<{ size?: number }>;
	label: string;
	hint?: string;
	kbd?: string;
	run: () => void;
}

export function CommandPalette() {
	const close = useModalsStore((s) => s.closeModal);
	const openModal = useModalsStore((s) => s.openModal);
	const setContext = useUiStore((s) => s.setContext);
	const toggleTheme = useUiStore((s) => s.toggleTheme);
	const { data: routes = [] } = useUserRoutes();
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);

	const groups = useMemo<{ title: string; items: CmdItem[] }[]>(
		() => [
			{
				title: "Navigate",
				items: [
					{ id: "nav-plan", icon: I.route, label: "Plan a route", kbd: "G P", run: () => setContext("plan") },
					{ id: "nav-lib", icon: I.library, label: "Open library", kbd: "G L", run: () => setContext("library") },
					{ id: "nav-act", icon: I.activity, label: "View activity", kbd: "G A", run: () => setContext("activity") },
					{ id: "nav-set", icon: I.settings, label: "Settings", kbd: "G S", run: () => setContext("settings") },
				],
			},
			{
				title: "Actions",
				items: [
					{ id: "act-save", icon: I.save, label: "Save current route", kbd: "S", run: () => openModal("save") },
					{ id: "act-loop", icon: I.refresh, label: "Generate loop", kbd: "L", run: () => openModal("loop") },
					{ id: "act-routing", icon: I.zap, label: "Routing preferences", kbd: "R", run: () => openModal("routing") },
					{ id: "act-import", icon: I.upload, label: "Import GPX", kbd: "I", run: () => openModal("import") },
					{ id: "act-share", icon: I.share, label: "Share current route", kbd: "⇧ S", run: () => openModal("share") },
					{ id: "act-theme", icon: I.moon, label: "Toggle dark mode", kbd: "⌘ D", run: toggleTheme },
				],
			},
			{
				title: "Recent routes",
				items: routes.slice(0, 5).map((r) => ({
					id: `route-${r.id}`,
					icon: I.pin,
					label: r.name,
					hint: r.distance ? `${(r.distance / 1000).toFixed(1)} km` : undefined,
					run: () => {
						setContext("library");
					},
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
				padding: "10vh 24px 24px",
			}}
		>
			<button
				type="button"
				aria-label="Close palette"
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
					width: 600,
					maxWidth: "100%",
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 14,
					boxShadow: "var(--rds-shadow-lg)",
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
						placeholder="Type a command, search, or jump…"
						style={{
							flex: 1,
							background: "transparent",
							border: 0,
							outline: "none",
							fontSize: 15,
							color: "inherit",
						}}
					/>
					<Kbd>esc</Kbd>
				</div>
				<div style={{ padding: 6, maxHeight: 440, overflow: "auto" }}>
					{filtered.length === 0 && (
						<div
							style={{
								padding: 28,
								textAlign: "center",
								fontSize: 13,
								color: RDS_COLORS.fgSubtle,
							}}
						>
							No results for "{query}"
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
						<Kbd>↓</Kbd> navigate
					</span>
					<span>
						<Kbd>↵</Kbd> run
					</span>
					<div style={{ flex: 1 }} />
					<span>
						<Kbd>⌘</Kbd>
						<Kbd>K</Kbd> toggle
					</span>
				</div>
			</div>
		</div>
	);
}
