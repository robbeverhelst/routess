import { Migration } from "@mikro-orm/migrations";

// Library redesign: server-side favourites and Collections.
// - route.favourite replaces the client-only localStorage favourites.
// - collection + collection_route implement curated, manually ordered,
//   shareable sets of routes (many-to-many with a position column).
export class Migration20260604000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "route" add column "favourite" boolean not null default false;`);
		this.addSql(`
			create table "collection" (
				"id" serial primary key,
				"name" varchar(255) not null,
				"description" varchar(255) null,
				"visibility" varchar(255) not null default 'private',
				"user_id" int not null,
				"created_at" timestamptz not null default now(),
				"updated_at" timestamptz not null default now(),
				"deleted_at" timestamptz null,
				constraint "collection_user_id_fk"
					foreign key ("user_id") references "user"("id") on update cascade
			);
		`);
		this.addSql(`create index "collection_user_id_index" on "collection" ("user_id");`);
		this.addSql(`
			create table "collection_route" (
				"id" serial primary key,
				"collection_id" int not null,
				"route_id" int not null,
				"position" int not null,
				constraint "collection_route_collection_id_fk"
					foreign key ("collection_id") references "collection"("id") on update cascade on delete cascade,
				constraint "collection_route_route_id_fk"
					foreign key ("route_id") references "route"("id") on update cascade on delete cascade
			);
		`);
		this.addSql(`
			alter table "collection_route"
				add constraint "collection_route_collection_id_route_id_unique" unique ("collection_id", "route_id");
		`);
		this.addSql(`create index "collection_route_collection_id_index" on "collection_route" ("collection_id");`);
		this.addSql(`create index "collection_route_route_id_index" on "collection_route" ("route_id");`);
	}

	override async down(): Promise<void> {
		this.addSql(`drop table if exists "collection_route";`);
		this.addSql(`drop table if exists "collection";`);
		this.addSql(`alter table "route" drop column "favourite";`);
	}
}
