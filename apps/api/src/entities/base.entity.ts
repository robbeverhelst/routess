import { Filter, OptionalProps, Property } from "@mikro-orm/core";

export const SOFT_DELETE_FILTER = "softDelete";

@Filter({ name: SOFT_DELETE_FILTER, cond: { deletedAt: null }, default: true })
export abstract class BaseEntity {
	[OptionalProps]?: "createdAt" | "updatedAt" | "deletedAt";

	@Property()
	createdAt = new Date();

	@Property({ onUpdate: () => new Date() })
	updatedAt = new Date();

	@Property({ type: "datetime", nullable: true })
	deletedAt?: Date;
}
