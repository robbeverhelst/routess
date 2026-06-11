// The reserved system seed User owns Generated fill Routes (CONTEXT.md
// "system seed User", ADR 0035). It is excluded from Profile rollup and its
// routes are never Indexable while it owns them. Created idempotently by a
// migration; resolved by email everywhere it is needed.
export const SYSTEM_SEED_USER_EMAIL = "system-seed@routess.internal";
export const SYSTEM_SEED_USER_HANDLE = "routess-seed";
export const SYSTEM_SEED_USER_NAME = "routess";
