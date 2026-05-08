import { DefaultLogger, type LogContext } from "@mikro-orm/core";
import { recordDbQueryIfEnabled } from "./db-metrics-recorder";

const OPERATIONS = new Set(["select", "insert", "update", "delete", "begin", "commit", "rollback", "savepoint"]);

function classifyOperation(sql: string): string {
	const head = sql.trimStart().split(/\s+/, 1)[0]?.toLowerCase();
	if (head && OPERATIONS.has(head)) return head;
	return "other";
}

export class MikroOrmMetricsLogger extends DefaultLogger {
	// MikroORM 6 routes every query through logQuery (not log). Capture the
	// timing here directly so the metric is independent of the `debug` config:
	// without this, a production deploy with debug=false would emit nothing.
	override logQuery(context: LogContext) {
		if (typeof context.took === "number" && typeof context.query === "string") {
			recordDbQueryIfEnabled(classifyOperation(context.query), context.took);
		}
		super.logQuery(context);
	}
}
