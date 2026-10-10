import { Migration } from "@mikro-orm/migrations";

// Payments groundwork (#135, ADR 0039): every User gets a Plan (default
// 'free'), and the entitlement table holds per-User Feature grants that sit on
// top of the Plan (comps, beta access, one-time purchases). Nothing reads
// these to gate a request yet. down() drops both, so the step is reversible
// until real grants exist.
export class Migration20261009000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "user" add column "plan" varchar(255) not null default 'free';`);
		this.addSql(`
			create table "entitlement" (
				"id" serial primary key,
				"user_id" int not null,
				"feature" varchar(255) not null,
				"source" varchar(255) not null,
				"expires_at" timestamptz null,
				"created_at" timestamptz not null default now(),
				"updated_at" timestamptz not null default now(),
				"deleted_at" timestamptz null,
				constraint "entitlement_user_id_fk"
					foreign key ("user_id") references "user"("id") on update cascade on delete cascade,
				constraint "entitlement_user_id_feature_unique" unique ("user_id", "feature")
			);
		`);
	}

	override async down(): Promise<void> {
		this.addSql(`drop table if exists "entitlement";`);
		this.addSql(`alter table "user" drop column "plan";`);
	}
}
