import { Inject, Injectable, Logger } from "@nestjs/common";
import { Client } from "pg";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";

export interface ProductEventDailyCount {
	// UTC calendar day, YYYY-MM-DD.
	date: string;
	eventName: string;
	count: number;
}

export interface ProductEventUserDay {
	date: string;
	eventName: string;
	userIdHash: string;
	firstAt: Date;
}

// Bounds a slow Umami database so it cannot hold an admin request open.
const QUERY_TIMEOUT_MS = 5_000;

// Reads ProductEvent counts back out of Umami for the admin metrics page.
// Business analytics stay in Postgres (ADR 0014); this covers only what has
// no Postgres record, such as route generation attempts, which leave nothing
// behind unless the Route is saved. Same Umami tables and same best-effort
// posture as AnalyticsErasureService: unconfigured or failing returns null.
@Injectable()
export class ProductEventStatsService {
	private readonly logger = new Logger(ProductEventStatsService.name);

	constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

	get enabled(): boolean {
		return Boolean(this.config.analytics.umamiDatabaseUrl && this.config.analytics.umamiWebsiteId);
	}

	// Per-UTC-day counts of the named ProductEvents over the last `days` days,
	// today included. Days and events with no rows are omitted.
	async dailyCounts(eventNames: readonly string[], days: number): Promise<ProductEventDailyCount[] | null> {
		const rows = await this.query<{ d: string; event_name: string; count: number }>(
			`select to_char((created_at at time zone 'UTC')::date, 'YYYY-MM-DD') as d, event_name, count(*)::int as count
			 from website_event
			 where website_id = $1
			   and event_name = any($2::text[])
			   and created_at >= (date_trunc('day', now() at time zone 'UTC') - ($3::int - 1) * interval '1 day') at time zone 'UTC'
			 group by 1, 2`,
			[this.config.analytics.umamiWebsiteId, [...eventNames], days],
		);
		return rows?.map((row) => ({ date: row.d, eventName: row.event_name, count: Number(row.count) })) ?? null;
	}

	// Which signed-in Users (by user_id_hash, ADR-0020) fired the named
	// ProductEvents on each UTC day of the last `days` days, today included,
	// with the first time each did that day. Events without a hash are skipped.
	async dailyUserHashes(eventNames: readonly string[], days: number): Promise<ProductEventUserDay[] | null> {
		const rows = await this.query<{ d: string; event_name: string; user_id_hash: string; first_at: Date }>(
			`select to_char((we.created_at at time zone 'UTC')::date, 'YYYY-MM-DD') as d, we.event_name,
			        ed.string_value as user_id_hash, min(we.created_at) as first_at
			 from website_event we
			 join event_data ed on ed.website_event_id = we.event_id and ed.data_key = 'user_id_hash'
			 where we.website_id = $1
			   and we.event_name = any($2::text[])
			   and we.created_at >= (date_trunc('day', now() at time zone 'UTC') - ($3::int - 1) * interval '1 day') at time zone 'UTC'
			   and ed.string_value is not null and ed.string_value <> ''
			 group by 1, 2, 3`,
			[this.config.analytics.umamiWebsiteId, [...eventNames], days],
		);
		return (
			rows?.map((row) => ({
				date: row.d,
				eventName: row.event_name,
				userIdHash: row.user_id_hash,
				firstAt: new Date(row.first_at),
			})) ?? null
		);
	}

	private async query<R extends object>(sql: string, params: unknown[]): Promise<R[] | null> {
		if (!this.enabled) return null;

		const client = new Client({
			connectionString: this.config.analytics.umamiDatabaseUrl,
			connectionTimeoutMillis: QUERY_TIMEOUT_MS,
			statement_timeout: QUERY_TIMEOUT_MS,
		});
		client.on("error", (error: Error) => this.logger.warn(`Analytics stats connection error: ${error.message}`));
		try {
			await client.connect();
			const { rows } = await client.query<R>(sql, params);
			return rows;
		} catch (error) {
			this.logger.error(`Analytics stats query failed: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		} finally {
			await client.end().catch(() => undefined);
		}
	}
}
