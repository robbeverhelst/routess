// Debug Authentication Helper
// Copy and paste this into the browser console to debug auth issues

console.log("=== AUTHENTICATION DEBUG HELPER ===");
console.log("Available commands:");
console.log("- debugAuth() : Check current auth state");
console.log("- checkNetworkTab() : Instructions for checking network tab");
console.log("- testAuthFlow() : Test making an authenticated API call");
console.log("===================================");

// Already added to window by api.ts
console.log("\n1. Check localStorage and API state:");
console.log("Run: debugAuth()");

// Network tab instructions
window.checkNetworkTab = () => {
  console.log("\n=== NETWORK TAB DEBUGGING ===");
  console.log("1. Open DevTools Network tab");
  console.log("2. Clear the network log");
  console.log("3. Try to make an authenticated request (e.g., save a route)");
  console.log("4. Look for the API request and check:");
  console.log("   - Request Headers > Authorization header");
  console.log("   - It should show: 'Bearer <your-token>'");
  console.log("5. If missing, the token isn't being sent");
  console.log("6. Check the Response tab for any auth errors");
  console.log("=============================");
};

// Test authenticated API call
window.testAuthFlow = async () => {
  console.log("\n=== TESTING AUTH FLOW ===");

  // Check current state
  const authState = window.debugAuth();

  if (!authState.localStorageToken) {
    console.error("❌ No token in localStorage. Please login first!");
    return;
  }

  console.log("✓ Token found in localStorage");
  console.log("Testing API call to /routes...");

  try {
    // This will trigger all our console.log statements
    const response = await fetch(`${import.meta.env.VITE_API_URL || "__VITE_API_URL__"}/routes`, {
      headers: {
        Authorization: `Bearer ${authState.localStorageToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log(`Response status: ${response.status}`);

    if (response.ok) {
      console.log("✓ Manual API call successful!");
      const data = await response.json();
      console.log("Routes data:", data);
    } else {
      console.error("❌ API call failed:", response.status, response.statusText);
      const error = await response.text();
      console.error("Error response:", error);
    }
  } catch (error) {
    console.error("❌ Network error:", error);
  }

  console.log("=========================");
};

// Auto-run initial check
console.log("\nCurrent auth state:");
window.debugAuth();
