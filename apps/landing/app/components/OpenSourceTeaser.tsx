import type { Dict } from "@/lib/content";
import { ArrowIcon, GhIcon } from "./Icons";

export function OpenSourceTeaser({ dict }: { dict: Dict }) {
	return (
		<section className="tight">
			<div className="container-x">
				<div
					className="card grid-2 reveal"
					style={{
						padding: "44px 48px",
						display: "grid",
						gridTemplateColumns: "1fr auto",
						gap: 32,
						alignItems: "center",
						background: "linear-gradient(120deg, var(--indigo-soft) 0%, var(--paper) 60%)",
						borderColor: "transparent",
					}}
				>
					<div>
						<div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
							<GhIcon />
							<span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-soft)" }}>
								{dict.openSource.repo}
							</span>
						</div>
						<h3 className="display" style={{ fontSize: 32, margin: "0 0 10px" }}>
							{dict.openSource.title}
						</h3>
						<p style={{ margin: 0, color: "var(--ink-soft)", maxWidth: 560 }}>{dict.openSource.body}</p>
					</div>
					<a className="btn btn-primary" href="/developers">
						{dict.openSource.cta} <ArrowIcon />
					</a>
				</div>
			</div>
		</section>
	);
}
