import { useIsAuthenticated } from "@/hooks/useAuthState";
import { I } from "../components/icons";
import { Badge, Btn, PreviewBanner, RDS_COLORS, SecTitle } from "../components/primitives";
import { SignInGate } from "../components/SignInGate";

type Friend = {
	name: string;
	handle: string;
	followers: number;
	note: string;
};

type SharedRoute = {
	name: string;
	owner: string;
	distance: string;
	when: string;
	note: string;
};

const FRIENDS: Friend[] = [
	{ name: "Marta Ruiz", handle: "@marta", followers: 182, note: "Posts hilly morning rides and route notes." },
	{ name: "Luis Ortega", handle: "@luis", followers: 96, note: "Shares easy recovery loops and river paths." },
];

const SHARED_ROUTES: SharedRoute[] = [
	{
		name: "Coffee spin with the ridge climb",
		owner: "Marta",
		distance: "34.8 km",
		when: "Shared 2h ago",
		note: "Added a note about the smoother descent and the best stop for water.",
	},
	{
		name: "Sunday river path",
		owner: "Luis",
		distance: "12.4 km",
		when: "Shared yesterday",
		note: "Good for walking or an easy run. Mostly shaded once you're past the bridge.",
	},
];

export function SocialPanel() {
	const isAuthenticated = useIsAuthenticated();

	if (!isAuthenticated) {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<SignInGate
					title="Sign in for social"
					description="Follow friends, manage your public profile, and see routes shared with you."
					icon={I.social}
				/>
			</div>
		);
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					padding: "16px 20px 12px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
					<div style={{ fontSize: 13, fontWeight: 600, color: RDS_COLORS.fg }}>Social</div>
					<Badge variant="accent">People</Badge>
				</div>
				<div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.4, marginTop: 8 }}>
					Friends, profiles, and shared routes.
				</div>
				<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
					<Badge variant="default">{FRIENDS.length} suggested people</Badge>
					<Badge variant="default">{SHARED_ROUTES.length} routes shared with you</Badge>
				</div>
			</div>

			<div style={{ padding: "14px 20px 20px", flex: 1, overflow: "auto" }}>
				<PreviewBanner
					style={{ marginBottom: 18 }}
					title="Preview · social graph"
					body="Following, profile stats, and route-sharing inboxes are still mocked, but this is the right home for people and profile surfaces."
				/>

				<SecTitle style={{ marginBottom: 10 }}>People to follow</SecTitle>
				<div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
					{FRIENDS.map((friend) => (
						<div
							key={friend.handle}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: 14,
								borderRadius: 12,
								border: `1px solid ${RDS_COLORS.border}`,
								background: RDS_COLORS.bgPanel,
							}}
						>
							<div
								style={{
									width: 42,
									height: 42,
									borderRadius: 999,
									background: RDS_COLORS.accentSoft,
									color: RDS_COLORS.accent,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
									fontSize: 13,
									fontWeight: 700,
								}}
							>
								{friend.name
									.split(" ")
									.slice(0, 2)
									.map((part) => part[0])
									.join("")}
							</div>
							<div style={{ minWidth: 0, flex: 1 }}>
								<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
									<div style={{ fontSize: 13, fontWeight: 600 }}>{friend.name}</div>
									<Badge variant="default">{friend.handle}</Badge>
								</div>
								<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
									{friend.followers} followers
								</div>
								<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted, marginTop: 6 }}>{friend.note}</div>
							</div>
							<div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
								<Btn onClick={() => window.dispatchEvent(new CustomEvent("routess:open-profile"))}>Profile</Btn>
								<Btn variant="primary">
									<I.plus size={14} /> Follow
								</Btn>
							</div>
						</div>
					))}
				</div>

				<SecTitle style={{ marginBottom: 10 }}>Shared with you</SecTitle>
				<div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
					{SHARED_ROUTES.map((route) => (
						<div
							key={`${route.owner}-${route.name}`}
							style={{
								padding: 14,
								borderRadius: 12,
								border: `1px solid ${RDS_COLORS.border}`,
								background: RDS_COLORS.bgPanel,
							}}
						>
							<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
								<div style={{ fontSize: 13, fontWeight: 600 }}>{route.name}</div>
								<Badge variant="accent">From {route.owner}</Badge>
							</div>
							<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 4 }}>
								{route.distance} · {route.when}
							</div>
							<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted, marginTop: 8 }}>{route.note}</div>
							<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
								<Btn variant="primary" onClick={() => window.dispatchEvent(new CustomEvent("routess:open-discover"))}>
									<I.route size={14} /> Open route
								</Btn>
								<Btn onClick={() => window.dispatchEvent(new CustomEvent("routess:open-profile"))}>View profile</Btn>
							</div>
						</div>
					))}
				</div>

				<SecTitle style={{ marginBottom: 10 }}>Your presence</SecTitle>
				<div
					style={{
						padding: 16,
						borderRadius: 12,
						border: `1px solid ${RDS_COLORS.border}`,
						background: RDS_COLORS.bgPanel,
					}}
				>
					<div style={{ fontSize: 14, fontWeight: 600 }}>Profile and account</div>
					<p
						style={{
							fontSize: 12.5,
							lineHeight: 1.5,
							color: RDS_COLORS.fgMuted,
							margin: "8px 0 14px",
						}}
					>
						Manage your public profile from the profile screen and your plan, billing, and account details from the
						avatar menu.
					</p>
					<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						<Btn variant="primary" onClick={() => window.dispatchEvent(new CustomEvent("routess:open-profile"))}>
							<I.user size={14} /> Open profile
						</Btn>
						<Btn onClick={() => window.dispatchEvent(new CustomEvent("routess:open-account"))}>
							<I.settings size={14} /> Account & billing
						</Btn>
					</div>
				</div>
			</div>
		</div>
	);
}
