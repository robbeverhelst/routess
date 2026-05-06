import { useState } from "react";
import { useDeleteRoute, useUserRoutes } from "@/lib/api-queries";
import { t } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

export function ConfirmDeleteModal() {
	const closeModal = useModalsStore((s) => s.closeModal);
	const routeId = useModalsStore((s) => s.deletingRouteId);
	const { data: routes = [] } = useUserRoutes();
	const route = routes.find((r) => r.id === routeId);
	const deleteRoute = useDeleteRoute();
	const pushToast = useToastStore((s) => s.push);
	const language = useUiStore((s) => s.language);
	const [confirmText, setConfirmText] = useState("");

	const confirmWord = t("confirm.delete.confirmWord", language);
	const canDelete = confirmText.trim().toLowerCase() === confirmWord.toLowerCase();

	const handleDelete = () => {
		if (!routeId || !canDelete) return;
		deleteRoute.mutate(routeId, {
			onSuccess: () => {
				pushToast({
					kind: "danger",
					title: t("confirm.delete.toast", language),
					body: route?.name ?? "",
				});
				closeModal();
			},
		});
	};

	return (
		<ModalShell
			title={t("confirm.delete.title", language)}
			width={420}
			onClose={closeModal}
			footer={
				<>
					<div style={{ flex: 1 }} />
					<Btn onClick={closeModal}>{t("common.cancel", language)}</Btn>
					<Btn variant="danger" onClick={handleDelete} disabled={!canDelete || deleteRoute.isPending}>
						<I.trash size={14} />
						{deleteRoute.isPending ? t("confirm.delete.deleting", language) : t("confirm.delete.forever", language)}
					</Btn>
				</>
			}
		>
			<div
				style={{
					display: "flex",
					alignItems: "flex-start",
					gap: 12,
					padding: 12,
					marginBottom: 14,
					background: `color-mix(in oklch, ${RDS_COLORS.danger} 10%, transparent)`,
					border: `1px solid color-mix(in oklch, ${RDS_COLORS.danger} 30%, ${RDS_COLORS.border})`,
					borderRadius: 8,
				}}
			>
				<div
					style={{
						width: 32,
						height: 32,
						borderRadius: 8,
						background: RDS_COLORS.danger,
						color: "white",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
					}}
				>
					<I.trash size={16} />
				</div>
				<div style={{ fontSize: 13, color: RDS_COLORS.fg, lineHeight: 1.5 }}>
					{route
						? t("confirm.delete.warning", language, { name: route.name })
						: t("confirm.delete.warningGeneric", language)}
				</div>
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
				<SecTitle>{t("confirm.delete.typeToConfirm", language)}</SecTitle>
				<input
					value={confirmText}
					onChange={(e) => setConfirmText(e.target.value)}
					placeholder={t("confirm.delete.placeholder", language)}
					// biome-ignore lint/a11y/noAutofocus: confirm-delete asks for explicit text input; focusing on open is expected
					autoFocus
					style={{
						height: 36,
						padding: "0 12px",
						borderRadius: 8,
						background: RDS_COLORS.bgInput,
						border: `1px solid ${RDS_COLORS.border}`,
						color: RDS_COLORS.fg,
						fontSize: 13.5,
						outline: "none",
					}}
				/>
			</div>
		</ModalShell>
	);
}
