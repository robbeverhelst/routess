import { ImageResponse } from "next/og";
import { getDict } from "@/lib/content";
import { getLocale } from "@/lib/locale";

export const runtime = "edge";
export const alt = "routess · plan routes for running, cycling & hiking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
	const locale = await getLocale();
	const dict = getDict(locale);

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				padding: "72px 80px",
				background:
					"radial-gradient(ellipse at 20% 0%, #d8efd6 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, #e2dcfb 0%, transparent 55%), #fdfaf2",
				fontFamily: "system-ui, sans-serif",
				color: "#1a1530",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 20 }}>
				<div
					style={{
						width: 64,
						height: 64,
						borderRadius: 14,
						background: "#5b3df5",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						boxShadow: "0 4px 18px rgba(91,61,245,0.3)",
					}}
				>
					<div
						style={{
							width: 12,
							height: 12,
							borderRadius: "50%",
							background: "#fff",
						}}
					/>
				</div>
				<div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }}>routess</div>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
				<div
					style={{
						fontSize: 96,
						fontWeight: 700,
						lineHeight: 1.05,
						letterSpacing: "-0.02em",
						maxWidth: 980,
					}}
				>
					{dict.meta.landing.title}
				</div>
				<div style={{ fontSize: 28, color: "#473e66", maxWidth: 920, lineHeight: 1.3 }}>
					{dict.meta.landing.description}
				</div>
			</div>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 18,
					fontSize: 20,
					color: "#473e66",
					fontFamily: "ui-monospace, monospace",
				}}
			>
				<span>run · cycle · walk</span>
				<span>·</span>
				<span>open source · MIT</span>
				<span>·</span>
				<span>{locale === "nl" ? "België" : "Belgium"}</span>
			</div>
		</div>,
		size,
	);
}
