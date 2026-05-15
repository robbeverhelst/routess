import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AUTH_CARD_STYLE, AuthBackdrop, AuthCardAccentBar, AuthLayout } from "@/components/auth-shared";
import { Btn, RDS_COLORS } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { useToastStore } from "@/stores/toastStore";

export const Route = createFileRoute("/auth/reset-password")({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : "",
	}),
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const { token } = Route.useSearch();
	const navigate = useNavigate();
	const t = useT();
	const pushToast = useToastStore((s) => s.push);
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [done, setDone] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage(null);
		if (!token) {
			setErrorMessage(t("auth.resetPassword.missingToken"));
			return;
		}
		if (password !== confirm) {
			setErrorMessage(t("auth.resetPassword.mismatch"));
			return;
		}
		setSubmitting(true);
		try {
			await apiService.resetPassword(token, password);
			setDone(true);
			pushToast({ kind: "success", title: t("auth.resetPassword.success") });
			setTimeout(() => navigate({ to: "/" }), 1500);
		} catch (error) {
			Logger.error("resetPassword failed", error);
			setErrorMessage(error instanceof Error ? error.message : t("auth.resetPassword.failed"));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AuthBackdrop>
			<AuthLayout>
				<div style={{ ...AUTH_CARD_STYLE, width: "100%", padding: "36px 32px 28px" }}>
					<AuthCardAccentBar />
					<h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, marginBottom: 12 }}>
						{t("auth.resetPassword.title")}
					</h1>
					<p style={{ fontSize: 14, color: RDS_COLORS.fgMuted, marginTop: 0, marginBottom: 20, lineHeight: 1.5 }}>
						{done ? t("auth.resetPassword.successBody") : t("auth.resetPassword.body")}
					</p>
					{!done && (
						<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
							<input
								type="password"
								autoComplete="new-password"
								required
								minLength={12}
								maxLength={128}
								placeholder={t("auth.resetPassword.newPassword")}
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
							<input
								type="password"
								autoComplete="new-password"
								required
								minLength={12}
								maxLength={128}
								placeholder={t("auth.resetPassword.confirm")}
								value={confirm}
								onChange={(e) => setConfirm(e.target.value)}
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
							{errorMessage && (
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
									{errorMessage}
								</div>
							)}
							<Btn type="submit" variant="primary" disabled={submitting} style={{ width: "100%", height: 40 }}>
								{submitting ? t("auth.resetPassword.submitting") : t("auth.resetPassword.submit")}
							</Btn>
						</form>
					)}
				</div>
			</AuthLayout>
		</AuthBackdrop>
	);
}
