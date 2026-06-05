import type { ArticleBlock, Inline, RichText } from "@/lib/articles/types";

function inlineKey(part: Inline): string {
	return typeof part === "string" ? part : part.text;
}

function richTextKey(content: RichText): string {
	return content.map(inlineKey).join("").slice(0, 64);
}

function blockKey(block: ArticleBlock): string {
	switch (block.kind) {
		case "h2":
		case "h3":
			return `${block.kind}:${block.text}`;
		case "p":
		case "note":
			return `${block.kind}:${richTextKey(block.content)}`;
		case "ul":
			return `ul:${richTextKey(block.items[0] ?? [])}`;
		case "table":
			return `table:${block.headers.join("|")}`;
		case "cta":
			return `cta:${block.href}`;
	}
}

export function RichTextSpan({ content }: { content: RichText }) {
	return (
		<>
			{content.map((part) => {
				if (typeof part === "string") return part;
				if (part.href) {
					return (
						<a key={part.text} className="article-link" href={part.href}>
							{part.text}
						</a>
					);
				}
				if (part.strong) return <strong key={part.text}>{part.text}</strong>;
				return part.text;
			})}
		</>
	);
}

function renderBlock(block: ArticleBlock) {
	const key = blockKey(block);
	switch (block.kind) {
		case "h2":
			return (
				<h2 key={key} className="display article-h2">
					{block.text}
				</h2>
			);
		case "h3":
			return (
				<h3 key={key} className="display article-h3">
					{block.text}
				</h3>
			);
		case "p":
			return (
				<p key={key} className="body-lg article-p">
					<RichTextSpan content={block.content} />
				</p>
			);
		case "ul":
			return (
				<ul key={key} className="body-lg article-ul">
					{block.items.map((item) => (
						<li key={richTextKey(item)}>
							<RichTextSpan content={item} />
						</li>
					))}
				</ul>
			);
		case "table":
			return (
				<div key={key} className="article-table-wrap">
					<table className="article-table">
						<thead>
							<tr>
								{block.headers.map((h) => (
									<th key={h}>{h}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{block.rows.map((row) => (
								<tr key={richTextKey(row[0] ?? [])}>
									{row.map((cell, cellIndex) => (
										<td key={`${block.headers[cellIndex] ?? cellIndex}:${richTextKey(cell)}`}>
											<RichTextSpan content={cell} />
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			);
		case "note":
			return (
				<div key={key} className="article-note">
					<RichTextSpan content={block.content} />
				</div>
			);
		case "cta":
			return (
				<p key={key} className="article-cta">
					<a className="btn btn-primary" href={block.href}>
						{block.label}
					</a>
				</p>
			);
	}
}

export function ArticleBlocks({ blocks }: { blocks: ReadonlyArray<ArticleBlock> }) {
	return <>{blocks.map(renderBlock)}</>;
}
