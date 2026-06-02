"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { APP_HOST, DOCS_HOST, REPO_URL, SISTER_HOST } from "@/lib/i18n";
import { ArrowIcon, GhIcon } from "./Icons";
import { Logo } from "./Logo";

interface NavProps {
	dict: Dict;
	locale: Locale;
	dev?: boolean;
}

export function Nav({ dict, locale, dev = false }: NavProps) {
	const [scrolled, setScrolled] = useState(false);
	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 12);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const otherLocale: Locale = locale === "en" ? "nl" : "en";
	const sisterUrl = `https://${SISTER_HOST[locale]}/`;

	return (
		<header className={`nav${scrolled ? " scrolled" : ""}`}>
			<div
				className="container-x"
				style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}
			>
				<a href="/" aria-label="routess">
					<Logo />
				</a>

				<nav style={{ display: "flex", gap: 28, fontSize: 14, fontWeight: 500 }} aria-label="Primary">
					{dev ? (
						<>
							<a href="/">{dict.nav.home}</a>
							<a href={`https://${DOCS_HOST}`}>{dict.nav.docs}</a>
							<a href={REPO_URL}>{dict.nav.github}</a>
						</>
					) : (
						<>
							<a href="#planner">{dict.nav.plan}</a>
							<a href="#features">{dict.nav.features}</a>
							<a href="#community">{dict.nav.community}</a>
							<a href="#pricing">{dict.nav.pricing}</a>
						</>
					)}
				</nav>

				<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
					<a
						href={sisterUrl}
						className="chip"
						aria-label={`Switch language to ${otherLocale.toUpperCase()}`}
						style={{ background: "var(--paper)", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}
					>
						{otherLocale}
					</a>
					{dev ? (
						<>
							<a className="btn btn-ghost" href={REPO_URL} style={{ height: 40, padding: "0 16px", fontSize: 14 }}>
								<GhIcon /> {dict.nav.star}
							</a>
							<a
								className="btn btn-primary"
								href={`https://${DOCS_HOST}`}
								style={{ height: 40, padding: "0 18px", fontSize: 14 }}
							>
								{dict.nav.readDocs} <ArrowIcon />
							</a>
						</>
					) : (
						<>
							<a className="btn btn-ghost" href="/developers" style={{ height: 40, padding: "0 16px", fontSize: 14 }}>
								{dict.nav.forDevelopers}
							</a>
							<a
								className="btn btn-primary"
								href={`https://${APP_HOST}/plan`}
								style={{ height: 40, padding: "0 18px", fontSize: 14 }}
							>
								{dict.nav.planRoute} <ArrowIcon />
							</a>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
