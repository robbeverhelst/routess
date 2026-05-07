import { type DomainErrorPayload, isDomainErrorPayload } from "@routess/core";

// Thrown by the HttpClient when the server response body conforms to the
// shared DomainErrorPayload protocol. Consumers in the web app branch on
// `payload.code` and optionally read `payload.details`.
export class ApiDomainError extends Error {
	readonly name = "ApiDomainError";

	constructor(public readonly payload: DomainErrorPayload) {
		super(payload.message);
	}
}

// Build either an ApiDomainError (when the body is coded) or a plain Error
// describing the raw response. Caller has already determined !response.ok.
export const errorFromResponse = async (response: Response): Promise<Error> => {
	let bodyText = "";
	try {
		bodyText = await response.text();
	} catch {
		// fall through with empty body
	}

	if (bodyText) {
		try {
			const parsed = JSON.parse(bodyText) as unknown;
			if (isDomainErrorPayload(parsed)) {
				return new ApiDomainError(parsed);
			}
		} catch {
			// not JSON — fall through to text error
		}
	}

	return new Error(`API Error: ${response.status} ${response.statusText}${bodyText ? ` - ${bodyText}` : ""}`);
};
