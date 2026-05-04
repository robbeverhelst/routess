import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type CredentialResponse, googleAuth } from "../../lib/google-auth";
import type { SupportedLanguage } from "../../lib/i18n";
import { t } from "../../lib/i18n";
import { Logger } from "../../lib/logger";

interface LoginModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onLoginSuccess: () => void;
	currentLanguage: SupportedLanguage;
}

function GoogleIcon({ size = 18 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
			<title>Google</title>
			<path
				fill="#4285F4"
				d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
			/>
			<path
				fill="#34A853"
				d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
			/>
			<path
				fill="#FBBC05"
				d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.04l3.007-2.333z"
			/>
			<path
				fill="#EA4335"
				d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
			/>
		</svg>
	);
}

export function LoginModal({ isOpen, onOpenChange, onLoginSuccess, currentLanguage }: LoginModalProps) {
	const [isLoading, setIsLoading] = useState(false);

	const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
		setIsLoading(true);

		try {
			Logger.info("Processing Google login...");

			// Process the Google credential
			const user = await googleAuth.handleGoogleSuccess(credentialResponse);

			Logger.info("Google login successful:", { email: user.email, name: user.name });

			// Close modal and trigger success callback
			onOpenChange(false);
			onLoginSuccess();
		} catch (error) {
			Logger.error("Google login failed:", error);
			// You can add error handling UI here if needed
		} finally {
			setIsLoading(false);
		}
	};

	const handleGoogleError = () => {
		setIsLoading(false);
		try {
			googleAuth.handleGoogleError();
		} catch (error) {
			Logger.error("Google login error:", error);
			// You can add error handling UI here if needed
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader className="text-center">
					<DialogTitle className="text-xl font-semibold">{t("auth.welcomeBack", currentLanguage)}</DialogTitle>
					<DialogDescription className="text-gray-600 dark:text-gray-400">
						{t("auth.signInToSaveRoutes", currentLanguage)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 pt-4">
					{/* Google Sign In Button (custom UI overlaying hidden GSI button) */}
					<div className="relative w-full h-11">
						<div className="w-full h-11 flex items-center justify-center gap-2.5 rounded-md border border-input bg-background text-sm font-medium pointer-events-none">
							<GoogleIcon size={18} />
							{t("auth.continueWithGoogle", currentLanguage)}
						</div>
						<div
							className="absolute inset-0 opacity-0"
							style={{ pointerEvents: isLoading ? "none" : "auto", colorScheme: "light" }}
						>
							<GoogleLogin
								onSuccess={handleGoogleSuccess}
								onError={handleGoogleError}
								auto_select={false}
								theme="filled_blue"
								size="large"
								width="400"
								text="continue_with"
							/>
						</div>
					</div>

					{isLoading && (
						<div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
							<span>{t("auth.signingIn", currentLanguage)}</span>
						</div>
					)}

					{/* Divider */}
					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<span className="w-full border-t border-gray-200 dark:border-gray-700" />
						</div>
						<div className="relative flex justify-center text-xs uppercase">
							<span className="bg-white dark:bg-gray-900 px-2 text-gray-500">
								{t("auth.benefits", currentLanguage)}
							</span>
						</div>
					</div>

					{/* Benefits List */}
					<div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
						<div className="flex items-center space-x-3">
							<div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
							<span>{t("auth.benefit.saveRoutes", currentLanguage)}</span>
						</div>
						<div className="flex items-center space-x-3">
							<div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
							<span>{t("auth.benefit.accessAnywhere", currentLanguage)}</span>
						</div>
						<div className="flex items-center space-x-3">
							<div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></div>
							<span>{t("auth.benefit.shareEasily", currentLanguage)}</span>
						</div>
					</div>

					{/* Privacy Notice */}
					<div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-100 dark:border-gray-800">
						{t("auth.privacyNotice", currentLanguage)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
