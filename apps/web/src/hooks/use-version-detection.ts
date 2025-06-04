import { useEffect, useState } from 'react';
import { checkVersionChange, getStoredVersionInfo, getCurrentVersion } from '@/lib/version';

interface VersionState {
  hasChanged: boolean;
  currentVersion: string;
  previousVersion?: string;
}

/**
 * Hook to detect version changes and provide version information
 */
export function useVersionDetection() {
  const [versionState, setVersionState] = useState<VersionState>({
    hasChanged: false,
    currentVersion: getCurrentVersion(),
  });

  useEffect(() => {
    const hasChanged = checkVersionChange();
    const versionInfo = getStoredVersionInfo();
    
    setVersionState({
      hasChanged,
      currentVersion: getCurrentVersion(),
      previousVersion: versionInfo?.previous,
    });
  }, []);

  return versionState;
} 