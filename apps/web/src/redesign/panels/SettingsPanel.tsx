import type { ReactNode } from "react";
import { useLogout, useUserProfile } from "@/lib/api-queries";
import { useRoutingPreferencesStore } from "@/redesign/stores/routingPreferencesStore";
import { type RedesignMapStyle, useRedesignSettingsStore } from "@/redesign/stores/settingsStore";
import { type RedesignAccent, useUiStore } from "@/redesign/stores/uiStore";
import { I } from "../components/icons";
import { Btn, RDS_COLORS, SecTitle, Toggle } from "../components/primitives";
import { useToastStore } from "../stores/toastStore";

function Group({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div style={{ marginBottom: 22 }}>
			<SecTitle style={{ marginBottom: 10 }}>{title}</SecTitle>
			<div
				style={{
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 10,
					overflow: "hidden",
				}}
			>
				{children}
			</div>
		</div>
	);
}

function Row({ label, sub, control, last }: { label: string; sub?: string; control: ReactNode; last?: boolean }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "12px 14px",
				borderBottom: last ? "none" : `1px solid ${RDS_COLORS.border}`,
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
				<div style={{ fontSize: 13, color: RDS_COLORS.fg }}>{label}</div>
				{sub && <div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>{sub}</div>}
			</div>
			{control}
		</div>
	);
}

function Segmented({
	value,
	onChange,
	options,
}: {
	value: string;
	onChange: (v: string) => void;
	options: { value: string; label: string }[];
}) {
	return (
		<div
			style={{
				display: "flex",
				gap: 4,
				background: RDS_COLORS.bgInput,
				padding: 2,
				borderRadius: 6,
			}}
		>
			{options.map((o) => {
				const on = value === o.value;
				return (
					<button
						key={o.value}
						type="button"
						onClick={() => onChange(o.value)}
						style={{
							padding: "4px 10px",
							borderRadius: 4,
							background: on ? RDS_COLORS.bgPanel : "transparent",
							border: 0,
							fontSize: 12,
							fontWeight: 500,
							color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
							cursor: "pointer",
						}}
					>
						{o.label}
					</button>
				);
			})}
		</div>
	);
}

const ACCENT_OPTIONS: { key: RedesignAccent; label: string; swatch: string }[] = [
	{ key: "violet", label: "Violet", swatch: "oklch(0.5 0.17 282)" },
	{ key: "cobalt", label: "Cobalt", swatch: "oklch(0.5 0.17 250)" },
	{ key: "forest", label: "Forest", swatch: "oklch(0.48 0.13 155)" },
	{ key: "ember", label: "Ember", swatch: "oklch(0.55 0.18 30)" },
];

export function SettingsPanel() {
	const { data: profile } = useUserProfile();
	const logout = useLogout();
	const pushToast = useToastStore((s) => s.push);
	const { accent, setAccent, theme, setTheme } = useUiStore();
	const {
		units,
		setUnits,
		showPois,
		setShowPois,
		terrain3d,
		setTerrain3d,
		publicProfile,
		setPublicProfile,
		hidePrivacy,
		setHidePrivacy,
		defaultActivity,
		setDefaultActivity,
		mapStyle,
		setMapStyle,
	} = useRedesignSettingsStore();
	const autoSnap = useRoutingPreferencesStore((s) => s.snap);
	const setAutoSnap = useRoutingPreferencesStore((s) => s.setSnap);

	const userName = profile?.name ?? "Your account";
	const userEmail = profile?.email ?? "Sign in to sync";

	const handleEditProfile = () => {
		window.dispatchEvent(new CustomEvent("routess:open-account"));
	};

	const handleExportData = () => {
		window.dispatchEvent(new CustomEvent("routess:export-all-data"));
	};

	const handleMapStyleChange = (nextStyle: RedesignMapStyle) => {
		setMapStyle(nextStyle);
	};

	const handleShowPoisChange = (next: boolean) => {
		setShowPois(next);
	};

	const handleSignOut = () => {
		if (!profile) {
			window.dispatchEvent(new CustomEvent("routess:open-login"));
			return;
		}
		logout.mutate(undefined, {
			onSuccess: () => {
				pushToast({ kind: "success", title: "Signed out" });
			},
		});
	};

	return (
		<div style={{ padding: "20px 20px", overflow: "auto", height: "100%" }}>
			<Group title="Profile">
				<Row
					label={userName}
					sub={userEmail}
					control={
						<Btn variant="ghost" onClick={handleEditProfile}>
							Edit
						</Btn>
					}
				/>
				<Row
					label="Default activity"
					sub="Used for new routes"
					control={
						<select
							value={defaultActivity}
							onChange={(e) => setDefaultActivity(e.target.value)}
							style={{
								height: 30,
								padding: "0 8px",
								borderRadius: 6,
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								color: RDS_COLORS.fg,
								fontSize: 12.5,
							}}
						>
							<option>Cycling</option>
							<option>Running</option>
							<option>Walking</option>
						</select>
					}
				/>
				<Row
					label="Units"
					control={
						<Segmented
							value={units}
							onChange={(v) => setUnits(v as "km" | "mi")}
							options={[
								{ value: "km", label: "Metric" },
								{ value: "mi", label: "Imperial" },
							]}
						/>
					}
					last
				/>
			</Group>

			<Group title="Appearance">
				<Row
					label="Theme"
					control={
						<Segmented
							value={theme}
							onChange={(v) => setTheme(v as "light" | "dark")}
							options={[
								{ value: "light", label: "Light" },
								{ value: "dark", label: "Dark" },
							]}
						/>
					}
				/>
				<Row
					label="Accent"
					control={
						<div style={{ display: "flex", gap: 6 }}>
							{ACCENT_OPTIONS.map((a) => {
								const on = accent === a.key;
								return (
									<button
										key={a.key}
										type="button"
										onClick={() => setAccent(a.key)}
										title={a.label}
										style={{
											width: 22,
											height: 22,
											borderRadius: 999,
											background: a.swatch,
											border: on ? `2px solid ${RDS_COLORS.fg}` : `2px solid ${RDS_COLORS.border}`,
											cursor: "pointer",
											padding: 0,
										}}
									/>
								);
							})}
						</div>
					}
					last
				/>
			</Group>

			<Group title="Map">
				<Row
					label="Map style"
					control={
						<select
							value={mapStyle}
							onChange={(e) => handleMapStyleChange(e.target.value as RedesignMapStyle)}
							style={{
								height: 30,
								padding: "0 8px",
								borderRadius: 6,
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								color: RDS_COLORS.fg,
								fontSize: 12.5,
							}}
						>
							<option value="streets">Streets</option>
							<option value="outdoors">Outdoors</option>
							<option value="satellite">Satellite</option>
							<option value="terrain">Terrain</option>
							<option value="dark">Dark</option>
							<option value="minimal">Minimal</option>
						</select>
					}
				/>
				<Row
					label="Show points of interest"
					sub="Cafés, shops, transit"
					control={<Toggle on={showPois} onChange={handleShowPoisChange} />}
				/>
				<Row
					label="3D terrain"
					sub="Coming soon"
					control={<Toggle on={terrain3d} onChange={setTerrain3d} disabled />}
				/>
				<Row label="Auto-snap to roads" control={<Toggle on={autoSnap} onChange={setAutoSnap} />} last />
			</Group>

			<Group title="Privacy">
				<Row
					label="Public profile"
					sub="Anyone with the link can see your routes"
					control={<Toggle on={publicProfile} onChange={setPublicProfile} disabled />}
				/>
				<Row
					label="Hide start/end (1km)"
					sub="Mask first and last kilometer on shared routes"
					control={<Toggle on={hidePrivacy} onChange={setHidePrivacy} />}
					last
				/>
			</Group>

			<Group title="Account">
				<Row
					label="Export all data"
					control={
						<Btn variant="ghost" onClick={handleExportData}>
							<I.download size={14} />
						</Btn>
					}
				/>
				<Row
					label={profile ? "Sign out" : "Sign in"}
					control={
						<Btn
							variant={profile ? "ghost" : "primary"}
							onClick={handleSignOut}
							disabled={logout.isPending}
							style={profile ? { color: RDS_COLORS.danger } : undefined}
						>
							{logout.isPending ? "Signing out…" : profile ? "Sign out" : "Sign in"}
						</Btn>
					}
					last
				/>
			</Group>
		</div>
	);
}
