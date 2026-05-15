// Shared domain-error protocol used across API and web. The wire shape is:
//   { statusCode, code, message, details? }
// `code` is the stable semantic identifier; `details` carries structured
// per-error context (e.g. validation field paths, expected enum values).

export type DomainErrorCode =
	| "VALIDATION_FAILED"
	| "NOT_FOUND"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "CONFLICT"
	| "PRECONDITION_REQUIRED"
	| "RATE_LIMITED"
	| "INTERNAL";

export type DomainErrorSeverity = "low" | "medium" | "high" | "critical";

export interface DomainErrorPayload {
	statusCode: number;
	code: DomainErrorCode;
	message: string;
	details?: Record<string, unknown>;
}

const DOMAIN_CODES: ReadonlySet<DomainErrorCode> = new Set([
	"VALIDATION_FAILED",
	"NOT_FOUND",
	"UNAUTHORIZED",
	"FORBIDDEN",
	"CONFLICT",
	"PRECONDITION_REQUIRED",
	"RATE_LIMITED",
	"INTERNAL",
]);

export const isDomainErrorPayload = (value: unknown): value is DomainErrorPayload => {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.statusCode === "number" &&
		typeof v.code === "string" &&
		DOMAIN_CODES.has(v.code as DomainErrorCode) &&
		typeof v.message === "string"
	);
};

// Maps an HTTP status to a DomainErrorCode for un-coded NestJS exceptions
// (the API filter uses this to keep raw HttpException responses consistent
// with the protocol).
export const inferCodeFromStatus = (status: number): DomainErrorCode => {
	if (status === 401) return "UNAUTHORIZED";
	if (status === 403) return "FORBIDDEN";
	if (status === 404) return "NOT_FOUND";
	if (status === 409) return "CONFLICT";
	if (status === 412 || status === 428) return "PRECONDITION_REQUIRED";
	if (status === 422 || status === 400) return "VALIDATION_FAILED";
	if (status === 429) return "RATE_LIMITED";
	return "INTERNAL";
};

export const severityForCode = (code: DomainErrorCode): DomainErrorSeverity => {
	switch (code) {
		case "VALIDATION_FAILED":
			return "low";
		case "NOT_FOUND":
		case "CONFLICT":
		case "PRECONDITION_REQUIRED":
		case "RATE_LIMITED":
			return "medium";
		case "UNAUTHORIZED":
		case "FORBIDDEN":
			return "high";
		case "INTERNAL":
			return "critical";
	}
};
