import { redirect } from "next/navigation";

// Locale roots live at /{lang}; the bare root sends visitors to English.
// Temporary redirect on purpose: it leaves room for Accept-Language detection.
export default function RootRedirect() {
	redirect("/en");
}
