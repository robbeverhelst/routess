import type { UserPlan } from "../entities/user.entity";

// The Plan resolution every reader shares (ADR 0039): EntitlementsService
// (the Pro gates) and the admin views both join PRO_GRANTS_SQL and read it
// through resolvePlanStatus / PLAN_KIND_SQL, so an admin list can never
// disagree with what a gate decides.

export interface PlanStatus {
	// The Plan in effect now: the stored Plan, or Pro while a Plan grant runs.
	plan: UserPlan;
	// When the Pro time from Plan grants ends. Null with plan 'pro' means Pro
	// does not expire (stored Plan or an open-ended grant).
	proExpiresAt: Date | null;
}

// Joins `pro`: the unexpired, unrevoked Pro Plan grants of the User aliased
// `u` at the moment bound to its one `?`. Aggregates over no rows are null
// (count is 0).
export const PRO_GRANTS_SQL = `left join lateral (
	select max(e."expires_at") as "latest",
		bool_or(e."expires_at" is null) as "open_ended",
		count(e."id")::int as "count",
		bool_or(e."source" = 'billing') as "paid",
		bool_or(e."source" in ('admin', 'manual')) as "comp",
		bool_or(e."source" = 'og-grant') as "og"
	from "entitlement" e
	where e."user_id" = u."id" and e."plan" = 'pro' and e."deleted_at" is null
		and (e."expires_at" is null or e."expires_at" > ?)
) pro on true`;

export interface ProGrantsRow {
	stored_plan: UserPlan;
	latest: Date | string | null;
	open_ended: boolean | null;
	count: number;
}

export function resolvePlanStatus(row: ProGrantsRow | undefined): PlanStatus {
	if (!row) return { plan: "free", proExpiresAt: null };
	if (row.stored_plan === "pro" || row.open_ended) return { plan: "pro", proExpiresAt: null };
	if (row.count === 0) return { plan: row.stored_plan, proExpiresAt: null };
	return { plan: "pro", proExpiresAt: new Date(row.latest as Date) };
}

// The admin panel's label for a User's Plan. A paid pass wins over a comp,
// a comp over the OG grant, so a User who paid shows as paying whatever else
// they hold. 'pro_expired' is a User on free who once held Pro time.
export const PLAN_KINDS = ["free", "pro_paid", "pro_admin", "pro_og", "pro_expired"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

// Joins `past`: when the User's last Pro grant ended, revoked rows counting
// from their revocation. Only meaningful for 'pro_expired'.
export const PAST_PRO_SQL = `left join lateral (
	select max(case when h."deleted_at" is not null then least(coalesce(h."expires_at", h."deleted_at"), h."deleted_at")
		else h."expires_at" end) as "ended",
		count(h."id")::int as "count"
	from "entitlement" h
	where h."user_id" = u."id" and h."plan" = 'pro'
) past on true`;

// Both joins in order; binds `now` once (PAST_PRO_SQL takes no parameter).
export const PLAN_SUMMARY_JOINS_SQL = `${PRO_GRANTS_SQL}\n${PAST_PRO_SQL}`;

const IS_PRO_SQL = `(u."plan" = 'pro' or pro."count" > 0)`;
const IS_PERMANENT_SQL = `(u."plan" = 'pro' or coalesce(pro."open_ended", false))`;

export const PLAN_KIND_SQL = `(case
	when pro."paid" then 'pro_paid'
	when u."plan" = 'pro' or pro."comp" then 'pro_admin'
	when pro."og" then 'pro_og'
	when past."count" > 0 then 'pro_expired'
	else 'free' end)`;

// When Pro ends (or ended, for 'pro_expired'); null for free and for Pro
// that does not expire.
export const PRO_UNTIL_SQL = `(case
	when ${IS_PERMANENT_SQL} then null
	when ${IS_PRO_SQL} then pro."latest"
	when past."count" > 0 then past."ended"
	end)`;

export const PRO_PERMANENT_SQL = `(${IS_PRO_SQL} and ${IS_PERMANENT_SQL})`;

// Sort key for "Pro until": Pro that does not expire sorts as the far
// future, free Users (no date) last either way.
export const PRO_UNTIL_SORT_SQL = `(case when ${PRO_PERMANENT_SQL} then 'infinity'::timestamptz else ${PRO_UNTIL_SQL} end)`;
