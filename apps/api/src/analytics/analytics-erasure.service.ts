import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Client } from "pg";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { hashUserId } from "../users/user.mapper";

// Erases ProductEvents from Umami, two ways: on request (a user deletes their
// account, ADR-0020) and on age (the retention window the privacy policy
// commits to). Umami has neither a delete-by-property endpoint nor any
// retention setting of its own, so both talk to its Postgres directly. That
// couples us to three Umami tables (`event_data`, `website_event`, `session`),
// which have been stable across v2.
//
// Both paths are best-effort. Erasure must never block the account deletion it
// accompanies, and a failed sweep must never take the API down.
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

		return this.withTransaction(`erasure for user ${userId}`, async (client) => {
			// event_data holds one row per property per event; the join back to
			// website_event is by website_event_id.
			const { rows } = await client.query<{ website_event_id: string }>(
				`select distinct website_event_id from event_data
				 where website_id = $1 and data_key = 'user_id_hash' and string_value = $2`,
				[this.config.analytics.umamiWebsiteId, idHash],
			);
			const eventIds = rows.map((row) => row.website_event_id);
			if (eventIds.length === 0) return 0;

			await client.query(`delete from event_data where website_event_id = any($1::uuid[])`, [eventIds]);
			await client.query(`delete from website_event where event_id = any($1::uuid[])`, [eventIds]);
			return eventIds.length;
		});
	}

	@Cron(CronExpression.EVERY_DAY_AT_4AM)
	async enforceRetentionCron(): Promise<void> {
		if (!this.enabled) return;
		const deleted = await this.enforceRetention();
		if (deleted !== null && deleted > 0) {
			this.logger.log(`Retention sweep removed ${deleted} ProductEvents older than ${this.retentionDays} days`);
		}
	}

	get retentionDays(): number {
		return this.config.analytics.umamiRetentionDays;
	}

	// Deletes events past the retention window, then the sessions those events
	// were the last reason to keep. Session rows carry visitor metadata (country,
	// city, browser, device), so leaving them behind would keep exactly the data
	// the retention window promises to drop.
	async enforceRetention(): Promise<number | null> {
		if (!this.enabled) {
			this.logger.warn("Retention sweep skipped: UMAMI_DATABASE_URL / UMAMI_WEBSITE_ID not configured");
			return null;
		}

		const websiteId = this.config.analytics.umamiWebsiteId;
		const days = this.retentionDays;

		return this.withTransaction("retention sweep", async (client) => {
			const cutoff = `${days} days`;
			await client.query(
				`delete from event_data
				 where website_id = $1 and created_at < now() - $2::interval`,
				[websiteId, cutoff],
			);
			const events = await client.query(
				`delete from website_event
				 where website_id = $1 and created_at < now() - $2::interval`,
				[websiteId, cutoff],
			);
			await client.query(
				`delete from session s
				 where s.website_id = $1
				   and s.created_at < now() - $2::interval
				   and not exists (select 1 from website_event e where e.session_id = s.session_id)`,
				[websiteId, cutoff],
			);
			return events.rowCount ?? 0;
		});
	}

	private async withTransaction(label: string, work: (client: Client) => Promise<number>): Promise<number | null> {
		const client = new Client({ connectionString: this.config.analytics.umamiDatabaseUrl });
		try {
			await client.connect();
			await client.query("begin");
			const result = await work(client);
			await client.query("commit");
			return result;
		} catch (error) {
			await client.query("rollback").catch(() => undefined);
			this.logger.error(`Analytics ${label} failed: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		} finally {
			await client.end().catch(() => undefined);
		}
	}
}
