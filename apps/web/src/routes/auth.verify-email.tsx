import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AUTH_CARD_STYLE, AuthBackdrop, AuthCardAccentBar, AuthLayout } from "@/components/auth-shared";
import { Btn, RDS_COLORS } from "@/components/primitives";
import { apiService } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { useToastStore } from "@/stores/toastStore";

type VerifyState = "verifying" | "success" | "error";

export const Route = createFileRoute("/auth/verify-email")({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : "",
	}),
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	const { token } = Route.useSearch();
	const navigate = useNavigate();
	const t = useT();
	const pushToast = useToastStore((s) => s.push);
	const [state, setState] = useState<VerifyState>("verifying");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	// React 18 StrictMode mounts → unmounts → mounts in dev, so a naive
	// useEffect would POST verify-email twice in quick succession and race
	// past the "no existing user" check. Track the token we've already kicked
	// off a request for so we fire exactly once per token.
	const startedForToken = useRef<string | null>(null);

	useEffect(() => {
		if (!token) {
			setState("error");
			setErrorMessage(t("auth.verifyEmail.missingToken"));
			return;
		}
		if (startedForToken.current === token) return;
		startedForToken.current = token;
		void (async () => {
			try {
				const result = await apiService.verifyEmail(token);
				setState("success");
				pushToast({ kind: "success", title: t("auth.verifyEmail.success"), body: result.user.email });
				setTimeout(() => navigate({ to: "/" }), 1200);
			} catch (error) {
				Logger.error("verifyEmail failed", error);
				setState("error");
				setErrorMessage(error instanceof Error ? error.message : t("auth.verifyEmail.failed"));
			}
		})();
	}, [token, navigate, pushToast, t]);

	return (
		<AuthBackdrop>
			<AuthLayout>
				<div style={{ ...AUTH_CARD_STYLE, width: "100%", padding: "36px 32px 28px" }}>
					<AuthCardAccentBar />
					<h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, marginBottom: 12 }}>
						{state === "success" ? t("auth.verifyEmail.successTitle") : t("auth.verifyEmail.title")}
					</h1>
					<p style={{ fontSize: 14, color: RDS_COLORS.fgMuted, marginTop: 0, marginBottom: 24, lineHeight: 1.5 }}>
						{state === "verifying" && t("auth.verifyEmail.verifying")}
						{state === "success" && t("auth.verifyEmail.successBody")}
						{state === "error" && (errorMessage ?? t("auth.verifyEmail.failed"))}
					</p>
					{state === "error" && (
						<Btn variant="primary" onClick={() => navigate({ to: "/" })} style={{ width: "100%", height: 40 }}>
							{t("auth.verifyEmail.backToApp")}
						</Btn>
					)}
				</div>
			</AuthLayout>
		</AuthBackdrop>
	);
}
