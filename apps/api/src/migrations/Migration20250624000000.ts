import { Migration } from "@mikro-orm/migrations";

export class Migration20250624000000 extends Migration {
  override async up(): Promise<void> {
    // Create session table
    this.addSql(`create table "session" (
      "id" serial primary key, 
      "created_at" timestamptz not null default now(), 
      "updated_at" timestamptz not null default now(), 
      "deleted_at" timestamptz null, 
      "jti" varchar(255) not null, 
      "user_id" int not null, 
      "expires_at" timestamptz not null, 
      "last_activity" timestamptz null, 
      "user_agent" varchar(255) null, 
      "ip_address" varchar(255) null
    );`);

    // Add unique constraint on jti
    this.addSql('alter table "session" add constraint "session_jti_unique" unique ("jti");');

    // Add foreign key constraint
    this.addSql(
      'alter table "session" add constraint "session_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;',
    );

    // Add indexes for performance
    this.addSql('create index "session_user_id_index" on "session" ("user_id");');
    this.addSql('create index "session_expires_at_index" on "session" ("expires_at");');
    this.addSql(
      'create index "session_user_id_expires_at_index" on "session" ("user_id", "expires_at");',
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "session" cascade;');
  }
}
