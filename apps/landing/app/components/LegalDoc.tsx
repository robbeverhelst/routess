import type { LegalBlock, LegalDocument } from "@/lib/legal/types";

function Block({ block }: { block: LegalBlock }) {
	if (block.kind === "p") {
		return <p style={{ marginBottom: 16, lineHeight: 1.7, color: "var(--ink-soft)" }}>{block.text}</p>;
	}

	if (block.kind === "ul") {
		return (
			<ul style={{ margin: "0 0 20px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
				{block.items.map((item) => (
					<li key={item} style={{ lineHeight: 1.7, color: "var(--ink-soft)" }}>
						{item}
					</li>
				))}
			</ul>
		);
	}

	return (
		<div className="article-table-wrap">
			<table className="article-table">
				<thead>
					<tr>
						{block.head.map((cell) => (
							<th key={cell}>{cell}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{block.rows.map((row) => (
						<tr key={row.join("|")}>
							{row.map((cell) => (
								<td key={cell}>{cell}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function LegalDoc({ doc }: { doc: LegalDocument }) {
	return (
		<section className="topo-bg" style={{ padding: "60px 0 90px" }}>
			<div className="container-x">
				<div style={{ maxWidth: 820 }}>
					<div className="eyebrow" style={{ marginBottom: 14 }}>
						{doc.updatedLabel} {doc.updated}
					</div>
					<h1 className="display" style={{ fontSize: "clamp(40px, 5vw, 68px)", margin: "0 0 20px" }}>
						{doc.title}
					</h1>
					<p className="body-lg" style={{ marginBottom: 40 }}>
						{doc.intro}
					</p>

					<nav className="card card-pad" style={{ marginBottom: 48 }}>
						<div className="eyebrow" style={{ marginBottom: 12 }}>
							{doc.tocLabel}
						</div>
						<ol
							style={{
								margin: 0,
								paddingLeft: 20,
								display: "flex",
								flexDirection: "column",
								gap: 6,
								fontSize: 14,
							}}
						>
							{doc.sections.map((s) => (
								<li key={s.id}>
									<a href={`#${s.id}`} style={{ color: "var(--ink-soft)" }}>
										{s.h}
									</a>
								</li>
							))}
						</ol>
					</nav>

					{doc.sections.map((s) => (
						<div key={s.id} id={s.id} style={{ marginBottom: 44, scrollMarginTop: 90 }}>
							<h2 className="display" style={{ fontSize: 28, margin: "0 0 14px" }}>
								{s.h}
							</h2>
							{s.blocks.map((block, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: blocks are static content, never reordered
								<Block key={i} block={block} />
							))}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
