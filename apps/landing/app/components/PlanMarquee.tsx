import type { Dict } from "@/lib/content";

const COPIES = ["a", "b"] as const;

export function PlanMarquee({ dict }: { dict: Dict }) {
	return (
		<section
			className="tight"
			style={{
				padding: "32px 0",
				borderTop: "1px solid var(--line)",
				borderBottom: "1px solid var(--line)",
				overflow: "hidden",
			}}
			aria-hidden="true"
		>
			<div className="marquee mono" style={{ fontSize: 14, color: "var(--ink-soft)" }}>
				{COPIES.flatMap((copy) =>
					dict.marquee.map((t) => (
						<span key={`${copy}:${t}`} style={{ display: "flex", alignItems: "center", gap: 14, whiteSpace: "nowrap" }}>
							{t}
							<span style={{ color: "var(--muted-color)" }}>{"•••"}</span>
						</span>
					)),
				)}
			</div>
		</section>
	);
}
