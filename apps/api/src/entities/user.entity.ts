import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  email!: string;

  @Property()
  name!: string;

  @Property({ hidden: true, nullable: true })
  password?: string;

  @Property({ nullable: true })
  googleId?: string;

  @Property({ nullable: true })
  avatar?: string;

  @Property({ default: false })
  isEmailVerified = false;

  @Property()
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();
}
