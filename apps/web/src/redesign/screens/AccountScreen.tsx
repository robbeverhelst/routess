import { useMemo, useState } from "react";
import { useAuthStatus } from "@/lib/api-queries";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";
import { useToastStore } from "../stores/toastStore";

interface Field {
	label: string;
	value: string;
	editable?: boolean;
	managed?: string;
}

export function AccountScreen() {
	const { data: auth } = useAuthStatus();
	const user = auth?.user ?? null;
	const pushToast = useToastStore((s) => s.push);

	const initialFields = useMemo<Field[]>(() => {
		const username = user?.email?.split("@")[0] ?? "guest";
		return [
			{ label: "Name", value: user?.name ?? "—", managed: "Google account" },
			{ label: "Email", value: user?.email ?? "—", managed: "Google account" },
			{ label: "Username", value: username, editable: true },
			// Below fields require backend support — left as TODO mocks.
			{ label: "Password", value: "Managed by Google", managed: "Google account" },
			{ label: "Two-factor", value: "Managed by Google", managed: "Google account" },
			{ label: "Connected", value: "None", editable: true },
		];
	}, [user]);

	const [fields, setFields] = useState<Field[]>(initialFields);

	// Resync when auth user changes (e.g. after sign-in).
	if (fields.length > 0 && fields[0]?.value !== initialFields[0]?.value) {
		setFields(initialFields);
	}

	const handleEdit = (index: number) => {
		const field = fields[index];
		if (!field) return;
		if (!field.editable) {
			pushToast({
				kind: "info",
				title: `${field.label} is read-only`,
				body: field.managed ? `This field is managed via your ${field.managed}.` : undefined,
			});
			return;
		}
		const next = window.prompt(`Edit ${field.label}`, field.value);
		if (next == null) return;
		const trimmed = next.trim();
		if (!trimmed) return;
		setFields((prev) => prev.map((f, i) => (i === index ? { ...f, value: trimmed } : f)));
		// TODO: persist edited field to backend once the user-profile endpoint lands.
	};

	const handleDeleteAccount = () => {
		const confirmed = window.confirm(
			"Are you sure you want to permanently delete your account? All routes, activities, and data will be lost. This cannot be undone.",
		);
		if (!confirmed) return;
		pushToast({
			kind: "info",
			title: "Account deletion coming soon",
			body: "We'll wire this to the backend deletion endpoint when it lands.",
		});
		// TODO: wire to backend deletion endpoint
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
				<SecTitle>Settings</SecTitle>
				<h1 style={{ fontSize: 26, fontWeight: 600, margin: "4px 0 0", letterSpacing: -0.5 }}>Account & billing</h1>

				{/* Account details */}
				<div
					style={{
						marginTop: 24,
						padding: 20,
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 12,
					}}
				>
					<SecTitle style={{ marginBottom: 14 }}>Account</SecTitle>
					{fields.map((f, i) => (
						<div
							key={f.label}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: "10px 0",
								borderBottom: i < fields.length - 1 ? `1px solid ${RDS_COLORS.border}` : "none",
							}}
						>
							<div style={{ fontSize: 13, color: RDS_COLORS.fgMuted, width: 110 }}>{f.label}</div>
							<div style={{ flex: 1, fontSize: 13 }}>{f.value}</div>
							<Btn
								variant="ghost"
								style={{ height: 28, padding: "0 10px", fontSize: 12 }}
								onClick={() => handleEdit(i)}
								disabled={f.editable}
								title={f.editable ? "Coming soon" : undefined}
							>
								{f.editable ? "Soon" : "Edit"}
							</Btn>
						</div>
					))}
				</div>

				{/* Danger zone */}
				<div
					style={{
						marginTop: 24,
						padding: 20,
						border: `1px solid color-mix(in oklch, ${RDS_COLORS.danger} 40%, ${RDS_COLORS.border})`,
						borderRadius: 12,
					}}
				>
					<SecTitle style={{ marginBottom: 12, color: RDS_COLORS.danger }}>Danger zone</SecTitle>
					<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
						<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
							<div style={{ fontSize: 13, fontWeight: 500 }}>Delete account</div>
							<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted, marginTop: 2 }}>
								Permanently delete your account and all routes. This cannot be undone.
							</div>
						</div>
						<Btn
							onClick={handleDeleteAccount}
							disabled
							title="Coming soon"
							style={{
								background: "transparent",
								color: RDS_COLORS.danger,
								borderColor: `color-mix(in oklch, ${RDS_COLORS.danger} 40%, ${RDS_COLORS.border})`,
							}}
						>
							Delete
						</Btn>
					</div>
				</div>
			</div>
		</div>
	);
}
