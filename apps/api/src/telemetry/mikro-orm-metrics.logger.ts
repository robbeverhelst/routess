import { DefaultLogger, type LogContext, type LoggerNamespace, type LoggerOptions } from "@mikro-orm/core";
import { recordDbQueryIfEnabled } from "./db-metrics-recorder";

const OPERATIONS = new Set(["select", "insert", "update", "delete", "begin", "commit", "rollback", "savepoint"]);

function classifyOperation(sql: string): string {
	const head = sql.trimStart().split(/\s+/, 1)[0]?.toLowerCase();
	if (head && OPERATIONS.has(head)) return head;
	return "other";
}

export class MikroOrmMetricsLogger extends DefaultLogger {
	constructor(options: LoggerOptions) {
		super(options);
	}

	override isEnabled(namespace: LoggerNamespace, context?: LogContext): boolean {
		if (namespace === "query") return true;
		return super.isEnabled(namespace, context);
	}

	override log(namespace: LoggerNamespace, message: string, context?: LogContext) {
		this.maybeRecord(namespace, context);
		if (super.isEnabled(namespace, context)) {
			super.log(namespace, message, context);
		}
	}

	private maybeRecord(namespace: LoggerNamespace, context?: LogContext) {
		if (namespace !== "query") return;
		const took = (context as { took?: number } | undefined)?.took;
		const query = (context as { query?: string } | undefined)?.query;
		if (typeof took !== "number" || typeof query !== "string") return;
		recordDbQueryIfEnabled(classifyOperation(query), took);
	}
}
