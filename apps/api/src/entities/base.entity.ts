import { OptionalProps, Property } from "@mikro-orm/core";

export abstract class BaseEntity {
	[OptionalProps]?: "createdAt" | "updatedAt" | "deletedAt";

	@Property()
	createdAt = new Date();

	@Property({ onUpdate: () => new Date() })
	updatedAt = new Date();

	@Property({ type: "datetime", nullable: true })
	deletedAt?: Date;
}
