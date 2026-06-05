import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export const ROUTES_PAGE_LIMIT_DEFAULT = 100;
export const ROUTES_PAGE_LIMIT_MAX = 200;

export class ListRoutesQueryDto {
	@ApiPropertyOptional({
		description: "Page size",
		default: ROUTES_PAGE_LIMIT_DEFAULT,
		maximum: ROUTES_PAGE_LIMIT_MAX,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(ROUTES_PAGE_LIMIT_MAX)
	limit?: number;

	@ApiPropertyOptional({ description: "Number of routes to skip", default: 0, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset?: number;
}
