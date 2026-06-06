import { useIsAuthenticated } from "@/hooks/useAuthState";
import { useAuthStatus, useFollowUser, usePublicProfile, useUnfollowUser } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useUnits } from "@/lib/units";
import { I } from "../../components/icons";
import { Btn, RDS_COLORS, SecTitle } from "../../components/primitives";
import { Avatar } from "./Avatar";
import { SocialRouteCard } from "./RouteCard";

function Stat({ label, value }: { label: string; value: string | number }) {
	return (
		<div style={{ textAlign: "center" }}>
			<div className="rds-mono" style={{ fontSize: 16, fontWeight: 600 }}>
				{value}
			</div>
			<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>{label}</div>
		</div>
	);
}

// The public projection of a User (CONTEXT.md "Profile"): stats over public
// routes only; follower lists stay owner-only so only counts render here.
export function ProfileView({
	handle,
	onBack,
	followSource = "profile",
}: {
	handle: string;
	onBack?: () => void;
	followSource?: "profile" | "search" | "public_route" | "feed";
}) {
	const t = useT();
	const isAuthenticated = useIsAuthenticated();
	const { data: auth } = useAuthStatus();
	const { data: profile, isLoading, isError } = usePublicProfile(handle);
	const follow = useFollowUser();
	const unfollow = useUnfollowUser();
	const { formatDistanceParts } = useUnits();

	if (isLoading) {
		return <div style={{ padding: 40, textAlign: "center", color: RDS_COLORS.fgSubtle }}>{t("social.loading")}</div>;
	}
	if (isError || !profile) {
		return (
			<div style={{ padding: 40, textAlign: "center", color: RDS_COLORS.fgMuted }}>{t("social.profile.notFound")}</div>
		);
	}

	const distance = formatDistanceParts(profile.stats.totalDistance / 1000);
	const busy = follow.isPending || unfollow.isPending;
	const isOwnProfile = auth?.user?.handle === profile.handle;

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
			<div style={{ padding: "16px 20px", borderBottom: `1px solid ${RDS_COLORS.border}` }}>
				{onBack && (
					<button
						type="button"
						onClick={onBack}
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							background: "transparent",
							border: 0,
							color: RDS_COLORS.fgMuted,
							fontSize: 12,
							cursor: "pointer",
							padding: 0,
							marginBottom: 12,
						}}
					>
						<I.chevronL size={14} /> {t("common.back")}
					</button>
				)}
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<Avatar name={profile.name} avatar={profile.avatar} size={48} />
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ fontSize: 16, fontWeight: 600 }}>{profile.name}</div>
						<div className="rds-mono" style={{ fontSize: 12, color: RDS_COLORS.fgSubtle }}>
							@{profile.handle}
						</div>
					</div>
					{isAuthenticated && !isOwnProfile && profile.isFollowing !== null && (
						<Btn
							variant={profile.isFollowing ? "ghost" : "primary"}
							disabled={busy}
							onClick={() =>
								profile.isFollowing
									? unfollow.mutate(profile.handle)
									: follow.mutate({ handle: profile.handle, source: followSource })
							}
						>
							{profile.isFollowing ? t("social.unfollow") : t("social.follow")}
						</Btn>
					)}
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(4, 1fr)",
						gap: 8,
						marginTop: 14,
						padding: "10px 0",
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 10,
						background: RDS_COLORS.bgPanelElev,
					}}
				>
					<Stat label={t("social.stats.routes")} value={profile.stats.publicRoutes} />
					<Stat label={t("social.stats.distance")} value={`${distance.value} ${distance.unit}`} />
					<Stat label={t("social.stats.followers")} value={profile.stats.followers} />
					<Stat label={t("social.stats.following")} value={profile.stats.following} />
				</div>
			</div>
			<div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
				<SecTitle>{t("social.profile.publicRoutes")}</SecTitle>
				{profile.routes.length === 0 && (
					<div style={{ fontSize: 13, color: RDS_COLORS.fgSubtle, padding: "12px 0" }}>
						{t("social.profile.noRoutes")}
					</div>
				)}
				{profile.routes.map((route) => (
					<SocialRouteCard key={route.id} route={route} />
				))}
			</div>
		</div>
	);
}
