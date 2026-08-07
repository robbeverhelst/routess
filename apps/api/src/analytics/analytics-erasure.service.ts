import { Inject, Injectable, Logger } from "@nestjs/common";
import { Client } from "pg";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { hashUserId } from "../users/user.mapper";

// Erases a user's ProductEvent trail from Umami, fulfilling the deletion
// promise in ADR-0020. Umami has no delete-by-property endpoint (only a
// website-wide reset), so this talks to its Postgres directly. That couples us
// to two Umami tables, `event_data` and `website_event`, which have been stable
// across v2. Erasure is best-effort: a failure here must never block the
// account deletion it accompanies.
@Injectable()
export class AnalyticsErasureService {
	private readonly logger = new Logger(AnalyticsErasureService.name);

	constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

	get enabled(): boolean {
		return Boolean(this.config.analytics.umamiDatabaseUrl && this.config.analytics.umamiWebsiteId);
	}

	// Returns the number of events deleted, or null when erasure is not
	// configured or failed. Callers log, they do not throw.
	async eraseUserEvents(userId: number): Promise<number | null> {
		if (!this.enabled) {
			this.logger.warn(
				`Analytics erasure skipped for user ${userId}: UMAMI_DATABASE_URL / UMAMI_WEBSITE_ID not configured`,
			);
			return null;
		}

		const idHash = hashUserId(this.config.analytics.salt, userId);
		const client = new Client({ connectionString: this.config.analytics.umamiDatabaseUrl });

		try {
			await client.connect();
			await client.query("begin");
			// event_data holds one row per property per event; the join back to
			// website_event is by website_event_id.
			const { rows } = await client.query<{ website_event_id: string }>(
				`select distinct website_event_id from event_data
				 where website_id = $1 and data_key = 'user_id_hash' and string_value = $2`,
				[this.config.analytics.umamiWebsiteId, idHash],
			);
			const eventIds = rows.map((row) => row.website_event_id);
			if (eventIds.length === 0) {
				await client.query("commit");
				return 0;
			}
			await client.query(`delete from event_data where website_event_id = any($1::uuid[])`, [eventIds]);
			await client.query(`delete from website_event where event_id = any($1::uuid[])`, [eventIds]);
			await client.query("commit");
			return eventIds.length;
		} catch (error) {
			await client.query("rollback").catch(() => undefined);
			this.logger.error(
				`Analytics erasure failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
			);
			return null;
		} finally {
			await client.end().catch(() => undefined);
		}
	}
}
