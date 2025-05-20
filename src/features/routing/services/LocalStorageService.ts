import type { Coordinate } from '@/types/map';

// Data structure stored in local storage
interface StoredRouteData {
  waypoints: Coordinate[];
  directFlags: boolean[];
}

const WAYPOINTS_STORAGE_KEY = 'mapWaypoints';

// Function to save waypoints to local storage
export const saveWaypointsToLocalStorage = (waypoints: Coordinate[], directFlags: boolean[]): void => {
  try {
    const data: StoredRouteData = { waypoints, directFlags };
    localStorage.setItem(WAYPOINTS_STORAGE_KEY, JSON.stringify(data));
    console.log('[LocalStorageService] Saved waypoints to local storage');
  } catch (error) {
    console.error('[LocalStorageService] Error saving waypoints to local storage:', error);
  }
};

// Function to load waypoints from local storage
export const loadWaypointsFromLocalStorage = (): StoredRouteData | null => {
  try {
    const data = localStorage.getItem(WAYPOINTS_STORAGE_KEY);
    if (data) {
      const parsedData = JSON.parse(data) as StoredRouteData;
      // Basic validation of the parsed data structure
      if (parsedData && Array.isArray(parsedData.waypoints) && Array.isArray(parsedData.directFlags)) {
        // Further check if waypoints are valid Coordinates (arrays of 2 numbers)
        // And directFlags are booleans
        const isValidWaypoints = parsedData.waypoints.every(
          (wp: Coordinate) => Array.isArray(wp) && wp.length === 2 && typeof wp[0] === 'number' && typeof wp[1] === 'number'
        );
        const isValidFlags = parsedData.directFlags.every((flag: boolean) => typeof flag === 'boolean');

        if (isValidWaypoints && isValidFlags) {
          console.log('[LocalStorageService] Loaded waypoints from local storage:', parsedData.waypoints);
          return parsedData;
        } else {
          console.warn('[LocalStorageService] Data format error: Waypoints or directFlags have incorrect types.', parsedData);
          // Optionally, clear the invalid data from local storage
          // localStorage.removeItem(WAYPOINTS_STORAGE_KEY);
          return null;
        }
      } else {
        console.warn('[LocalStorageService] Loaded data is not in the expected format:', parsedData);
        // Optionally, clear the invalid data
        // localStorage.removeItem(WAYPOINTS_STORAGE_KEY);
        return null;
      }
    }
  } catch (error) {
    console.error('[LocalStorageService] Error loading waypoints from local storage:', error);
  }
  return null;
};

const MAP_LOCK_STATE_KEY = 'routingAppMapLockState';

export const saveMapLockStateToLocalStorage = (isLocked: boolean): void => {
  try {
    localStorage.setItem(MAP_LOCK_STATE_KEY, JSON.stringify(isLocked));
    if (import.meta.env.DEV) {
      console.log(`[LocalStorageService] Saved map lock state: ${isLocked}`);
    }
  } catch (error) {
    console.error('[LocalStorageService] Error saving map lock state:', error);
  }
};

export const loadMapLockStateFromLocalStorage = (): boolean => {
  try {
    const storedState = localStorage.getItem(MAP_LOCK_STATE_KEY);
    if (storedState === null) {
      // If not set, default to not locked (or your preferred default)
      console.log('[LocalStorageService] No map lock state found, defaulting to false (unlocked).');
      return false; 
    }
    const isLocked = JSON.parse(storedState);
    if (import.meta.env.DEV) {
      console.log(`[LocalStorageService] Loaded map lock state: ${isLocked}`);
    }
    return typeof isLocked === 'boolean' ? isLocked : false; // Ensure it's a boolean
  } catch (error) {
    console.error('[LocalStorageService] Error loading map lock state:', error);
    return false; // Default to false (unlocked) on error
  }
}; 