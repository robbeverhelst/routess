import { Migration } from "@mikro-orm/migrations";

// Promotes activity / privacy / tags from a serialized blob inside `description`
// (e.g. "Activity: run; Privacy: link; Tags: hilly, scenic") to first-class
// columns. The web client used to encode them into description because the
// Route entity had no fields for them; the regex parser in RouteDetailPanel
// decoded them on read. With proper columns the parser is deleted, the encoder
// in SaveModal is gone, and `description` returns to free-form prose.
//
// Backfill is one-shot: any existing description matching the encoded shape is
// parsed into the new columns and the description is then nulled. Descriptions
// that don't match are left untouched as user prose.
export class Migration20260508060000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "route" add column "activity" varchar(255) null;`);
		this.addSql(`alter table "route" add column "privacy" varchar(255) not null default 'private';`);
		this.addSql(`alter table "route" add column "tags" jsonb not null default '[]'::jsonb;`);

		// One-shot backfill: the encoded shape is
		//   "Activity: <activity>; Privacy: <privacy>[; Tags: <tag>, <tag>...]"
		// The regex captures activity, privacy, and an optional tags list, all
		// case-insensitive. Rows that don't match are skipped — their description
		// is real prose and stays.
		this.addSql(`
			with parsed as (
				select
					id,
					regexp_match(
						description,
						'^Activity:\\s*(\\w+);\\s*Privacy:\\s*(\\w+)(?:;\\s*Tags:\\s*(.*?))?\\s*\\.?$',
						'i'
					) as m
				from "route"
				where description is not null
			),
			matched as (
				select
					id,
					lower(m[1]) as activity,
					lower(m[2]) as privacy,
					case
						when m[3] is null or trim(m[3]) = '' then '[]'::jsonb
						else (
							select coalesce(jsonb_agg(trim(t)), '[]'::jsonb)
							from regexp_split_to_table(m[3], ',') as t
							where trim(t) <> ''
						)
					end as tags
				from parsed
				where m is not null
			)
			update "route" r
			set
				activity = case when m.activity in ('run', 'cycle', 'walk') then m.activity else null end,
				privacy = case when m.privacy in ('private', 'link', 'public') then m.privacy else 'private' end,
				tags = m.tags,
				description = null
			from matched m
			where r.id = m.id;
		`);
	}

	override async down(): Promise<void> {
		// Best-effort restoration: re-encode the columns into description for
		// rows that have an activity set (the marker that this row carried
		// encoded metadata before the up migration). Rows without activity keep
		// whatever description they had.
		this.addSql(`
			update "route"
			set description = case
				when jsonb_array_length(tags) > 0 then
					'Activity: ' || activity || '; Privacy: ' || privacy || '; Tags: ' ||
					(select string_agg(value::text, ', ') from jsonb_array_elements_text(tags))
				else
					'Activity: ' || activity || '; Privacy: ' || privacy
			end
			where activity is not null;
		`);
		this.addSql(`alter table "route" drop column "tags";`);
		this.addSql(`alter table "route" drop column "privacy";`);
		this.addSql(`alter table "route" drop column "activity";`);
	}
}
