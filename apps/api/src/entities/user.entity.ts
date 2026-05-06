import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/core";
import { BaseEntity } from "./base.entity";
import type { UserPreferences } from "../users/user-preferences";

@Entity()
@Index({ properties: ["email"] }) // Index for email lookups
@Index({ properties: ["googleId"] }) // Index for Google authentication
export class User extends BaseEntity {
	@PrimaryKey({ type: "number" })
	id!: number;

	@Property({ unique: true })
	email!: string;

	@Property()
	name!: string;

	@Property({ hidden: true, nullable: true })
	googleId?: string;

	@Property({ nullable: true })
	avatar?: string;

	@Property({ default: false })
	isEmailVerified = false;

	@Property({ type: "json", nullable: true })
	preferences?: UserPreferences | null;
}
