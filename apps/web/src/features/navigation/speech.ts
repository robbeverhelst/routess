import { Logger } from "@/lib/logger";

// Voice guidance speaks the server's localized cue text verbatim via the
// platform speechSynthesis voices (ADR 0038). No client phrase templates.

const SPEECH_LANG: Record<string, string> = {
	en: "en-US",
	nl: "nl-NL",
	fr: "fr-FR",
	de: "de-DE",
};

export function speechSupported(): boolean {
	return typeof window !== "undefined" && "speechSynthesis" in window;
}

// iOS Safari only allows speech that originates from a user gesture. A silent
// utterance inside the "start navigation" tap unlocks the channel for the
// programmatic announcements that follow; without it voice never works on iOS.
export function primeSpeech(): void {
	if (!speechSupported()) return;
	try {
		const utterance = new SpeechSynthesisUtterance(" ");
		utterance.volume = 0;
		window.speechSynthesis.speak(utterance);
	} catch (err) {
		Logger.debug("[Speech] Priming failed:", err);
	}
}

export function speak(text: string, language: string): void {
	if (!speechSupported()) return;
	try {
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = SPEECH_LANG[language] ?? SPEECH_LANG.en;
		// A stale queued announcement is worse than a skipped one: a cue spoken
		// after the turn sends people the wrong way.
		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(utterance);
	} catch (err) {
		Logger.debug("[Speech] speak failed:", err);
	}
}

export function stopSpeech(): void {
	if (!speechSupported()) return;
	try {
		window.speechSynthesis.cancel();
	} catch {
		// Nothing to clean up.
	}
}
