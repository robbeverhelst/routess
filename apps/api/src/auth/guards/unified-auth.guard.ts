import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

// Accepts either a cookie/Bearer JWT session ("jwt" strategy) or a
// Personal Access Token presented as `Authorization: Bearer routess_pat_…`
// ("pat-bearer" strategy). Apply to endpoints that should be usable
// from both the web app and non-browser clients. Endpoints that must
// reject PATs (admin module, account deletion, PAT mint) continue
// to use the cookie-only `JwtAuthGuard`.
@Injectable()
export class UnifiedAuthGuard extends AuthGuard(["jwt", "pat-bearer"]) {}
