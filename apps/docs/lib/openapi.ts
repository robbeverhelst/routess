import type { Document } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";
import { createAPIPage } from "fumadocs-openapi/ui";
import spec from "@/openapi/routess.openapi.json";

export const openapi = createOpenAPI({
	input: () => ({
		routess: spec as Document,
	}),
});

export const APIPage = createAPIPage(openapi);
