import type { ApiProfileSummary } from "@routess/api-client";
import { useState } from "react";
import type { ApiRoute } from "@/lib/api";
import { useSendRouteShare, useUpdateRoute, useUserSearch } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { I } from "../../components/icons";
import { ModalShell } from "../../components/ModalShell";
import { Btn, RDS_COLORS } from "../../components/primitives";
import { Avatar } from "./Avatar";

// Send a route to another user's inbox (CONTEXT.md "RouteShare"). Only
// unlisted/public routes are shareable (ADR 0027): for a private route the
// dialog offers to make it unlisted first.
export function ShareRouteDialog({ route, onClose }: { route: ApiRoute; onClose: () => void }) {
	const t = useT();
	const [query, setQuery] = useState("");
	const [recipient, setRecipient] = useState<ApiProfileSummary | null>(null);
	const [message, setMessage] = useState("");
	const [sent, setSent] = useState(false);
	const { data: results = [] } = useUserSearch(query);
	const sendShare = useSendRouteShare();
	const updateRoute = useUpdateRoute();

	const isPrivate = route.visibility === "private";
	const busy = sendShare.isPending || updateRoute.isPending;

	const send = async () => {
		if (!recipient) return;
		// ADR 0027: visibility stays the only access control. A private route
		// is first made unlisted (with the user's explicit consent via this
		// button), then shared.
		const visibility = isPrivate ? "unlisted" : (route.visibility as "unlisted" | "public");
		if (isPrivate) {
			await updateRoute.mutateAsync({ routeId: route.id, updates: { visibility: "unlisted" } });
		}
		await sendShare.mutateAsync({
			body: { routeId: route.id, recipientHandle: recipient.handle, message: message.trim() || undefined },
			visibility,
		});
		setSent(true);
	};

	return (
		<ModalShell title={t("social.share.title")} sub={route.name} width={400} onClose={onClose}>
			<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
				{sent ? (
					<div style={{ textAlign: "center", padding: "16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
						<div style={{ color: RDS_COLORS.success, display: "flex", justifyContent: "center" }}>
							<I.check size={28} />
						</div>
						<div style={{ fontSize: 14, fontWeight: 600 }}>
							{t("social.share.sent", { name: recipient?.name ?? "" })}
						</div>
						<Btn variant="primary" onClick={onClose}>
							{t("common.done")}
						</Btn>
					</div>
				) : (
					<>
						{isPrivate && (
							<div
								style={{
									fontSize: 12.5,
									lineHeight: 1.5,
									color: RDS_COLORS.fgMuted,
									background: RDS_COLORS.accentSoft,
									borderRadius: 8,
									padding: "8px 10px",
								}}
							>
								{t("social.share.privateNotice")}
							</div>
						)}

						{recipient ? (
							<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
								<Avatar name={recipient.name} avatar={recipient.avatar} size={32} />
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ fontSize: 13, fontWeight: 600 }}>{recipient.name}</div>
									<div className="rds-mono" style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>
										@{recipient.handle}
									</div>
								</div>
								<Btn variant="ghost" onClick={() => setRecipient(null)}>
									{t("common.change")}
								</Btn>
							</div>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 8,
										background: RDS_COLORS.bgInput,
										border: `1px solid ${RDS_COLORS.border}`,
										borderRadius: 8,
										height: 36,
										padding: "0 10px",
									}}
								>
									<I.search size={14} />
									<input
										value={query}
										onChange={(e) => setQuery(e.target.value)}
										placeholder={t("social.search.placeholder")}
										style={{
											background: "transparent",
											border: 0,
											outline: "none",
											flex: 1,
											fontSize: 13,
											color: "inherit",
										}}
									/>
								</div>
								{results.map((user) => (
									<button
										key={user.handle}
										type="button"
										onClick={() => setRecipient(user)}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 10,
											background: "transparent",
											border: 0,
											padding: "6px 2px",
											cursor: "pointer",
											textAlign: "left",
											color: RDS_COLORS.fg,
											borderRadius: 8,
										}}
									>
										<Avatar name={user.name} avatar={user.avatar} size={28} />
										<span style={{ fontSize: 13 }}>
											{user.name}{" "}
											<span className="rds-mono" style={{ color: RDS_COLORS.fgSubtle, fontSize: 11.5 }}>
												@{user.handle}
											</span>
										</span>
									</button>
								))}
							</div>
						)}

						<textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							maxLength={500}
							rows={2}
							placeholder={t("social.share.messagePlaceholder")}
							style={{
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								borderRadius: 8,
								padding: "8px 10px",
								fontSize: 13,
								color: "inherit",
								outline: "none",
								resize: "vertical",
								fontFamily: "inherit",
							}}
						/>

						{sendShare.isError && (
							<div style={{ fontSize: 12.5, color: RDS_COLORS.danger }}>{t("social.share.failed")}</div>
						)}

						<Btn variant="primary" disabled={!recipient || busy} onClick={send}>
							<I.mail size={13} /> {isPrivate ? t("social.share.unlistAndSend") : t("social.share.send")}
						</Btn>
					</>
				)}
			</div>
		</ModalShell>
	);
}
