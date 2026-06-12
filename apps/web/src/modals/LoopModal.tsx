import type { Heading, RouteGenerationType, SurfaceType } from "@routess/core";
import { useEffect, useRef, useState } from "react";
import { emitAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { LocationService } from "@/services/LocationService";
import { type LoopStart, MAX_LANDMARKS, useLoopPreferencesStore } from "@/stores/loopPreferencesStore";
import { useModalsStore } from "@/stores/modalsStore";
import { useToastStore } from "@/stores/toastStore";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

const HEADINGS_UI = [
	{ key: "any", labelKey: "loop.dir.any", icon: I.compass },
	{ key: "north", labelKey: "loop.dir.north", icon: I.arrowUp, deg: 0 },
	{ key: "east", labelKey: "loop.dir.east", icon: I.arrowUp, deg: 90 },
	{ key: "south", labelKey: "loop.dir.south", icon: I.arrowUp, deg: 180 },
	{ key: "west", labelKey: "loop.dir.west", icon: I.arrowUp, deg: 270 },
] as const;

const SURFACES: SurfaceType[] = ["mixed", "paved", "unpaved"];

const SURFACE_LABEL_KEY: Record<SurfaceType, string> = {
	mixed: "loop.surface.mixed",
	paved: "loop.surface.paved",
	unpaved: "loop.surface.unpaved",
};

// One start/end point picker row: map-center / my-location / pick-on-map.
function PointPicker({
	value,
	onChange,
	onPickOnMap,
	isLocating,
	setIsLocating,
}: {
	value: LoopStart;
	onChange: (v: LoopStart) => void;
	onPickOnMap: () => void;
	isLocating: boolean;
	setIsLocating: (v: boolean) => void;
}) {
	const t = useT();
	const pushToast = useToastStore((s) => s.push);

	const handleUseCurrentLocation = () => {
		const service = LocationService.getInstance();

		// Seed instantly from the last known location (shared with the map's
		// locate button), then refine with a fresh fix in the background.
		const lastKnown = service.getLastKnownLocation();
		if (lastKnown) {
			onChange({ kind: "point", coord: lastKnown, source: "geolocation" });
		}

		setIsLocating(true);
		// LocationService enforces its own timeout, so this always settles even
		// when the browser never answers (e.g. a pending OS location prompt).
		service
			.getCurrentLocation({ timeout: 8000, maximumAge: 60000 })
			.then((state) => {
				if (state.location) {
					onChange({ kind: "point", coord: state.location, source: "geolocation" });
				}
			})
			.catch((err: Error) => {
				if (!lastKnown) {
					pushToast({
						kind: "danger",
						title: t("loop.couldNotLocate"),
						body: err.message,
					});
				}
			})
			.finally(() => setIsLocating(false));
	};

	const label =
		value.kind === "point"
			? t("loop.coords", { lat: value.coord[1].toFixed(4), lng: value.coord[0].toFixed(4) })
			: isLocating
				? t("loop.locating")
				: t("loop.mapCenter");

	const options = [
		{ key: "center", label: t("loop.mapCenter"), icon: I.globe, onClick: () => onChange({ kind: "center" }) },
		{
			key: "geolocation",
			label: isLocating ? t("loop.locating") : t("loop.myLocation"),
			icon: I.target,
			onClick: handleUseCurrentLocation,
		},
		{ key: "picked", label: t("loop.pickOnMap"), icon: I.pin, onClick: onPickOnMap },
	] as const;
	const activeKey = value.kind === "center" ? "center" : value.source === "geolocation" ? "geolocation" : "picked";

	return (
		<>
			<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
				{options.map((option) => {
					const Icon = option.icon;
					const on = activeKey === option.key;
					return (
						<button
							key={option.key}
							type="button"
							onClick={option.onClick}
							style={{
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 6,
								height: 38,
								borderRadius: 8,
								background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
								border: on ? `1px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
								color: on ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
								fontSize: 12,
								fontWeight: 500,
								cursor: "pointer",
							}}
						>
							<Icon size={13} /> {option.label}
						</button>
					);
				})}
			</div>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					fontSize: 11.5,
					color: RDS_COLORS.fgSubtle,
					paddingLeft: 2,
				}}
			>
				<div style={{ width: 6, height: 6, borderRadius: 999, background: RDS_COLORS.success }} />
				{label}
			</div>
		</>
	);
}

interface PlaceSuggestion {
	id: string;
	name: string;
	sub: string;
	coords: [number, number];
}

// Pin up to MAX_LANDMARKS geocoded places the generated route must pass
// (sent as required Anchors; generation v2 slice 6).
function LandmarkPicker() {
	const t = useT();
	const landmarks = useLoopPreferencesStore((s) => s.landmarks);
	const addLandmark = useLoopPreferencesStore((s) => s.addLandmark);
	const removeLandmark = useLoopPreferencesStore((s) => s.removeLandmark);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<PlaceSuggestion[]>([]);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (!query.trim()) {
			setResults([]);
			return;
		}
		const token = getRuntimeConfig("VITE_MAPBOX_ACCESS_TOKEN");
		if (!token) return;
		debounceRef.current = setTimeout(async () => {
			try {
				const res = await fetch(
					`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=5&access_token=${token}`,
				);
				const data = (await res.json()) as {
					features?: { id: string; place_name: string; text: string; center: [number, number] }[];
				};
				setResults((data.features ?? []).map((f) => ({ id: f.id, name: f.text, sub: f.place_name, coords: f.center })));
			} catch {
				setResults([]);
			}
		}, 220);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query]);

	const pick = (place: PlaceSuggestion) => {
		addLandmark({ coord: place.coords, name: place.name });
		setQuery("");
		setResults([]);
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
			<SecTitle>{t("loop.landmarks")}</SecTitle>
			{landmarks.length > 0 ? (
				<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
					{landmarks.map((landmark, index) => (
						<span
							key={`${landmark.name}:${landmark.coord.join(",")}`}
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 6,
								height: 28,
								padding: "0 10px",
								borderRadius: 999,
								background: RDS_COLORS.accentSoft,
								border: `1px solid ${RDS_COLORS.accent}`,
								color: RDS_COLORS.accent,
								fontSize: 11.5,
							}}
						>
							<I.pin size={11} /> {landmark.name}
							<button
								type="button"
								onClick={() => removeLandmark(index)}
								aria-label={t("common.close")}
								style={{
									background: "transparent",
									border: 0,
									color: "inherit",
									cursor: "pointer",
									display: "inline-flex",
									padding: 0,
								}}
							>
								<I.close size={11} />
							</button>
						</span>
					))}
				</div>
			) : null}
			{landmarks.length < MAX_LANDMARKS ? (
				<div style={{ position: "relative" }}>
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t("loop.landmarksPlaceholder")}
						style={{
							width: "100%",
							height: 36,
							padding: "0 12px",
							borderRadius: 8,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							color: RDS_COLORS.fg,
							fontSize: 12.5,
							outline: "none",
						}}
					/>
					{results.length > 0 ? (
						<div
							style={{
								position: "absolute",
								top: 40,
								left: 0,
								right: 0,
								zIndex: 5,
								background: RDS_COLORS.bgPanel,
								border: `1px solid ${RDS_COLORS.border}`,
								borderRadius: 8,
								overflow: "hidden",
								boxShadow: "var(--rds-shadow-lg, 0 8px 30px rgba(0,0,0,0.25))",
							}}
						>
							{results.map((place) => (
								<button
									key={place.id}
									type="button"
									onClick={() => pick(place)}
									style={{
										display: "block",
										width: "100%",
										textAlign: "left",
										padding: "8px 12px",
										background: "transparent",
										border: 0,
										cursor: "pointer",
										color: RDS_COLORS.fg,
										fontSize: 12.5,
									}}
								>
									{place.name}
									<span style={{ color: RDS_COLORS.fgSubtle, fontSize: 11 }}> — {place.sub}</span>
								</button>
							))}
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}

export function LoopModal() {
	const closeModal = useModalsStore((s) => s.closeModal);
	const t = useT();
	const {
		routeType,
		distanceKm,
		heading,
		surface,
		start,
		end,
		preferNodeNetworks,
		setRouteType,
		setDistanceKm,
		setHeading,
		setSurface,
		setStart,
		setEnd,
		setPreferNodeNetworks,
	} = useLoopPreferencesStore();

	const [isLocatingStart, setIsLocatingStart] = useState(false);
	const [isLocatingEnd, setIsLocatingEnd] = useState(false);
	const isAtoB = routeType === "a-to-b";

	const handlePickOnMap = (event: "routess:pick-loop-start" | "routess:pick-loop-end") => {
		// The map subtree owns pick mode (cursor, click capture); the modal
		// reopens with the picked point once the user clicks.
		closeModal();
		emitAppEvent(event);
	};

	const handleGenerate = () => {
		// `center` resolves to the live map center in the map handler, so
		// generation works before the user grants location access.
		emitAppEvent("routess:generate-loop", {
			...(start.kind === "point" ? { start: start.coord } : {}),
			...(isAtoB && end.kind === "point" ? { end: end.coord } : {}),
		});
		closeModal();
	};

	const TABS: { key: RouteGenerationType; label: string }[] = [
		{ key: "loop", label: t("loop.tab.loop") },
		{ key: "a-to-b", label: t("loop.tab.atob") },
	];

	return (
		<ModalShell
			title={isAtoB ? t("loop.titleAtoB") : t("loop.title")}
			sub={isAtoB ? t("loop.subtitleAtoB") : t("loop.subtitle")}
			width={520}
			onClose={closeModal}
			footer={
				<>
					<div style={{ flex: 1 }} />
					<Btn onClick={closeModal}>{t("common.cancel")}</Btn>
					<Btn variant="primary" onClick={handleGenerate}>
						<I.compass size={14} /> {t("loop.generate")}
					</Btn>
				</>
			}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
					{TABS.map((tab) => {
						const on = routeType === tab.key;
						return (
							<button
								key={tab.key}
								type="button"
								onClick={() => setRouteType(tab.key)}
								style={{
									height: 34,
									borderRadius: 8,
									background: on ? RDS_COLORS.bgActive : "transparent",
									border: `1px solid ${on ? RDS_COLORS.borderStrong : RDS_COLORS.border}`,
									color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
									fontSize: 12.5,
									fontWeight: 600,
									cursor: "pointer",
								}}
							>
								{tab.label}
							</button>
						);
					})}
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>{t("loop.startPoint")}</SecTitle>
					<PointPicker
						value={start}
						onChange={setStart}
						onPickOnMap={() => handlePickOnMap("routess:pick-loop-start")}
						isLocating={isLocatingStart}
						setIsLocating={setIsLocatingStart}
					/>
				</div>

				{isAtoB ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
						<SecTitle>{t("loop.endPoint")}</SecTitle>
						<PointPicker
							value={end}
							onChange={setEnd}
							onPickOnMap={() => handlePickOnMap("routess:pick-loop-end")}
							isLocating={isLocatingEnd}
							setIsLocating={setIsLocatingEnd}
						/>
					</div>
				) : null}

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<div style={{ display: "flex", alignItems: "center" }}>
						<SecTitle style={{ flex: 1 }}>{t("loop.targetDistance")}</SecTitle>
						<span className="rds-mono" style={{ fontSize: 14, fontWeight: 600 }}>
							{distanceKm} km
						</span>
					</div>
					<input
						type="range"
						min={1}
						max={100}
						step={1}
						value={distanceKm}
						onChange={(e) => setDistanceKm(Number(e.target.value))}
						style={{ width: "100%", accentColor: "var(--rds-accent)" }}
					/>
					<div
						className="rds-mono"
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: 10.5,
							color: RDS_COLORS.fgSubtle,
						}}
					>
						<span>{t("loop.km1")}</span>
						<span>25</span>
						<span>50</span>
						<span>75</span>
						<span>{t("loop.km100")}</span>
					</div>
				</div>

				{!isAtoB ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
						<SecTitle>{t("loop.directionLabel")}</SecTitle>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(5, 1fr)",
								gap: 6,
							}}
						>
							{HEADINGS_UI.map((d) => {
								const Icon = d.icon;
								const on = heading === d.key;
								return (
									<button
										key={d.key}
										type="button"
										onClick={() => setHeading(d.key as Heading)}
										style={{
											padding: 12,
											borderRadius: 8,
											background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
											border: on ? `1px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
											color: on ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
											display: "flex",
											flexDirection: "column",
											alignItems: "center",
											gap: 4,
											cursor: "pointer",
										}}
									>
										<Icon
											size={20}
											style={"deg" in d && d.deg !== 0 ? { transform: `rotate(${d.deg}deg)` } : undefined}
										/>
										<div style={{ fontSize: 12, fontWeight: 500 }}>{t(d.labelKey)}</div>
									</button>
								);
							})}
						</div>
					</div>
				) : null}

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>{t("loop.surfaceLabel")}</SecTitle>
					<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						{SURFACES.map((s) => {
							const on = surface === s;
							return (
								<button
									key={s}
									type="button"
									onClick={() => setSurface(s)}
									style={{
										height: 32,
										padding: "0 12px",
										borderRadius: 999,
										background: on ? RDS_COLORS.bgActive : "transparent",
										border: `1px solid ${RDS_COLORS.border}`,
										fontSize: 12,
										color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
										cursor: "pointer",
									}}
								>
									{t(SURFACE_LABEL_KEY[s])}
								</button>
							);
						})}
					</div>
				</div>

				<button
					type="button"
					onClick={() => setPreferNodeNetworks(!preferNodeNetworks)}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						padding: "10px 12px",
						borderRadius: 8,
						background: preferNodeNetworks ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
						border: preferNodeNetworks ? `1px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
						cursor: "pointer",
						textAlign: "left",
					}}
				>
					<div
						style={{
							width: 16,
							height: 16,
							borderRadius: 4,
							flexShrink: 0,
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							background: preferNodeNetworks ? RDS_COLORS.accent : "transparent",
							border: `1px solid ${preferNodeNetworks ? RDS_COLORS.accent : RDS_COLORS.border}`,
							color: "#fff",
						}}
					>
						{preferNodeNetworks ? <I.check size={11} /> : null}
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
						<span style={{ fontSize: 12.5, fontWeight: 600, color: RDS_COLORS.fg }}>{t("loop.preferNodes")}</span>
						<span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>{t("loop.preferNodesSub")}</span>
					</div>
				</button>

				<LandmarkPicker />
			</div>
		</ModalShell>
	);
}
