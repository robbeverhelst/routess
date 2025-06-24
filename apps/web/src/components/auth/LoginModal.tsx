import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Logger } from "../../lib/logger";
import { googleAuth, type CredentialResponse } from "../../lib/google-auth";
import { t } from "../../lib/i18n";
import type { SupportedLanguage } from "../../lib/i18n";

interface LoginModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess: () => void;
  currentLanguage: SupportedLanguage;
}

export function LoginModal({
  isOpen,
  onOpenChange,
  onLoginSuccess,
  currentLanguage,
}: LoginModalProps) {
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
          <DialogTitle className="text-xl font-semibold">
            {t("auth.welcomeBack", currentLanguage)}
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            {t("auth.signInToSaveRoutes", currentLanguage)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Google Sign In Button */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
              auto_select={false}
              theme="outline"
              size="large"
              width="100%"
              text="signin_with"
            />
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
