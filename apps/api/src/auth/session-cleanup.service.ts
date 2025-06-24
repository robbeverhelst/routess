import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SessionService } from "./session.service";

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(private readonly sessionService: SessionService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions() {
    try {
      const cleanedCount = await this.sessionService.cleanupExpiredSessions();
      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} expired sessions`);
      }
    } catch (error) {
      this.logger.error("Failed to cleanup expired sessions", error);
    }
  }
}
