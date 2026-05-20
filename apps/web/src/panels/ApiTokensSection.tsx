import type { ApiPatScope, ApiPersonalAccessToken } from "@routess/api-client";
import { type CSSProperties, useState } from "react";
import { useCreatePersonalAccessToken, usePersonalAccessTokens, useRevokePersonalAccessToken } from "@/lib/api-queries";
import { t } from "@/lib/i18n";
import { useToastStore } from "@/stores/toastStore";
import { Badge, Btn, RDS_COLORS, SecTitle } from "../components/primitives";

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

interface TokenRowProps {
	token: ApiPersonalAccessToken;
	last?: boolean;
}

function TokenRow({ token, last }: TokenRowProps) {
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
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "12px 14px",
				borderBottom: last ? "none" : `1px solid ${RDS_COLORS.border}`,
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
				<div style={{ fontSize: 13, color: RDS_COLORS.fg, display: "flex", alignItems: "center", gap: 8 }}>
					<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{token.label}</span>
					<Badge variant={token.scope === "write" ? "accent" : "default"}>
						{token.scope === "write" ? t("settings.tokens.scopeWriteShort") : t("settings.tokens.scopeReadShort")}
					</Badge>
				</div>
				<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>{subtitle}</div>
			</div>
			<Btn variant="ghost" onClick={handleRevoke} disabled={revoke.isPending} style={{ color: RDS_COLORS.danger }}>
				{revoke.isPending ? t("settings.tokens.revoking") : t("settings.tokens.revoke")}
			</Btn>
		</div>
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

	const inputStyle: CSSProperties = {
		width: "100%",
		padding: "8px 10px",
		fontSize: 13,
		borderRadius: "var(--rds-radius-sm)",
		background: RDS_COLORS.bgInput,
		color: RDS_COLORS.fg,
		border: `1px solid ${RDS_COLORS.border}`,
	};

	return (
		<form
			onSubmit={handleSubmit}
			style={{ padding: "14px 14px 16px", display: "flex", flexDirection: "column", gap: 10 }}
		>
			<label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
				<span style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>{t("settings.tokens.labelField")}</span>
				<input
					type="text"
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					placeholder={t("settings.tokens.labelPlaceholder")}
					maxLength={80}
					style={inputStyle}
				/>
			</label>
			<label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
				<span style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>{t("settings.tokens.scopeField")}</span>
				<select value={scope} onChange={(e) => setScope(e.target.value as ApiPatScope)} style={inputStyle}>
					<option value="read">{t("settings.tokens.scopeRead")}</option>
					<option value="write">{t("settings.tokens.scopeWrite")}</option>
				</select>
			</label>
			<label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
				<span style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>{t("settings.tokens.expiresField")}</span>
				<input
					type="date"
					value={expiresAt}
					onChange={(e) => setExpiresAt(e.target.value)}
					placeholder={t("settings.tokens.expiresPlaceholder")}
					style={inputStyle}
				/>
			</label>
			<div style={{ display: "flex", gap: 8, marginTop: 4 }}>
				<Btn type="submit" variant="primary" disabled={!canSubmit}>
					{t("settings.tokens.create")}
				</Btn>
				<Btn variant="ghost" onClick={onCancel} disabled={create.isPending}>
					{t("settings.tokens.cancel")}
				</Btn>
			</div>
		</form>
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
		<div style={{ padding: "14px 14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
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
		</div>
	);
}

export function ApiTokensSection() {
	const tokensQuery = usePersonalAccessTokens();
	const [mode, setMode] = useState<"list" | "creating" | { reveal: string }>("list");

	const tokens = tokensQuery.data ?? [];

	return (
		<div style={{ marginBottom: 22 }}>
			<SecTitle style={{ marginBottom: 10 }}>{t("settings.tokens.title")}</SecTitle>
			<div
				style={{
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 10,
					overflow: "hidden",
				}}
			>
				{tokens.length === 0 && mode === "list" && (
					<div style={{ padding: "12px 14px", fontSize: 12.5, color: RDS_COLORS.fgSubtle }}>
						{t("settings.tokens.empty")}
					</div>
				)}
				{tokens.map((token, index) => (
					<TokenRow key={token.id} token={token} last={index === tokens.length - 1 && mode === "list"} />
				))}
				{mode === "creating" && (
					<CreateForm onSecretRevealed={(token) => setMode({ reveal: token })} onCancel={() => setMode("list")} />
				)}
				{typeof mode === "object" && "reveal" in mode && <Reveal token={mode.reveal} onDone={() => setMode("list")} />}
				{mode === "list" && (
					<div
						style={{
							padding: "10px 14px",
							borderTop: tokens.length === 0 ? "none" : `1px solid ${RDS_COLORS.border}`,
						}}
					>
						<Btn variant="ghost" onClick={() => setMode("creating")}>
							{t("settings.tokens.create")}
						</Btn>
					</div>
				)}
			</div>
		</div>
	);
}
