import { type ReactNode, useState } from "react";
import { useUserProfile } from "@/lib/api-queries";
import { type RedesignAccent, useUiStore } from "@/redesign/stores/uiStore";
import { I } from "../components/icons";
import { Btn, RDS_COLORS, SecTitle, Toggle } from "../components/primitives";

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
	const { accent, setAccent, density, setDensity, theme, setTheme, layout, setLayout } = useUiStore();
	const [units, setUnits] = useState<"metric" | "imperial">("metric");
	const [showPois, setShowPois] = useState(true);
	const [terrain3d, setTerrain3d] = useState(false);
	const [autoSnap, setAutoSnap] = useState(true);
	const [publicProfile, setPublicProfile] = useState(false);
	const [hidePrivacy, setHidePrivacy] = useState(true);
	const [defaultActivity, setDefaultActivity] = useState("Cycling");
	const [mapStyle, setMapStyle] = useState("Streets");

	const userName = profile?.name ?? "Your account";
	const userEmail = profile?.email ?? "Sign in to sync";

	return (
		<div style={{ padding: "20px 20px", overflow: "auto", height: "100%" }}>
			<Group title="Profile">
				<Row label={userName} sub={userEmail} control={<Btn variant="ghost">Edit</Btn>} />
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
							onChange={(v) => setUnits(v as "metric" | "imperial")}
							options={[
								{ value: "metric", label: "Metric" },
								{ value: "imperial", label: "Imperial" },
							]}
						/>
					}
					last
				/>
			</Group>

			<Group title="Appearance">
				<Row
					label="Layout"
					sub="Sidebar is the desktop default; floating glass and bottom sheet are alt modes"
					control={
						<Segmented
							value={layout}
							onChange={(v) => setLayout(v as "sidebar" | "floating" | "bottom")}
							options={[
								{ value: "sidebar", label: "Sidebar" },
								{ value: "floating", label: "Floating" },
								{ value: "bottom", label: "Bottom" },
							]}
						/>
					}
				/>
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
				/>
				<Row
					label="Density"
					control={
						<Segmented
							value={density}
							onChange={(v) => setDensity(v as "compact" | "default" | "comfy")}
							options={[
								{ value: "compact", label: "Compact" },
								{ value: "default", label: "Default" },
								{ value: "comfy", label: "Comfy" },
							]}
						/>
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
							onChange={(e) => setMapStyle(e.target.value)}
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
							<option>Streets</option>
							<option>Outdoors</option>
							<option>Satellite</option>
						</select>
					}
				/>
				<Row
					label="Show points of interest"
					sub="Cafés, shops, transit"
					control={<Toggle on={showPois} onChange={setShowPois} />}
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
						<Btn variant="ghost">
							<I.download size={14} />
						</Btn>
					}
				/>
				<Row
					label="Sign out"
					control={
						<Btn variant="ghost" style={{ color: RDS_COLORS.danger }}>
							Sign out
						</Btn>
					}
					last
				/>
			</Group>
		</div>
	);
}
