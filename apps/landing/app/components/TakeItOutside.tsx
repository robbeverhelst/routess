import Image from "next/image";
import type { Dict } from "@/lib/content";
import { AccentInline } from "./AccentText";

// Phone-framed capture of the real mobile layout plus the GPX in/out story.
export function TakeItOutside({ dict }: { dict: Dict }) {
	return (
		<section style={{ background: "var(--paper-2)" }}>
			<div className="container-x">
				<div
					className="grid-2"
					style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 60, alignItems: "center" }}
				>
					<div className="reveal" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
						{/* CSS phone frame around the real mobile screenshot. */}
						<div
							className="float-slow"
							style={{
								width: 280,
								borderRadius: 40,
								border: "10px solid var(--ink)",
								overflow: "hidden",
								boxShadow: "0 30px 60px oklch(0.2 0.02 270 / 0.25)",
								background: "var(--ink)",
							}}
						>
							<Image
								src="/app-mobile.png"
								alt=""
								width={780}
								height={1600}
								sizes="280px"
								style={{ width: "100%", display: "block", borderRadius: 30 }}
							/>
						</div>
						<span style={{ fontSize: 12, color: "var(--muted-color)", fontFamily: "var(--font-mono)" }}>
							{dict.outside.phoneCaption}
						</span>
					</div>

					<div className="reveal" style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
						<span className="eyebrow">{dict.outside.eyebrow}</span>
						<h2 className="display" style={{ fontSize: "clamp(36px, 4.4vw, 64px)", margin: "14px 0 18px" }}>
							<AccentInline pieces={dict.outside.title} />
						</h2>
						<p className="body-lg" style={{ marginBottom: 28 }}>
							{dict.outside.body}
						</p>
						<ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
							{dict.outside.bullets.map((t) => (
								<li key={t} style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--ink-soft)" }}>
									<span
										style={{
											width: 18,
											height: 18,
											borderRadius: "50%",
											background: "var(--moss)",
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											color: "white",
											fontSize: 11,
										}}
										aria-hidden="true"
									>
										✓
									</span>
									{t}
								</li>
							))}
						</ul>
					</div>
				</div>
			</div>
		</section>
	);
}
