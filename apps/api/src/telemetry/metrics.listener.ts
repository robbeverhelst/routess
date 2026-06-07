import { EntityManager } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
	AUTH_LOGIN_ATTEMPTED,
	AUTH_SESSION_REVOKED,
	type AuthLoginAttemptedEvent,
	type AuthSessionRevokedEvent,
	ROUTE_CREATED,
	ROUTE_DELETED,
	ROUTE_GENERATION_COMPLETED,
	type RouteCreatedEvent,
	type RouteDeletedEvent,
	type RouteGenerationCompletedEvent,
	SESSION_ACTIVITY_CHANGED,
	USER_REGISTERED,
	USER_UNDELETED,
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
	onRouteCreated(_event: RouteCreatedEvent) {
		this.metrics.recordRouteCreated();
	}

	@OnEvent(ROUTE_DELETED)
	onRouteDeleted(_event: RouteDeletedEvent) {
		this.metrics.recordRouteDeleted();
	}

	@OnEvent(ROUTE_GENERATION_COMPLETED)
	onRouteGenerationCompleted(event: RouteGenerationCompletedEvent) {
		this.metrics.recordRouteGeneration(event);
	}

	@OnEvent(USER_REGISTERED)
	onUserRegistered(event: UserRegisteredEvent) {
		this.metrics.recordUserRegistration(event.source);
	}

	@OnEvent(USER_UNDELETED)
	onUserUndeleted() {
		this.metrics.recordUserUndeleted();
	}

	@OnEvent(AUTH_LOGIN_ATTEMPTED)
	onAuthLoginAttempted(event: AuthLoginAttemptedEvent) {
		this.metrics.recordLoginAttempt(event.provider, event.result);
	}

	@OnEvent(AUTH_SESSION_REVOKED)
	onAuthSessionRevoked(event: AuthSessionRevokedEvent) {
		this.metrics.recordSessionRevoked(event.reason, event.count);
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
