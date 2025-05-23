import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { t } from '@/lib/i18n';
import type { SupportedLanguage } from '@/lib/i18n';
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Download,
  HardDrive,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface CacheManagerProps {
  currentLanguage: SupportedLanguage;
}

export function CacheManager({ currentLanguage }: CacheManagerProps) {
  const {
    swState,
    isOnline,
    networkStatus,
    cacheStatus,
    isCacheLoading,
    updateServiceWorker,
    refreshCacheStatus,
    clearCache,
    clearAllCaches,
    formatCacheSize,
    getTotalCacheSize,
    getCacheEntryCount
  } = useServiceWorker();

  const [isClearing, setIsClearing] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const handleClearCache = async (cacheName: string) => {
    setIsClearing(cacheName);
    try {
      await clearCache(cacheName);
    } finally {
      setIsClearing(null);
    }
  };

  const handleClearAllCaches = async () => {
    setIsClearingAll(true);
    try {
      await clearAllCaches();
    } finally {
      setIsClearingAll(false);
    }
  };

  const getCacheTypeLabel = (cacheName: string): string => {
    if (cacheName.includes('app-shell')) return t('cacheManager.appShell', currentLanguage);
    if (cacheName.includes('api-cache')) return t('cacheManager.apiCache', currentLanguage);
    if (cacheName.includes('map-assets')) return t('cacheManager.mapAssets', currentLanguage);
    if (cacheName.includes('runtime')) return t('cacheManager.runtime', currentLanguage);
    return t('cacheManager.unknown', currentLanguage);
  };

  const getCacheTypeDescription = (cacheName: string): string => {
    if (cacheName.includes('app-shell')) return t('cacheManager.appShellDesc', currentLanguage);
    if (cacheName.includes('api-cache')) return t('cacheManager.apiCacheDesc', currentLanguage);
    if (cacheName.includes('map-assets')) return t('cacheManager.mapAssetsDesc', currentLanguage);
    if (cacheName.includes('runtime')) return t('cacheManager.runtimeDesc', currentLanguage);
    return t('cacheManager.unknownDesc', currentLanguage);
  };

  const getServiceWorkerStatusIcon = () => {
    if (!swState.isSupported) return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (swState.hasUpdate) return <Download className="h-4 w-4 text-blue-500" />;
    if (swState.isControlling) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (swState.isInstalling) return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
    return <Clock className="h-4 w-4 text-gray-500" />;
  };

  const getServiceWorkerStatusText = (): string => {
    if (!swState.isSupported) return t('cacheManager.swNotSupported', currentLanguage);
    if (swState.hasUpdate) return t('cacheManager.swUpdateAvailable', currentLanguage);
    if (swState.isControlling) return t('cacheManager.swActive', currentLanguage);
    if (swState.isInstalling) return t('cacheManager.swInstalling', currentLanguage);
    if (swState.isRegistered) return t('cacheManager.swRegistered', currentLanguage);
    return t('cacheManager.swNotRegistered', currentLanguage);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Database className="h-4 w-4" />
          <span className="hidden sm:inline">{t('cacheManager.title', currentLanguage)}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t('cacheManager.title', currentLanguage)}
          </DialogTitle>
          <DialogDescription className="hidden sm:block">
            {t('cacheManager.description', currentLanguage)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Network Status */}
          <Card className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
              <h3 className="font-medium flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                {t('cacheManager.networkStatus', currentLanguage)}
              </h3>
              <span className={`text-sm px-2 py-1 rounded self-start ${
                isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {isOnline ? t('cacheManager.online', currentLanguage) : t('cacheManager.offline', currentLanguage)}
              </span>
            </div>
            {isOnline && (
              <div className="text-sm text-gray-600 space-y-1">
                <div>{t('cacheManager.connectionType', currentLanguage)}: {networkStatus.effectiveType}</div>
                {networkStatus.downlink > 0 && (
                  <div>{t('cacheManager.speed', currentLanguage)}: {networkStatus.downlink} Mbps</div>
                )}
              </div>
            )}
          </Card>

          {/* Service Worker Status */}
          <Card className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
              <h3 className="font-medium flex items-center gap-2">
                {getServiceWorkerStatusIcon()}
                {t('cacheManager.serviceWorker', currentLanguage)}
              </h3>
              {swState.hasUpdate && (
                <Button 
                  size="sm" 
                  onClick={updateServiceWorker}
                  className="gap-2 self-start"
                >
                  <Download className="h-3 w-3" />
                  {t('cacheManager.update', currentLanguage)}
                </Button>
              )}
            </div>
            <p className="text-sm text-gray-600">{getServiceWorkerStatusText()}</p>
          </Card>

          {/* Cache Overview */}
          <Card className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
              <h3 className="font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                {t('cacheManager.cacheOverview', currentLanguage)}
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={refreshCacheStatus}
                  disabled={isCacheLoading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-3 w-3 ${isCacheLoading ? 'animate-spin' : ''}`} />
                  {t('cacheManager.refresh', currentLanguage)}
                </Button>
                {cacheStatus && Object.keys(cacheStatus).length > 0 && (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={handleClearAllCaches}
                    disabled={isClearingAll}
                    className="gap-2"
                  >
                    <Trash2 className="h-3 w-3" />
                    {isClearingAll ? t('cacheManager.clearing', currentLanguage) : t('cacheManager.clearAll', currentLanguage)}
                  </Button>
                )}
              </div>
            </div>

            {isCacheLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">{t('cacheManager.loading', currentLanguage)}</span>
              </div>
            ) : cacheStatus ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                  <div>
                    <span className="font-medium">{t('cacheManager.totalSize', currentLanguage)}: </span>
                    <span>{formatCacheSize(getTotalCacheSize())}</span>
                  </div>
                  <div>
                    <span className="font-medium">{t('cacheManager.totalEntries', currentLanguage)}: </span>
                    <span>{getCacheEntryCount()}</span>
                  </div>
                </div>

                {Object.keys(cacheStatus).length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    {t('cacheManager.noCaches', currentLanguage)}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(cacheStatus).map(([cacheName, cacheInfo]) => (
                      <div key={cacheName} className="border rounded-lg p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm truncate">{getCacheTypeLabel(cacheName)}</h4>
                            <p className="text-xs text-gray-500 line-clamp-2 sm:line-clamp-1">{getCacheTypeDescription(cacheName)}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleClearCache(cacheName)}
                            disabled={isClearing === cacheName}
                            className="gap-2 self-start sm:self-center flex-shrink-0"
                          >
                            {isClearing === cacheName ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            <span className="hidden sm:inline">
                              {isClearing === cacheName ? t('cacheManager.clearing', currentLanguage) : t('cacheManager.clear', currentLanguage)}
                            </span>
                          </Button>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>{cacheInfo.entries} {t('cacheManager.entries', currentLanguage)}</span>
                          <span>{formatCacheSize(cacheInfo.size)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                {t('cacheManager.unavailable', currentLanguage)}
              </p>
            )}
          </Card>

          {/* Offline Features Info */}
          <Card className="p-3 sm:p-4 bg-blue-50 border-blue-200">
            <h3 className="font-medium text-blue-900 mb-2">
              {t('cacheManager.offlineFeatures', currentLanguage)}
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• {t('cacheManager.feature1', currentLanguage)}</li>
              <li>• {t('cacheManager.feature2', currentLanguage)}</li>
              <li>• {t('cacheManager.feature3', currentLanguage)}</li>
              <li>• {t('cacheManager.feature4', currentLanguage)}</li>
            </ul>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 