import type { Dict } from "@/lib/content";
import { APP_HOST } from "@/lib/i18n";
import { AccentLines } from "./AccentText";
import { HeroAppScreenshot } from "./HeroAppScreenshot";
import { ArrowIcon, CheckIcon, Dot } from "./Icons";

export function Hero({ dict }: { dict: Dict }) {
	return (
		<section className="topo-bg" style={{ padding: "60px 0 80px", overflow: "hidden" }}>
			<div className="container-x" style={{ position: "relative", zIndex: 2 }}>
				<div
					className="grid-hero"
					style={{
						display: "grid",
						gridTemplateColumns: "1.05fr 1fr",
						gap: 56,
						alignItems: "center",
						minHeight: "min(620px, 78vh)",
					}}
				>
					<div style={{ position: "relative", zIndex: 3 }}>
						<div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
							<span
								className="chip"
								style={{
									background: "var(--moss-soft)",
									borderColor: "transparent",
									color: "oklch(0.32 0.08 145)",
								}}
							>
								<Dot color="var(--moss)" /> {dict.hero.chip}
							</span>
						</div>

						<h1
							className="display"
							style={{
								fontSize: "clamp(48px, 6.4vw, 92px)",
								margin: "0 0 24px",
							}}
						>
							<AccentLines lines={dict.hero.headlineLines} />
						</h1>

						<p className="body-lg" style={{ maxWidth: 540, marginBottom: 36 }}>
							{dict.hero.body}
						</p>

						<div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
							<a className="btn btn-primary" href={`https://${APP_HOST}/`}>
								{dict.hero.ctaPrimary} <ArrowIcon />
							</a>
							<a className="btn btn-ghost" href="#features">
								{dict.hero.ctaSecondary} →
							</a>
						</div>

						<div
							style={{
								display: "flex",
								gap: 22,
								alignItems: "center",
								color: "var(--muted-color)",
								fontSize: 13,
								flexWrap: "wrap",
							}}
						>
							{dict.hero.bullets.map((b) => (
								<span key={b} style={{ display: "flex", alignItems: "center", gap: 8 }}>
									<CheckIcon /> {b}
								</span>
							))}
						</div>
					</div>

					<div className="hero-side">
						<HeroAppScreenshot />
					</div>
				</div>
			</div>
		</section>
	);
}
