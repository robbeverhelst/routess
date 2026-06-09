import { type DomainErrorPayload, isDomainErrorPayload } from "@routess/core";

// Thrown by the HttpClient when the server response body conforms to the
// shared DomainErrorPayload protocol. Consumers in the web app branch on
// `payload.code` and optionally read `payload.details`.
export class ApiDomainError extends Error {
	readonly name = "ApiDomainError";

	constructor(
		public readonly payload: DomainErrorPayload,
		// Correlates with the API's X-Request-ID log field.
		public readonly requestId?: string,
	) {
		super(payload.message);
	}
}

// Thrown for non-ok responses without a coded domain payload.
export class ApiHttpError extends Error {
	readonly name = "ApiHttpError";

	constructor(
		message: string,
		public readonly status: number,
		public readonly requestId?: string,
	) {
		super(message);
	}
}

// Build either an ApiDomainError (when the body is coded) or an ApiHttpError
// describing the raw response. Caller has already determined !response.ok.
export const errorFromResponse = async (response: Response, requestId?: string): Promise<Error> => {
	let bodyText = "";
	try {
		bodyText = await response.text();
	} catch {
		// fall through with empty body
	}

	if (bodyText) {
		try {
			const parsed: unknown = JSON.parse(bodyText);
			if (isDomainErrorPayload(parsed)) {
				return new ApiDomainError(parsed, requestId);
			}
		} catch {
			// not JSON — fall through to text error
		}
	}

	return new ApiHttpError(
		`API Error: ${response.status} ${response.statusText}${bodyText ? ` - ${bodyText}` : ""}`,
		response.status,
		requestId,
	);
};
