import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { CacheManager } from '@/components/ui/cache-manager';
import { t } from '@/lib/i18n';
import type { SupportedLanguage } from '@/lib/i18n';
import { 
  Settings,
  Database,
  Palette,
  User,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  isLoggedIn: boolean;
  currentUser?: { name?: string; email?: string } | null;
  showSunDirection: boolean;
  onToggleSunDirection: (enabled: boolean) => void;
}

export function SettingsModal({ 
  isOpen, 
  onOpenChange, 
  currentLanguage,
  onLanguageChange,
  isLoggedIn,
  currentUser,
  showSunDirection,
  onToggleSunDirection
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<string>('general');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const settingsSections = [
    {
      id: 'general',
      label: t('settings.general', currentLanguage),
      icon: Settings,
      description: t('settings.generalDesc', currentLanguage)
    },
    {
      id: 'storage',
      label: t('settings.storage', currentLanguage),
      icon: Database,
      description: t('settings.storageDesc', currentLanguage)
    },
    {
      id: 'appearance',
      label: t('settings.appearance', currentLanguage),
      icon: Palette,
      description: t('settings.appearanceDesc', currentLanguage)
    }
  ];

  if (isLoggedIn) {
    settingsSections.push({
      id: 'account',
      label: t('settings.account', currentLanguage),
      icon: User,
      description: t('settings.accountDesc', currentLanguage)
    });
  }

  const currentSection = settingsSections.find(section => section.id === activeSection);

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('settings.language', currentLanguage)}
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {t('settings.languageDesc', currentLanguage)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { code: 'en' as SupportedLanguage, name: 'English' },
                  { code: 'nl' as SupportedLanguage, name: 'Nederlands' },
                  { code: 'fr' as SupportedLanguage, name: 'Français' },
                  { code: 'de' as SupportedLanguage, name: 'Deutsch' }
                ].map((lang) => (
                  <Button
                    key={lang.code}
                    variant={currentLanguage === lang.code ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onLanguageChange(lang.code)}
                    className="justify-start"
                  >
                    {lang.name}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('settings.mapDefaults', currentLanguage)}
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {t('settings.mapDefaultsDesc', currentLanguage)}
              </p>
              <div className="text-xs text-gray-400">
                {t('settings.comingSoon', currentLanguage)}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Sun Direction Indicator
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Show sun direction on the map to help plan your routes based on sunlight
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSunDirection}
                  onChange={(e) => onToggleSunDirection(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Show sun direction indicator
                </span>
              </label>
            </div>
          </div>
        );

      case 'storage':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('settings.offlineStorage', currentLanguage)}
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {t('settings.offlineStorageDesc', currentLanguage)}
              </p>
              <CacheManager currentLanguage={currentLanguage} />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('settings.dataManagement', currentLanguage)}
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {t('settings.dataManagementDesc', currentLanguage)}
              </p>
              <div className="text-xs text-gray-400">
                {t('settings.comingSoon', currentLanguage)}
              </div>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('settings.theme', currentLanguage)}
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {t('settings.themeDesc', currentLanguage)}
              </p>
              <div className="text-xs text-gray-400">
                {t('settings.comingSoon', currentLanguage)}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('settings.mapStyle', currentLanguage)}
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {t('settings.mapStyleDesc', currentLanguage)}
              </p>
              <div className="text-xs text-gray-400">
                {t('settings.comingSoon', currentLanguage)}
              </div>
            </div>
          </div>
        );

      case 'account':
        return (
          <div className="space-y-4">
            {isLoggedIn && currentUser && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {t('settings.accountInfo', currentLanguage)}
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {currentUser.name || 'User'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentUser.email || 'No email'}
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('settings.privacy', currentLanguage)}
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {t('settings.privacyDesc', currentLanguage)}
              </p>
              <div className="text-xs text-gray-400">
                {t('settings.comingSoon', currentLanguage)}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('settings.savedRoutes', currentLanguage)}
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {t('settings.savedRoutesDesc', currentLanguage)}
              </p>
              <div className="text-xs text-gray-400">
                {t('settings.comingSoon', currentLanguage)}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[80vh] overflow-hidden p-0 w-[95vw] sm:w-full">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('settings.title', currentLanguage)}
          </DialogTitle>
          <DialogDescription className="hidden sm:block">
            {t('settings.description', currentLanguage)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row h-[70vh] sm:h-[60vh]">
          {/* Sidebar */}
          <div className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="p-4">
              {/* Mobile toggle button */}
              <div className="sm:hidden mb-3">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {currentSection && <currentSection.icon className="h-4 w-4" />}
                    <span className="font-medium">{currentSection?.label}</span>
                  </div>
                  {isSidebarOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {/* Navigation items */}
              <div className={`space-y-1 ${isSidebarOpen ? 'block' : 'hidden'} sm:block`}>
                {settingsSections.map((section) => {
                  const IconComponent = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => handleSectionChange(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                        activeSection === section.id
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <IconComponent className="h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {section.label}
                        </div>
                        <div className="text-xs text-gray-500 truncate hidden sm:block">
                          {section.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6">
              {renderSectionContent()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 