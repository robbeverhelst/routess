import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProfileRouteDto, ProfileSummaryDto } from "../../profiles/dto/profile-response.dto";

// An inbox entry (CONTEXT.md "RouteShare"). The route is a live reference:
// when it has been deleted or flipped back to private, `route` is null and
// `unavailable` is true (ADR 0027 — the share grants no access of its own).
export class RouteShareResponseDto {
	@ApiProperty({ example: 7 })
	id!: number;

	@ApiProperty({ type: ProfileSummaryDto })
	sender!: ProfileSummaryDto;

	@ApiPropertyOptional({ example: "Route for Sunday's ride!", nullable: true })
	message?: string | null;

	@ApiPropertyOptional({ type: ProfileRouteDto, nullable: true })
	route?: ProfileRouteDto | null;

	@ApiProperty({ example: false })
	unavailable!: boolean;

	@ApiPropertyOptional({ example: "2026-06-05T10:00:00.000Z", nullable: true })
	readAt?: string | null;

	@ApiProperty({ example: "2026-06-05T09:00:00.000Z" })
	createdAt!: string;
}

export class ShareUnreadCountDto {
	@ApiProperty({ example: 2 })
	unread!: number;
}
