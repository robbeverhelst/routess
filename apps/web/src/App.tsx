import { GoogleOAuthProvider } from '@react-oauth/google';
import { useEffect, useState } from 'react';
import MapWithRouting from "@/components/MapWithRouting"
import { googleAuth } from "@/lib/google-auth"
import { useVersionDetection } from '@/hooks/use-version-detection';
import { formatVersion } from '@/lib/version';

function App() {
  const versionState = useVersionDetection();
  const [showVersionNotification, setShowVersionNotification] = useState(false);

  useEffect(() => {
    // Handle PWA shortcut URLs
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action) {
      // Small delay to ensure the map component is mounted
      setTimeout(() => {
        switch (action) {
          case 'new-route':
            // Trigger route generator modal
            window.dispatchEvent(new CustomEvent('pwa-shortcut', { detail: { action: 'new-route' } }));
            break;
          case 'locate':
            // Trigger location finding
            window.dispatchEvent(new CustomEvent('pwa-shortcut', { detail: { action: 'locate' } }));
            break;
          case 'import':
            // Trigger GPX import
            window.dispatchEvent(new CustomEvent('pwa-shortcut', { detail: { action: 'import' } }));
            break;
        }
        
        // Clean up URL after handling
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }, 500);
    }
  }, []);

  // Show version change notification
  useEffect(() => {
    if (versionState.hasChanged && versionState.previousVersion) {
      setShowVersionNotification(true);
      const timer = setTimeout(() => {
        setShowVersionNotification(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [versionState.hasChanged, versionState.previousVersion]);

  return (
    <GoogleOAuthProvider clientId={googleAuth.getClientId()}>
      <div className="w-full h-svh">
        <MapWithRouting height="100%" width="100%" />
        
        {/* Version change notification */}
        {showVersionNotification && (
          <div 
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              background: '#10b981',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '8px',
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              maxWidth: '320px'
            }}
          >
            <div className="font-medium mb-1">App Updated!</div>
            <div className="text-sm opacity-90">
              Updated to version {formatVersion(versionState.currentVersion)}
              {versionState.previousVersion && (
                <div className="text-xs mt-1 opacity-75">
                  Previous: {formatVersion(versionState.previousVersion)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </GoogleOAuthProvider>
  )
}

export default App
