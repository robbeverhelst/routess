import { Entity, Index, ManyToOne, PrimaryKey, Property, type Ref } from "@mikro-orm/core";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

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
