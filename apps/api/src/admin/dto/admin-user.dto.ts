import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { USER_ROLES, type UserRole } from "../../entities/user.entity";

export class AdminUserListItemDto {
	@ApiProperty({ example: 42 })
	id!: number;

	@ApiProperty({ example: "user@example.com" })
	email!: string;

	@ApiProperty({ example: "Jane Doe" })
	name!: string;

	@ApiProperty({ example: "user", enum: USER_ROLES })
	role!: UserRole;

	@ApiProperty({ example: true })
	isEmailVerified!: boolean;

	@ApiProperty({ example: 14 })
	routeCount!: number;

	@ApiProperty({ example: "2026-05-08T08:59:00.000Z" })
	createdAt!: string;

	@ApiPropertyOptional({ nullable: true, example: "2026-05-08T08:59:00.000Z" })
	lastActiveAt!: string | null;
}

export class AdminUserListDto {
	@ApiProperty({ type: [AdminUserListItemDto] })
	items!: AdminUserListItemDto[];

	@ApiProperty({ example: 1342 })
	total!: number;

	@ApiProperty({ example: 1 })
	page!: number;

	@ApiProperty({ example: 20 })
	pageSize!: number;
}

export class AdminUserSessionDto {
	@ApiProperty({ example: "5f2a9d6e-..." })
	id!: string;

	@ApiProperty({ example: "Mozilla/5.0 ..." })
	userAgent!: string | null;

	@ApiProperty({ example: "203.0.113.42" })
	ipAddress!: string | null;

	@ApiProperty({ example: "2026-05-08T08:59:00.000Z" })
	createdAt!: string;

	@ApiProperty({ example: "2026-05-15T08:59:00.000Z" })
	expiresAt!: string;

	@ApiPropertyOptional({ nullable: true })
	lastActivity!: string | null;
}

export class AdminUserRouteDto {
	@ApiProperty({ example: 1234 })
	id!: number;

	@ApiProperty({ example: "Sunday morning loop" })
	name!: string;

	@ApiPropertyOptional({ nullable: true })
	activity!: string | null;

	@ApiProperty({ example: "2026-05-08T08:59:00.000Z" })
	createdAt!: string;
}

export class AdminUserDetailDto extends AdminUserListItemDto {
	@ApiProperty({ type: [AdminUserSessionDto] })
	activeSessions!: AdminUserSessionDto[];

	@ApiProperty({ type: [AdminUserRouteDto] })
	recentRoutes!: AdminUserRouteDto[];
}
