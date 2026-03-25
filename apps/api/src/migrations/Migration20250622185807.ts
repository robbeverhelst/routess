import { Migration } from "@mikro-orm/migrations";

export class Migration20250622185807 extends Migration {
	override async up(): Promise<void> {
		this.addSql(
			`create table "route" ("id" serial primary key, "name" varchar(255) not null, "description" varchar(255) null, "waypoints" jsonb not null, "distance" real null, "user_id" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
		);

		this.addSql(
			`alter table "route" add constraint "route_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`,
		);
	}

	override async down(): Promise<void> {
		this.addSql(`drop table if exists "route" cascade;`);
	}
}
