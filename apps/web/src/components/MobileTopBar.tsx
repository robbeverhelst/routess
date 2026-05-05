import { useModalsStore } from "@/stores/modalsStore";
import { useUiStore } from "@/stores/uiStore";
import { I } from "./icons";
import { IconBtn, RDS_COLORS } from "./primitives";
import { UserAvatar } from "./UserAvatar";

export function MobileTopBar() {
	const { theme, toggleTheme } = useUiStore();
	const openModal = useModalsStore((s) => s.openModal);

	return (
		<header
			style={{
				position: "absolute",
				top: "max(10px, calc(var(--rds-safe-top) + 6px))",
				left: "max(10px, var(--rds-safe-left))",
				right: "max(10px, var(--rds-safe-right))",
				height: 48,
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "0 10px 0 12px",
				background: `color-mix(in oklch, ${RDS_COLORS.bgPanel} 88%, transparent)`,
				backdropFilter: "blur(16px) saturate(150%)",
				WebkitBackdropFilter: "blur(16px) saturate(150%)",
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 18,
				boxShadow:
					"0 1px 0 oklch(1 0 0 / 0.06) inset, 0 8px 24px -8px oklch(0 0 0 / 0.18), 0 24px 48px -16px oklch(0 0 0 / 0.18)",
				zIndex: 7,
			}}
		>
			<img
				src="/logo.png"
				alt="routess"
				width={26}
				height={26}
				style={{ borderRadius: 7, display: "block", flexShrink: 0 }}
			/>
			<span style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.1 }}>routess</span>
			<div style={{ flex: 1 }} />
			<IconBtn title="Search" onClick={() => openModal("search")}>
				<I.search size={18} />
			</IconBtn>
			<IconBtn title="Toggle theme" onClick={toggleTheme}>
				{theme === "dark" ? <I.sun size={18} /> : <I.moon size={18} />}
			</IconBtn>
			<UserAvatar size={30} compact />
		</header>
	);
}
