# Domain services emit events; telemetry listens

`RoutesService`, `AuthService`, and `SessionService` no longer inject `MetricsService`. They emit a small set of typed domain events from `apps/api/src/telemetry/domain-events.ts` (`route.created`, `route.deleted`, `user.registered`, `session.activity-changed`). A single `MetricsListener` (`apps/api/src/telemetry/metrics.listener.ts`) translates those events into `MetricsService` counter and gauge calls. New telemetry concerns (audit trail, search indexing, webhooks) attach to the same events without touching the domain modules.

The `active-users` gauge is the load-bearing case: previously `SessionService` ran a raw `select count(distinct user_id) from session` after every session mutation and pushed it to `MetricsService` via a private `syncActiveUsersMetric()`. That query and that push now live entirely in `MetricsListener.onSessionActivityChanged`. `SessionService` knows only that the activity surface changed; it doesn't know how the gauge is computed.

## Considered options

- **Keep direct `MetricsService` injection in domain services** — the prior state. Rejected: telemetry leaked into the interface of every domain service, every unit test had to mock `MetricsService`, and adding a non-metrics observer (e.g. an audit log of route creations) would require editing the domain service.
- **Sync invocation of a `TelemetryFacade` that hides the metric type** — rejected: still couples the domain to a specific observability concept. The event seam is the cheaper boundary, since NestJS already ships `@nestjs/event-emitter` and listeners are trivially discoverable in DI.
- **Async/queued events via a message broker** — overkill for in-process counters. The default `EventEmitter2` is synchronous within a request, which is fine for metrics that should reflect the request that caused them. Revisit if a listener grows expensive enough to warrant offloading.
