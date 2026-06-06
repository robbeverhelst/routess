import type { ApiRouteShare } from "@routess/api-client";
import { useCopySharedRoute, useMarkShareRead, useShareInbox } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { I } from "../../components/icons";
import { Btn, RDS_COLORS } from "../../components/primitives";
import { Avatar } from "./Avatar";
import { SocialRouteCard } from "./RouteCard";

function ShareCard({ share, onOpenProfile }: { share: ApiRouteShare; onOpenProfile: (handle: string) => void }) {
	const t = useT();
	const markRead = useMarkShareRead();
	const copy = useCopySharedRoute();
	const unread = !share.readAt;

	const header = (
		<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
			<button
				type="button"
				onClick={() => onOpenProfile(share.sender.handle)}
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					background: "transparent",
					border: 0,
					padding: 0,
					cursor: "pointer",
					color: RDS_COLORS.fgMuted,
					textAlign: "left",
					flex: 1,
					minWidth: 0,
				}}
			>
				<Avatar name={share.sender.name} avatar={share.sender.avatar} size={24} />
				<span style={{ fontSize: 12 }}>
					<span style={{ fontWeight: 600, color: RDS_COLORS.fg }}>{share.sender.name}</span>{" "}
					{t("social.inbox.sharedWithYou")} · {new Date(share.createdAt).toLocaleDateString()}
				</span>
			</button>
			{unread && (
				<span
					title={t("social.inbox.unread")}
					style={{ width: 8, height: 8, borderRadius: 999, background: RDS_COLORS.accent, flexShrink: 0 }}
				/>
			)}
		</div>
	);

	const message = share.message && (
		<div
			style={{
				fontSize: 13,
				color: RDS_COLORS.fgMuted,
				background: RDS_COLORS.bgPanelElev,
				borderRadius: 8,
				padding: "8px 10px",
				lineHeight: 1.4,
			}}
		>
			"{share.message}"
		</div>
	);

	if (share.unavailable || !share.route) {
		return (
			<div
				style={{
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 12,
					background: RDS_COLORS.bgPanel,
					padding: 12,
					display: "flex",
					flexDirection: "column",
					gap: 8,
					opacity: 0.75,
				}}
			>
				{header}
				{message}
				<div style={{ fontSize: 13, color: RDS_COLORS.fgSubtle, fontStyle: "italic" }}>
					{t("social.inbox.unavailable")}
				</div>
				{unread && (
					<div style={{ display: "flex", gap: 8 }}>
						<Btn variant="ghost" onClick={() => markRead.mutate(share.id)}>
							<I.check size={13} /> {t("social.inbox.markRead")}
						</Btn>
					</div>
				)}
			</div>
		);
	}

	return (
		<SocialRouteCard
			route={share.route}
			header={
				<>
					{header}
					{message}
				</>
			}
			footer={
				<div style={{ display: "flex", gap: 8 }}>
					<Btn
						variant="ghost"
						disabled={copy.isPending}
						onClick={() => {
							copy.mutate(share.id);
							if (unread) markRead.mutate(share.id);
						}}
					>
						<I.copy size={13} /> {copy.isSuccess ? t("social.inbox.copied") : t("social.inbox.saveCopy")}
					</Btn>
					{unread && (
						<Btn variant="ghost" onClick={() => markRead.mutate(share.id)}>
							<I.check size={13} /> {t("social.inbox.markRead")}
						</Btn>
					)}
				</div>
			}
		/>
	);
}

export function InboxTab({ onOpenProfile }: { onOpenProfile: (handle: string) => void }) {
	const t = useT();
	const { data: shares = [], isLoading } = useShareInbox();

	if (isLoading) {
		return <div style={{ padding: 40, textAlign: "center", color: RDS_COLORS.fgSubtle }}>{t("social.loading")}</div>;
	}
	if (shares.length === 0) {
		return (
			<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
				<div style={{ maxWidth: 280, textAlign: "center" }}>
					<div
						style={{
							width: 72,
							height: 72,
							margin: "0 auto 14px",
							borderRadius: 18,
							background: RDS_COLORS.accentSoft,
							color: RDS_COLORS.accent,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<I.mail size={30} />
					</div>
					<h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t("social.inbox.empty.title")}</h3>
					<p style={{ fontSize: 13, color: RDS_COLORS.fgMuted, margin: "6px 0 0", lineHeight: 1.5 }}>
						{t("social.inbox.empty.body")}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}
		>
			{shares.map((share) => (
				<ShareCard key={share.id} share={share} onOpenProfile={onOpenProfile} />
			))}
		</div>
	);
}
