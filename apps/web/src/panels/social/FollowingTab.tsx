import { useState } from "react";
import { useFollows, useFollowUser, useUnfollowUser, useUserSearch } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { I } from "../../components/icons";
import { Btn, RDS_COLORS, SecTitle } from "../../components/primitives";
import { Avatar } from "./Avatar";

function UserRow({
	handle,
	name,
	avatar,
	action,
	onOpenProfile,
}: {
	handle: string;
	name: string;
	avatar?: string | null;
	action?: React.ReactNode;
	onOpenProfile: (handle: string) => void;
}) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
			<button
				type="button"
				onClick={() => onOpenProfile(handle)}
				style={{
					display: "flex",
					alignItems: "center",
					gap: 10,
					background: "transparent",
					border: 0,
					padding: 0,
					cursor: "pointer",
					flex: 1,
					minWidth: 0,
					textAlign: "left",
					color: RDS_COLORS.fg,
				}}
			>
				<Avatar name={name} avatar={avatar} size={32} />
				<div style={{ minWidth: 0 }}>
					<div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
					<div className="rds-mono" style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>
						@{handle}
					</div>
				</div>
			</button>
			{action}
		</div>
	);
}

export function FollowingTab({ onOpenProfile }: { onOpenProfile: (handle: string) => void }) {
	const t = useT();
	const [query, setQuery] = useState("");
	const { data: results = [], isFetching: searchFetching } = useUserSearch(query);
	const { data: follows, isLoading } = useFollows();
	const follow = useFollowUser();
	const unfollow = useUnfollowUser();

	const followingHandles = new Set((follows?.following ?? []).map((p) => p.handle));
	const searching = query.trim().length >= 2;
	// Per-row pending: one mutation instance serves every row, so key the
	// disabled state to the handle in flight instead of freezing all rows.
	const followPending = (handle: string) => follow.isPending && follow.variables?.handle === handle;
	const unfollowPending = (handle: string) => unfollow.isPending && unfollow.variables === handle;

	return (
		<div
			style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 14 }}
		>
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
					style={{ background: "transparent", border: 0, outline: "none", flex: 1, fontSize: 13, color: "inherit" }}
				/>
			</div>

			{searching && (
				<div>
					<SecTitle>{t("social.search.results")}</SecTitle>
					{searchFetching && results.length === 0 && (
						<div style={{ fontSize: 13, color: RDS_COLORS.fgSubtle, padding: "10px 0" }}>
							{t("social.search.searching")}
						</div>
					)}
					{!searchFetching && results.length === 0 && (
						<div style={{ fontSize: 13, color: RDS_COLORS.fgSubtle, padding: "10px 0" }}>
							{t("social.search.noResults")}
						</div>
					)}
					{results.map((user) => (
						<UserRow
							key={user.handle}
							{...user}
							onOpenProfile={onOpenProfile}
							action={
								followingHandles.has(user.handle) ? (
									<Btn
										variant="ghost"
										disabled={unfollowPending(user.handle)}
										onClick={() => unfollow.mutate(user.handle)}
									>
										{t("social.unfollow")}
									</Btn>
								) : (
									<Btn
										variant="primary"
										disabled={followPending(user.handle)}
										onClick={() => follow.mutate({ handle: user.handle, source: "search" })}
									>
										{t("social.follow")}
									</Btn>
								)
							}
						/>
					))}
				</div>
			)}

			{!searching && (
				<>
					<div>
						<SecTitle>{t("social.following.title")}</SecTitle>
						{isLoading && (
							<div style={{ fontSize: 13, color: RDS_COLORS.fgSubtle, padding: "10px 0" }}>{t("social.loading")}</div>
						)}
						{!isLoading && (follows?.following ?? []).length === 0 && (
							<div style={{ fontSize: 13, color: RDS_COLORS.fgSubtle, padding: "10px 0", lineHeight: 1.5 }}>
								{t("social.following.empty")}
							</div>
						)}
						{(follows?.following ?? []).map((user) => (
							<UserRow
								key={user.handle}
								{...user}
								onOpenProfile={onOpenProfile}
								action={
									<Btn
										variant="ghost"
										disabled={unfollowPending(user.handle)}
										onClick={() => unfollow.mutate(user.handle)}
									>
										{t("social.unfollow")}
									</Btn>
								}
							/>
						))}
					</div>
					{(follows?.followers ?? []).length > 0 && (
						<div>
							<SecTitle>{t("social.followers.title")}</SecTitle>
							{(follows?.followers ?? []).map((user) => (
								<UserRow
									key={user.handle}
									{...user}
									onOpenProfile={onOpenProfile}
									action={
										followingHandles.has(user.handle) ? undefined : (
											<Btn
												variant="ghost"
												disabled={followPending(user.handle)}
												onClick={() => follow.mutate({ handle: user.handle, source: "search" })}
											>
												{t("social.followBack")}
											</Btn>
										)
									}
								/>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}
