import { isValidHandle } from "@routess/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics/track";
import { apiService } from "@/lib/api";
import { useAuthStatus, useLogout } from "@/lib/api-queries";
import { emitAppEvent } from "@/lib/app-events";
import { storeUser } from "@/lib/auth-state";
import { t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-client";
import { useToastStore } from "@/stores/toastStore";
import { Btn, RDS_COLORS, SecTitle, Toggle } from "../components/primitives";
import { Field, SettingsBlock, SettingsRow, SettingsSection, TextInput } from "../components/settings";

const dash = "—";

async function resizeImageToDataUrl(file: File, maxDimension: number): Promise<string> {
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error ?? new Error("read failed"));
		reader.readAsDataURL(file);
	});
	const img = await new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("image decode failed"));
		image.src = dataUrl;
	});
	const ratio = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
	const w = Math.round(img.width * ratio);
	const h = Math.round(img.height * ratio);
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("canvas 2d not available");
	ctx.drawImage(img, 0, 0, w, h);
	return canvas.toDataURL("image/jpeg", 0.85);
}

function initialsFromName(name: string | null | undefined, email: string | null | undefined): string {
	const source = (name?.trim() || email?.split("@")[0] || "").trim();
	if (!source) return "?";
	const parts = source.split(/\s+/).slice(0, 2);
	return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || source[0]?.toUpperCase() || "?";
}

export function UserSettingsScreen() {
	const { data: auth } = useAuthStatus();
	const user = auth?.user ?? null;
	const pushToast = useToastStore((s) => s.push);
	const queryClient = useQueryClient();

	const [name, setName] = useState(user?.name ?? "");
	const [editingName, setEditingName] = useState(false);
	const [savingName, setSavingName] = useState(false);
	const [handle, setHandle] = useState(user?.handle ?? "");
	const [editingHandle, setEditingHandle] = useState(false);
	const [savingHandle, setSavingHandle] = useState(false);
	const [savingSharePref, setSavingSharePref] = useState(false);
	const [avatarUploading, setAvatarUploading] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const [editingPassword, setEditingPassword] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [savingPassword, setSavingPassword] = useState(false);
	const [passwordError, setPasswordError] = useState<string | null>(null);

	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const lastSyncedNameRef = useRef<string | null>(null);
	useEffect(() => {
		if (user?.name && user.name !== lastSyncedNameRef.current && !editingName) {
			lastSyncedNameRef.current = user.name;
			setName(user.name);
		}
	}, [user?.name, editingName]);

	const refreshUser = async () => {
		await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
		await queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() });
	};

	const handleSaveName = async () => {
		const trimmed = name.trim();
		if (!trimmed || trimmed === user?.name) {
			setEditingName(false);
			setName(user?.name ?? "");
			return;
		}
		setSavingName(true);
		try {
			const updated = await apiService.updateCurrentUser({ name: trimmed });
			storeUser(updated);
			await refreshUser();
			pushToast({ kind: "success", title: t("account.nameUpdated") });
			setEditingName(false);
		} catch (error) {
			Logger.error("Update name failed", error);
			pushToast({ kind: "danger", title: t("account.nameUpdateFailed") });
		} finally {
			setSavingName(false);
		}
	};

	const handleCancelName = () => {
		setEditingName(false);
		setName(user?.name ?? "");
	};

	// Handle change (CONTEXT.md "Handle"): old profile URLs 404 afterwards,
	// the freed handle returns to the pool.
	const handleSaveHandle = async () => {
		const trimmed = handle.trim().toLowerCase();
		if (!trimmed || trimmed === user?.handle) {
			setEditingHandle(false);
			setHandle(user?.handle ?? "");
			return;
		}
		if (!isValidHandle(trimmed)) {
			pushToast({ kind: "warn", title: t("account.handleInvalid") });
			return;
		}
		setSavingHandle(true);
		try {
			const updated = await apiService.updateCurrentUser({ handle: trimmed });
			storeUser(updated);
			await refreshUser();
			trackEvent({ name: "profile_handle_changed", properties: {} });
			pushToast({ kind: "success", title: t("account.handleUpdated") });
			setEditingHandle(false);
		} catch (error) {
			Logger.error("Update handle failed", error);
			const taken = error instanceof Error && error.message.includes("409");
			pushToast({ kind: "danger", title: taken ? t("account.handleTaken") : t("account.handleUpdateFailed") });
		} finally {
			setSavingHandle(false);
		}
	};

	const handleToggleShareEmails = async (next: boolean) => {
		setSavingSharePref(true);
		try {
			const updated = await apiService.updateCurrentUser({ preferences: { emailOnRouteShare: next } });
			storeUser(updated);
			await refreshUser();
		} catch (error) {
			Logger.error("Update share email preference failed", error);
			pushToast({ kind: "danger", title: t("common.tryAgain") });
		} finally {
			setSavingSharePref(false);
		}
	};

	const handleAvatarClick = () => fileInputRef.current?.click();

	const handleAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			pushToast({ kind: "warn", title: t("settings.profile.avatar.invalidType") });
			return;
		}
		setAvatarUploading(true);
		try {
			const dataUrl = await resizeImageToDataUrl(file, 256);
			const updated = await apiService.updateCurrentUser({ avatar: dataUrl });
			storeUser(updated);
			await refreshUser();
			pushToast({ kind: "success", title: t("settings.profile.avatar.updated") });
		} catch (error) {
			Logger.error("Avatar upload failed", error);
			pushToast({ kind: "danger", title: t("settings.profile.avatar.failed") });
		} finally {
			setAvatarUploading(false);
		}
	};

	const handleClearAvatar = async () => {
		setAvatarUploading(true);
		try {
			const updated = await apiService.updateCurrentUser({ avatar: "" });
			storeUser(updated);
			await refreshUser();
			pushToast({ kind: "success", title: t("settings.profile.avatar.cleared") });
		} catch (error) {
			Logger.error("Avatar clear failed", error);
			pushToast({ kind: "danger", title: t("settings.profile.avatar.failed") });
		} finally {
			setAvatarUploading(false);
		}
	};

	const resetPasswordForm = () => {
		setCurrentPassword("");
		setNewPassword("");
		setConfirmPassword("");
		setPasswordError(null);
	};

	const handleCancelPassword = () => {
		setEditingPassword(false);
		resetPasswordForm();
	};

	const handleSavePassword = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setPasswordError(null);
		if (newPassword.length < 12) {
			setPasswordError(t("account.password.tooShort"));
			return;
		}
		if (newPassword !== confirmPassword) {
			setPasswordError(t("account.password.mismatch"));
			return;
		}
		setSavingPassword(true);
		try {
			await apiService.setPassword({
				newPassword,
				currentPassword: currentPassword || undefined,
			});
			pushToast({ kind: "success", title: t("settings.security.passwordUpdated") });
			setEditingPassword(false);
			resetPasswordForm();
		} catch (error) {
			Logger.error("Set password failed", error);
			const message = error instanceof Error ? error.message : t("settings.security.passwordFailed");
			setPasswordError(message);
		} finally {
			setSavingPassword(false);
		}
	};

	const handleDeleteAccount = async () => {
		setDeleting(true);
		try {
			await apiService.deleteAccount();
			pushToast({ kind: "success", title: t("settings.account.deleteScheduled") });
			emitAppEvent("routess:open-login", { entryPoint: "session_ended" });
		} catch (error) {
			Logger.error("Delete account failed", error);
			pushToast({ kind: "danger", title: t("settings.account.deleteFailed") });
		} finally {
			setDeleting(false);
			setConfirmingDelete(false);
		}
	};

	const isPendingDeletion = user?.deletionStatus === "pending_hard_delete";

	const handleCancelDeletion = async () => {
		try {
			await apiService.cancelDeletion();
			await refreshUser();
			pushToast({ kind: "success", title: t("settings.account.deletionCancelled") });
		} catch (error) {
			Logger.error("Cancel deletion failed", error);
			pushToast({ kind: "danger", title: t("settings.account.deletionCancelFailed") });
		}
	};

	const logout = useLogout();

	const handleSignOut = () => {
		logout.mutate(undefined, {
			onSuccess: () => {
				pushToast({ kind: "success", title: t("common.signedOut") });
				emitAppEvent("routess:open-login", { entryPoint: "session_ended" });
			},
		});
	};

	const handleLogoutEverywhere = async () => {
		if (!window.confirm(t("settings.security.logoutEverywhereConfirm"))) return;
		try {
			await apiService.logoutEverywhere();
			pushToast({ kind: "success", title: t("common.signedOut") });
			emitAppEvent("routess:open-login", { entryPoint: "session_ended" });
		} catch (error) {
			Logger.error("Logout everywhere failed", error);
			pushToast({ kind: "danger", title: t("settings.security.logoutEverywhereFailed") });
		}
	};

	const handleExportData = () => {
		const url = apiService.exportDataUrl();
		const a = document.createElement("a");
		a.href = url;
		a.download = "";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	};

	const avatarSize = 72;

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: RDS_COLORS.bgCanvas,
				overflow: "auto",
			}}
		>
			<div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
				<SecTitle>{t("nav.settings")}</SecTitle>
				<h1 style={{ fontSize: 26, fontWeight: 600, margin: "4px 0 0", letterSpacing: -0.5 }}>
					{t("account.heading")}
				</h1>

				{isPendingDeletion && (
					<div
						style={{
							marginTop: 20,
							padding: 14,
							borderRadius: 10,
							background: `color-mix(in oklch, ${RDS_COLORS.warn} 14%, ${RDS_COLORS.bgPanel})`,
							border: `1px solid color-mix(in oklch, ${RDS_COLORS.warn} 50%, ${RDS_COLORS.border})`,
							display: "flex",
							alignItems: "center",
							gap: 12,
						}}
					>
						<div style={{ flex: 1 }}>
							<div style={{ fontSize: 13, fontWeight: 600, color: RDS_COLORS.fg }}>
								{t("settings.account.pendingDeletion")}
							</div>
							<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted, marginTop: 2 }}>
								{t("settings.account.pendingDeletionSub")}
							</div>
						</div>
						<Btn variant="primary" onClick={handleCancelDeletion}>
							{t("settings.account.cancelDeletion")}
						</Btn>
					</div>
				)}

				<div style={{ marginTop: 24 }}>
					<SettingsSection title={t("account.title")}>
						<SettingsBlock style={{ display: "flex", alignItems: "center", gap: 16 }}>
							<div
								style={{
									width: avatarSize,
									height: avatarSize,
									borderRadius: 999,
									background: user?.avatar ? "transparent" : RDS_COLORS.bgInput,
									border: `1px solid ${RDS_COLORS.border}`,
									overflow: "hidden",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: RDS_COLORS.fgMuted,
									fontSize: 22,
									fontWeight: 600,
									flexShrink: 0,
								}}
							>
								{user?.avatar ? (
									<img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
								) : (
									initialsFromName(user?.name, user?.email)
								)}
							</div>
							<div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									onChange={handleAvatarFile}
									style={{ display: "none" }}
								/>
								<div style={{ display: "flex", gap: 8 }}>
									<Btn variant="default" onClick={handleAvatarClick} disabled={avatarUploading}>
										{avatarUploading ? t("account.uploading") : t("settings.profile.avatar.upload")}
									</Btn>
									{user?.avatar && (
										<Btn variant="ghost" onClick={handleClearAvatar} disabled={avatarUploading}>
											{t("settings.profile.avatar.clear")}
										</Btn>
									)}
								</div>
								<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{t("settings.profile.avatar.sub")}</div>
							</div>
						</SettingsBlock>

						{editingName ? (
							<SettingsBlock>
								<form
									onSubmit={(e) => {
										e.preventDefault();
										void handleSaveName();
									}}
									style={{ display: "flex", flexDirection: "column", gap: 10 }}
								>
									<Field label={t("account.field.name")}>
										<TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
									</Field>
									<div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
										<Btn variant="ghost" onClick={handleCancelName} disabled={savingName}>
											{t("common.cancel")}
										</Btn>
										<Btn type="submit" variant="primary" disabled={savingName}>
											{savingName ? t("account.saving") : t("common.save")}
										</Btn>
									</div>
								</form>
							</SettingsBlock>
						) : (
							<SettingsRow
								label={t("account.field.name")}
								control={
									<>
										<span style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>{user?.name || dash}</span>
										<Btn variant="ghost" onClick={() => setEditingName(true)}>
											{t("common.edit")}
										</Btn>
									</>
								}
							/>
						)}

						{editingHandle ? (
							<SettingsBlock>
								<form
									onSubmit={(e) => {
										e.preventDefault();
										void handleSaveHandle();
									}}
									style={{ display: "flex", flexDirection: "column", gap: 10 }}
								>
									<Field label={t("account.field.handle")}>
										<TextInput value={handle} onChange={(e) => setHandle(e.target.value)} autoFocus />
									</Field>
									<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{t("account.handleHint")}</div>
									<div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
										<Btn
											variant="ghost"
											onClick={() => {
												setEditingHandle(false);
												setHandle(user?.handle ?? "");
											}}
											disabled={savingHandle}
										>
											{t("common.cancel")}
										</Btn>
										<Btn type="submit" variant="primary" disabled={savingHandle}>
											{savingHandle ? t("account.saving") : t("common.save")}
										</Btn>
									</div>
								</form>
							</SettingsBlock>
						) : (
							<SettingsRow
								label={t("account.field.handle")}
								sub={t("account.handleSub")}
								control={
									<>
										<span className="rds-mono" style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>
											@{user?.handle || dash}
										</span>
										<Btn
											variant="ghost"
											onClick={() => {
												setHandle(user?.handle ?? "");
												setEditingHandle(true);
											}}
										>
											{t("common.edit")}
										</Btn>
									</>
								}
							/>
						)}

						<SettingsRow
							label={t("account.field.email")}
							sub={t("account.emailReadonly")}
							control={<span style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>{user?.email || dash}</span>}
						/>

						<SettingsRow
							label={t("account.shareEmails")}
							sub={t("account.shareEmailsSub")}
							control={
								<Toggle
									on={user?.preferences?.emailOnRouteShare ?? true}
									disabled={savingSharePref}
									onChange={(next) => void handleToggleShareEmails(next)}
								/>
							}
						/>

						{editingPassword ? (
							<SettingsBlock>
								<div style={{ fontSize: 13, fontWeight: 500, color: RDS_COLORS.fg, marginBottom: 4 }}>
									{user?.hasPassword ? t("account.password.changeTitle") : t("account.password.setTitle")}
								</div>
								<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginBottom: 12 }}>
									{user?.hasPassword ? t("account.password.changeHint") : t("account.password.setHint")}
								</div>
								<form onSubmit={handleSavePassword} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
									{user?.hasPassword && (
										<TextInput
											type="password"
											autoComplete="current-password"
											required
											placeholder={t("account.password.currentPlaceholder")}
											value={currentPassword}
											onChange={(e) => setCurrentPassword(e.target.value)}
										/>
									)}
									<TextInput
										type="password"
										autoComplete="new-password"
										required
										minLength={12}
										placeholder={t("account.password.newPlaceholder")}
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
									/>
									<TextInput
										type="password"
										autoComplete="new-password"
										required
										minLength={12}
										placeholder={t("account.password.confirmPlaceholder")}
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										style={{
											borderColor: confirmPassword && confirmPassword !== newPassword ? RDS_COLORS.danger : undefined,
										}}
									/>
									{passwordError && (
										<div
											style={{
												padding: 10,
												borderRadius: 8,
												background: `color-mix(in oklch, ${RDS_COLORS.danger} 14%, ${RDS_COLORS.bgPanel})`,
												color: RDS_COLORS.fg,
												fontSize: 12.5,
												lineHeight: 1.5,
											}}
										>
											{passwordError}
										</div>
									)}
									<div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 2 }}>
										<Btn variant="ghost" type="button" onClick={handleCancelPassword} disabled={savingPassword}>
											{t("common.cancel")}
										</Btn>
										<Btn
											type="submit"
											variant="primary"
											disabled={savingPassword || newPassword.length < 12 || newPassword !== confirmPassword}
										>
											{savingPassword ? t("account.saving") : t("common.save")}
										</Btn>
									</div>
								</form>
							</SettingsBlock>
						) : (
							<SettingsRow
								label={t("account.field.password")}
								sub={user?.hasPassword ? t("account.password.placeholderDisplay") : t("account.password.notSet")}
								control={
									<Btn
										variant="ghost"
										onClick={() => {
											resetPasswordForm();
											setEditingPassword(true);
										}}
									>
										{user?.hasPassword ? t("settings.security.changePasswordAction") : t("account.password.setAction")}
									</Btn>
								}
							/>
						)}
					</SettingsSection>

					<SettingsSection title={t("account.sessions")}>
						<SettingsRow
							label={t("account.sessions.thisDevice")}
							sub={t("account.sessions.thisDeviceHint")}
							control={
								<Btn variant="ghost" onClick={handleSignOut} disabled={logout.isPending}>
									{logout.isPending ? t("common.signingOut") : t("common.signOut")}
								</Btn>
							}
						/>
						<SettingsRow
							label={t("settings.security.logoutEverywhere")}
							sub={t("settings.security.logoutEverywhereSub")}
							control={
								<Btn variant="ghost" onClick={handleLogoutEverywhere} style={{ color: RDS_COLORS.danger }}>
									{t("settings.security.logoutEverywhereAction")}
								</Btn>
							}
						/>
					</SettingsSection>

					<SettingsSection title={t("account.data")}>
						<SettingsRow
							label={t("settings.account.exportAll")}
							sub={t("settings.account.exportAllSub")}
							control={
								<Btn variant="ghost" onClick={handleExportData}>
									{t("account.data.export")}
								</Btn>
							}
						/>
					</SettingsSection>

					<SettingsSection title={t("account.danger")} danger>
						{confirmingDelete ? (
							<SettingsBlock>
								<div style={{ fontSize: 13, fontWeight: 600, color: RDS_COLORS.fg, marginBottom: 6 }}>
									{t("account.deleteAccount")}
								</div>
								<div style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted, marginBottom: 14, lineHeight: 1.5 }}>
									{t("settings.account.deleteConfirm")}
								</div>
								<div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
									<Btn variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
										{t("common.cancel")}
									</Btn>
									<Btn variant="danger" onClick={handleDeleteAccount} disabled={deleting}>
										{deleting ? t("account.deleting") : t("account.deleteConfirmAction")}
									</Btn>
								</div>
							</SettingsBlock>
						) : (
							<SettingsRow
								label={t("account.deleteAccount")}
								sub={t("account.deleteAccountSub")}
								control={
									<Btn
										variant="ghost"
										onClick={() => setConfirmingDelete(true)}
										disabled={isPendingDeletion}
										style={{ color: RDS_COLORS.danger }}
									>
										{t("common.delete")}
									</Btn>
								}
							/>
						)}
					</SettingsSection>
				</div>
			</div>
		</div>
	);
}
