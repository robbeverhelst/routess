import { useState } from "react";
import { useAuthStatus } from "@/lib/api-queries";
import { I } from "../components/icons";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

// TODO: replace STATS / ROUTES / ACTIVITIES with real data when backend lands.
const STATS = [
	{ label: "Public routes", value: "47" },
	{ label: "Total km", value: "2,148" },
	{ label: "Followers", value: "182" },
	{ label: "Following", value: "94" },
];

function getInitials(name: string | undefined | null, email: string | undefined | null): string {
	if (name) {
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2 && parts[0] && parts[1]) {
			return (parts[0][0] ?? "").concat(parts[1][0] ?? "").toUpperCase();
		}
		return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
	}
	if (email) return email.slice(0, 2).toUpperCase();
	return "??";
}

const ROUTES = [
	{ name: "Schelde loop — long", distance: "12.4 km", likes: 24 },
	{ name: "Hingene castle ride", distance: "18.6 km", likes: 11 },
	{ name: "Buisstraat → museum", distance: "8.6 km", likes: 7 },
	{ name: "Saturday long", distance: "42.1 km", likes: 31 },
	{ name: "Sint-Amands recovery", distance: "3.6 km", likes: 4 },
	{ name: "Tempo intervals", distance: "7.8 km", likes: 9 },
];

const ACTIVITIES = [
	{ name: "Morning ride along the Schelde", date: "Apr 28 · 09:42", distance: "12.4 km", time: "1:04" },
	{ name: "Tempo intervals", date: "Apr 26 · 18:10", distance: "7.8 km", time: "0:32" },
	{ name: "Saturday long", date: "Apr 24 · 08:15", distance: "42.1 km", time: "2:48" },
	{ name: "Sint-Amands recovery", date: "Apr 22 · 17:35", distance: "3.6 km", time: "0:18" },
];

type Tab = "routes" | "activity" | "about";

export function ProfileScreen() {
	const { data: auth } = useAuthStatus();
	const user = auth?.user ?? null;
	const [tab, setTab] = useState<Tab>("routes");
	const [following, setFollowing] = useState(false);

	const displayName = user?.name ?? "Guest";
	const username = user?.email ? user.email.split("@")[0] : "guest";
	const initials = getInitials(user?.name, user?.email);
	const memberSinceYear = new Date().getFullYear();

	const handleShare = () => {
		window.dispatchEvent(new CustomEvent("routess:share-route"));
	};

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: RDS_COLORS.bgCanvas,
				overflow: "auto",
			}}
		>
			<div
				style={{
					height: 180,
					background: `linear-gradient(135deg, ${RDS_COLORS.accent}, oklch(0.65 0.15 200))`,
					position: "relative",
				}}
			/>
			<div style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px" }}>
				<div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: -56 }}>
					<div
						style={{
							width: 112,
							height: 112,
							borderRadius: 999,
							background: user?.picture
								? "transparent"
								: `linear-gradient(135deg, ${RDS_COLORS.accent}, oklch(0.65 0.15 200))`,
							color: "white",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 36,
							fontWeight: 600,
							border: `4px solid ${RDS_COLORS.bgCanvas}`,
							flexShrink: 0,
							overflow: "hidden",
						}}
					>
						{user?.picture ? (
							<img src={user.picture} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
						) : (
							initials
						)}
					</div>
					<div style={{ display: "flex", flexDirection: "column", flex: 1, paddingBottom: 8 }}>
						<h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: -0.4 }}>{displayName}</h1>
						<div
							className="rds-mono"
							style={{
								display: "flex",
								gap: 8,
								fontSize: 12,
								color: RDS_COLORS.fgMuted,
								marginTop: 6,
							}}
						>
							<span>@{username}</span>
							<span>·</span>
							<span>Member since {memberSinceYear}</span>
						</div>
					</div>
					<Btn variant={following ? "default" : "primary"} onClick={() => setFollowing((f) => !f)}>
						<I.plus size={14} /> {following ? "Following" : "Follow"}
					</Btn>
					<Btn onClick={handleShare} title="Share profile">
						<I.share size={14} />
					</Btn>
				</div>

				<p
					style={{
						marginTop: 18,
						fontSize: 14,
						color: RDS_COLORS.fgMuted,
						maxWidth: 540,
						lineHeight: 1.55,
					}}
				>
					{user?.email ?? "Sign in to set up your public profile and share routes."}
				</p>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(4, 1fr)",
						marginTop: 24,
						padding: 20,
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 14,
					}}
				>
					{STATS.map((s, i) => (
						<div
							key={s.label}
							style={{
								borderLeft: i ? `1px solid ${RDS_COLORS.border}` : "none",
								paddingLeft: i ? 18 : 0,
							}}
						>
							<SecTitle>{s.label}</SecTitle>
							<div className="rds-mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
								{s.value}
							</div>
						</div>
					))}
				</div>

				<div
					style={{
						display: "flex",
						gap: 4,
						marginTop: 28,
						borderBottom: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					{(
						[
							{ key: "routes", label: "Public routes" },
							{ key: "activity", label: "Activity" },
							{ key: "about", label: "About" },
						] as { key: Tab; label: string }[]
					).map((t) => {
						const active = tab === t.key;
						return (
							<button
								key={t.key}
								type="button"
								onClick={() => setTab(t.key)}
								style={{
									padding: "10px 14px",
									border: 0,
									background: "transparent",
									fontSize: 13,
									fontWeight: 500,
									color: active ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
									borderBottom: active ? `2px solid ${RDS_COLORS.accent}` : "2px solid transparent",
									marginBottom: -1,
									cursor: "pointer",
								}}
							>
								{t.label}
							</button>
						);
					})}
				</div>

				{tab === "routes" && (
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
							gap: 14,
							marginTop: 18,
							paddingBottom: 32,
						}}
					>
						{ROUTES.map((r, i) => (
							<div
								key={r.name}
								style={{
									background: RDS_COLORS.bgPanel,
									border: `1px solid ${RDS_COLORS.border}`,
									borderRadius: 12,
									overflow: "hidden",
								}}
							>
								<div style={{ height: 110, background: RDS_COLORS.bgInput, position: "relative" }}>
									<svg
										viewBox="0 0 240 110"
										style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
										aria-hidden="true"
									>
										<path
											d={`M 30 ${80 + (i % 3) * 5} Q ${80 + i * 4} ${20 + (i % 4) * 6}, ${130 + i * 3} 60 T ${210 - i} 30`}
											stroke="var(--rds-accent)"
											strokeWidth="2"
											fill="none"
											strokeLinecap="round"
										/>
									</svg>
								</div>
								<div style={{ padding: 12 }}>
									<div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
									<div
										className="rds-mono"
										style={{
											display: "flex",
											gap: 8,
											fontSize: 11,
											color: RDS_COLORS.fgSubtle,
											marginTop: 4,
										}}
									>
										<span>{r.distance}</span>
										<span>·</span>
										<span>
											<I.heart size={10} /> {r.likes}
										</span>
									</div>
								</div>
							</div>
						))}
					</div>
				)}

				{tab === "activity" && (
					<div
						style={{
							marginTop: 18,
							paddingBottom: 32,
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 12,
							overflow: "hidden",
						}}
					>
						{ACTIVITIES.map((a, i) => (
							<div
								key={a.name}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 12,
									padding: "14px 16px",
									borderBottom: i < ACTIVITIES.length - 1 ? `1px solid ${RDS_COLORS.border}` : "none",
								}}
							>
								<I.activity size={16} />
								<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
									<div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
									<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
										{a.date}
									</div>
								</div>
								<div className="rds-mono" style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>
									{a.distance} · {a.time}
								</div>
							</div>
						))}
					</div>
				)}

				{tab === "about" && (
					<div
						style={{
							marginTop: 18,
							paddingBottom: 32,
						}}
					>
						<div
							style={{
								padding: 20,
								background: RDS_COLORS.bgPanel,
								border: `1px solid ${RDS_COLORS.border}`,
								borderRadius: 12,
								fontSize: 13.5,
								color: RDS_COLORS.fgMuted,
								lineHeight: 1.6,
							}}
						>
							<SecTitle style={{ marginBottom: 10 }}>Email</SecTitle>
							<p style={{ margin: 0 }}>{user?.email ?? "Not signed in"}</p>
							<SecTitle style={{ marginTop: 18, marginBottom: 10 }}>Member since</SecTitle>
							<p style={{ margin: 0 }}>{memberSinceYear}</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
