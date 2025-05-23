import { GoogleOAuthProvider } from '@react-oauth/google';
import { useEffect } from 'react';
import MapWithRouting from "@/components/MapWithRouting"
import { googleAuth } from "@/lib/google-auth"

function App() {
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

  return (
    <GoogleOAuthProvider clientId={googleAuth.getClientId()}>
      <div className="w-full h-svh">
        <MapWithRouting height="100%" width="100%" />
      </div>
    </GoogleOAuthProvider>
  )
}

export default App
