# Auth guard stacks stay explicit per endpoint; no policy-decorator layer

A 2026-06 architecture review proposed collapsing the per-endpoint guard
decorators (`@UseGuards(UnifiedAuthGuard, ScopeGuard, ...)` plus the
`@ApiBearerAuth`/`@RequireScope`/throttle companions) into named policy
decorators. Measured, the idea fails: the codebase has seven distinct guard
stack shapes (6x unified+scope, 6x +confirmation, 4x JWT-only, 3x
optional-unified, 2x optional-JWT, 2 one-offs), so a policy layer either
mints ~7 policy names (renaming, not concentrating) or converts only half the
sites. Line count is net-zero and it adds an indirection layer to
security-sensitive code, where explicit stacks are also the easier audit:
what an endpoint requires is readable at the endpoint.

Revisit only if the same exact stack reaches ~15+ repetitions or a real
policy change has to touch many controllers at once.
