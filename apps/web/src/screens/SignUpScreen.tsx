import { useState } from "react";
import { trackEvent } from "@/lib/analytics/track";
import { apiService } from "@/lib/api";
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
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

// Server enforces 12-char minimum and a HIBP breach check; the client mirrors
// the length rule so the button doesn't enable on input that the server will
// reject. Composition is purely a visual cue, not a gate (NIST 800-63B).
const PASSWORD_MIN_LENGTH = 12;

function passwordStrength(p: string): number {
	let score = 0;
	if (p.length >= PASSWORD_MIN_LENGTH) score++;
	if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
	if (/\d/.test(p)) score++;
	if (/[^A-Za-z0-9]/.test(p)) score++;
	return score;
}

const STRENGTH_KEYS = [
	"signup.strength.weak",
	"signup.strength.weak",
	"signup.strength.ok",
	"signup.strength.strong",
	"signup.strength.veryStrong",
];

export function SignUpScreen({ onSwitchToLogin }: { onSwitchToLogin?: () => void }) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const pushToast = useToastStore((s) => s.push);
	const t = useT();
	const oauthConfigured = hasValidGoogleClientId();

	const strength = passwordStrength(password);
	const strengthLabel = t(STRENGTH_KEYS[strength]);
	const strengthColor = strength >= 3 ? RDS_COLORS.success : strength === 2 ? RDS_COLORS.warn : RDS_COLORS.danger;
	const isLongEnough = password.length >= PASSWORD_MIN_LENGTH;
	const passwordsMatch = confirm.length > 0 && password === confirm;
	const showMismatch = confirm.length > 0 && !passwordsMatch;
	const canSubmit = Boolean(email) && isLongEnough && passwordsMatch && !isLoading;

	const handleGoogle = async (response: GoogleCodeResponse) => {
		setIsLoading(true);
		try {
			const { user, isNewUser } = await googleAuth.handleGoogleSuccess(response);
			if (isNewUser) {
				trackEvent({ name: "user_registered", properties: { provider: "google" } });
			}
			trackEvent({ name: "user_logged_in", properties: { provider: "google" } });
			pushToast({ kind: "success", title: t("signup.toast.created"), body: user.name ?? user.email });
		} catch (e) {
			Logger.error(e);
			pushToast({ kind: "danger", title: t("signup.toast.failed") });
		} finally {
			setIsLoading(false);
		}
	};

	const [emailSent, setEmailSent] = useState(false);

	const handleEmailSignup = async () => {
		if (!canSubmit) return;
		setIsLoading(true);
		try {
			await apiService.signupEmail({ email: email.trim(), name: name.trim() || undefined, password });
			setEmailSent(true);
			pushToast({ kind: "success", title: t("login.email.signupSent") });
		} catch (error) {
			Logger.error("signupEmail failed", error);
			const body = error instanceof Error ? error.message : t("login.email.genericError");
			pushToast({ kind: "danger", title: t("login.email.failed"), body });
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<AuthBackdrop>
			<AuthLayout>
				<div
					style={{
						...AUTH_CARD_STYLE,
						width: "100%",
						padding: "36px 32px 28px",
					}}
				>
					<AuthCardAccentBar />

					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
							marginBottom: 24,
						}}
					>
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
						{t("signup.title")}
					</h1>
					<p style={{ fontSize: 14, color: RDS_COLORS.fgMuted, marginTop: 8, marginBottom: 24, lineHeight: 1.5 }}>
						{t("signup.subtitle")}
					</p>

					<div style={{ minHeight: 46 }}>
						{oauthConfigured ? (
							<CustomGoogleButton
								onSuccess={handleGoogle}
								onError={() => pushToast({ kind: "danger", title: t("signup.toast.cancelled") })}
								isLoading={isLoading}
								text="signup_with"
							/>
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
									{t("signup.googleNotConfigured")}
								</div>
								<div style={{ color: RDS_COLORS.fgMuted }}>{t("signup.googleNotConfiguredHint")}</div>
							</div>
						)}
					</div>

					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
							margin: "20px 0",
						}}
					>
						<div style={{ flex: 1, height: 1, background: RDS_COLORS.border }} />
						<span
							style={{
								fontSize: 11,
								color: RDS_COLORS.fgSubtle,
								textTransform: "uppercase",
								letterSpacing: 0.6,
							}}
						>
							{t("signup.orWithEmail")}
						</span>
						<div style={{ flex: 1, height: 1, background: RDS_COLORS.border }} />
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
						<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
							<SecTitle>{t("signup.name")}</SecTitle>
							<input
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder={t("signup.namePlaceholder")}
								style={{
									height: 40,
									padding: "0 12px",
									borderRadius: 8,
									background: RDS_COLORS.bgInput,
									border: `1px solid ${RDS_COLORS.borderStrong}`,
									color: RDS_COLORS.fg,
									fontSize: 13.5,
									outline: "none",
								}}
							/>
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
							<SecTitle>{t("signup.email")}</SecTitle>
							<input
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder={t("signup.emailPlaceholder")}
								style={{
									height: 40,
									padding: "0 12px",
									borderRadius: 8,
									background: RDS_COLORS.bgInput,
									border: `1px solid ${RDS_COLORS.borderStrong}`,
									color: RDS_COLORS.fg,
									fontSize: 13.5,
									outline: "none",
								}}
							/>
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
							<SecTitle>{t("signup.password")}</SecTitle>
							<input
								value={password}
								type="password"
								autoComplete="new-password"
								onChange={(e) => setPassword(e.target.value)}
								style={{
									height: 40,
									padding: "0 12px",
									borderRadius: 8,
									background: RDS_COLORS.bgInput,
									border: `1px solid ${RDS_COLORS.borderStrong}`,
									color: RDS_COLORS.fg,
									fontSize: 13.5,
									outline: "none",
								}}
							/>
							<div style={{ display: "flex", gap: 4, marginTop: 2 }}>
								{[0, 1, 2, 3].map((i) => (
									<div
										key={i}
										style={{
											flex: 1,
											height: 3,
											borderRadius: 999,
											background: i < strength ? strengthColor : RDS_COLORS.border,
											transition: "background 120ms",
										}}
									/>
								))}
							</div>
							<div
								style={{
									fontSize: 11,
									color: !password ? RDS_COLORS.fgSubtle : isLongEnough ? RDS_COLORS.fgMuted : RDS_COLORS.warn,
								}}
							>
								{!password
									? t("signup.passwordHint", { min: String(PASSWORD_MIN_LENGTH) })
									: !isLongEnough
										? t("signup.passwordTooShort", {
												count: String(PASSWORD_MIN_LENGTH - password.length),
												min: String(PASSWORD_MIN_LENGTH),
											})
										: t("signup.passwordHintWith", { label: strengthLabel })}
							</div>
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
							<SecTitle>{t("signup.confirmPassword")}</SecTitle>
							<input
								value={confirm}
								type="password"
								autoComplete="new-password"
								onChange={(e) => setConfirm(e.target.value)}
								style={{
									height: 40,
									padding: "0 12px",
									borderRadius: 8,
									background: RDS_COLORS.bgInput,
									border: `1px solid ${showMismatch ? RDS_COLORS.danger : RDS_COLORS.borderStrong}`,
									color: RDS_COLORS.fg,
									fontSize: 13.5,
									outline: "none",
								}}
							/>
							{showMismatch && (
								<div style={{ fontSize: 11, color: RDS_COLORS.danger }}>{t("signup.passwordMismatch")}</div>
							)}
						</div>
					</div>

					{emailSent ? (
						<div
							style={{
								padding: 12,
								borderRadius: 10,
								marginTop: 20,
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								color: RDS_COLORS.fgMuted,
								fontSize: 13,
								lineHeight: 1.5,
							}}
						>
							{t("login.email.signupSent")}
						</div>
					) : (
						<Btn
							variant={canSubmit ? "primary" : "default"}
							onClick={handleEmailSignup}
							disabled={!canSubmit}
							style={{ width: "100%", marginTop: 20, height: 44 }}
						>
							{isLoading ? t("login.email.submitting") : t("login.email.createAccount")}
						</Btn>
					)}

					<div
						style={{
							fontSize: 12.5,
							color: RDS_COLORS.fgMuted,
							marginTop: 24,
							paddingTop: 20,
							borderTop: `1px solid ${RDS_COLORS.border}`,
							textAlign: "center",
						}}
					>
						{t("signup.haveAccount")}{" "}
						<button
							type="button"
							onClick={onSwitchToLogin}
							style={{
								color: RDS_COLORS.accent,
								fontWeight: 600,
								background: "transparent",
								border: 0,
								cursor: "pointer",
								padding: 0,
								font: "inherit",
							}}
						>
							{t("common.signIn")}
						</button>
					</div>
				</div>
			</AuthLayout>
		</AuthBackdrop>
	);
}
