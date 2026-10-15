import { useMemo, useState } from "react";
import { I } from "@/components/icons";
import { Btn } from "@/components/primitives";
import { useT } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { useToastStore } from "@/stores/toastStore";
import { type ExportTarget, getEnabledExportTargets } from "./exportTargets";

/** "Send to ..." buttons for the enabled export targets. Renders nothing while the flag is off. */
export function ExportTargetButtons({ routeId }: { routeId: number }) {
	const t = useT();
	const pushToast = useToastStore((s) => s.push);
	const targets = useMemo(() => getEnabledExportTargets(), []);
	const [sending, setSending] = useState<ExportTarget["id"] | null>(null);

	const send = async (target: ExportTarget) => {
		setSending(target.id);
		try {
			await target.send(routeId);
			pushToast({ kind: "success", title: t("route.sentToTarget", { target: target.displayName }) });
		} catch (error) {
			Logger.warn("[ExportTargetButtons] send failed", { target: target.id, error });
			pushToast({
				kind: "danger",
				title: t("route.sendToTargetFailed", { target: target.displayName }),
				body: t("common.tryAgain"),
			});
		} finally {
			setSending(null);
		}
	};

	return targets.map((target) => {
		const label = t("route.sendToTarget", { target: target.displayName });
		return (
			<Btn key={target.id} onClick={() => send(target)} disabled={sending !== null} title={label}>
				<I.externalLink size={14} />
			</Btn>
		);
	});
}
