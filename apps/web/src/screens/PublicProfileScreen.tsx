import { useEffect } from "react";
import { useT } from "@/lib/i18n";
import { I } from "../components/icons";
import { Btn, RDS_COLORS } from "../components/primitives";
import { ProfileView } from "../panels/social/ProfileView";

// Interactive twin of the landing host's /u/{handle} page (ADR 0025 pattern).
export function PublicProfileScreen({ handle }: { handle: string }) {
	const t = useT();

	useEffect(() => {
		document.title = `@${handle} · routess`;
	}, [handle]);

	return (
		<div style={{ minHeight: "100svh", display: "flex", flexDirection: "column", background: RDS_COLORS.bgCanvas }}>
			<header
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					padding: "14px 20px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<a
					href="/"
					style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: RDS_COLORS.fg }}
				>
					<I.route size={18} />
					<span style={{ fontWeight: 600, fontSize: 14, letterSpacing: -0.2 }}>routess</span>
				</a>
				<div style={{ flex: 1 }} />
				<a href="/" style={{ textDecoration: "none" }}>
					<Btn variant="ghost">{t("public.signIn")}</Btn>
				</a>
			</header>
			<main style={{ flex: 1, maxWidth: 720, width: "100%", margin: "0 auto" }}>
				<ProfileView handle={handle} followSource="public_route" />
			</main>
		</div>
	);
}
