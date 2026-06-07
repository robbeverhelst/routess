import type { Dict } from "@/lib/content";
import { REPO_URL } from "@/lib/i18n";
import { GhIcon } from "./Icons";
import { Logo } from "./Logo";

function FooterCol({ title, items }: { title: string; items: ReadonlyArray<{ label: string; href: string }> }) {
	return (
		<div>
			<div className="eyebrow" style={{ marginBottom: 14 }}>
				{title}
			</div>
			<ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
				{items.map((it) => (
					<li key={it.label}>
						<a href={it.href} style={{ color: "var(--ink-soft)", fontSize: 14 }}>
							{it.label}
						</a>
					</li>
				))}
			</ul>
		</div>
	);
}

export function Footer({ dict }: { dict: Dict }) {
	return (
		<footer style={{ borderTop: "1px solid var(--line)", padding: "60px 0 40px", background: "var(--paper-2)" }}>
			<div className="container-x">
				<div
					className="grid-footer"
					style={{
						display: "grid",
						gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
						gap: 40,
					}}
				>
					<div>
						<Logo />
						<p style={{ color: "var(--ink-soft)", maxWidth: 280, marginTop: 16, fontSize: 14, lineHeight: 1.6 }}>
							{dict.footer.tagline}
						</p>
						<div style={{ display: "flex", gap: 8, marginTop: 18 }}>
							<a className="chip" href={REPO_URL} style={{ background: "var(--paper)" }}>
								<GhIcon /> {dict.nav.github}
							</a>
						</div>
					</div>
					<FooterCol title={dict.footer.colProduct.title} items={dict.footer.colProduct.items} />
					<FooterCol title={dict.footer.colOpen.title} items={dict.footer.colOpen.items} />
					<FooterCol title={dict.footer.colMore.title} items={dict.footer.colMore.items} />
				</div>
				<div
					style={{
						marginTop: 56,
						paddingTop: 24,
						borderTop: "1px dashed var(--line)",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						fontSize: 12,
						color: "var(--muted-color)",
						fontFamily: "var(--font-mono)",
					}}
				>
					<span>{dict.footer.copyright}</span>
					<span style={{ display: "flex", gap: 8, alignItems: "center" }}>
						{dict.footer.madeWith}
						<span>·</span>
						<a href={dict.footer.madeBy.href} target="_blank" rel="noreferrer" style={{ color: "var(--ink-soft)" }}>
							{dict.footer.madeBy.label}
						</a>
					</span>
				</div>
			</div>
		</footer>
	);
}
