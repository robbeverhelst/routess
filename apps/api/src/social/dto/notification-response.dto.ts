import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProfileSummaryDto } from "../../profiles/dto/profile-response.dto";

// A Notification is a derived pointer (CONTEXT.md "Notification"): one item per
// Follow of you or RouteShare sent to you. Nothing is stored per item, so an
// unfollow or dismissed share removes its item instantly.
export class NotificationItemDto {
	@ApiProperty({ enum: ["follow", "route_share"], example: "follow" })
	type!: "follow" | "route_share";

	@ApiProperty({ type: ProfileSummaryDto })
	actor!: ProfileSummaryDto;

	@ApiPropertyOptional({ example: 7, description: "RouteShare id; route_share items only" })
	shareId?: number;

	@ApiPropertyOptional({
		example: "Sunday gravel loop",
		nullable: true,
		description: "Live reference; null when the route is deleted or private again",
	})
	routeName?: string | null;

	@ApiProperty({ example: "2026-06-05T09:00:00.000Z" })
	createdAt!: string;
}

export class NotificationsResponseDto {
	@ApiProperty({ type: NotificationItemDto, isArray: true })
	items!: NotificationItemDto[];

	// The NotificationsSeenAt watermark as it was before this read; items newer
	// than it render highlighted as unseen.
	@ApiPropertyOptional({ example: "2026-06-05T08:00:00.000Z", nullable: true })
	seenAt?: string | null;
}

export class NotificationUnseenCountDto {
	@ApiProperty({ example: 3 })
	unseen!: number;
}
