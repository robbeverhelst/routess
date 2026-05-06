import { GoogleLogin } from "@react-oauth/google";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { CredentialResponse } from "@/lib/google-auth";
import { useUiStore } from "@/stores/uiStore";
import { useViewport } from "../hooks/useViewport";
import { I } from "./icons";
import { IconBtn, RDS_COLORS } from "./primitives";

export function GoogleIcon({ size = 18 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
			<title>Google</title>
			<path
				fill="#4285F4"
				d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
			/>
			<path
				fill="#34A853"
				d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
			/>
			<path
				fill="#FBBC05"
				d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.04l3.007-2.333z"
			/>
			<path
				fill="#EA4335"
				d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
			/>
		</svg>
	);
}

interface CustomGoogleButtonProps {
	onSuccess: (cred: CredentialResponse) => void | Promise<void>;
	onError: () => void;
	isLoading?: boolean;
	text?: "continue_with" | "signup_with" | "signin_with" | "signin";
}

export function CustomGoogleButton({
	onSuccess,
	onError,
	isLoading = false,
	text = "continue_with",
}: CustomGoogleButtonProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [buttonWidth, setButtonWidth] = useState(400);

	useEffect(() => {
		const node = containerRef.current;
		if (!node) return;

		const updateWidth = () => {
			const nextWidth = Math.max(220, Math.round(node.getBoundingClientRect().width));
			setButtonWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
		};

		updateWidth();

		if (typeof ResizeObserver === "undefined") return;

		const observer = new ResizeObserver(() => updateWidth());
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={containerRef}
			className="rds-google-btn"
			style={{
				width: "100%",
				minHeight: 40,
				display: "flex",
				justifyContent: "center",
				opacity: isLoading ? 0.6 : 1,
				pointerEvents: isLoading ? "none" : "auto",
				transition: "opacity 120ms",
			}}
		>
			<div style={{ colorScheme: "light" }}>
				<GoogleLogin
					onSuccess={onSuccess}
					onError={onError}
					auto_select={false}
					theme="outline"
					size="large"
					width={String(buttonWidth)}
					text={text}
				/>
			</div>
		</div>
	);
}

export function AuthThemeToggle() {
	const theme = useUiStore((s) => s.theme);
	const toggleTheme = useUiStore((s) => s.toggleTheme);
	return (
		<div
			style={{
				position: "absolute",
				top: 16,
				right: 16,
				zIndex: 5,
				background: RDS_COLORS.bgPanel,
				border: `1px solid ${RDS_COLORS.borderStrong}`,
				borderRadius: 999,
				padding: 4,
				boxShadow: "0 2px 8px oklch(0 0 0 / 0.08), 0 8px 24px -8px oklch(0 0 0 / 0.12)",
			}}
		>
			<IconBtn
				title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
				onClick={toggleTheme}
				style={{ width: 32, height: 32, color: RDS_COLORS.fg }}
			>
				{theme === "dark" ? <I.sun size={16} /> : <I.moon size={16} />}
			</IconBtn>
		</div>
	);
}

const ROUTE_PATH =
	"M30,360 C70,300 90,290 130,300 C170,310 180,250 220,230 C260,210 270,170 310,140 C340,118 360,80 380,40";

export function AuthHeroPanel() {
	return (
		<div
			style={{
				position: "relative",
				width: 440,
				height: 540,
				borderRadius: 22,
				overflow: "hidden",
				background: `linear-gradient(155deg,
					color-mix(in oklch, ${RDS_COLORS.accent} 88%, black),
					color-mix(in oklch, ${RDS_COLORS.accent} 78%, black) 55%,
					color-mix(in oklch, ${RDS_COLORS.accent} 65%, ${RDS_COLORS.success}))`,
				boxShadow: `
					0 1px 0 oklch(1 0 0 / 0.06) inset,
					0 20px 50px -12px color-mix(in oklch, ${RDS_COLORS.accent} 35%, transparent),
					0 40px 100px -24px oklch(0 0 0 / 0.28)
				`,
				border: "1px solid oklch(1 0 0 / 0.12)",
				color: "white",
				flexShrink: 0,
			}}
		>
			<div
				aria-hidden
				style={{
					position: "absolute",
					top: -80,
					right: -80,
					width: 280,
					height: 280,
					borderRadius: "50%",
					background: `radial-gradient(circle, color-mix(in oklch, ${RDS_COLORS.warn} 35%, transparent), transparent 70%)`,
					filter: "blur(60px)",
				}}
			/>
			<div
				aria-hidden
				style={{
					position: "absolute",
					bottom: -100,
					left: -60,
					width: 320,
					height: 320,
					borderRadius: "50%",
					background: `radial-gradient(circle, color-mix(in oklch, ${RDS_COLORS.success} 35%, transparent), transparent 65%)`,
					filter: "blur(70px)",
				}}
			/>

			<svg
				aria-hidden
				viewBox="0 0 400 400"
				style={{
					position: "absolute",
					top: 70,
					left: 0,
					width: "100%",
					height: 400,
					opacity: 0.95,
				}}
			>
				<title>Route preview</title>
				<g stroke="oklch(1 0 0 / 0.12)" fill="none" strokeWidth="1.2">
					<path d="M0,90 Q100,60 200,80 T400,75" />
					<path d="M0,140 Q100,110 200,130 T400,125" />
					<path d="M0,200 Q120,160 220,190 T400,180" />
					<path d="M0,260 Q120,220 230,250 T400,240" />
					<path d="M0,320 Q140,280 240,310 T400,300" />
				</g>

				<path d={ROUTE_PATH} stroke="oklch(1 0 0 / 0.25)" strokeWidth="10" fill="none" strokeLinecap="round" />
				<path
					className="rds-auth-route"
					d={ROUTE_PATH}
					stroke="white"
					strokeWidth="3.5"
					fill="none"
					strokeLinecap="round"
					strokeLinejoin="round"
					style={{
						filter: "drop-shadow(0 0 6px oklch(1 0 0 / 0.6))",
					}}
				/>

				<circle cx="30" cy="360" r="9" fill="white" />
				<circle cx="30" cy="360" r="4.5" fill={RDS_COLORS.success} />

				<circle cx="220" cy="230" r="6" fill="white" opacity="0.9" />

				<g className="rds-auth-pin">
					<circle cx="380" cy="40" r="11" fill="white" />
					<circle cx="380" cy="40" r="5.5" fill={RDS_COLORS.warn} />
				</g>
			</svg>

			<div
				aria-hidden
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					bottom: 0,
					height: 220,
					background: `linear-gradient(to top,
						color-mix(in oklch, ${RDS_COLORS.accent} 95%, black) 0%,
						color-mix(in oklch, ${RDS_COLORS.accent} 92%, black) 35%,
						transparent 100%)`,
					pointerEvents: "none",
				}}
			/>

			<div
				style={{
					position: "absolute",
					top: 28,
					left: 28,
					right: 28,
					display: "flex",
					alignItems: "center",
					gap: 10,
				}}
			>
				<I.compass size={16} style={{ opacity: 0.85 }} />
				<span style={{ fontSize: 12, fontWeight: 500, letterSpacing: 0.4, textTransform: "uppercase", opacity: 0.85 }}>
					routess
				</span>
			</div>

			<div
				style={{
					position: "absolute",
					top: 90,
					left: 28,
					right: 28,
					display: "flex",
					gap: 10,
					flexWrap: "wrap",
				}}
			>
				<HeroChip icon={<I.bike size={12} />} label="Cycling" />
				<HeroChip icon={<I.mountain size={12} />} label="2,840 m climb" />
				<HeroChip icon={<I.flag size={12} />} label="78 km" />
			</div>

			<div
				style={{
					position: "absolute",
					left: 28,
					right: 28,
					bottom: 28,
				}}
			>
				<div
					style={{
						fontSize: 24,
						fontWeight: 600,
						letterSpacing: -0.4,
						lineHeight: 1.15,
						marginBottom: 8,
					}}
				>
					Plan it. Save it.
					<br />
					Ride anywhere.
				</div>
				<div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5, maxWidth: 320 }}>
					Drop waypoints, sync across devices, and find your next favourite route.
				</div>
			</div>

			<style>{`
				.rds-auth-route {
					stroke-dasharray: 800;
					stroke-dashoffset: 800;
					animation: rds-route-draw 2.4s ease-out 0.2s forwards;
				}
				.rds-auth-pin {
					transform-origin: 380px 40px;
					opacity: 0;
					animation: rds-pin-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 2.4s forwards;
				}
				@keyframes rds-route-draw {
					to { stroke-dashoffset: 0; }
				}
				@keyframes rds-pin-pop {
					0% { transform: scale(0); opacity: 0; }
					100% { transform: scale(1); opacity: 1; }
				}
			`}</style>
		</div>
	);
}

function HeroChip({ icon, label }: { icon: ReactNode; label: string }) {
	return (
		<div
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				padding: "5px 10px",
				background: "oklch(1 0 0 / 0.16)",
				backdropFilter: "blur(8px)",
				border: "1px solid oklch(1 0 0 / 0.22)",
				borderRadius: 999,
				fontSize: 11.5,
				fontWeight: 500,
			}}
		>
			{icon}
			{label}
		</div>
	);
}

interface AuthLayoutProps {
	children: ReactNode;
	showHero?: boolean;
}

export function AuthLayout({ children, showHero = true }: AuthLayoutProps) {
	const { isMobile, isTablet } = useViewport();
	const compact = isMobile || isTablet;
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 36,
				width: "100%",
				maxWidth: 940,
			}}
		>
			{showHero && !compact && <AuthHeroPanel />}
			<div style={{ flexShrink: 0, width: 400, maxWidth: "100%" }}>{children}</div>
		</div>
	);
}

export function AuthBackdrop({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 24,
				background: `
					radial-gradient(ellipse 70% 60% at 12% 18%, color-mix(in oklch, ${RDS_COLORS.accent} 40%, transparent), transparent 55%),
					radial-gradient(ellipse 60% 55% at 88% 82%, color-mix(in oklch, ${RDS_COLORS.success} 30%, transparent), transparent 55%),
					linear-gradient(135deg,
						color-mix(in oklch, ${RDS_COLORS.accent} 22%, ${RDS_COLORS.bgCanvas}),
						color-mix(in oklch, ${RDS_COLORS.accent} 10%, ${RDS_COLORS.bgCanvas}) 50%,
						color-mix(in oklch, ${RDS_COLORS.success} 14%, ${RDS_COLORS.bgCanvas}))
				`,
				overflow: "auto",
			}}
		>
			<div
				aria-hidden
				style={{
					position: "absolute",
					top: "-15%",
					left: "-8%",
					width: 360,
					height: 360,
					borderRadius: "50%",
					background: `radial-gradient(circle, color-mix(in oklch, ${RDS_COLORS.accent} 50%, transparent), transparent 70%)`,
					filter: "blur(70px)",
					pointerEvents: "none",
				}}
			/>
			<div
				aria-hidden
				style={{
					position: "absolute",
					bottom: "-12%",
					right: "-8%",
					width: 420,
					height: 420,
					borderRadius: "50%",
					background: `radial-gradient(circle, color-mix(in oklch, ${RDS_COLORS.success} 38%, transparent), transparent 70%)`,
					filter: "blur(90px)",
					pointerEvents: "none",
				}}
			/>
			<div
				aria-hidden
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage: `linear-gradient(to right, color-mix(in oklch, ${RDS_COLORS.fg} 8%, transparent) 1px, transparent 1px),
					                  linear-gradient(to bottom, color-mix(in oklch, ${RDS_COLORS.fg} 8%, transparent) 1px, transparent 1px)`,
					backgroundSize: "48px 48px",
					maskImage: "radial-gradient(ellipse at center, black 5%, transparent 70%)",
					WebkitMaskImage: "radial-gradient(ellipse at center, black 5%, transparent 70%)",
					opacity: 0.4,
					pointerEvents: "none",
				}}
			/>
			<AuthThemeToggle />
			{children}
		</div>
	);
}

export const AUTH_CARD_STYLE = {
	position: "relative",
	background: RDS_COLORS.bgPanel,
	border: `1px solid ${RDS_COLORS.borderStrong}`,
	borderRadius: 18,
	boxShadow: `
		0 1px 0 oklch(0 0 0 / 0.04),
		0 12px 32px -10px color-mix(in oklch, var(--rds-accent) 18%, transparent),
		0 28px 70px -20px oklch(0 0 0 / 0.18)
	`,
	overflow: "hidden",
} as const;

export function AuthCardAccentBar() {
	return (
		<div
			aria-hidden
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				right: 0,
				height: 4,
				background: `linear-gradient(90deg,
					${RDS_COLORS.accent} 0%,
					color-mix(in oklch, ${RDS_COLORS.accent} 60%, ${RDS_COLORS.success}) 50%,
					${RDS_COLORS.success} 100%)`,
			}}
		/>
	);
}
