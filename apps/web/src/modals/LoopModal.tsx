import type { Heading, SurfaceType } from "@routess/core";
import { useState } from "react";
import { emitAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { useLoopPreferencesStore } from "@/stores/loopPreferencesStore";
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

export function LoopModal() {
	const closeModal = useModalsStore((s) => s.closeModal);
	const pushToast = useToastStore((s) => s.push);
	const t = useT();
	const { distanceKm, heading, surface, start, setDistanceKm, setHeading, setSurface, setStart } =
		useLoopPreferencesStore();

	const [isLocating, setIsLocating] = useState(false);

	const handleUseCurrentLocation = () => {
		if (!navigator.geolocation) {
			pushToast({
				kind: "danger",
				title: t("loop.geoUnavailable"),
				body: t("loop.geoUnavailableSub"),
			});
			return;
		}
		setIsLocating(true);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setStart({ kind: "point", coord: [pos.coords.longitude, pos.coords.latitude], source: "geolocation" });
				setIsLocating(false);
			},
			(err) => {
				setIsLocating(false);
				pushToast({
					kind: "danger",
					title: t("loop.couldNotLocate"),
					body: err.message,
				});
			},
			{ enableHighAccuracy: true, timeout: 8000 },
		);
	};

	const handlePickOnMap = () => {
		// The map subtree owns pick mode (cursor, click capture); the modal
		// reopens with the picked point once the user clicks.
		closeModal();
		emitAppEvent("routess:pick-loop-start");
	};

	const handleGenerate = () => {
		// `center` resolves to the live map center in the map handler, so
		// generation works before the user grants location access.
		emitAppEvent("routess:generate-loop", start.kind === "point" ? { start: start.coord } : {});
		closeModal();
	};

	const startLabel = isLocating
		? t("loop.locating")
		: start.kind === "point"
			? t("loop.coords", { lat: start.coord[1].toFixed(4), lng: start.coord[0].toFixed(4) })
			: t("loop.mapCenter");

	const START_OPTIONS = [
		{ key: "center", label: t("loop.mapCenter"), icon: I.globe, onClick: () => setStart({ kind: "center" }) },
		{ key: "geolocation", label: t("loop.myLocation"), icon: I.target, onClick: handleUseCurrentLocation },
		{ key: "picked", label: t("loop.pickOnMap"), icon: I.pin, onClick: handlePickOnMap },
	] as const;
	const activeStartKey = start.kind === "center" ? "center" : start.source === "geolocation" ? "geolocation" : "picked";

	return (
		<ModalShell
			title={t("loop.title")}
			sub={t("loop.subtitle")}
			width={520}
			onClose={closeModal}
			footer={
				<>
					<div style={{ flex: 1 }} />
					<Btn onClick={closeModal}>{t("common.cancel")}</Btn>
					<Btn variant="primary" onClick={handleGenerate} disabled={isLocating}>
						<I.compass size={14} /> {t("loop.generate")}
					</Btn>
				</>
			}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>{t("loop.startPoint")}</SecTitle>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
						{START_OPTIONS.map((option) => {
							const Icon = option.icon;
							const on = activeStartKey === option.key;
							return (
								<button
									key={option.key}
									type="button"
									onClick={option.onClick}
									disabled={isLocating}
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
										cursor: isLocating ? "wait" : "pointer",
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
						{startLabel}
					</div>
				</div>

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
			</div>
		</ModalShell>
	);
}
