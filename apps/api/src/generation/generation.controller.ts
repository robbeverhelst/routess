import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { ThrottleExpensive } from "../common/decorators/throttle.decorator";
import { GenerateRequestDto, GenerateResponseDto } from "./dto/generate.dto";
import { GenerationService } from "./generation.service";
import { GenerationQuotaGuard } from "./generation-quota.guard";

@ApiTags("generation")
@Controller("generation")
export class GenerationController {
	constructor(private readonly generationService: GenerationService) {}

	@ApiOperation({
		summary: "Generate loop route candidates from high-level parameters",
		description:
			"Runs the RouteGeneration pipeline (ADR-0029): a fan of candidate loops around the start point, snap-validated, routed through Valhalla, scored on Overlap/distance/surface/shape, and reduced to up to 3 diverse candidates. " +
			"A response with an empty candidate list carries a structured failure code that drives retry suggestions. " +
			"Each request fans out into ~10-25 Valhalla calls, hence the strict per-IP throttle and a per-User daily quota (ADR 0031).",
	})
	@ApiBody({ type: GenerateRequestDto })
	@ApiResponse({ status: 200, description: "Scored candidates or a structured failure", type: GenerateResponseDto })
	@ApiResponse({ status: 429, description: "Daily route generation quota exceeded" })
	@ApiResponse({ status: 503, description: "Valhalla is not configured or unreachable" })
	// OptionalJwtAuthGuard populates req.user so the quota keys per-User when
	// signed in (falling back to IP); the quota guard runs after it.
	@UseGuards(OptionalJwtAuthGuard, GenerationQuotaGuard)
	@ThrottleExpensive()
	@HttpCode(HttpStatus.OK)
	@Post()
	generate(@Body() body: GenerateRequestDto): Promise<GenerateResponseDto> {
		return this.generationService.generate(body);
	}
}
