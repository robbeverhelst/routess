import { SetMetadata } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedUser } from "../authenticated-user";

// Inspects the request and returns a human-readable description of the
// destructive change about to happen, or null when the request is not
// destructive (e.g. a PATCH that only changes the route name). The
// description ends up in the 428 PRECONDITION_REQUIRED body so a
// calling agent can surface it to the user verbatim.
export type ConfirmationCheck = (request: Request & { user?: AuthenticatedUser }) => string | null;

export const CONFIRMATION_CHECK_KEY = "confirmationCheck";

// Mark a route handler as requiring `X-Routess-Confirm: true` for
// PAT-authenticated callers when the check returns a description string.
// Cookie sessions bypass the gate (see ADR-0023). The check function may
// inspect req.body, req.params, and req.user to decide.
export const RequireConfirmation = (check: ConfirmationCheck) => SetMetadata(CONFIRMATION_CHECK_KEY, check);
