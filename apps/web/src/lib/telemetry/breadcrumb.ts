import * as Sentry from "@sentry/react";

type BreadcrumbCategory = "auth" | "state" | "routing" | "import" | "map" | "ui";

type BreadcrumbLevel = "info" | "warning" | "error";

export function breadcrumb(
	category: BreadcrumbCategory,
	message: string,
	data?: Record<string, unknown>,
	level: BreadcrumbLevel = "info",
): void {
	Sentry.addBreadcrumb({ category, message, data, level });
}
