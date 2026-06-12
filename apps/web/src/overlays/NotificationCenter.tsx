import type { ApiNotification } from "@routess/api-client";
import { useEffect, useRef } from "react";
import { useMarkNotificationsSeen, useNotifications } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { IconBtn, RDS_COLORS } from "../components/primitives";
import { useViewport } from "../hooks/useViewport";
import { Avatar } from "../panels/social/Avatar";

// A Notification is a pointer, never an action surface (CONTEXT.md
// "Notification"): rows deep-link to the profile or the inbox, where the
// actions live.
function NotificationRow({
	item,
	unseen,
	onOpen,
}: {
	item: ApiNotification;
	unseen: boolean;
	onOpen: (item: ApiNotification) => void;
}) {
	const t = useT();
	const text =
		item.type === "follow"
			? t("notifications.followedYou")
			: item.routeName
				? t("notifications.sharedRoute", { name: item.routeName })
				: t("notifications.sharedRouteGone");
	return (
		<button
			type="button"
			onClick={() => onOpen(item)}
			style={{
				display: "flex",
				alignItems: "center",
				gap: 10,
				width: "100%",
				padding: "10px 16px",
				background: "transparent",
				border: 0,
				cursor: "pointer",
				textAlign: "left",
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.background = RDS_COLORS.bgHover;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.background = "transparent";
			}}
		>
			<Avatar name={item.actor.name} avatar={item.actor.avatar} size={28} />
			<span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: RDS_COLORS.fgMuted, lineHeight: 1.4 }}>
				<span style={{ fontWeight: 600, color: RDS_COLORS.fg }}>{item.actor.name}</span> {text}
				<span style={{ color: RDS_COLORS.fgSubtle }}> · {new Date(item.createdAt).toLocaleDateString()}</span>
			</span>
			{unseen && (
				<span
					title={t("notifications.new")}
					style={{ width: 8, height: 8, borderRadius: 999, background: RDS_COLORS.accent, flexShrink: 0 }}
				/>
			)}
		</button>
	);
}

export function NotificationCenter() {
	const close = useModalsStore((s) => s.closeOverlay);
	const requestSocialPanel = useModalsStore((s) => s.requestSocialPanel);
	const setContext = useUiStore((s) => s.setContext);
	const setPanelCollapsed = useUiStore((s) => s.setPanelCollapsed);
	const t = useT();
	const { isMobile } = useViewport();
	const { data, isLoading } = useNotifications();
	const { mutate: bumpSeen } = useMarkNotificationsSeen();

	// Opening the center marks everything seen (bumps the NotificationsSeenAt
	// watermark). Items still highlight against the pre-bump seenAt the list
	// response carried, so "what's new" stays visible while open.
	const bumped = useRef(false);
	useEffect(() => {
		if (data && !bumped.current) {
			bumped.current = true;
			bumpSeen();
		}
	}, [data, bumpSeen]);

	const openItem = (item: ApiNotification) => {
		setContext("social");
		setPanelCollapsed(false);
		requestSocialPanel(item.type === "follow" ? { profile: item.actor.handle } : { tab: "inbox" });
		close();
	};

	const seenAtMs = data?.seenAt ? new Date(data.seenAt).getTime() : 0;
	const items = data?.items ?? [];

	return (
		<div
			style={
				isMobile
					? {
							position: "absolute",
							left: "max(12px, var(--rds-safe-left))",
							right: "max(12px, var(--rds-safe-right))",
							bottom: "var(--rds-bottom-tab-h)",
							maxHeight: "calc(100dvh - var(--rds-bottom-tab-h) - var(--rds-top-bar-h) - 16px)",
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 14,
							boxShadow: "var(--rds-shadow-lg)",
							zIndex: 60,
							display: "flex",
							flexDirection: "column",
							animation: "rds-sheet-in var(--rds-dur-slow) var(--rds-ease-spring)",
						}
					: {
							position: "absolute",
							top: 16,
							right: 16,
							width: 380,
							maxHeight: "min(520px, calc(100dvh - 32px))",
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 14,
							boxShadow: "var(--rds-shadow-lg)",
							zIndex: 60,
							display: "flex",
							flexDirection: "column",
							transformOrigin: "top right",
							animation: "rds-pop-in var(--rds-dur-base) var(--rds-ease-out)",
						}
			}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "14px 16px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<I.bell size={16} />
				<div style={{ fontSize: 14, fontWeight: 600 }}>{t("rail.notifications")}</div>
				<div style={{ flex: 1 }} />
				<IconBtn title={t("common.close")} onClick={close}>
					<I.close size={14} />
				</IconBtn>
			</div>
			{isLoading ? (
				<div style={{ padding: 40, textAlign: "center", color: RDS_COLORS.fgSubtle, fontSize: 13 }}>
					{t("social.loading")}
				</div>
			) : items.length === 0 ? (
				<div style={{ padding: "36px 24px", textAlign: "center" }}>
					<div
						style={{
							width: 56,
							height: 56,
							margin: "0 auto 12px",
							borderRadius: 16,
							background: RDS_COLORS.accentSoft,
							color: RDS_COLORS.accent,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<I.bell size={24} />
					</div>
					<h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t("notifications.empty.title")}</h3>
					<p style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted, margin: "5px 0 0", lineHeight: 1.5 }}>
						{t("notifications.empty.body")}
					</p>
				</div>
			) : (
				<div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
					{items.map((item) => (
						<NotificationRow
							key={`${item.type}-${item.shareId ?? item.actor.handle}-${item.createdAt}`}
							item={item}
							unseen={new Date(item.createdAt).getTime() > seenAtMs}
							onOpen={openItem}
						/>
					))}
				</div>
			)}
		</div>
	);
}
