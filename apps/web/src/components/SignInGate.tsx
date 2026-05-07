import { emitAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { I } from "./icons";
import { Btn, RDS_COLORS } from "./primitives";

interface SignInGateProps {
	title: string;
	description: string;
	icon?: React.ComponentType<{ size?: number }>;
}

export function SignInGate({ title, description, icon: Icon = I.user }: SignInGateProps) {
	const t = useT();
	const goToSignIn = () => {
		emitAppEvent("routess:open-login");
	};

	const goToSignUp = () => {
		emitAppEvent("routess:open-signup");
	};

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
					<Icon size={36} />
				</div>
				<h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h3>
				<p
					style={{
						fontSize: 13,
						color: RDS_COLORS.fgMuted,
						marginTop: 8,
						marginBottom: 20,
						lineHeight: 1.5,
					}}
				>
					{description}
				</p>
				<div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
					<Btn onClick={goToSignUp}>{t("save.createAccount")}</Btn>
					<Btn variant="primary" onClick={goToSignIn}>
						<I.user size={14} /> {t("common.signIn")}
					</Btn>
				</div>
			</div>
		</div>
	);
}
