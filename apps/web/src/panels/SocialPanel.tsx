import { useEffect, useState } from "react";
import { useIsAuthenticated } from "@/hooks/useAuthState";
import { useShareUnreadCount } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { I } from "../components/icons";
import { RDS_COLORS, SecTitle } from "../components/primitives";
import { SignInGate } from "../components/SignInGate";
import { FeedTab } from "./social/FeedTab";
import { FollowingTab } from "./social/FollowingTab";
import { InboxTab } from "./social/InboxTab";
import { ProfileView } from "./social/ProfileView";

type SocialTab = "feed" | "inbox" | "following";

export function SocialPanel() {
	const t = useT();
	const isAuthenticated = useIsAuthenticated();

	if (!isAuthenticated) {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<SignInGate title={t("social.gate.title")} description={t("social.gate.body")} icon={I.social} />
			</div>
		);
	}
	return <SocialPanelInner />;
}

function SocialPanelInner() {
	const t = useT();
	const [tab, setTab] = useState<SocialTab>("feed");
	const [openedProfile, setOpenedProfile] = useState<string | null>(null);
	const { data: unread = 0 } = useShareUnreadCount();
	const socialRequest = useModalsStore((s) => s.socialRequest);
	const clearSocialRequest = useModalsStore((s) => s.clearSocialRequest);

	// One-shot deep link (e.g. a notification pointing at the inbox or a
	// follower's profile).
	useEffect(() => {
		if (!socialRequest) return;
		if ("profile" in socialRequest) {
			setOpenedProfile(socialRequest.profile);
		} else {
			setTab(socialRequest.tab);
			setOpenedProfile(null);
		}
		clearSocialRequest();
	}, [socialRequest, clearSocialRequest]);

	if (openedProfile) {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<ProfileView handle={openedProfile} onBack={() => setOpenedProfile(null)} />
			</div>
		);
	}

	const tabs: { key: SocialTab; label: string; badge?: number }[] = [
		{ key: "feed", label: t("social.tab.feed") },
		{ key: "inbox", label: t("social.tab.inbox"), badge: unread },
		{ key: "following", label: t("social.tab.following") },
	];

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div style={{ padding: "16px 20px 0" }}>
				<SecTitle>{t("nav.social")}</SecTitle>
				<div style={{ display: "flex", gap: 2, marginTop: 10 }}>
					{tabs.map(({ key, label, badge }) => {
						const on = tab === key;
						return (
							<button
								key={key}
								type="button"
								role="tab"
								aria-selected={on}
								onClick={() => setTab(key)}
								style={{
									padding: "8px 14px",
									background: "transparent",
									border: 0,
									borderBottom: `2px solid ${on ? RDS_COLORS.accent : "transparent"}`,
									color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
									fontSize: 13,
									fontWeight: on ? 600 : 500,
									cursor: "pointer",
									display: "inline-flex",
									alignItems: "center",
									gap: 6,
								}}
							>
								{label}
								{badge != null && badge > 0 && (
									<span
										style={{
											minWidth: 16,
											height: 16,
											padding: "0 4px",
											borderRadius: 999,
											background: RDS_COLORS.accent,
											color: RDS_COLORS.accentFg,
											fontSize: 10.5,
											fontWeight: 600,
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										{badge > 9 ? "9+" : badge}
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>
			{tab === "feed" && <FeedTab onOpenProfile={setOpenedProfile} />}
			{tab === "inbox" && <InboxTab onOpenProfile={setOpenedProfile} />}
			{tab === "following" && <FollowingTab onOpenProfile={setOpenedProfile} />}
		</div>
	);
}
