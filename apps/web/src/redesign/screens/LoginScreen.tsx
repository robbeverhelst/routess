import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { type CredentialResponse, googleAuth, hasValidGoogleClientId } from "@/lib/google-auth";
import { Logger } from "@/lib/logger";
import { I, RoutessMark } from "../components/icons";
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

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 24,
				background: RDS_COLORS.bgCanvas,
			}}
		>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: `radial-gradient(circle at 30% 40%, oklch(0.92 0.04 230) 0%, transparent 30%),
				             radial-gradient(circle at 70% 60%, oklch(0.94 0.03 145) 0%, transparent 35%),
				             radial-gradient(circle at 20% 80%, oklch(0.93 0.05 225) 0%, transparent 30%),
				             oklch(0.96 0.01 240)`,
					opacity: 0.6,
				}}
			/>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: `color-mix(in oklch, ${RDS_COLORS.bgCanvas} 80%, transparent)`,
					backdropFilter: "blur(8px)",
				}}
			/>

			<div
				style={{
					position: "relative",
					width: 380,
					maxWidth: "100%",
					padding: 36,
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 16,
					boxShadow: "var(--rds-shadow-lg)",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						color: RDS_COLORS.accent,
						marginBottom: 24,
					}}
				>
					<RoutessMark size={26} />
					<span
						style={{
							fontSize: 18,
							fontWeight: 600,
							color: RDS_COLORS.fg,
							letterSpacing: -0.2,
						}}
					>
						Routess
					</span>
				</div>

				<h1
					style={{
						fontSize: 24,
						fontWeight: 600,
						margin: 0,
						letterSpacing: -0.4,
						lineHeight: 1.15,
					}}
				>
					Plan a route.{" "}
					<span className="rds-serif" style={{ color: RDS_COLORS.accent }}>
						Anywhere.
					</span>
				</h1>
				<p
					style={{
						fontSize: 13.5,
						color: RDS_COLORS.fgMuted,
						marginTop: 10,
						lineHeight: 1.5,
					}}
				>
					Sign in to save routes, sync across devices, and pick up where you left off.
				</p>

				<div style={{ marginTop: 24, minHeight: 42 }}>
					{oauthConfigured ? (
						<GoogleLogin
							onSuccess={handleSuccess}
							onError={() => {
								googleAuth.handleGoogleError();
								pushToast({ kind: "danger", title: "Sign in cancelled" });
							}}
							useOneTap
							auto_select={false}
							theme="outline"
							size="large"
							width="100%"
							text="continue_with"
						/>
					) : (
						<div
							style={{
								padding: 14,
								borderRadius: 10,
								background: "color-mix(in oklch, var(--rds-warn) 12%, transparent)",
								border: `1px solid color-mix(in oklch, ${RDS_COLORS.warn} 35%, ${RDS_COLORS.border})`,
								color: RDS_COLORS.fg,
								fontSize: 12.5,
								lineHeight: 1.5,
							}}
						>
							<div style={{ fontWeight: 600, color: RDS_COLORS.warn, marginBottom: 6 }}>
								Google sign-in not configured
							</div>
							<div style={{ color: RDS_COLORS.fgMuted }}>
								Set <code className="rds-mono">VITE_GOOGLE_CLIENT_ID</code> in <code className="rds-mono">.env</code> to
								a real OAuth Web Client ID, then restart <code className="rds-mono">bun dev</code>. Use “Continue
								without an account” for now.
							</div>
						</div>
					)}
				</div>

				<Btn disabled style={{ width: "100%", height: 42, marginTop: 8 }}>
					Continue with email
				</Btn>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						margin: "20px 0",
					}}
				>
					<div style={{ flex: 1, height: 1, background: RDS_COLORS.border }} />
					<span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>or</span>
					<div style={{ flex: 1, height: 1, background: RDS_COLORS.border }} />
				</div>

				<Btn variant="ghost" onClick={onSuccess} style={{ width: "100%", color: RDS_COLORS.fgMuted }}>
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
						<span>Signing in…</span>
					</div>
				)}

				<div
					style={{
						fontSize: 11,
						color: RDS_COLORS.fgSubtle,
						marginTop: 24,
						textAlign: "center",
						lineHeight: 1.5,
					}}
				>
					By continuing, you agree to our{" "}
					<a href="/terms" style={{ color: RDS_COLORS.fgMuted }}>
						Terms
					</a>{" "}
					&{" "}
					<a href="/privacy" style={{ color: RDS_COLORS.fgMuted }}>
						Privacy
					</a>
					. <I.compass size={10} style={{ verticalAlign: "middle" }} />
				</div>
			</div>
		</div>
	);
}
