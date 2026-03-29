import { Migration } from "@mikro-orm/migrations";

export class Migration20260329064500 extends Migration {
	override async up(): Promise<void> {
		this.addSql('alter table "user" rename column "picture" to "avatar";');
		this.addSql('alter table "user" add column "is_email_verified" boolean not null default false;');
	}

	override async down(): Promise<void> {
		this.addSql('alter table "user" drop column "is_email_verified";');
		this.addSql('alter table "user" rename column "avatar" to "picture";');
	}
}
