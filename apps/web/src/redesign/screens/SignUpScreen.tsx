import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { type CredentialResponse, googleAuth, hasValidGoogleClientId } from "@/lib/google-auth";
import { Logger } from "@/lib/logger";
import { RoutessMark } from "../components/icons";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";
import { useToastStore } from "../stores/toastStore";

function passwordStrength(p: string): number {
	let score = 0;
	if (p.length >= 8) score++;
	if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
	if (/\d/.test(p)) score++;
	if (/[^A-Za-z0-9]/.test(p)) score++;
	return score;
}

export function SignUpScreen({ onSwitchToLogin }: { onSwitchToLogin?: () => void }) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const pushToast = useToastStore((s) => s.push);
	const oauthConfigured = hasValidGoogleClientId();

	const strength = passwordStrength(password);
	const strengthLabel = ["Weak", "Weak", "OK", "Strong", "Very strong"][strength];

	const handleGoogle = async (cred: CredentialResponse) => {
		try {
			await googleAuth.handleGoogleSuccess(cred);
			pushToast({ kind: "success", title: "Account created", body: "Welcome to Routess." });
		} catch (e) {
			Logger.error(e);
			pushToast({ kind: "danger", title: "Sign up failed" });
		}
	};

	const handleEmailSignup = () => {
		pushToast({
			kind: "info",
			title: "Email signup coming soon",
			body: "Use Google for now — same account, no password.",
		});
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
					position: "relative",
					width: 400,
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
						marginBottom: 20,
					}}
				>
					<RoutessMark size={24} />
					<span style={{ fontSize: 17, fontWeight: 600, color: RDS_COLORS.fg }}>Routess</span>
				</div>
				<h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: -0.4 }}>Create account</h1>
				<p style={{ fontSize: 13, color: RDS_COLORS.fgMuted, marginTop: 8 }}>Free forever. Up to 50 saved routes.</p>

				<div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
					<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						<SecTitle>Name</SecTitle>
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Robbe Verhelst"
							style={{
								height: 36,
								padding: "0 12px",
								borderRadius: 8,
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								color: RDS_COLORS.fg,
								fontSize: 13.5,
								outline: "none",
							}}
						/>
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						<SecTitle>Email</SecTitle>
						<input
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							style={{
								height: 36,
								padding: "0 12px",
								borderRadius: 8,
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								color: RDS_COLORS.fg,
								fontSize: 13.5,
								outline: "none",
							}}
						/>
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						<SecTitle>Password</SecTitle>
						<input
							value={password}
							type="password"
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							style={{
								height: 36,
								padding: "0 12px",
								borderRadius: 8,
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								color: RDS_COLORS.fg,
								fontSize: 13.5,
								outline: "none",
							}}
						/>
						<div style={{ display: "flex", gap: 4 }}>
							{[0, 1, 2, 3].map((i) => (
								<div
									key={i}
									style={{
										flex: 1,
										height: 3,
										borderRadius: 999,
										background:
											i < strength
												? strength >= 3
													? RDS_COLORS.success
													: strength === 2
														? RDS_COLORS.warn
														: RDS_COLORS.danger
												: RDS_COLORS.border,
									}}
								/>
							))}
						</div>
						<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>
							{password ? `${strengthLabel} · 8+ chars, mixed case` : "8+ chars, mixed case"}
						</div>
					</div>
				</div>

				<Btn
					variant="primary"
					onClick={handleEmailSignup}
					disabled={!name || !email || strength < 2}
					style={{ width: "100%", marginTop: 24, height: 42 }}
				>
					Create account
				</Btn>

				<div style={{ marginTop: 8 }}>
					{oauthConfigured ? (
						<GoogleLogin
							onSuccess={handleGoogle}
							onError={() => pushToast({ kind: "danger", title: "Sign up cancelled" })}
							theme="outline"
							size="large"
							width="100%"
							text="signup_with"
						/>
					) : (
						<div
							style={{
								padding: 12,
								borderRadius: 8,
								background: "color-mix(in oklch, var(--rds-warn) 12%, transparent)",
								border: `1px solid color-mix(in oklch, ${RDS_COLORS.warn} 35%, ${RDS_COLORS.border})`,
								fontSize: 12,
								color: RDS_COLORS.fgMuted,
							}}
						>
							<span style={{ fontWeight: 600, color: RDS_COLORS.warn }}>Google sign-up disabled.</span> Set{" "}
							<code className="rds-mono">VITE_GOOGLE_CLIENT_ID</code> in <code className="rds-mono">.env</code>.
						</div>
					)}
				</div>

				<div
					style={{
						fontSize: 12,
						color: RDS_COLORS.fgMuted,
						marginTop: 18,
						textAlign: "center",
					}}
				>
					Already have an account?{" "}
					<button
						type="button"
						onClick={onSwitchToLogin}
						style={{
							color: RDS_COLORS.accent,
							fontWeight: 500,
							background: "transparent",
							border: 0,
							cursor: "pointer",
							padding: 0,
							font: "inherit",
						}}
					>
						Sign in
					</button>
				</div>
			</div>
		</div>
	);
}
