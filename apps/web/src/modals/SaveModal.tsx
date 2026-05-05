import { useState } from "react";
import { useIsAuthenticated } from "@/hooks/useAuthState";
import { useSaveRoute } from "@/lib/api-queries";
import { useModalsStore } from "@/stores/modalsStore";
import { useElevationGain, useRouteDistance, useRouteDuration, useWaypoints } from "@/stores/routingStore";
import { useToastStore } from "@/stores/toastStore";
import { type RedesignActivity, useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

const ACTIVITIES: { key: RedesignActivity; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
	{ key: "run", icon: I.run, label: "Run" },
	{ key: "cycle", icon: I.bike, label: "Cycle" },
	{ key: "walk", icon: I.walk, label: "Walk" },
];

const PRIVACY_OPTS = [
	{ key: "private", label: "Private", sub: "Only me" },
	{ key: "link", label: "Link", sub: "Anyone with link" },
	{ key: "public", label: "Public", sub: "Discoverable" },
] as const;

export function SaveModal() {
	const closeModal = useModalsStore((s) => s.closeModal);
	const waypoints = useWaypoints();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const elevationGain = useElevationGain();
	const { activityType, setActivityType } = useUiStore();
	const saveRoute = useSaveRoute();
	const pushToast = useToastStore((s) => s.push);
	const isAuthenticated = useIsAuthenticated();

	const [name, setName] = useState("");
	const [privacy, setPrivacy] = useState<(typeof PRIVACY_OPTS)[number]["key"]>("private");
	const [tags, setTags] = useState<string[]>([]);
	const [tagDraft, setTagDraft] = useState("");

	// `distance` is the formatted "X.X km" or "X.X mi" string from the routing
	// store. Convert it back to meters for the API based on the unit suffix.
	const distanceMeters = (() => {
		const value = parseFloat(distance) || 0;
		if (!value) return 0;
		if (distance.includes("mi")) return Math.round(value * 1609.344);
		if (distance.includes("ft")) return Math.round(value * 0.3048);
		// "X m" or "X.X km" — split on space to disambiguate
		const unit = distance.split(" ")[1] || "km";
		if (unit.startsWith("m") && !unit.startsWith("mi")) return Math.round(value);
		return Math.round(value * 1000);
	})();
	const wpCount = waypoints.length;

	if (!isAuthenticated) {
		return <SignInToSave distance={distance} duration={duration} wpCount={wpCount} onClose={closeModal} />;
	}

	const handleSave = () => {
		if (!name.trim() || waypoints.length < 2) return;
		saveRoute.mutate(
			{
				name: name.trim(),
				description: tags.length
					? `Activity: ${activityType}; Privacy: ${privacy}; Tags: ${tags.join(", ")}`
					: `Activity: ${activityType}; Privacy: ${privacy}`,
				waypoints: waypoints.map((wp) => ({
					lng: wp.coord[0],
					lat: wp.coord[1],
					type: wp.type,
					...(wp.name ? { name: wp.name } : {}),
				})),
				distance: distanceMeters,
				elevationGain: elevationGain != null ? Math.round(elevationGain) : 0,
			},
			{
				onSuccess: () => {
					pushToast({
						kind: "success",
						title: "Route saved",
						body: `${name.trim()} · ${distance || "—"}`,
					});
					closeModal();
				},
				onError: () => {
					pushToast({ kind: "danger", title: "Save failed", body: "Try again." });
				},
			},
		);
	};

	const addTag = () => {
		const t = tagDraft.trim();
		if (!t || tags.includes(t)) return;
		setTags([...tags, t]);
		setTagDraft("");
	};

	return (
		<ModalShell
			title="Save route"
			sub={`${distance || "—"} · ${duration || "—"} · ${wpCount} waypoints`}
			width={520}
			onClose={closeModal}
			footer={
				<>
					<div style={{ flex: 1 }} />
					<Btn onClick={closeModal}>Cancel</Btn>
					<Btn variant="primary" onClick={handleSave} disabled={!name.trim() || wpCount < 2 || saveRoute.isPending}>
						<I.save size={14} /> {saveRoute.isPending ? "Saving…" : "Save route"}
					</Btn>
				</>
			}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>Name</SecTitle>
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Schelde loop — long"
						style={{
							height: 36,
							padding: "0 12px",
							borderRadius: 8,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							color: RDS_COLORS.fg,
							fontSize: 13.5,
							outline: "none",
						}}
						// biome-ignore lint/a11y/noAutofocus: name input is the primary action; focusing on modal open is expected
						autoFocus
					/>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>Activity</SecTitle>
					<div style={{ display: "flex", gap: 8 }}>
						{ACTIVITIES.map((a) => {
							const Icon = a.icon;
							const on = activityType === a.key;
							return (
								<button
									key={a.key}
									type="button"
									onClick={() => setActivityType(a.key)}
									style={{
										display: "inline-flex",
										alignItems: "center",
										gap: 6,
										flex: 1,
										height: 42,
										borderRadius: 8,
										background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
										color: on ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
										border: on ? `1px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
										fontSize: 13,
										fontWeight: 500,
										justifyContent: "center",
										cursor: "pointer",
									}}
								>
									<Icon size={14} /> {a.label}
								</button>
							);
						})}
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>Privacy</SecTitle>
					<div
						style={{
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 8,
							padding: 4,
							display: "grid",
							gridTemplateColumns: "1fr 1fr 1fr",
							gap: 4,
						}}
					>
						{PRIVACY_OPTS.map((p) => {
							const on = privacy === p.key;
							return (
								<button
									key={p.key}
									type="button"
									onClick={() => setPrivacy(p.key)}
									style={{
										padding: "8px 10px",
										borderRadius: 6,
										background: on ? RDS_COLORS.bgPanel : "transparent",
										boxShadow: on ? "var(--rds-shadow-sm)" : "none",
										border: 0,
										textAlign: "left",
										cursor: "pointer",
									}}
								>
									<div style={{ fontSize: 12.5, fontWeight: 600, color: RDS_COLORS.fg }}>{p.label}</div>
									<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>{p.sub}</div>
								</button>
							);
						})}
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>Tags</SecTitle>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
						{tags.map((t) => (
							<span
								key={t}
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 6,
									padding: "2px 8px",
									height: 22,
									borderRadius: 999,
									background: RDS_COLORS.bgInput,
									color: RDS_COLORS.fgMuted,
									fontSize: 11.5,
								}}
							>
								{t}
								<button
									type="button"
									onClick={() => setTags(tags.filter((x) => x !== t))}
									style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", padding: 0 }}
									aria-label={`Remove ${t}`}
								>
									<I.close size={10} />
								</button>
							</span>
						))}
						<input
							value={tagDraft}
							onChange={(e) => setTagDraft(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									addTag();
								}
							}}
							placeholder="+ Add tag"
							style={{
								flex: 1,
								minWidth: 100,
								height: 22,
								padding: "0 8px",
								borderRadius: 999,
								background: "transparent",
								border: `1px dashed ${RDS_COLORS.borderStrong}`,
								color: RDS_COLORS.fgMuted,
								fontSize: 11.5,
								outline: "none",
							}}
						/>
					</div>
				</div>
			</div>
		</ModalShell>
	);
}

function SignInToSave({
	distance,
	duration,
	wpCount,
	onClose,
}: {
	distance: string;
	duration: string;
	wpCount: number;
	onClose: () => void;
}) {
	const goToSignIn = () => {
		onClose();
		window.dispatchEvent(new CustomEvent("routess:open-login"));
	};

	const goToSignUp = () => {
		onClose();
		window.dispatchEvent(new CustomEvent("routess:open-signup"));
	};

	return (
		<ModalShell
			title="You need an account to save"
			sub={`${distance || "—"} · ${duration || "—"} · ${wpCount} waypoints`}
			width={420}
			onClose={onClose}
			footer={
				<>
					<Btn onClick={onClose}>Cancel</Btn>
					<div style={{ flex: 1 }} />
					<Btn onClick={goToSignUp}>Create account</Btn>
					<Btn variant="primary" onClick={goToSignIn}>
						<I.user size={14} /> Sign in
					</Btn>
				</>
			}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
				<p style={{ margin: 0, fontSize: 13.5, color: RDS_COLORS.fg, lineHeight: 1.5 }}>
					Saving routes requires a free Routess account.
				</p>
				<p style={{ margin: 0, fontSize: 12.5, color: RDS_COLORS.fgMuted, lineHeight: 1.5 }}>
					Sign in or create an account to keep this route. Your current draft stays on the map while you sign in — you
					can come back and finish saving in a moment.
				</p>

				<ul
					style={{
						listStyle: "none",
						padding: 0,
						margin: 0,
						display: "flex",
						flexDirection: "column",
						gap: 8,
						fontSize: 12.5,
						color: RDS_COLORS.fgMuted,
					}}
				>
					<li style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<I.save size={12} /> Save unlimited routes
					</li>
					<li style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<I.library size={12} /> Sync across web and mobile
					</li>
					<li style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<I.share size={12} /> Share routes with a link
					</li>
				</ul>
			</div>
		</ModalShell>
	);
}
