export const isDev = (): boolean => import.meta.env.MODE === "development";

export const isTest = (): boolean => import.meta.env.MODE === "test";

export const getEnvVar = (key: string): string | undefined =>
	(import.meta.env as Record<string, string | undefined>)[key];
