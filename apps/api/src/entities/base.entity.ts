import { OptionalProps } from "@mikro-orm/core";
import { Filter, Property } from "@mikro-orm/decorators/legacy";

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
