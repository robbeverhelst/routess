import type { SignInEntryPoint } from "@/lib/app-events";
import { trackEvent } from "./track";

// Logout and account deletion land the user on the sign-in screen too, but
// that is the end of a session, not the start of a signup. Firing there would
// inflate the top of the funnel with people who just left.
export function trackSignInEntry(entryPoint: SignInEntryPoint): void {
	if (entryPoint === "session_ended") return;
	trackEvent({ name: "signup_started", properties: { entry_point: entryPoint } });
}
