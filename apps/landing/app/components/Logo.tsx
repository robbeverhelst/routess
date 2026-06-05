import Image from "next/image";

export function Logo({ size = 32 }: { size?: number }) {
	return (
		<div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
			<Image
				src="/logo.png"
				alt=""
				width={size}
				height={size}
				priority
				style={{
					width: size,
					height: size,
					borderRadius: size * 0.22,
					boxShadow: "0 1px 3px rgba(0,0,0,.08)",
				}}
			/>
			<span
				style={{
					fontFamily: "var(--font-display)",
					fontWeight: 700,
					fontSize: 22,
					letterSpacing: "-0.02em",
				}}
			>
				routess
			</span>
		</div>
	);
}
