import Image from "next/image";
import type { Dict } from "@/lib/content";
import { AccentInline } from "./AccentText";

// The same demo loop rendered across the app's map styles. Images are real
// tiles with real routed geometry, baked by `bun run screenshots`.
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
							<Image
								src={`/previews/style-${s.key}.png`}
								alt=""
								width={840}
								height={640}
								sizes="(max-width: 900px) 100vw, 320px"
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
