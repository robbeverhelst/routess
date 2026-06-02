import type { Dict } from "@/lib/content";

const SOFT_BY_INDEX = ["var(--indigo-soft)", "var(--sky-soft)", "var(--moss-soft)"];
const COLOR_BY_INDEX = ["var(--indigo)", "var(--sky)", "var(--moss)"];
const ICON_BY_INDEX = ["🏃", "🚴", "🥾"];

export function Modes({ dict }: { dict: Dict }) {
	return (
		<section id="features">
			<div className="container-x">
				<div className="section-header">
					<span className="eyebrow">{dict.modes.eyebrow}</span>
					<h2 className="display">{dict.modes.title}</h2>
					<p className="body-lg">{dict.modes.body}</p>
				</div>
				<div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
					{dict.modes.items.map((it, i) => (
						<div
							key={it.mode}
							className="card card-pad"
							style={{ position: "relative", overflow: "hidden", minHeight: 300 }}
						>
							<div
								style={{
									position: "absolute",
									inset: "auto -30px -30px auto",
									width: 180,
									height: 180,
									borderRadius: "50%",
									background: SOFT_BY_INDEX[i] ?? "var(--indigo-soft)",
									opacity: 0.7,
								}}
								aria-hidden="true"
							/>
							<div style={{ position: "relative" }}>
								<div
									style={{
										width: 56,
										height: 56,
										borderRadius: 18,
										background: COLOR_BY_INDEX[i] ?? "var(--indigo)",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontSize: 28,
										marginBottom: 24,
									}}
									aria-hidden="true"
								>
									{ICON_BY_INDEX[i]}
								</div>
								<h3 className="display" style={{ fontSize: 28, margin: "0 0 10px" }}>
									{it.mode}
								</h3>
								<p style={{ color: "var(--ink-soft)", fontSize: 15, lineHeight: 1.5, margin: 0, maxWidth: 240 }}>
									{it.copy}
								</p>
								<div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px dashed var(--line)" }}>
									<div
										style={{
											fontSize: 11,
											color: "var(--muted-color)",
											fontFamily: "var(--font-mono)",
											textTransform: "uppercase",
											letterSpacing: "0.08em",
										}}
									>
										{it.statLabel}
									</div>
									<div className="display" style={{ fontSize: 24, marginTop: 4 }}>
										{it.stat}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
