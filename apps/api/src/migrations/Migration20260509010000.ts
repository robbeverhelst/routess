import { Migration } from "@mikro-orm/migrations";

// Rename Route's "privacy" column to "visibility" and migrate the value "link"
// to "unlisted" (issue #134). Aligns the column name with the canonical
// RouteVisibility domain term and the YouTube-style enum that the product
// language committed to. This is a pure rename — semantics of all three values
// are unchanged. Code paths that defaulted to "private" still default to
// "private".
export class Migration20260509010000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "route" rename column "privacy" to "visibility";`);
		this.addSql(`update "route" set "visibility" = 'unlisted' where "visibility" = 'link';`);
	}

	override async down(): Promise<void> {
		this.addSql(`update "route" set "visibility" = 'link' where "visibility" = 'unlisted';`);
		this.addSql(`alter table "route" rename column "visibility" to "privacy";`);
	}
}
