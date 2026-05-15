import { useState } from "react";
import { trackEvent } from "@/lib/analytics/track";
import { apiService } from "@/lib/api";
import { emitAppEvent } from "@/lib/app-events";
import { notifyAuthStateChange, storeUser } from "@/lib/auth-state";
import { type GoogleCodeResponse, googleAuth, hasValidGoogleClientId } from "@/lib/google-auth";
import { useT } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { useToastStore } from "@/stores/toastStore";
import {
	AUTH_CARD_STYLE,
	AuthBackdrop,
	AuthCardAccentBar,
	AuthLayout,
	CustomGoogleButton,
} from "../components/auth-shared";
import { I } from "../components/icons";
import { Btn, RDS_COLORS } from "../components/primitives";

type EmailMode = "signin" | "forgot";

export function LoginScreen({ onSuccess }: { onSuccess?: () => void }) {
	const [isLoading, setIsLoading] = useState(false);
	const [emailMode, setEmailMode] = useState<EmailMode | null>(null);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [postSubmitMessage, setPostSubmitMessage] = useState<string | null>(null);
	const pushToast = useToastStore((s) => s.push);
	const t = useT();
	const oauthConfigured = hasValidGoogleClientId();

	const resetEmailForm = () => {
		setEmail("");
		setPassword("");
		setPostSubmitMessage(null);
	};

	const handleSuccess = async (response: GoogleCodeResponse) => {
		setIsLoading(true);
		try {
			const user = await googleAuth.handleGoogleSuccess(response);
			Logger.info("Google login success", { email: user.email });
			trackEvent({ name: "user_logged_in", properties: { provider: "google" } });
			pushToast({ kind: "success", title: t("login.toast.welcomeBack"), body: user.name ?? user.email });
			onSuccess?.();
		} catch (error) {
			Logger.error("Google login failed", error);
			pushToast({ kind: "danger", title: t("login.toast.failed"), body: t("login.toast.failedSub") });
		} finally {
			setIsLoading(false);
		}
	};

	const handleError = () => {
		googleAuth.handleGoogleError();
		pushToast({ kind: "danger", title: t("login.toast.cancelled") });
	};

	const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!emailMode) return;
		setSubmitting(true);
		try {
			if (emailMode === "signin") {
				const result = await apiService.loginEmail(email.trim(), password);
				storeUser(result.user);
				notifyAuthStateChange();
				pushToast({ kind: "success", title: t("login.toast.welcomeBack"), body: result.user.email });
				onSuccess?.();
			} else {
				await apiService.requestPasswordReset(email.trim());
				setPostSubmitMessage(t("login.email.resetSent"));
			}
		} catch (error) {
			Logger.error("Email auth failed", error);
			const body = error instanceof Error ? error.message : t("login.email.genericError");
			pushToast({ kind: "danger", title: t("login.email.failed"), body });
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AuthBackdrop>
			<AuthLayout>
				<div style={{ ...AUTH_CARD_STYLE, width: "100%", padding: "36px 32px 28px" }}>
					<AuthCardAccentBar />

					<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
						<img
							src="/logo.png"
							alt="routess"
							width={32}
							height={32}
							style={{ borderRadius: 8, display: "block", flexShrink: 0 }}
						/>
						<span style={{ fontSize: 17, fontWeight: 600, color: RDS_COLORS.fg, letterSpacing: -0.2 }}>routess</span>
					</div>

					<h1 style={{ fontSize: 26, fontWeight: 600, margin: 0, letterSpacing: -0.5, lineHeight: 1.15 }}>
						{t("login.welcomeBack")}
					</h1>
					<p
						style={{
							fontSize: 14,
							color: RDS_COLORS.fgMuted,
							marginTop: 8,
							marginBottom: 28,
							lineHeight: 1.5,
						}}
					>
						{t("login.subtitle")}
					</p>

					<div style={{ minHeight: 46 }}>
						{oauthConfigured ? (
							<CustomGoogleButton onSuccess={handleSuccess} onError={handleError} isLoading={isLoading} />
						) : (
							<div
								style={{
									padding: 12,
									borderRadius: 10,
									background: `color-mix(in oklch, ${RDS_COLORS.warn} 14%, ${RDS_COLORS.bgPanel})`,
									border: `1px solid color-mix(in oklch, ${RDS_COLORS.warn} 50%, ${RDS_COLORS.border})`,
									color: RDS_COLORS.fg,
									fontSize: 12.5,
									lineHeight: 1.5,
								}}
							>
								<div style={{ fontWeight: 600, color: RDS_COLORS.warn, marginBottom: 4 }}>
									{t("login.googleNotConfigured")}
								</div>
								<div style={{ color: RDS_COLORS.fgMuted }}>{t("login.googleNotConfiguredHint")}</div>
							</div>
						)}
					</div>

					<div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
						<div style={{ flex: 1, height: 1, background: RDS_COLORS.border }} />
						<span
							style={{
								fontSize: 11,
								color: RDS_COLORS.fgSubtle,
								textTransform: "uppercase",
								letterSpacing: 0.6,
							}}
						>
							{t("common.or")}
						</span>
						<div style={{ flex: 1, height: 1, background: RDS_COLORS.border }} />
					</div>

					{!emailMode && (
						<Btn
							variant="default"
							onClick={() => {
								resetEmailForm();
								setEmailMode("signin");
							}}
							style={{ width: "100%", height: 40 }}
						>
							<I.user size={14} /> {t("login.email.signInWithEmail")}
						</Btn>
					)}

					{emailMode && (
						<form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
							<input
								type="email"
								autoComplete="email"
								required
								placeholder={t("login.email.emailPlaceholder")}
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								style={{
									height: 40,
									padding: "0 12px",
									borderRadius: 8,
									background: RDS_COLORS.bgInput,
									border: `1px solid ${RDS_COLORS.border}`,
									color: RDS_COLORS.fg,
									fontSize: 13.5,
									outline: "none",
								}}
							/>
							{emailMode === "signin" && (
								<input
									type="password"
									autoComplete="current-password"
									required
									placeholder={t("login.email.passwordPlaceholder")}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									style={{
										height: 40,
										padding: "0 12px",
										borderRadius: 8,
										background: RDS_COLORS.bgInput,
										border: `1px solid ${RDS_COLORS.border}`,
										color: RDS_COLORS.fg,
										fontSize: 13.5,
										outline: "none",
									}}
								/>
							)}
							{postSubmitMessage ? (
								<div
									style={{
										padding: 10,
										borderRadius: 8,
										background: RDS_COLORS.bgInput,
										color: RDS_COLORS.fgMuted,
										fontSize: 12.5,
										lineHeight: 1.5,
									}}
								>
									{postSubmitMessage}
								</div>
							) : (
								<Btn type="submit" variant="primary" disabled={submitting} style={{ width: "100%", height: 40 }}>
									{submitting
										? t("login.email.submitting")
										: emailMode === "signin"
											? t("login.email.signIn")
											: t("login.email.sendReset")}
								</Btn>
							)}
							<div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
								<button
									type="button"
									onClick={() => {
										resetEmailForm();
										setEmailMode(null);
									}}
									style={{
										background: "transparent",
										border: "none",
										color: RDS_COLORS.fgMuted,
										cursor: "pointer",
										padding: 0,
									}}
								>
									{t("common.cancel")}
								</button>
								<button
									type="button"
									onClick={() => {
										resetEmailForm();
										setEmailMode(emailMode === "forgot" ? "signin" : "forgot");
									}}
									style={{
										background: "transparent",
										border: "none",
										color: RDS_COLORS.fgMuted,
										cursor: "pointer",
										padding: 0,
									}}
								>
									{emailMode === "forgot" ? t("login.email.backToSignIn") : t("login.email.forgotPassword")}
								</button>
							</div>
						</form>
					)}

					<div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
						<div style={{ flex: 1, height: 1, background: RDS_COLORS.border }} />
						<span
							style={{
								fontSize: 11,
								color: RDS_COLORS.fgSubtle,
								textTransform: "uppercase",
								letterSpacing: 0.6,
							}}
						>
							{t("common.or")}
						</span>
						<div style={{ flex: 1, height: 1, background: RDS_COLORS.border }} />
					</div>

					<Btn
						variant="default"
						onClick={onSuccess}
						style={{ width: "100%", height: 40, color: RDS_COLORS.fg, borderColor: RDS_COLORS.borderStrong }}
					>
						{t("login.continueGuest")}
					</Btn>

					<div
						style={{
							textAlign: "center",
							marginTop: 16,
							fontSize: 12.5,
							color: RDS_COLORS.fgMuted,
						}}
					>
						{t("login.noAccount")}{" "}
						<button
							type="button"
							onClick={() => emitAppEvent("routess:open-signup")}
							style={{
								background: "transparent",
								border: 0,
								color: RDS_COLORS.accent,
								fontWeight: 600,
								cursor: "pointer",
								padding: 0,
								font: "inherit",
							}}
						>
							{t("login.createAccount")}
						</button>
					</div>

					{isLoading && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 8,
								marginTop: 16,
								fontSize: 12,
								color: RDS_COLORS.fgMuted,
							}}
						>
							<div
								style={{
									width: 14,
									height: 14,
									borderRadius: 999,
									border: `2px solid ${RDS_COLORS.border}`,
									borderTopColor: RDS_COLORS.accent,
									animation: "rds-pulse 1s linear infinite",
								}}
							/>
							<span>{t("common.signingIn")}</span>
						</div>
					)}

					<div
						style={{
							fontSize: 11.5,
							color: RDS_COLORS.fgSubtle,
							marginTop: 24,
							paddingTop: 20,
							borderTop: `1px solid ${RDS_COLORS.border}`,
							textAlign: "center",
							lineHeight: 1.5,
						}}
					>
						<I.compass size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
						{t("login.legal")}{" "}
						<a href="/terms" style={{ color: RDS_COLORS.fgMuted, fontWeight: 500 }}>
							{t("login.terms")}
						</a>{" "}
						&{" "}
						<a href="/privacy" style={{ color: RDS_COLORS.fgMuted, fontWeight: 500 }}>
							{t("login.privacy")}
						</a>
						.
					</div>
				</div>
			</AuthLayout>
		</AuthBackdrop>
	);
}
