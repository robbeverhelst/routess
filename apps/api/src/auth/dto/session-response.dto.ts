import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SessionResponseDto {
	@ApiProperty({ example: 42 })
	id!: number;

	@ApiProperty({
		example: true,
		description: "True for the session that issued the JWT on this request. Cannot be revoked from the list.",
	})
	isCurrent!: boolean;

	@ApiPropertyOptional({ example: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)..." })
	userAgent?: string;

	@ApiPropertyOptional({ example: "203.0.113.42" })
	ipAddress?: string;

	@ApiPropertyOptional({ example: "2026-05-09T12:01:00.000Z" })
	lastActivity?: string;

	@ApiProperty({ example: "2026-05-16T12:01:00.000Z" })
	expiresAt!: string;

	@ApiProperty({ example: "2026-05-09T08:00:00.000Z" })
	createdAt!: string;
}
