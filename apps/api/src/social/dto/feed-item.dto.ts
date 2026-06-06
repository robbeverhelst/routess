import { ApiProperty } from "@nestjs/swagger";
import { ProfileRouteDto, ProfileSummaryDto } from "../../profiles/dto/profile-response.dto";

// One entry in the Feed (CONTEXT.md "Feed"): a public Route of a followed
// Profile. The feed is a derived view — nothing is stored per follower.
export class FeedItemDto extends ProfileRouteDto {
	@ApiProperty({ type: ProfileSummaryDto })
	author!: ProfileSummaryDto;
}
