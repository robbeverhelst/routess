import { ApiProperty } from "@nestjs/swagger";
import { ProfileSummaryDto } from "../../profiles/dto/profile-response.dto";

// Owner-only view of the Follow graph: follower *lists* are visible to the
// owner only; the public sees counts on the Profile (CONTEXT.md "Profile").
export class FollowsResponseDto {
	@ApiProperty({ type: ProfileSummaryDto, isArray: true })
	following!: ProfileSummaryDto[];

	@ApiProperty({ type: ProfileSummaryDto, isArray: true })
	followers!: ProfileSummaryDto[];
}
