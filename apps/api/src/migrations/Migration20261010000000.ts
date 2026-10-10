import { Migration } from "@mikro-orm/migrations";

// Pro year pass (ADR 0039, decided): an Entitlement row can now grant the
// whole Pro Plan (a paid pass or the OG grant) instead of one Feature, and the
// payment table records each paid checkout. payment doubles as the webhook's
// idempotency record (unique provider event id and checkout ref) and keeps
// its rows when a User is hard-deleted, since invoices must be kept. down()
// drops payment and the Plan rows; it loses every pass bought in between.
export class Migration20261010000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "entitlement" alter column "feature" drop not null;`);
		this.addSql(`alter table "entitlement" add column "plan" varchar(255) null;`);
		this.addSql(`
			alter table "entitlement"
				add constraint "entitlement_feature_or_plan_check" check (("feature" is null) <> ("plan" is null));
		`);
		this.addSql(`
			alter table "entitlement"
				add constraint "entitlement_user_id_plan_source_unique" unique ("user_id", "plan", "source");
		`);
		this.addSql(`
			create table "payment" (
				"id" serial primary key,
				"user_id" int null,
				"provider" varchar(255) not null,
				"event_id" varchar(255) not null,
				"checkout_ref" varchar(255) not null,
				"offer" varchar(255) not null,
				"amount_total" int null,
				"currency" varchar(255) null,
				"paid_at" timestamptz not null,
				"pass_expires_at" timestamptz null,
				"created_at" timestamptz not null default now(),
				"updated_at" timestamptz not null default now(),
				"deleted_at" timestamptz null,
				constraint "payment_user_id_fk"
					foreign key ("user_id") references "user"("id") on update cascade on delete set null,
				constraint "payment_event_id_unique" unique ("event_id"),
				constraint "payment_checkout_ref_unique" unique ("checkout_ref")
			);
		`);
	}

	override async down(): Promise<void> {
		this.addSql(`drop table if exists "payment";`);
		this.addSql(`delete from "entitlement" where "plan" is not null;`);
		this.addSql(`alter table "entitlement" drop constraint if exists "entitlement_user_id_plan_source_unique";`);
		this.addSql(`alter table "entitlement" drop constraint if exists "entitlement_feature_or_plan_check";`);
		this.addSql(`alter table "entitlement" drop column "plan";`);
		this.addSql(`alter table "entitlement" alter column "feature" set not null;`);
	}
}
