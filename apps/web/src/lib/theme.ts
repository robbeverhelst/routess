/**
 * Simple theme management
 * Handles light/dark theme switching with existing CSS setup
 */

/**
 * Get current theme from document class
 */
export function getCurrentTheme(): "light" | "dark" {
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Set theme and update CSS variables
 */
export function setTheme(theme: "light" | "dark") {
	const root = document.documentElement;

	if (theme === "dark") {
		root.classList.add("dark");
	} else {
		root.classList.remove("dark");
	}

	// Store preference
	localStorage.setItem("theme", theme);
}

/**
 * Toggle between light and dark theme
 */
export function toggleTheme() {
	const currentTheme = getCurrentTheme();
	const newTheme = currentTheme === "light" ? "dark" : "light";
	setTheme(newTheme);
	return newTheme;
}

/**
 * Initialize theme from localStorage or system preference
 */
export function initializeThemeFromPreference() {
	// Get saved theme or system preference
	const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
	const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	const theme = savedTheme || systemTheme;

	setTheme(theme);

	return theme;
}

/**
 * Listen for system theme changes
 */
export function setupThemeListener() {
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	mediaQuery.addEventListener("change", (e) => {
		// Only auto-switch if no manual preference is saved
		if (!localStorage.getItem("theme")) {
			setTheme(e.matches ? "dark" : "light");
		}
	});
}
