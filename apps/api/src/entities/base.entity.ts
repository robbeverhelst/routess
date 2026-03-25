import { Property } from "@mikro-orm/core";

export abstract class BaseEntity {
	@Property()
	createdAt = new Date();

	@Property({ onUpdate: () => new Date() })
	updatedAt = new Date();

	@Property({ type: "datetime", nullable: true })
	deletedAt?: Date;
}
