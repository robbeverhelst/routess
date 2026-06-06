import { Migration } from "@mikro-orm/migrations";

// Share tokens for routes and collections. Unlisted resources were reachable
// by sequential numeric id, which made the "only people with the link" tier
// enumerable. Anonymous access to unlisted resources now goes through an
// unguessable 32-hex token instead; numeric ids remain for owners and for
// public resources. Backfill uses gen_random_uuid() (built-in since pg13),
// which yields exactly 32 hex chars once the dashes are stripped.
export class Migration20260605000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "route" add column "share_token" varchar(255) null;`);
		this.addSql(`update "route" set "share_token" = replace(gen_random_uuid()::text, '-', '');`);
		this.addSql(`alter table "route" alter column "share_token" set not null;`);
		this.addSql(`alter table "route" add constraint "route_share_token_unique" unique ("share_token");`);

		this.addSql(`alter table "collection" add column "share_token" varchar(255) null;`);
		this.addSql(`update "collection" set "share_token" = replace(gen_random_uuid()::text, '-', '');`);
		this.addSql(`alter table "collection" alter column "share_token" set not null;`);
		this.addSql(`alter table "collection" add constraint "collection_share_token_unique" unique ("share_token");`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "collection" drop constraint "collection_share_token_unique";`);
		this.addSql(`alter table "collection" drop column "share_token";`);
		this.addSql(`alter table "route" drop constraint "route_share_token_unique";`);
		this.addSql(`alter table "route" drop column "share_token";`);
	}
}
