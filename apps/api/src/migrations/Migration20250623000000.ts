import { Migration } from "@mikro-orm/migrations";

export class Migration20250623000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "user" add column "deleted_at" timestamptz null;');
    this.addSql('alter table "route" add column "deleted_at" timestamptz null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "user" drop column "deleted_at";');
    this.addSql('alter table "route" drop column "deleted_at";');
  }
}