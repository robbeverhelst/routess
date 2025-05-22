import { GoogleOAuthProvider } from '@react-oauth/google';
import MapWithRouting from "@/components/MapWithRouting"
import { googleAuth } from "@/lib/google-auth"

function App() {
  return (
    <GoogleOAuthProvider clientId={googleAuth.getClientId()}>
      <div className="w-full h-svh">
        <MapWithRouting height="100%" width="100%" />
      </div>
    </GoogleOAuthProvider>
  )
}

export default App
