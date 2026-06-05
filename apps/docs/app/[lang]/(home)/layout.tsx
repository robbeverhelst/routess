import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout.shared";

export default async function Layout(props: { children: ReactNode; params: Promise<{ lang: string }> }) {
	const { lang } = await props.params;
	return <HomeLayout {...baseOptions(lang, { languageSwitch: true })}>{props.children}</HomeLayout>;
}
