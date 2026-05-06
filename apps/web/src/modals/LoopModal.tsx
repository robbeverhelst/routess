import { useState } from "react";
import { type LoopDirection, type LoopSurface, useLoopPreferencesStore } from "@/stores/loopPreferencesStore";
import { useModalsStore } from "@/stores/modalsStore";
import { useToastStore } from "@/stores/toastStore";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

const DIRECTIONS = [
	{ key: "any", label: "Any", icon: I.compass },
	{ key: "n", label: "North", icon: I.arrowUp, deg: 0 },
	{ key: "e", label: "East", icon: I.arrowUp, deg: 90 },
	{ key: "s", label: "South", icon: I.arrowUp, deg: 180 },
	{ key: "w", label: "West", icon: I.arrowUp, deg: 270 },
] as const;

const SURFACES: LoopSurface[] = ["Mixed", "Roads only", "Trails", "Paved bike paths"];

type LocationStatus = "current" | "locating" | "resolved" | "error";

export function LoopModal() {
	const closeModal = useModalsStore((s) => s.closeModal);
	const pushToast = useToastStore((s) => s.push);
	const { distanceKm, direction, surface, setDistanceKm, setDirection, setSurface } = useLoopPreferencesStore();

	const [locationStatus, setLocationStatus] = useState<LocationStatus>("current");
	const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);

	const handleUseCurrentLocation = () => {
		if (!navigator.geolocation) {
			setLocationStatus("error");
			pushToast({
				kind: "danger",
				title: "Geolocation unavailable",
				body: "This browser doesn't expose a location API.",
			});
			return;
		}
		setLocationStatus("locating");
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setResolvedCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
				setLocationStatus("resolved");
			},
			(err) => {
				setLocationStatus("error");
				pushToast({
					kind: "danger",
					title: "Couldn't get your location",
					body: err.message,
				});
			},
			{ enableHighAccuracy: true, timeout: 8000 },
		);
	};

	const handleGenerate = () => {
		// Generation backend isn't live yet; preferences are persisted. Confirm to
		// the user that the choice is saved and the generator is in the works.
		pushToast({
			kind: "info",
			title: "Loop generation in progress",
			body: "Your preferences are saved. Generation will arrive in an upcoming release.",
			durationMs: 3500,
		});
	};

	const startLabel =
		locationStatus === "locating"
			? "Locating…"
			: resolvedCoords
				? `Lat ${resolvedCoords.lat.toFixed(4)}, Lng ${resolvedCoords.lng.toFixed(4)}`
				: "Current location";

	return (
		<ModalShell
			title="Generate a loop"
			sub="From your starting point, back to your starting point"
			width={520}
			onClose={closeModal}
			footer={
				<>
					<span style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>Generator coming soon</span>
					<div style={{ flex: 1 }} />
					<Btn onClick={closeModal}>Cancel</Btn>
					<Btn variant="primary" onClick={handleGenerate} disabled>
						<I.compass size={14} /> Generate
					</Btn>
				</>
			}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>Start point</SecTitle>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 8,
							padding: "0 12px",
							height: 40,
						}}
					>
						<div
							style={{
								width: 8,
								height: 8,
								borderRadius: 999,
								background: locationStatus === "error" ? RDS_COLORS.danger : RDS_COLORS.success,
							}}
						/>
						<span style={{ fontSize: 13 }}>{startLabel}</span>
						<div style={{ flex: 1 }} />
						<button
							type="button"
							title="Use current location"
							onClick={handleUseCurrentLocation}
							disabled={locationStatus === "locating"}
							style={{
								background: "transparent",
								border: 0,
								color: RDS_COLORS.fgMuted,
								cursor: locationStatus === "locating" ? "wait" : "pointer",
								display: "inline-flex",
							}}
						>
							<I.target size={14} />
						</button>
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<div style={{ display: "flex", alignItems: "center" }}>
						<SecTitle style={{ flex: 1 }}>Target distance</SecTitle>
						<span className="rds-mono" style={{ fontSize: 14, fontWeight: 600 }}>
							{distanceKm} km
						</span>
					</div>
					<input
						type="range"
						min={1}
						max={40}
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
						<span>1 km</span>
						<span>10</span>
						<span>20</span>
						<span>30</span>
						<span>40 km</span>
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>Direction</SecTitle>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(5, 1fr)",
							gap: 6,
						}}
					>
						{DIRECTIONS.map((d) => {
							const Icon = d.icon;
							const on = direction === d.key;
							return (
								<button
									key={d.key}
									type="button"
									onClick={() => setDirection(d.key as LoopDirection)}
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
									<div style={{ fontSize: 12, fontWeight: 500 }}>{d.label}</div>
								</button>
							);
						})}
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>Surface</SecTitle>
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
									{s}
								</button>
							);
						})}
					</div>
				</div>
			</div>
		</ModalShell>
	);
}
