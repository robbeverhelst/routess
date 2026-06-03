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

function MenuIcon({ open }: { open: boolean }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			aria-hidden="true"
		>
			{open ? (
				<>
					<path d="M5 5 L15 15" strokeLinecap="round" />
					<path d="M15 5 L5 15" strokeLinecap="round" />
				</>
			) : (
				<>
					<path d="M3 6 H17" strokeLinecap="round" />
					<path d="M3 10 H17" strokeLinecap="round" />
					<path d="M3 14 H17" strokeLinecap="round" />
				</>
			)}
		</svg>
	);
}

export function Nav({ dict, locale, dev = false }: NavProps) {
	const [scrolled, setScrolled] = useState(false);
	const [open, setOpen] = useState(false);
	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 12);
		onScroll();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		// Tapping a #section link in the open mobile menu navigates via the hash;
		// close the menu so it doesn't cover the section it jumped to.
		const onHash = () => setOpen(false);
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("keydown", onKey);
		window.addEventListener("hashchange", onHash);
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("hashchange", onHash);
		};
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

				<button
					type="button"
					className="nav-toggle"
					aria-expanded={open}
					aria-controls="nav-menu"
					aria-label="Menu"
					onClick={() => setOpen((o) => !o)}
				>
					<MenuIcon open={open} />
				</button>

				<div id="nav-menu" className={`nav-menu${open ? " open" : ""}`}>
					<nav className="nav-links" aria-label="Primary">
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

					<div className="nav-actions">
						<a
							href={sisterUrl}
							className="chip nav-lang"
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
									href={`https://${APP_HOST}/`}
									style={{ height: 40, padding: "0 18px", fontSize: 14 }}
								>
									{dict.nav.planRoute} <ArrowIcon />
								</a>
							</>
						)}
					</div>
				</div>
			</div>
		</header>
	);
}
