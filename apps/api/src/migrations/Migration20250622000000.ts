import { Migration } from "@mikro-orm/migrations";

export class Migration20250622000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "user" ("id" serial primary key, "email" varchar(255) not null, "google_id" varchar(255) not null, "name" varchar(255) null, "picture" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `alter table "user" add constraint "user_email_unique" unique ("email");`,
    );
    this.addSql(
      `alter table "user" add constraint "user_google_id_unique" unique ("google_id");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "user" cascade;`);
  }
}
