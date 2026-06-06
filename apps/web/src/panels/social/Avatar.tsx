import { RDS_COLORS } from "../../components/primitives";

// Small avatar for profile summaries (not the signed-in user's UserAvatar).
export function Avatar({ name, avatar, size = 32 }: { name: string; avatar?: string | null; size?: number }) {
	const initials = name
		.split(/\s+/)
		.map((p) => p[0])
		.filter(Boolean)
		.slice(0, 2)
		.join("")
		.toUpperCase();
	if (avatar) {
		return (
			<img
				src={avatar}
				alt={name}
				width={size}
				height={size}
				style={{ borderRadius: 999, display: "block", objectFit: "cover", flexShrink: 0 }}
				referrerPolicy="no-referrer"
			/>
		);
	}
	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: 999,
				background: RDS_COLORS.accentSoft,
				color: RDS_COLORS.accent,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: size * 0.38,
				fontWeight: 600,
				flexShrink: 0,
			}}
		>
			{initials || "?"}
		</div>
	);
}
