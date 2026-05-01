import { I } from "./icons";
import { Btn, RDS_COLORS, SecTitle } from "./primitives";

export function EmptyActivity({
	onStartRecording,
	onConnect,
}: {
	onStartRecording?: () => void;
	onConnect?: () => void;
}) {
	return (
		<div
			style={{
				flex: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 40,
			}}
		>
			<div style={{ maxWidth: 340, textAlign: "center" }}>
				<div
					style={{
						width: 88,
						height: 88,
						margin: "0 auto 18px",
						borderRadius: 22,
						background: RDS_COLORS.accentSoft,
						color: RDS_COLORS.accent,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<I.activity size={36} />
				</div>
				<h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Nothing to show yet</h3>
				<p
					style={{
						fontSize: 13,
						color: RDS_COLORS.fgMuted,
						margin: "8px 0 20px",
						lineHeight: 1.55,
					}}
				>
					Once you record or sync a few rides, you'll see weekly volume, splits, and trends here.
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<Btn variant="primary" style={{ width: "100%" }} onClick={onStartRecording}>
						<I.play size={12} /> Start recording
					</Btn>
					<Btn style={{ width: "100%" }} onClick={onConnect} disabled>
						<I.refresh size={14} /> Connect Garmin / Strava
					</Btn>
				</div>
				<div
					style={{
						marginTop: 18,
						padding: 12,
						background: RDS_COLORS.bgInput,
						borderRadius: 8,
						fontSize: 11.5,
						color: RDS_COLORS.fgSubtle,
					}}
				>
					Or{" "}
					<button
						type="button"
						style={{
							color: RDS_COLORS.accent,
							fontWeight: 500,
							background: "transparent",
							border: 0,
							padding: 0,
							font: "inherit",
							cursor: "pointer",
						}}
					>
						upload past activities
					</button>{" "}
					as a bulk import.
				</div>
			</div>
		</div>
	);
}

export function EmptySearch({
	query,
	suggestions,
	onSuggest,
}: {
	query: string;
	suggestions: string[];
	onSuggest: (s: string) => void;
}) {
	return (
		<div
			style={{
				flex: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 40,
			}}
		>
			<div style={{ maxWidth: 320, textAlign: "center" }}>
				<div
					style={{
						width: 80,
						height: 80,
						margin: "0 auto 16px",
						borderRadius: 20,
						background: RDS_COLORS.bgInput,
						color: RDS_COLORS.fgMuted,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<I.search size={32} />
				</div>
				<h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>No results for "{query}"</h3>
				<p
					style={{
						fontSize: 13,
						color: RDS_COLORS.fgMuted,
						margin: "8px 0 18px",
						lineHeight: 1.55,
					}}
				>
					Check spelling, try a shorter query, or search by coordinates.
				</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
					<SecTitle>Try instead</SecTitle>
					{suggestions.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => onSuggest(s)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								padding: "8px 12px",
								borderRadius: 8,
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								fontSize: 12.5,
								color: "inherit",
								cursor: "pointer",
								textAlign: "left",
							}}
						>
							<I.search size={12} />
							<span>{s}</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
