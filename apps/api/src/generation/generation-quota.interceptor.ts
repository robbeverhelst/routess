import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from "@nestjs/common";
import { from, type Observable, throwError } from "rxjs";
import { catchError, concatMap } from "rxjs/operators";

import { CacheService } from "../cache/cache.service";
import type { GenerateResponseDto } from "./dto/generate.dto";
import {
	GENERATION_QUOTA_CHARGE,
	GENERATION_QUOTA_COUNTER,
	type GenerationQuotaRequest,
} from "./generation-quota.guard";

// Takes back the attempt GenerationQuotaGuard counted when the generation
// does not succeed: it threw (routing busy, Valhalla down) or returned no
// candidates. Only a generation that hands back candidates uses quota.
@Injectable()
export class GenerationQuotaRefundInterceptor implements NestInterceptor {
	constructor(private readonly cache: CacheService) {}

	intercept(context: ExecutionContext, next: CallHandler<GenerateResponseDto>): Observable<GenerateResponseDto> {
		const key = context.switchToHttp().getRequest<GenerationQuotaRequest>()[GENERATION_QUOTA_CHARGE];
		if (!key) return next.handle();
		const refund = () => this.cache.decrement(GENERATION_QUOTA_COUNTER, key);

		return next.handle().pipe(
			concatMap(async (response) => {
				if (!response?.candidates?.length) await refund();
				return response;
			}),
			catchError((err: unknown) => from(refund()).pipe(concatMap(() => throwError(() => err)))),
		);
	}
}
