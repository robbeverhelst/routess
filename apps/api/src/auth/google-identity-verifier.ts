import { Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { MetricsService } from "../telemetry/metrics.service";

export interface GoogleIdentity {
	googleId: string;
	email: string;
	name?: string;
	picture?: string;
}

export interface GoogleIdentityVerifier {
	verify(credential: string): Promise<GoogleIdentity>;
}

export const GOOGLE_IDENTITY_VERIFIER = Symbol("GOOGLE_IDENTITY_VERIFIER");

@Injectable()
export class GoogleOAuth2Verifier implements GoogleIdentityVerifier {
	private readonly logger = new Logger(GoogleOAuth2Verifier.name);
	private readonly client: OAuth2Client;

	constructor(
		@Inject(APP_CONFIG) private readonly config: AppConfig,
		private readonly metrics: MetricsService,
	) {
		this.client = new OAuth2Client(this.config.auth.googleClientId);
	}

	async verify(credential: string): Promise<GoogleIdentity> {
		const start = Date.now();
		let status: "success" | "error" = "error";
		try {
			const identity = await this.callGoogle(credential);
			status = "success";
			return identity;
		} finally {
			this.metrics.recordExternalRequest("google", status, Date.now() - start);
		}
	}

	private async callGoogle(credential: string): Promise<GoogleIdentity> {
		let payload: TokenPayload | undefined;
		try {
			const ticket = await this.client.verifyIdToken({
				idToken: credential,
				audience: this.config.auth.googleClientId,
			});
			payload = ticket.getPayload();
		} catch (error) {
			this.logger.warn(`Google token verification failed: ${error instanceof Error ? error.message : String(error)}`);
			throw new UnauthorizedException("Failed to authenticate with Google");
		}

		if (!payload) {
			throw new UnauthorizedException("Invalid Google token");
		}
		if (!payload.email) {
			throw new UnauthorizedException("Email not provided by Google");
		}

		return {
			googleId: payload.sub,
			email: payload.email,
			name: payload.name,
			picture: payload.picture,
		};
	}
}
