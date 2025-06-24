import { Entity, PrimaryKey, Property, ManyToOne, type Ref, Index } from "@mikro-orm/core";
import { User } from "./user.entity";
import { BaseEntity } from "./base.entity";

@Entity()
@Index({ properties: ["user"] })
@Index({ properties: ["expiresAt"] })
@Index({ properties: ["user", "expiresAt"] })
export class Session extends BaseEntity {
  @PrimaryKey()
  id!: number;

  @Property({ type: "string", unique: true })
  jti!: string; // JWT ID for tracking

  @ManyToOne(() => User)
  user!: Ref<User>;

  @Property({ type: "timestamp" })
  expiresAt!: Date;

  @Property({ type: "timestamp", nullable: true })
  lastActivity?: Date;

  @Property({ type: "string", nullable: true })
  userAgent?: string;

  @Property({ type: "string", nullable: true })
  ipAddress?: string;
}
