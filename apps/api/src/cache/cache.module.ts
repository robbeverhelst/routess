import { Global, Module } from "@nestjs/common";
import { CacheService } from "./cache.service";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

@Global()
@Module({
	providers: [CacheService, RedisThrottlerStorage],
	exports: [CacheService, RedisThrottlerStorage],
})
export class CacheModule {}
