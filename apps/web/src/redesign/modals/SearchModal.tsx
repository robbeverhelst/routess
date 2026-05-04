import { useEffect, useRef, useState } from "react";
import { EmptySearch } from "../components/EmptyStates";
import { I } from "../components/icons";
import { Kbd, RDS_COLORS, SecTitle } from "../components/primitives";
import { useModalsStore } from "../stores/modalsStore";

interface Suggestion {
	id: string;
	name: string;
	sub: string;
	tag: string;
	coords?: [number, number];
}

const RECENT: Suggestion[] = [
	{ id: "r1", name: "Search history is local-only", sub: "Recent searches will appear here", tag: "Hint" },
];

function suggestForQuery(query: string): string[] {
	// Trim and offer 3 simple alternatives. The mockup hardcodes Schelde / Bornem / coords;
	// we derive a similar set so suggestions feel like spell-check + coord hint.
	const q = query.trim();
	const trimmed = q.length > 3 ? q.slice(0, q.length - 1) : q;
	return [trimmed, q.split(" ")[0], "51.0828, 4.2032"].filter((s, i, a) => s && a.indexOf(s) === i).slice(0, 3);
}

export function SearchModal() {
	const close = useModalsStore((s) => s.closeModal);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Suggestion[]>([]);
	const [loading, setLoading] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (!query.trim()) {
			setResults([]);
			return;
		}
		const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
		if (!token) return;
		setLoading(true);
		debounceRef.current = setTimeout(async () => {
			try {
				const res = await fetch(
					`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=6&access_token=${token}`,
				);
				const data = (await res.json()) as {
					features?: {
						id: string;
						place_name: string;
						text: string;
						center: [number, number];
						place_type?: string[];
					}[];
				};
				const feats = data.features ?? [];
				setResults(
					feats.map((f) => ({
						id: f.id,
						name: f.text,
						sub: f.place_name,
						tag: f.place_type?.[0] ?? "place",
						coords: f.center,
					})),
				);
			} catch {
				setResults([]);
			} finally {
				setLoading(false);
			}
		}, 220);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query]);

	const handleSelect = (r: Suggestion) => {
		if (!r.coords) return;
		const [lng, lat] = r.coords;
		window.dispatchEvent(new CustomEvent("routess:fly-to", { detail: { coordinates: [lng, lat], zoom: 14 } }));
		close();
	};

	const rows = !query.trim() ? RECENT : results;

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			close();
			return;
		}

		if (rows.length === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, rows.length - 1));
			return;
		}

		if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, 0));
			return;
		}

		if (e.key === "Enter") {
			e.preventDefault();
			const selected = rows[activeIndex];
			if (selected) handleSelect(selected);
		}
	};

	const Row = ({ r, hot, index }: { r: Suggestion; hot?: boolean; index: number }) => (
		<button
			type="button"
			onClick={() => handleSelect(r)}
			onMouseEnter={() => setActiveIndex(index)}
			disabled={!r.coords}
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "10px 12px",
				borderRadius: 8,
				background: hot ? RDS_COLORS.bgHover : "transparent",
				cursor: r.coords ? "pointer" : "default",
				border: 0,
				width: "100%",
				textAlign: "left",
				color: "inherit",
				font: "inherit",
			}}
		>
			<div
				style={{
					width: 24,
					height: 24,
					borderRadius: 6,
					background: RDS_COLORS.bgInput,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: RDS_COLORS.fgMuted,
				}}
			>
				<I.pin size={14} />
			</div>
			<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
				<div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
				<div
					className="rds-mono"
					style={{
						fontSize: 11,
						color: RDS_COLORS.fgSubtle,
						marginTop: 2,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{r.sub}
				</div>
			</div>
			<span
				style={{
					display: "inline-flex",
					alignItems: "center",
					padding: "2px 8px",
					height: 22,
					borderRadius: 999,
					background: RDS_COLORS.bgInput,
					color: RDS_COLORS.fgMuted,
					fontSize: 11.5,
				}}
			>
				{r.tag}
			</span>
			{hot && <Kbd>↵</Kbd>}
		</button>
	);

	const showEmpty = !loading && query.trim().length > 0 && results.length === 0;

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset active row when the query/results change
	useEffect(() => {
		setActiveIndex(0);
	}, [query, results]);

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				zIndex: 60,
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "center",
				padding: "max(6vh, calc(16px + var(--rds-safe-top))) 12px 12px",
			}}
		>
			<button
				type="button"
				aria-label="Close search"
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
					maxWidth: 560,
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
					<I.search size={16} />
					<input
						// biome-ignore lint/a11y/noAutofocus: search modal exists to capture a query; focusing on open is expected
						autoFocus
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder="Search addresses, places, coordinates…"
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
				<div style={{ padding: 8, flex: 1, minHeight: 0, overflow: "auto" }}>
					{!query.trim() && (
						<>
							<SecTitle style={{ padding: "8px 12px 6px" }}>Recent</SecTitle>
							{RECENT.map((r, i) => (
								<Row key={r.id} r={r} hot={i === activeIndex} index={i} />
							))}
						</>
					)}
					{loading && (
						<div
							style={{
								padding: 24,
								textAlign: "center",
								fontSize: 13,
								color: RDS_COLORS.fgSubtle,
							}}
						>
							Searching…
						</div>
					)}
					{!loading && results.length > 0 && (
						<>
							<SecTitle style={{ padding: "8px 12px 6px" }}>Results</SecTitle>
							{results.map((r, i) => (
								<Row key={r.id} r={r} hot={i === activeIndex} index={i} />
							))}
						</>
					)}
					{showEmpty && (
						<EmptySearch query={query} suggestions={suggestForQuery(query)} onSuggest={(s) => setQuery(s)} />
					)}
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
						<Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
					</span>
					<span>
						<Kbd>↵</Kbd> select
					</span>
					<div style={{ flex: 1 }} />
					<span>Powered by Mapbox</span>
				</div>
			</div>
		</div>
	);
}
