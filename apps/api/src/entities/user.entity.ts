import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { BaseEntity } from "./base.entity";

@Entity()
export class User extends BaseEntity {
  @PrimaryKey({ type: "number" })
  id!: number;

  @Property({ unique: true })
  email!: string;

  @Property()
  name!: string;

  @Property({ hidden: true, nullable: true })
  password?: string;

  @Property({ hidden: true, nullable: true })
  googleId?: string;

  @Property({ nullable: true })
  avatar?: string;

  @Property({ default: false })
  isEmailVerified = false;
}
