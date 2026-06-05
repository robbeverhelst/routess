import type { ApiPatScope, ApiPersonalAccessToken } from "@routess/api-client";
import { useState } from "react";
import { useCreatePersonalAccessToken, usePersonalAccessTokens, useRevokePersonalAccessToken } from "@/lib/api-queries";
import { t } from "@/lib/i18n";
import { API_REFERENCE_URL } from "@/lib/links";
import { useToastStore } from "@/stores/toastStore";
import { I } from "../components/icons";
import { Badge, Btn, RDS_COLORS } from "../components/primitives";
import { Field, Select, SettingsBlock, SettingsRow, SettingsSection, TextInput } from "../components/settings";

// API tokens section of SettingsPanel. The mint endpoint returns the
// plaintext exactly once; we show it in a clearly-marked panel with a
// copy button and a Done action to dismiss. After dismissal the row
// drops back to the list, where only metadata is ever shown.

function formatRelative(iso: string | null): string {
	if (!iso) return t("settings.tokens.lastUsedNever");
	const when = new Date(iso);
	const diffMs = Date.now() - when.getTime();
	const seconds = Math.round(diffMs / 1000);
	const minutes = Math.round(seconds / 60);
	const hours = Math.round(minutes / 60);
	const days = Math.round(hours / 24);
	if (seconds < 60) return `${seconds}s ago`;
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 30) return `${days}d ago`;
	return when.toLocaleDateString();
}

function TokenRow({ token }: { token: ApiPersonalAccessToken }) {
	const revoke = useRevokePersonalAccessToken();
	const pushToast = useToastStore((s) => s.push);

	const handleRevoke = () => {
		const ok = window.confirm(t("settings.tokens.revokeConfirm").replace("{label}", token.label));
		if (!ok) return;
		revoke.mutate(token.id, {
			onError: () => {
				pushToast({ kind: "error", title: t("settings.tokens.revokeFailed") });
			},
		});
	};

	const subtitle = [
		token.scope === "write" ? t("settings.tokens.scopeWriteShort") : t("settings.tokens.scopeReadShort"),
		t("settings.tokens.lastUsed").replace("{when}", formatRelative(token.lastUsedAt)),
		token.expiresAt
			? t("settings.tokens.expires").replace("{when}", new Date(token.expiresAt).toLocaleDateString())
			: t("settings.tokens.noExpiry"),
	].join(" · ");

	return (
		<SettingsRow
			label={
				<span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
					<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{token.label}</span>
					<Badge variant={token.scope === "write" ? "accent" : "default"}>
						{token.scope === "write" ? t("settings.tokens.scopeWriteShort") : t("settings.tokens.scopeReadShort")}
					</Badge>
				</span>
			}
			sub={subtitle}
			control={
				<Btn variant="ghost" onClick={handleRevoke} disabled={revoke.isPending} style={{ color: RDS_COLORS.danger }}>
					{revoke.isPending ? t("settings.tokens.revoking") : t("settings.tokens.revoke")}
				</Btn>
			}
		/>
	);
}

interface CreateFormProps {
	onSecretRevealed: (token: string) => void;
	onCancel: () => void;
}

function CreateForm({ onSecretRevealed, onCancel }: CreateFormProps) {
	const create = useCreatePersonalAccessToken();
	const pushToast = useToastStore((s) => s.push);
	const [label, setLabel] = useState("");
	const [scope, setScope] = useState<ApiPatScope>("read");
	const [expiresAt, setExpiresAt] = useState("");

	const canSubmit = label.trim().length > 0 && !create.isPending;

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!canSubmit) return;
		create.mutate(
			{
				label: label.trim(),
				scope,
				...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
			},
			{
				onSuccess: (result) => {
					onSecretRevealed(result.token);
				},
				onError: () => {
					pushToast({ kind: "error", title: t("settings.tokens.createFailed") });
				},
			},
		);
	};

	return (
		<SettingsBlock>
			<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
				<Field label={t("settings.tokens.labelField")}>
					<TextInput
						type="text"
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						placeholder={t("settings.tokens.labelPlaceholder")}
						maxLength={80}
					/>
				</Field>
				<Field label={t("settings.tokens.scopeField")}>
					<Select value={scope} onChange={(e) => setScope(e.target.value as ApiPatScope)}>
						<option value="read">{t("settings.tokens.scopeRead")}</option>
						<option value="write">{t("settings.tokens.scopeWrite")}</option>
					</Select>
				</Field>
				<Field label={t("settings.tokens.expiresField")}>
					<TextInput
						type="date"
						value={expiresAt}
						onChange={(e) => setExpiresAt(e.target.value)}
						placeholder={t("settings.tokens.expiresPlaceholder")}
					/>
				</Field>
				<div style={{ display: "flex", gap: 8, marginTop: 4 }}>
					<Btn type="submit" variant="primary" disabled={!canSubmit}>
						{t("settings.tokens.create")}
					</Btn>
					<Btn variant="ghost" onClick={onCancel} disabled={create.isPending}>
						{t("settings.tokens.cancel")}
					</Btn>
				</div>
			</form>
		</SettingsBlock>
	);
}

interface RevealProps {
	token: string;
	onDone: () => void;
}

function Reveal({ token, onDone }: RevealProps) {
	const [copied, setCopied] = useState(false);
	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(token);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// clipboard API can fail in non-secure contexts; the textarea below
			// is the user's fallback to select and copy manually.
		}
	};
	return (
		<SettingsBlock style={{ display: "flex", flexDirection: "column", gap: 10 }}>
			<div style={{ fontSize: 13, color: RDS_COLORS.fg, fontWeight: 500 }}>{t("settings.tokens.revealTitle")}</div>
			<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>{t("settings.tokens.revealBody")}</div>
			<textarea
				readOnly
				value={token}
				onFocus={(e) => e.currentTarget.select()}
				rows={3}
				style={{
					width: "100%",
					padding: "8px 10px",
					fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
					fontSize: 12,
					borderRadius: "var(--rds-radius-sm)",
					background: RDS_COLORS.bgInput,
					color: RDS_COLORS.fg,
					border: `1px solid ${RDS_COLORS.border}`,
					resize: "none",
					wordBreak: "break-all",
				}}
			/>
			<div style={{ display: "flex", gap: 8 }}>
				<Btn variant="primary" onClick={handleCopy}>
					{copied ? t("settings.tokens.copied") : t("settings.tokens.copy")}
				</Btn>
				<Btn variant="ghost" onClick={onDone}>
					{t("settings.tokens.done")}
				</Btn>
			</div>
		</SettingsBlock>
	);
}

export function ApiTokensSection() {
	const tokensQuery = usePersonalAccessTokens();
	const [mode, setMode] = useState<"list" | "creating" | { reveal: string }>("list");

	const tokens = tokensQuery.data ?? [];

	return (
		<SettingsSection
			title={t("settings.tokens.title")}
			footer={
				<a
					href={API_REFERENCE_URL}
					target="_blank"
					rel="noreferrer"
					style={{ display: "inline-flex", alignItems: "center", gap: 4, color: RDS_COLORS.fgMuted }}
				>
					{t("settings.tokens.docs")} <I.externalLink size={11} />
				</a>
			}
		>
			{tokens.length === 0 && mode === "list" && (
				<div style={{ padding: "12px 14px", fontSize: 12.5, color: RDS_COLORS.fgSubtle }}>
					{t("settings.tokens.empty")}
				</div>
			)}
			{tokens.map((token) => (
				<TokenRow key={token.id} token={token} />
			))}
			{mode === "creating" && (
				<CreateForm onSecretRevealed={(token) => setMode({ reveal: token })} onCancel={() => setMode("list")} />
			)}
			{typeof mode === "object" && "reveal" in mode && <Reveal token={mode.reveal} onDone={() => setMode("list")} />}
			{mode === "list" && (
				<div style={{ padding: "10px 14px" }}>
					<Btn variant="ghost" onClick={() => setMode("creating")}>
						{t("settings.tokens.create")}
					</Btn>
				</div>
			)}
		</SettingsSection>
	);
}
