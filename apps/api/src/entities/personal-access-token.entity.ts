import { type Rel } from "@mikro-orm/core";
import { Entity, Index, ManyToOne, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

export type PatScope = "read" | "write";

@Entity()
@Index({ properties: ["user"] })
@Index({ properties: ["revokedAt"] })
export class PersonalAccessToken extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@Property({ type: "string", unique: true, hidden: true })
	tokenHash!: string;

	@ManyToOne(() => User)
	user!: Rel<User>;

	@Property({ type: "string" })
	label!: string;

	@Property({ type: "string" })
	scope!: PatScope;

	@Property({ type: "timestamp", nullable: true })
	expiresAt?: Date;

	@Property({ type: "timestamp", nullable: true })
	lastUsedAt?: Date;

	@Property({ type: "timestamp", nullable: true })
	revokedAt?: Date;
}
