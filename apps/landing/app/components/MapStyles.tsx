import type { Dict } from "@/lib/content";
import dark from "../../public/previews/style-dark.webp";
import outdoors from "../../public/previews/style-outdoors.webp";
import satellite from "../../public/previews/style-satellite.webp";
import streets from "../../public/previews/style-streets.webp";
import { AccentInline } from "./AccentText";
import { BakedImage } from "./BakedImage";

// The same demo loop rendered across the app's map styles. Images are real
// tiles with real routed geometry, baked by `bun run screenshots`.
const STYLE_PREVIEWS = { streets, outdoors, satellite, dark } as const;

export function MapStyles({ dict }: { dict: Dict }) {
	return (
		<section id="features">
			<div className="container-x">
				<div className="section-header reveal">
					<span className="eyebrow">{dict.mapStyles.eyebrow}</span>
					<h2 className="display">
						<AccentInline pieces={dict.mapStyles.title} />
					</h2>
					<p className="body-lg">{dict.mapStyles.body}</p>
				</div>
				<div className="grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
					{dict.mapStyles.items.map((s, i) => (
						<div
							key={s.key}
							className="card card-lift reveal"
							style={{ overflow: "hidden", padding: 0, "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
						>
							<BakedImage
								src={STYLE_PREVIEWS[s.key]}
								style={{ width: "100%", aspectRatio: "21 / 16", objectFit: "cover", display: "block" }}
							/>
							<div style={{ padding: "12px 16px 14px" }}>
								<div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
								<div style={{ fontSize: 13, color: "var(--muted-color)", marginTop: 2 }}>{s.desc}</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
