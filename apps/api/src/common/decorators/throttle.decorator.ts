import { Throttle } from "@nestjs/throttler";

export const ThrottleAuth = () => Throttle({ default: { limit: 5, ttl: 60000 } }); // Auth: 5 per minute (security)
export const ThrottleStrict = () => Throttle({ default: { limit: 10, ttl: 60000 } }); // Strict: 10 per minute
export const ThrottleModerate = () => Throttle({ default: { limit: 60, ttl: 60000 } }); // Moderate: 60 per minute (1 per second)
export const ThrottlePublic = () => Throttle({ default: { limit: 200, ttl: 60000 } }); // Public: 200 per minute
