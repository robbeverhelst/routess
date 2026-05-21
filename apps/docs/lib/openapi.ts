import type { Document } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";
import { createAPIPage } from "fumadocs-openapi/ui";
import spec from "@/openapi/routess.openapi.json";

export const openapi = createOpenAPI({
	input: () => ({
		// JSON literal narrowing makes mixed `security` arrays (some entries
		// keyed by JWT-auth, others by PAT-auth) unassignable to the OpenAPI
		// `SecurityRequirementObject`. The runtime shape is valid OpenAPI; the
		// double-cast just satisfies the structural check.
		routess: spec as unknown as Document,
	}),
});

export const APIPage = createAPIPage(openapi);
