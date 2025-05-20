import { useState, useCallback } from 'react';
import { getWaypoints, getDirectFlags } from '@/features/routing/managers/WaypointManager';
import { serializeAndCompress } from '@/lib/shareUtils';

export interface RouteDataState {
  routeDistance: string;
  routeDuration: string;
  hasRoute: boolean;
  shareNotification: string;
  displayedShareUrl: string | null;
  showRouteInfoError: boolean;
  routeInfoErrorMessage: string;
}

export interface RouteDataHandlers {
  setRouteDistance: React.Dispatch<React.SetStateAction<string>>;
  setRouteDuration: React.Dispatch<React.SetStateAction<string>>;
  setHasRoute: React.Dispatch<React.SetStateAction<boolean>>;
  handleShareRoute: () => void;
  handleCopySharedUrl: (urlToCopy: string) => void;
  handleRouteInfoError: (message: string) => void;
  clearShareState: () => void; // For resetting share UI on route reset etc.
}

export function useRouteData(): RouteDataState & RouteDataHandlers {
  const [routeDistance, setRouteDistance] = useState<string>('');
  const [routeDuration, setRouteDuration] = useState<string>('');
  const [hasRoute, setHasRoute] = useState<boolean>(false);
  const [shareNotification, setShareNotification] = useState('');
  const [displayedShareUrl, setDisplayedShareUrl] = useState<string | null>(null);
  const [showRouteInfoError, setShowRouteInfoError] = useState(false);
  const [routeInfoErrorMessage, setRouteInfoErrorMessage] = useState('');

  const handleRouteInfoError = useCallback((message: string) => {
    setShowRouteInfoError(true);
    setRouteInfoErrorMessage(message);
    setTimeout(() => {
      setShowRouteInfoError(false);
      setRouteInfoErrorMessage('');
    }, 5000);
  }, []);

  const handleShareRoute = useCallback(() => {
    const waypoints = getWaypoints();
    const directFlags = getDirectFlags();

    if (waypoints.length === 0) {
      handleRouteInfoError("Cannot share an empty route.");
      return;
    }

    const encodedData = serializeAndCompress(waypoints, directFlags, true);
    if (encodedData) {
      const shareUrl = `${window.location.origin}${window.location.pathname}?route=${encodedData}`;
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          setShareNotification('Link copied to clipboard!');
          setTimeout(() => setShareNotification(''), 2000);
        })
        .catch(err => {
          console.error('[useRouteData] Failed to copy share link:', err);
          handleRouteInfoError('Failed to copy link. Please try again.');
          setDisplayedShareUrl(null); // Clear URL display on error
        });
      setDisplayedShareUrl(shareUrl);
    } else {
      handleRouteInfoError('Could not generate shareable link.');
      setDisplayedShareUrl(null);
    }
  }, [handleRouteInfoError]);

  const handleCopySharedUrl = useCallback((urlToCopy: string) => {
    navigator.clipboard.writeText(urlToCopy)
      .then(() => {
        setShareNotification('Share link copied!');
        setTimeout(() => setShareNotification(''), 2000); 
      })
      .catch(err => {
        console.error('[useRouteData] Failed to copy share link from sidebar button:', err);
        handleRouteInfoError('Failed to copy. Please try again.');
      });
  }, [handleRouteInfoError]);
  
  const clearShareState = useCallback(() => {
    setDisplayedShareUrl(null);
    setShareNotification('');
    setShowRouteInfoError(false);
    setRouteInfoErrorMessage('');
  }, []);

  return {
    routeDistance,
    routeDuration,
    hasRoute,
    shareNotification,
    displayedShareUrl,
    showRouteInfoError,
    routeInfoErrorMessage,
    setRouteDistance,
    setRouteDuration,
    setHasRoute,
    handleShareRoute,
    handleCopySharedUrl,
    handleRouteInfoError,
    clearShareState,
  };
} 