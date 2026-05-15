import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { apiService } from "@/lib/api";
import { useAuthStatus } from "@/lib/api-queries";
import { emitAppEvent } from "@/lib/app-events";
import { storeUser } from "@/lib/auth-state";
import { t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-client";
import { useToastStore } from "@/stores/toastStore";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

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

function Card({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div
			style={{
				marginTop: 20,
				padding: 20,
				background: RDS_COLORS.bgPanel,
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 12,
			}}
		>
			<SecTitle style={{ marginBottom: 14 }}>{title}</SecTitle>
			{children}
		</div>
	);
}

function Row({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "10px 0",
				borderBottom: last ? "none" : `1px solid ${RDS_COLORS.border}`,
			}}
		>
			<div style={{ fontSize: 13, color: RDS_COLORS.fgMuted, width: 110 }}>{label}</div>
			<div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>{children}</div>
		</div>
	);
}

export function AccountScreen() {
	const { data: auth } = useAuthStatus();
	const user = auth?.user ?? null;
	const pushToast = useToastStore((s) => s.push);
	const queryClient = useQueryClient();

	const [name, setName] = useState(user?.name ?? "");
	const [editingName, setEditingName] = useState(false);
	const [savingName, setSavingName] = useState(false);
	const [avatarUploading, setAvatarUploading] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

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

	const handleChangePassword = async () => {
		const currentPassword = user ? (window.prompt(t("settings.security.currentPasswordPrompt")) ?? "") : "";
		const newPassword = window.prompt(t("settings.security.newPasswordPrompt"));
		if (!newPassword) return;
		try {
			await apiService.setPassword({ newPassword, currentPassword: currentPassword || undefined });
			pushToast({ kind: "success", title: t("settings.security.passwordUpdated") });
		} catch (error) {
			Logger.error("Set password failed", error);
			const message = error instanceof Error ? error.message : t("settings.security.passwordFailed");
			pushToast({ kind: "danger", title: t("settings.security.passwordFailed"), body: message });
		}
	};

	const handleDeleteAccount = async () => {
		if (!window.confirm(t("settings.account.deleteConfirm"))) return;
		setDeleting(true);
		try {
			await apiService.deleteAccount();
			pushToast({ kind: "success", title: t("settings.account.deleteScheduled") });
			emitAppEvent("routess:open-login");
		} catch (error) {
			Logger.error("Delete account failed", error);
			pushToast({ kind: "danger", title: t("settings.account.deleteFailed") });
		} finally {
			setDeleting(false);
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

				<Card title={t("account.title")}>
					<div style={{ display: "flex", alignItems: "center", gap: 16, padding: "4px 0 16px" }}>
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
					</div>

					<Row label={t("account.field.name")}>
						{editingName ? (
							<>
								<input
									value={name}
									onChange={(e) => setName(e.target.value)}
									// biome-ignore lint/a11y/noAutofocus: clicking Edit toggles this row into edit mode; focusing the field is the expected affordance
									autoFocus
									style={{
										flex: 1,
										height: 32,
										padding: "0 10px",
										borderRadius: 6,
										background: RDS_COLORS.bgInput,
										border: `1px solid ${RDS_COLORS.borderStrong}`,
										color: RDS_COLORS.fg,
										fontSize: 13,
										outline: "none",
									}}
								/>
								<Btn variant="primary" onClick={handleSaveName} disabled={savingName}>
									{savingName ? t("account.saving") : t("common.save")}
								</Btn>
								<Btn variant="ghost" onClick={handleCancelName} disabled={savingName}>
									{t("common.cancel")}
								</Btn>
							</>
						) : (
							<>
								<div style={{ flex: 1, fontSize: 13 }}>{user?.name || dash}</div>
								<Btn variant="ghost" onClick={() => setEditingName(true)}>
									{t("common.edit")}
								</Btn>
							</>
						)}
					</Row>

					<Row label={t("account.field.email")}>
						<div style={{ flex: 1, fontSize: 13 }}>{user?.email || dash}</div>
						<span style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{t("account.emailReadonly")}</span>
					</Row>

					<Row label={t("account.field.password")} last>
						<div style={{ flex: 1, fontSize: 13, color: RDS_COLORS.fgMuted }}>
							{t("account.passwordManagedInSettings")}
						</div>
						<Btn variant="ghost" onClick={handleChangePassword}>
							{t("settings.security.changePasswordAction")}
						</Btn>
					</Row>
				</Card>

				<div
					style={{
						marginTop: 24,
						padding: 20,
						border: `1px solid color-mix(in oklch, ${RDS_COLORS.danger} 40%, ${RDS_COLORS.border})`,
						borderRadius: 12,
					}}
				>
					<SecTitle style={{ marginBottom: 12, color: RDS_COLORS.danger }}>{t("account.danger")}</SecTitle>
					<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
						<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
							<div style={{ fontSize: 13, fontWeight: 500 }}>{t("account.deleteAccount")}</div>
							<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted, marginTop: 2 }}>
								{t("account.deleteAccountSub")}
							</div>
						</div>
						<Btn
							onClick={handleDeleteAccount}
							disabled={deleting || isPendingDeletion}
							style={{
								background: "transparent",
								color: RDS_COLORS.danger,
								borderColor: `color-mix(in oklch, ${RDS_COLORS.danger} 40%, ${RDS_COLORS.border})`,
							}}
						>
							{deleting ? t("account.deleting") : t("common.delete")}
						</Btn>
					</div>
				</div>
			</div>
		</div>
	);
}
