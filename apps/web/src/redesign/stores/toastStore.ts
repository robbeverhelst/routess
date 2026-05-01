import { create } from "zustand";

export type ToastKind = "success" | "info" | "warn" | "danger";

export interface Toast {
	id: string;
	kind: ToastKind;
	title: string;
	body?: string;
	action?: { label: string; onClick: () => void };
	durationMs?: number;
}

interface ToastState {
	toasts: Toast[];
	push: (t: Omit<Toast, "id">) => string;
	dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set, get) => ({
	toasts: [],
	push: (t) => {
		const id = Math.random().toString(36).slice(2, 10);
		set({ toasts: [...get().toasts, { ...t, id }] });
		const duration = t.durationMs ?? (t.kind === "danger" ? 8000 : 4000);
		setTimeout(() => get().dismiss(id), duration);
		return id;
	},
	dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
