import { MetricsService } from "./metrics.service";
import { Injectable } from "@nestjs/common";

@Injectable()
export class DatabaseMetricsSubscriber {
  private queryStartTimes = new Map<string, number>();

  constructor(private metricsService: MetricsService) {}

  async beforeQuery(event: any): Promise<void> {
    const queryId = this.getQueryId(event);
    this.queryStartTimes.set(queryId, Date.now());
  }

  async afterQuery(event: any): Promise<void> {
    const queryId = this.getQueryId(event);
    const startTime = this.queryStartTimes.get(queryId);

    if (startTime) {
      const duration = Date.now() - startTime;
      const operation = this.getOperationType(event.query?.toLowerCase() || "");

      this.metricsService.recordDbQuery(operation, duration);
      this.queryStartTimes.delete(queryId);
    }
  }

  private getQueryId(event: any): string {
    return `${event.query}-${Date.now()}-${Math.random()}`;
  }

  private getOperationType(query: string): string {
    if (query.includes("select")) return "select";
    if (query.includes("insert")) return "insert";
    if (query.includes("update")) return "update";
    if (query.includes("delete")) return "delete";
    return "other";
  }
}
