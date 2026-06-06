import { Migration } from "@mikro-orm/migrations";

// Social v1 (#245, ADR 0027):
// - user.handle: public Profile address, backfilled from the display name
//   (never the email; fallback user-<random>), then unique + not null.
// - route.published_at: first transition to public (CONTEXT.md "PublishedAt"),
//   backfilled for currently-public routes from updated_at.
// - route.copied_from_*: lineage for "save a copy" of a shared route.
// - follow: asymmetric subscription, unique (follower, followee).
// - route_share: person-to-person delivery landing in the recipient's inbox.

// Keep in sync with RESERVED_HANDLES in @routess/core.
const RESERVED = [
	"admin",
	"api",
	"app",
	"assets",
	"auth",
	"blog",
	"collection",
	"collections",
	"compare",
	"cycling-routes",
	"discover",
	"docs",
	"feed",
	"fietsroutes",
	"guides",
	"hardlooproutes",
	"help",
	"inbox",
	"library",
	"login",
	"logout",
	"looproutes",
	"mail",
	"me",
	"plan",
	"privacy",
	"profile",
	"profiles",
	"r",
	"route",
	"routes",
	"routess",
	"running-routes",
	"search",
	"settings",
	"share",
	"shares",
	"signup",
	"sitemap",
	"social",
	"static",
	"support",
	"terms",
	"u",
	"user",
	"users",
	"walking-routes",
	"wandelroutes",
	"www",
];

export class Migration20260606000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "user" add column "handle" varchar(30) null;`);

		// Backfill: slugify the display name into a handle base; users whose
		// base is unusable (too short, reserved, or equal to the email
		// local-part — emails are PII and must not leak into public URLs) get a
		// random user-xxxxxx handle. Duplicate bases keep the first claimant
		// bare and suffix the rest with random chars.
		const reservedList = RESERVED.map((w) => `'${w}'`).join(",");
		this.addSql(`
			with candidates as (
				select id,
					trim(both '-' from substring(
						trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
						for 24
					)) as base,
					lower(split_part(email, '@', 1)) as email_local
				from "user"
			),
			resolved as (
				select id,
					case
						when base is null or length(base) < 3 or base in (${reservedList}) or base = email_local
							then 'user-' || substr(md5(random()::text || id::text), 1, 8)
						else base
					end as base
				from candidates
			),
			numbered as (
				select id, base, row_number() over (partition by base order by id) as rn
				from resolved
			)
			update "user" u
			set "handle" = case
				when n.rn = 1 then n.base
				else n.base || '-' || substr(md5(random()::text || n.id::text), 1, 4)
			end
			from numbered n
			where u.id = n.id;
		`);

		this.addSql(`alter table "user" alter column "handle" set not null;`);
		this.addSql(`alter table "user" add constraint "user_handle_unique" unique ("handle");`);

		this.addSql(`alter table "route" add column "published_at" timestamptz null;`);
		this.addSql(`update "route" set "published_at" = "updated_at" where "visibility" = 'public';`);
		this.addSql(`alter table "route" add column "copied_from_route_id" int null;`);
		this.addSql(`alter table "route" add column "copied_from_user_id" int null;`);

		this.addSql(`
			create table "follow" (
				"id" serial primary key,
				"follower_id" int not null,
				"followee_id" int not null,
				"created_at" timestamptz not null default now(),
				"updated_at" timestamptz not null default now(),
				"deleted_at" timestamptz null,
				constraint "follow_follower_id_fk"
					foreign key ("follower_id") references "user"("id") on update cascade on delete cascade,
				constraint "follow_followee_id_fk"
					foreign key ("followee_id") references "user"("id") on update cascade on delete cascade,
				constraint "follow_follower_id_followee_id_unique" unique ("follower_id", "followee_id")
			);
		`);
		this.addSql(`create index "follow_follower_id_index" on "follow" ("follower_id");`);
		this.addSql(`create index "follow_followee_id_index" on "follow" ("followee_id");`);

		this.addSql(`
			create table "route_share" (
				"id" serial primary key,
				"sender_id" int not null,
				"recipient_id" int not null,
				"route_id" int not null,
				"message" varchar(500) null,
				"read_at" timestamptz null,
				"emailed_at" timestamptz null,
				"created_at" timestamptz not null default now(),
				"updated_at" timestamptz not null default now(),
				"deleted_at" timestamptz null,
				constraint "route_share_sender_id_fk"
					foreign key ("sender_id") references "user"("id") on update cascade on delete cascade,
				constraint "route_share_recipient_id_fk"
					foreign key ("recipient_id") references "user"("id") on update cascade on delete cascade,
				constraint "route_share_route_id_fk"
					foreign key ("route_id") references "route"("id") on update cascade on delete cascade
			);
		`);
		this.addSql(
			`create index "route_share_recipient_id_created_at_index" on "route_share" ("recipient_id", "created_at");`,
		);
		this.addSql(`create index "route_share_sender_id_index" on "route_share" ("sender_id");`);
		this.addSql(`create index "route_share_route_id_index" on "route_share" ("route_id");`);
	}

	override async down(): Promise<void> {
		this.addSql(`drop table if exists "route_share";`);
		this.addSql(`drop table if exists "follow";`);
		this.addSql(`alter table "route" drop column "copied_from_user_id";`);
		this.addSql(`alter table "route" drop column "copied_from_route_id";`);
		this.addSql(`alter table "route" drop column "published_at";`);
		this.addSql(`alter table "user" drop constraint "user_handle_unique";`);
		this.addSql(`alter table "user" drop column "handle";`);
	}
}
