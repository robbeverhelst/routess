import { SetMetadata } from "@nestjs/common";
import type { PatScope } from "../../entities/personal-access-token.entity";

// Metadata key consumed by ScopeGuard. Handlers without this decorator are
// rejected outright when the request is PAT-authenticated; cookie sessions
// are always allowed through (their privilege is enforced elsewhere, e.g.
// the admin RolesGuard).
export const REQUIRED_SCOPE_KEY = "requiredScope";

// Mark a route handler as accessible to PAT-authenticated clients with at
// least the given scope. `read` accepts tokens scoped `read` or `write`;
// `write` accepts only tokens scoped `write`. Cookie sessions ignore this
// decorator entirely — they have always been able to do whatever the
// existing controller logic allows.
export const RequireScope = (scope: PatScope) => SetMetadata(REQUIRED_SCOPE_KEY, scope);
