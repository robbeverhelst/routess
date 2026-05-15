import { useMemo, useState } from "react";
import { useAuthStatus } from "@/lib/api-queries";
import { type SupportedLanguage, t } from "@/lib/i18n";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

interface Field {
	labelKey: string;
	value: string;
	editable?: boolean;
	managedKey?: string;
}

function buildFields(_language: SupportedLanguage, name: string | null, email: string | null): Field[] {
	const dash = t("account.dash");
	const username = email?.split("@")[0] ?? t("account.guest");
	return [
		{ labelKey: "account.field.name", value: name ?? dash },
		{ labelKey: "account.field.email", value: email ?? dash },
		{ labelKey: "account.field.username", value: username, editable: true },
		{
			labelKey: "account.field.password",
			value: t("account.passwordManagedInSettings"),
			managedKey: "account.passwordManageHint",
		},
		{ labelKey: "account.field.twofactor", value: t("account.comingSoon") },
		{ labelKey: "account.field.connected", value: t("account.connectedNone"), editable: true },
	];
}

export function AccountScreen() {
	const { data: auth } = useAuthStatus();
	const user = auth?.user ?? null;
	const pushToast = useToastStore((s) => s.push);
	const language = useUiStore((s) => s.language);

	const initialFields = useMemo<Field[]>(
		() => buildFields(language, user?.name ?? null, user?.email ?? null),
		[language, user?.name, user?.email],
	);

	const [fields, setFields] = useState<Field[]>(initialFields);

	if (fields.length > 0 && fields[0]?.value !== initialFields[0]?.value) {
		setFields(initialFields);
	}

	const handleEdit = (index: number) => {
		const field = fields[index];
		if (!field) return;
		const label = t(field.labelKey);
		if (!field.editable) {
			pushToast({
				kind: "info",
				title: t("account.readonly", { label }),
				body: field.managedKey ? t("account.readonlySub", { managed: t(field.managedKey) }) : undefined,
			});
			return;
		}
		const next = window.prompt(t("account.editPrompt", { label }), field.value);
		if (next == null) return;
		const trimmed = next.trim();
		if (!trimmed) return;
		setFields((prev) => prev.map((f, i) => (i === index ? { ...f, value: trimmed } : f)));
	};

	const handleDeleteAccount = () => {
		const confirmed = window.confirm(t("account.deleteConfirm"));
		if (!confirmed) return;
		pushToast({
			kind: "info",
			title: t("account.deleteToast.title"),
			body: t("account.deleteToast.body"),
		});
	};

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: RDS_COLORS.bgCanvas,
				overflow: "auto",
			}}
		>
			<div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
				<SecTitle>{t("nav.settings")}</SecTitle>
				<h1 style={{ fontSize: 26, fontWeight: 600, margin: "4px 0 0", letterSpacing: -0.5 }}>
					{t("account.heading")}
				</h1>

				<div
					style={{
						marginTop: 24,
						padding: 20,
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 12,
					}}
				>
					<SecTitle style={{ marginBottom: 14 }}>{t("account.title")}</SecTitle>
					{fields.map((f, i) => (
						<div
							key={f.labelKey}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: "10px 0",
								borderBottom: i < fields.length - 1 ? `1px solid ${RDS_COLORS.border}` : "none",
							}}
						>
							<div style={{ fontSize: 13, color: RDS_COLORS.fgMuted, width: 110 }}>{t(f.labelKey)}</div>
							<div style={{ flex: 1, fontSize: 13 }}>{f.value}</div>
							<Btn
								variant="ghost"
								style={{ height: 28, padding: "0 10px", fontSize: 12 }}
								onClick={() => handleEdit(i)}
								disabled={f.editable}
								title={f.editable ? t("common.comingSoon") : undefined}
							>
								{f.editable ? t("account.soon") : t("common.edit")}
							</Btn>
						</div>
					))}
				</div>

				<div
					style={{
						marginTop: 24,
						padding: 20,
						border: `1px solid color-mix(in oklch, ${RDS_COLORS.danger} 40%, ${RDS_COLORS.border})`,
						borderRadius: 12,
					}}
				>
					<SecTitle style={{ marginBottom: 12, color: RDS_COLORS.danger }}>{t("account.danger")}</SecTitle>
					<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
						<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
							<div style={{ fontSize: 13, fontWeight: 500 }}>{t("account.deleteAccount")}</div>
							<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted, marginTop: 2 }}>
								{t("account.deleteAccountSub")}
							</div>
						</div>
						<Btn
							onClick={handleDeleteAccount}
							disabled
							title={t("common.comingSoon")}
							style={{
								background: "transparent",
								color: RDS_COLORS.danger,
								borderColor: `color-mix(in oklch, ${RDS_COLORS.danger} 40%, ${RDS_COLORS.border})`,
							}}
						>
							{t("common.delete")}
						</Btn>
					</div>
				</div>
			</div>
		</div>
	);
}
