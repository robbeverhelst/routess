import { EntityManager } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
	ROUTE_CREATED,
	ROUTE_DELETED,
	type RouteCreatedEvent,
	type RouteDeletedEvent,
	SESSION_ACTIVITY_CHANGED,
	USER_REGISTERED,
	type UserRegisteredEvent,
} from "./domain-events";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsListener {
	constructor(
		private readonly metrics: MetricsService,
		private readonly em: EntityManager,
	) {}

	@OnEvent(ROUTE_CREATED)
	onRouteCreated(event: RouteCreatedEvent) {
		this.metrics.recordRouteCreated(event.userId);
	}

	@OnEvent(ROUTE_DELETED)
	onRouteDeleted(event: RouteDeletedEvent) {
		this.metrics.recordRouteDeleted(event.userId);
	}

	@OnEvent(USER_REGISTERED)
	onUserRegistered(event: UserRegisteredEvent) {
		this.metrics.recordUserRegistration(event.source);
	}

	@OnEvent(SESSION_ACTIVITY_CHANGED)
	async onSessionActivityChanged() {
		const result = (await this.em.getConnection().execute<{ count: number | string }[]>(
			`select count(distinct("user_id"))::int as count
			 from "session"
			 where "expires_at" > now() and "deleted_at" is null`,
		)) as Array<{ count: number | string }>;
		this.metrics.setActiveUsers(Number(result[0]?.count || 0));
	}
}
