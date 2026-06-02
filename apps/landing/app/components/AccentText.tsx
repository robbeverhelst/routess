interface Piece {
	text: string;
	accent?: boolean;
}

const pieceKey = (p: Piece, i: number) => `${i}:${p.text}`;

export function AccentInline({ pieces, color = "var(--indigo)" }: { pieces: ReadonlyArray<Piece>; color?: string }) {
	return (
		<>
			{pieces.map((p, i) =>
				p.accent ? (
					<span key={pieceKey(p, i)} className="display-italic" style={{ color }}>
						{p.text}
					</span>
				) : (
					<span key={pieceKey(p, i)}>{p.text}</span>
				),
			)}
		</>
	);
}

export function AccentLines({ lines, color = "var(--indigo)" }: { lines: ReadonlyArray<Piece>; color?: string }) {
	return (
		<>
			{lines.map((line, i) => (
				<div key={pieceKey(line, i)} style={{ display: "block" }}>
					{line.accent ? (
						<span className="display-italic" style={{ color }}>
							{line.text}
						</span>
					) : (
						line.text
					)}
				</div>
			))}
		</>
	);
}
