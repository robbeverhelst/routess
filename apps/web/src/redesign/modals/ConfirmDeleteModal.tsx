import { useState } from "react";
import { useDeleteRoute, useUserRoutes } from "@/lib/api-queries";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";
import { useModalsStore } from "../stores/modalsStore";
import { useToastStore } from "../stores/toastStore";

export function ConfirmDeleteModal() {
	const closeModal = useModalsStore((s) => s.closeModal);
	const routeId = useModalsStore((s) => s.deletingRouteId);
	const { data: routes = [] } = useUserRoutes();
	const route = routes.find((r) => r.id === routeId);
	const deleteRoute = useDeleteRoute();
	const pushToast = useToastStore((s) => s.push);
	const [confirmText, setConfirmText] = useState("");

	const canDelete = confirmText.trim().toLowerCase() === "delete";

	const handleDelete = () => {
		if (!routeId || !canDelete) return;
		deleteRoute.mutate(routeId, {
			onSuccess: () => {
				pushToast({
					kind: "danger",
					title: "Route deleted",
					body: route?.name ?? "",
				});
				closeModal();
			},
		});
	};

	return (
		<ModalShell
			title="Delete route?"
			width={420}
			onClose={closeModal}
			footer={
				<>
					<div style={{ flex: 1 }} />
					<Btn onClick={closeModal}>Cancel</Btn>
					<Btn variant="danger" onClick={handleDelete} disabled={!canDelete || deleteRoute.isPending}>
						<I.trash size={14} />
						{deleteRoute.isPending ? "Deleting…" : "Delete forever"}
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
					{route ? (
						<>
							<strong>{route.name}</strong> will be permanently removed. This cannot be undone.
						</>
					) : (
						"This route will be permanently removed. This cannot be undone."
					)}
				</div>
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
				<SecTitle>Type "delete" to confirm</SecTitle>
				<input
					value={confirmText}
					onChange={(e) => setConfirmText(e.target.value)}
					placeholder="delete"
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
