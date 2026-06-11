import { darkBrand, landingAccents, lightBrand } from "@routess/design-tokens";
import type { Dict } from "@/lib/content";
import { APP_HOST, REPO_URL } from "@/lib/i18n";
import { AccentInline } from "./AccentText";
import { ArrowIcon } from "./Icons";

function PricingList({
	items,
	accent = "var(--moss)",
	dim = false,
}: {
	items: ReadonlyArray<string>;
	accent?: string;
	dim?: boolean;
}) {
	return (
		<ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
			{items.map((it) => (
				<li
					key={it}
					style={{
						display: "flex",
						gap: 10,
						alignItems: "flex-start",
						color: dim ? darkBrand.inkSoft : "var(--paper)",
						fontSize: 14,
					}}
				>
					<span
						style={{
							width: 18,
							height: 18,
							borderRadius: "50%",
							background: accent,
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							color: lightBrand.ink,
							fontSize: 11,
							fontWeight: 800,
							flexShrink: 0,
							marginTop: 1,
						}}
						aria-hidden="true"
					>
						✓
					</span>
					{it}
				</li>
			))}
		</ul>
	);
}

export function Pricing({ dict }: { dict: Dict }) {
	return (
		<section id="pricing" style={{ background: "var(--ink)", color: "var(--paper)" }}>
			<div className="container-x">
				<div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 56px" }}>
					<span className="eyebrow" style={{ color: landingAccents.eyebrowOnDark }}>
						{dict.pricing.eyebrow}
					</span>
					<h2
						className="display"
						style={{ fontSize: "clamp(44px, 6vw, 80px)", margin: "16px auto 14px", color: "var(--paper)" }}
					>
						<AccentInline pieces={dict.pricing.title} color="var(--sun)" />
					</h2>
					<p className="body-lg" style={{ color: darkBrand.inkSoft }}>
						{dict.pricing.body}
					</p>
				</div>

				<div
					className="grid-pricing"
					style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, maxWidth: 920, margin: "0 auto" }}
				>
					<div
						className="reveal card-lift"
						style={{
							background: darkBrand.paper2,
							border: "1px solid oklch(1 0 0 / 0.08)",
							borderRadius: 24,
							padding: 32,
							display: "flex",
							flexDirection: "column",
							gap: 20,
						}}
					>
						<div>
							<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
								<span style={{ fontSize: 22 }} aria-hidden="true">
									🍃
								</span>
								<span className="display" style={{ fontSize: 22, color: "var(--paper)" }}>
									{dict.pricing.freeName}
								</span>
							</div>
							<div style={{ color: landingAccents.mutedOnDark, fontSize: 14 }}>{dict.pricing.freeTagline}</div>
						</div>
						<div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
							<span className="display" style={{ fontSize: 56, color: "var(--paper)" }}>
								{dict.pricing.freePrice}
							</span>
							<span style={{ color: landingAccents.mutedOnDark, fontFamily: "var(--font-mono)" }}>
								{dict.pricing.freePeriod}
							</span>
						</div>
						<PricingList items={dict.pricing.freePerks} dim />
						<a
							className="btn"
							href={`https://${APP_HOST}/`}
							style={{ background: "var(--paper)", color: "var(--ink)", marginTop: "auto", justifyContent: "center" }}
						>
							{dict.pricing.freeCta} <ArrowIcon />
						</a>
					</div>

					<div
						className="reveal card-lift"
						style={{
							background: `linear-gradient(160deg, ${lightBrand.indigoDeep} 0%, ${landingAccents.indigoGradientEnd} 100%)`,
							border: "1px solid oklch(1 0 0 / 0.15)",
							borderRadius: 24,
							padding: 32,
							display: "flex",
							flexDirection: "column",
							gap: 20,
							position: "relative",
							overflow: "hidden",
						}}
					>
						<svg
							aria-hidden="true"
							viewBox="0 0 400 400"
							style={{
								position: "absolute",
								inset: 0,
								width: "100%",
								height: "100%",
								opacity: 0.12,
								pointerEvents: "none",
							}}
						>
							<g fill="none" stroke="white" strokeWidth="0.7">
								<path d="M0 100 Q 100 60, 200 90 T 400 80" />
								<path d="M0 130 Q 100 90, 200 120 T 400 110" />
								<path d="M0 160 Q 100 120, 200 150 T 400 140" />
								<path d="M0 190 Q 100 150, 200 180 T 400 170" />
								<path d="M0 220 Q 100 180, 200 210 T 400 200" />
								<path d="M0 250 Q 100 210, 200 240 T 400 230" />
								<path d="M0 280 Q 100 240, 200 270 T 400 260" />
							</g>
						</svg>
						<div style={{ position: "absolute", top: 22, right: 22 }}>
							<span
								style={{
									fontSize: 11,
									fontFamily: "var(--font-mono)",
									textTransform: "uppercase",
									letterSpacing: "0.1em",
									background: "var(--sun)",
									color: lightBrand.ink,
									padding: "4px 10px",
									borderRadius: 999,
									fontWeight: 700,
								}}
							>
								{dict.pricing.proBadge}
							</span>
						</div>
						<div style={{ position: "relative" }}>
							<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
								<span style={{ fontSize: 22 }} aria-hidden="true">
									⚡
								</span>
								<span className="display" style={{ fontSize: 22, color: "var(--paper)" }}>
									{dict.pricing.proName}
								</span>
							</div>
							<div style={{ color: landingAccents.lavender, fontSize: 14 }}>{dict.pricing.proTagline}</div>
						</div>
						<div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 6 }}>
							<span className="display" style={{ fontSize: 56, color: "var(--paper)" }}>
								{dict.pricing.proPrice}
							</span>
							<span style={{ color: landingAccents.lavender, fontFamily: "var(--font-mono)" }}>
								{dict.pricing.proPeriod}
							</span>
							<span
								style={{
									marginLeft: 10,
									color: landingAccents.lavenderDim,
									fontSize: 12,
									fontFamily: "var(--font-mono)",
								}}
							>
								{dict.pricing.proAlt}
							</span>
						</div>
						<div style={{ position: "relative" }}>
							<PricingList items={dict.pricing.proPerks} accent="var(--sun)" />
						</div>
						<a
							className="btn"
							href={`${REPO_URL}/issues`}
							style={{
								background: "var(--sun)",
								color: lightBrand.ink,
								marginTop: "auto",
								position: "relative",
								fontWeight: 700,
								justifyContent: "center",
							}}
						>
							{dict.pricing.proCta} <ArrowIcon />
						</a>
					</div>
				</div>

				<div
					style={{
						marginTop: 32,
						textAlign: "center",
						color: landingAccents.mutedOnDark,
						fontSize: 13,
						fontFamily: "var(--font-mono)",
					}}
				>
					{(() => {
						const parts = dict.pricing.selfHostNote.split(dict.pricing.selfHostLink);
						const before = parts[0] ?? "";
						const after = parts.slice(1).join(dict.pricing.selfHostLink);
						return (
							<>
								{before}
								<a href="/developers" style={{ color: "var(--sun)", textDecoration: "underline" }}>
									{dict.pricing.selfHostLink}
								</a>
								{after}
							</>
						);
					})()}
				</div>
			</div>
		</section>
	);
}
