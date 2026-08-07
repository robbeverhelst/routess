import { useAuthStatus } from "@/lib/api-queries";
import { emitAppEvent } from "@/lib/app-events";
import { I } from "./icons";
import { RDS_COLORS } from "./primitives";
import { Tooltip } from "./Tooltip";

interface UserAvatarProps {
	size?: number;
	onClick?: () => void;
	title?: string;
	/**
	 * When true, the signed-out state renders as a compact circular icon button
	 * (no "Sign in" label). Use in narrow contexts like the rail nav.
	 */
	compact?: boolean;
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
	if (name) {
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2 && parts[0] && parts[1]) {
			return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
		}
		return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
	}
	if (email) return email.slice(0, 2).toUpperCase();
	return "??";
}

/**
 * Renders the current user's avatar (Google picture or initials), or a "sign in"
 * affordance when no user is signed in. Click opens the account screen for signed-in
 * users, or the login screen for guests.
 */
export function UserAvatar({ size = 30, onClick, title, compact = false }: UserAvatarProps) {
	const { data: auth } = useAuthStatus();
	const user = auth?.user ?? null;
	const isAuthenticated = !!auth?.isAuthenticated;

	const handleClick = () => {
		if (onClick) {
			onClick();
			return;
		}
		if (isAuthenticated) {
			emitAppEvent("routess:open-user-settings");
		} else {
			emitAppEvent("routess:open-login", { entryPoint: "header_avatar" });
		}
	};

	const fontSize = Math.max(10, Math.round(size * 0.36));

	if (!isAuthenticated) {
		if (compact) {
			return (
				<Tooltip label={title ?? "Sign in"}>
					<button
						type="button"
						onClick={handleClick}
						aria-label="Sign in"
						style={{
							width: size,
							height: size,
							borderRadius: 999,
							border: `1px solid ${RDS_COLORS.accent}`,
							background: RDS_COLORS.accentSoft,
							color: RDS_COLORS.accent,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							cursor: "pointer",
							padding: 0,
						}}
					>
						<I.user size={Math.round(size * 0.5)} />
					</button>
				</Tooltip>
			);
		}
		return (
			<Tooltip label={title}>
				<button
					type="button"
					onClick={handleClick}
					style={{
						height: size,
						padding: `0 ${Math.max(10, Math.round(size * 0.4))}px`,
						borderRadius: 999,
						border: `1px solid ${RDS_COLORS.accent}`,
						background: RDS_COLORS.accentSoft,
						color: RDS_COLORS.accent,
						fontSize,
						fontWeight: 600,
						cursor: "pointer",
						display: "inline-flex",
						alignItems: "center",
						gap: 6,
					}}
				>
					<I.user size={Math.round(size * 0.45)} />
					Sign in
				</button>
			</Tooltip>
		);
	}

	const initials = getInitials(user?.name, user?.email);

	return (
		<Tooltip label={title ?? user?.name ?? user?.email ?? "Account"}>
			<button
				type="button"
				onClick={handleClick}
				aria-label={user?.name ?? user?.email ?? "Account"}
				style={{
					width: size,
					height: size,
					borderRadius: 999,
					background: user?.avatar
						? "transparent"
						: `linear-gradient(135deg, ${RDS_COLORS.accent}, oklch(0.65 0.15 200))`,
					color: "white",
					border: 0,
					padding: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize,
					fontWeight: 600,
					cursor: "pointer",
					overflow: "hidden",
				}}
			>
				{user?.avatar ? (
					<img
						src={user.avatar}
						alt={user.name ?? "avatar"}
						style={{ width: "100%", height: "100%", objectFit: "cover" }}
					/>
				) : (
					initials
				)}
			</button>
		</Tooltip>
	);
}
