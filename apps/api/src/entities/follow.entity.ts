import { type Ref } from "@mikro-orm/core";
import { Entity, Index, ManyToOne, PrimaryKey, Unique } from "@mikro-orm/decorators/legacy";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

// Asymmetric subscription from one User to another's Profile (CONTEXT.md
// "Follow"). Grants no access: RouteVisibility stays the only access-control
// concept (ADR 0027). Unfollow hard-deletes the row.
@Entity()
@Unique({ properties: ["follower", "followee"] })
@Index({ properties: ["follower"] })
@Index({ properties: ["followee"] })
export class Follow extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@ManyToOne(() => User, { deleteRule: "cascade" })
	follower!: Ref<User>;

	@ManyToOne(() => User, { deleteRule: "cascade" })
	followee!: Ref<User>;
}
