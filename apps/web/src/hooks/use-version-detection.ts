import { useEffect, useState, useCallback } from 'react';
import { checkVersionChange, getStoredVersionInfo, getCurrentVersion } from '@/lib/version';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { Logger } from '@/lib/logger';

interface VersionState {
  hasChanged: boolean;
  currentVersion: string;
  previousVersion?: string;
  isClearingCaches: boolean;
  cachesClearedSuccessfully: boolean;
  error?: string;
}

/**
 * Hook to detect version changes and provide version information
 * Automatically clears service worker caches when version changes are detected
 */
export function useVersionDetection() {
  const [versionState, setVersionState] = useState<VersionState>({
    hasChanged: false,
    currentVersion: getCurrentVersion(),
    isClearingCaches: false,
    cachesClearedSuccessfully: false,
  });

  const { clearAllCaches, swState, refreshCacheStatus } = useServiceWorker();

  const clearCachesForVersionUpdate = useCallback(async () => {
    setVersionState(prev => ({ ...prev, isClearingCaches: true, error: undefined }));
    
    try {
      Logger.info('[useVersionDetection] Version change detected, clearing all caches...');
      
      // Clear all service worker caches
      await clearAllCaches();
      
      // Refresh cache status to ensure it's updated
      await refreshCacheStatus();
      
      // Force reload the service worker to get the latest version
      if (swState.isControlling && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.waiting) {
          // If there's a waiting service worker, activate it
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else if (registration.active) {
          // Force update check
          await registration.update();
        }
      }
      
      Logger.info('[useVersionDetection] Caches cleared successfully for version update');
      
      setVersionState(prev => ({
        ...prev,
        isClearingCaches: false,
        cachesClearedSuccessfully: true
      }));
      
    } catch (error) {
      Logger.error('[useVersionDetection] Failed to clear caches for version update:', error);
      setVersionState(prev => ({
        ...prev,
        isClearingCaches: false,
        error: error instanceof Error ? error.message : 'Failed to clear caches'
      }));
    }
  }, [clearAllCaches, refreshCacheStatus, swState.isControlling]);

  useEffect(() => {
    const hasChanged = checkVersionChange();
    const versionInfo = getStoredVersionInfo();
    
    const newState: VersionState = {
      hasChanged,
      currentVersion: getCurrentVersion(),
      previousVersion: versionInfo?.previous,
      isClearingCaches: false,
      cachesClearedSuccessfully: false,
    };
    
    setVersionState(newState);
    
    // If version has changed and we have a previous version, clear caches
    if (hasChanged && versionInfo?.previous) {
      Logger.info('[useVersionDetection] Version changed from', versionInfo.previous, 'to', getCurrentVersion());
      clearCachesForVersionUpdate();
    }
  }, [clearCachesForVersionUpdate]);

  return versionState;
} 