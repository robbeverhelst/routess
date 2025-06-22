interface VersionInfo {
  current: string;
  previous?: string;
  lastChecked: number;
}

const VERSION_STORAGE_KEY = "maps-app-version";

/**
 * Get the current app version from environment variables
 */
export function getCurrentVersion(): string {
  return import.meta.env.VITE_APP_VERSION || "development";
}

/**
 * Get version information from localStorage
 */
export function getStoredVersionInfo(): VersionInfo | null {
  try {
    const stored = localStorage.getItem(VERSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn("Failed to parse stored version info:", error);
    return null;
  }
}

/**
 * Store version information in localStorage
 */
export function storeVersionInfo(versionInfo: VersionInfo): void {
  try {
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(versionInfo));
  } catch (error) {
    console.warn("Failed to store version info:", error);
  }
}

/**
 * Check if the app version has changed and update localStorage
 * Returns true if the version has changed
 */
export function checkVersionChange(): boolean {
  const currentVersion = getCurrentVersion();
  const storedInfo = getStoredVersionInfo();

  if (!storedInfo) {
    // First time - store current version
    storeVersionInfo({
      current: currentVersion,
      lastChecked: Date.now(),
    });
    return false;
  }

  if (storedInfo.current !== currentVersion) {
    // Version has changed
    storeVersionInfo({
      current: currentVersion,
      previous: storedInfo.current,
      lastChecked: Date.now(),
    });
    return true;
  }

  // Update last checked time
  storeVersionInfo({
    ...storedInfo,
    lastChecked: Date.now(),
  });

  return false;
}

/**
 * Get a human-readable version display
 */
export function getVersionDisplay(): string {
  const version = getCurrentVersion();
  return formatVersion(version);
}

/**
 * Format any version string for display
 */
export function formatVersion(version: string): string {
  // If it's a git hash (7-40 characters, alphanumeric), show it as a short hash
  if (/^[a-f0-9]{7,40}$/i.test(version)) {
    return `${version.substring(0, 7)} (dev)`;
  }

  // If it's a semantic version, return with v prefix
  if (version.match(/^\d+\.\d+\.\d+/)) {
    return `v${version}`;
  }

  // For anything else (including 'development'), return as-is
  return version;
}
