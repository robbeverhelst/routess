import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { I } from "../components/icons";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

// Shared chrome for the anonymous public route pages (/r/{slugId}): user
// Routes and ExternalRoutes (ADR 0033) render different content in the same
// shell with the same SEO head handling.

export function setMetaTag(attr: "name" | "property", key: string, content: string) {
	if (typeof document === "undefined") return;
	let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
	if (!el) {
		el = document.createElement("meta");
		el.setAttribute(attr, key);
		document.head.appendChild(el);
	}
	el.setAttribute("content", content);
}

export function setCanonical(href: string) {
	if (typeof document === "undefined") return;
	let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
	if (!el) {
		el = document.createElement("link");
		el.rel = "canonical";
		document.head.appendChild(el);
	}
	el.href = href;
}

export function StatBlock({ label, value, unit }: { label: string; value: string; unit?: string }) {
	return (
		<div style={{ padding: "12px 16px", borderRight: `1px solid ${RDS_COLORS.border}` }}>
			<SecTitle>{label}</SecTitle>
			<div className="rds-mono" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1, marginTop: 4 }}>
				{value}
				{unit && (
					<span style={{ fontSize: 12, color: RDS_COLORS.fgSubtle, marginLeft: 4, fontWeight: 400 }}>{unit}</span>
				)}
			</div>
		</div>
	);
}

export function PublicPageShell({
	isLoading,
	isError,
	children,
}: {
	isLoading: boolean;
	isError: boolean;
	children: ReactNode;
}) {
	const t = useT();
	return (
		<div style={{ minHeight: "100svh", display: "flex", flexDirection: "column", background: RDS_COLORS.bg }}>
			<header
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					padding: "14px 20px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<a
					href="/"
					style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: RDS_COLORS.fg }}
				>
					<I.route size={18} />
					<span style={{ fontWeight: 600, fontSize: 14, letterSpacing: -0.2 }}>routess</span>
				</a>
				<div style={{ flex: 1 }} />
				<a href="/" style={{ textDecoration: "none" }}>
					<Btn variant="ghost">{t("public.signIn")}</Btn>
				</a>
			</header>
			<main style={{ flex: 1 }}>
				{isLoading && (
					<div style={{ padding: 40, textAlign: "center", color: RDS_COLORS.fgSubtle, fontSize: 14 }}>
						{t("public.loading")}
					</div>
				)}
				{isError && (
					<div style={{ padding: 40, textAlign: "center", color: RDS_COLORS.fgMuted }}>
						<h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>{t("public.notFound.title")}</h2>
						<p style={{ fontSize: 13, color: RDS_COLORS.fgSubtle, margin: 0 }}>{t("public.notFound.body")}</p>
					</div>
				)}
				{children}
			</main>
			<footer
				style={{
					padding: "20px",
					textAlign: "center",
					borderTop: `1px solid ${RDS_COLORS.border}`,
					color: RDS_COLORS.fgSubtle,
					fontSize: 12,
				}}
			>
				{t("public.footer.cta")}{" "}
				<a href="/" style={{ color: RDS_COLORS.accent }}>
					{t("public.footer.try")}
				</a>
			</footer>
		</div>
	);
}
