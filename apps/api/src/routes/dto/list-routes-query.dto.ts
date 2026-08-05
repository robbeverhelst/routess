import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export const ROUTES_PAGE_LIMIT_DEFAULT = 100;
export const ROUTES_PAGE_LIMIT_MAX = 200;
// The public listing unions two independent tables at read time (ADR 0035), so
// it fetches `offset + limit` from each side before merging. That makes deep
// paging cost grow with the offset, so it needs a ceiling (#354).
export const ROUTES_PAGE_OFFSET_MAX = 50_000;

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

	@ApiPropertyOptional({
		description: "Number of routes to skip",
		default: 0,
		minimum: 0,
		maximum: ROUTES_PAGE_OFFSET_MAX,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(ROUTES_PAGE_OFFSET_MAX)
	offset?: number;
}
