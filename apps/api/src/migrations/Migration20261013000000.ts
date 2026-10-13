import { Migration } from "@mikro-orm/migrations";

// Admin Pro actions: grants, extensions and revocations made from the admin
// panel are recorded in admin_audit_entry (who, when, what, and the reason the
// admin gave). Both User links are set null on delete so the trail outlives
// the accounts; actor_email keeps who acted. The Entitlement source 'admin'
// needs no schema change: source is free text checked by the API. down()
// drops the table and loses the trail.
export class Migration20261013000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`
			create table "admin_audit_entry" (
				"id" serial primary key,
				"actor_id" int null,
				"actor_email" varchar(255) not null,
				"action" varchar(255) not null,
				"target_user_id" int null,
				"details" jsonb not null,
				"reason" text not null,
				"created_at" timestamptz not null default now(),
				"updated_at" timestamptz not null default now(),
				"deleted_at" timestamptz null,
				constraint "admin_audit_entry_actor_id_fk"
					foreign key ("actor_id") references "user"("id") on update cascade on delete set null,
				constraint "admin_audit_entry_target_user_id_fk"
					foreign key ("target_user_id") references "user"("id") on update cascade on delete set null
			);
		`);
		this.addSql(
			`create index "admin_audit_entry_target_user_id_created_at_index" on "admin_audit_entry" ("target_user_id", "created_at");`,
		);
	}

	override async down(): Promise<void> {
		this.addSql(`drop table if exists "admin_audit_entry";`);
	}
}
