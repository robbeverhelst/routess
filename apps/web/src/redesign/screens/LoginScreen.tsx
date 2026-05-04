import { useState } from "react";
import { type CredentialResponse, googleAuth, hasValidGoogleClientId } from "@/lib/google-auth";
import { Logger } from "@/lib/logger";
import {
	AUTH_CARD_STYLE,
	AuthBackdrop,
	AuthCardAccentBar,
	AuthLayout,
	CustomGoogleButton,
} from "../components/auth-shared";
import { I } from "../components/icons";
import { Btn, RDS_COLORS } from "../components/primitives";
import { useToastStore } from "../stores/toastStore";

export function LoginScreen({ onSuccess }: { onSuccess?: () => void }) {
	const [isLoading, setIsLoading] = useState(false);
	const pushToast = useToastStore((s) => s.push);
	const oauthConfigured = hasValidGoogleClientId();

	const handleSuccess = async (cred: CredentialResponse) => {
		setIsLoading(true);
		try {
			const user = await googleAuth.handleGoogleSuccess(cred);
			Logger.info("Google login success", { email: user.email });
			pushToast({ kind: "success", title: "Welcome back", body: user.name ?? user.email });
			onSuccess?.();
		} catch (error) {
			Logger.error("Google login failed", error);
			pushToast({ kind: "danger", title: "Sign in failed", body: "Try again or use email." });
		} finally {
			setIsLoading(false);
		}
	};

	const handleError = () => {
		googleAuth.handleGoogleError();
		pushToast({ kind: "danger", title: "Sign in cancelled" });
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
							marginBottom: 28,
						}}
					>
						<img
							src="/logo.png"
							alt="routess"
							width={32}
							height={32}
							style={{ borderRadius: 8, display: "block", flexShrink: 0 }}
						/>
						<span
							style={{
								fontSize: 17,
								fontWeight: 600,
								color: RDS_COLORS.fg,
								letterSpacing: -0.2,
							}}
						>
							routess
						</span>
					</div>

					<h1
						style={{
							fontSize: 26,
							fontWeight: 600,
							margin: 0,
							letterSpacing: -0.5,
							lineHeight: 1.15,
						}}
					>
						Welcome back.
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
						Sign in to save routes and sync across devices.
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
									Google sign-in not configured
								</div>
								<div style={{ color: RDS_COLORS.fgMuted }}>
									Set <code className="rds-mono">VITE_GOOGLE_CLIENT_ID</code> in <code className="rds-mono">.env</code>,
									then restart <code className="rds-mono">bun dev</code>.
								</div>
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
							or
						</span>
						<div style={{ flex: 1, height: 1, background: RDS_COLORS.border }} />
					</div>

					<Btn
						variant="default"
						onClick={onSuccess}
						style={{
							width: "100%",
							height: 44,
							color: RDS_COLORS.fg,
							borderColor: RDS_COLORS.borderStrong,
						}}
					>
						Continue without an account
					</Btn>

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
							<span>Signing in...</span>
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
						By continuing, you agree to our{" "}
						<a href="/terms" style={{ color: RDS_COLORS.fgMuted, fontWeight: 500 }}>
							Terms
						</a>{" "}
						&{" "}
						<a href="/privacy" style={{ color: RDS_COLORS.fgMuted, fontWeight: 500 }}>
							Privacy
						</a>
						.
					</div>
				</div>
			</AuthLayout>
		</AuthBackdrop>
	);
}
