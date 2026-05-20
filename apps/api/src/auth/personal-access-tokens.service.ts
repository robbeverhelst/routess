import { createHmac, randomBytes } from "node:crypto";
import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { type PatScope, PersonalAccessToken } from "../entities/personal-access-token.entity";
import type {
	CreatePersonalAccessTokenResponseDto,
	PersonalAccessTokenResponseDto,
} from "./dto/personal-access-token.dto";

export const PAT_TOKEN_PREFIX = "routess_pat_";

// Updates to lastUsedAt on every authenticated PAT request would mean a write
// for every read. Throttling the touch to once per LAST_USED_TOUCH_INTERVAL_MS
// keeps the field useful ("approximately when was this token last active")
// without DoS'ing Postgres on agent loops.
const LAST_USED_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class PersonalAccessTokensService {
	constructor(
		@InjectRepository(PersonalAccessToken)
		private readonly tokenRepository: EntityRepository<PersonalAccessToken>,
		private readonly em: EntityManager,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
	) {}

	private hashToken(plaintext: string): string {
		return createHmac("sha256", this.config.auth.patPepper).update(plaintext).digest("hex");
	}

	private generatePlaintext(): string {
		// 32 random bytes → 43 base64url chars. Combined with the prefix this is
		// a 55-char opaque string, recognisable for leak scanners and large
		// enough that brute-force is computationally infeasible.
		return `${PAT_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
	}

	private toResponseDto(record: PersonalAccessToken): PersonalAccessTokenResponseDto {
		return {
			id: record.id,
			label: record.label,
			scope: record.scope,
			lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
			expiresAt: record.expiresAt?.toISOString() ?? null,
			createdAt: record.createdAt.toISOString(),
		};
	}

	async mint(
		userId: number,
		label: string,
		scope: PatScope,
		expiresAt: Date | undefined,
	): Promise<CreatePersonalAccessTokenResponseDto> {
		const plaintext = this.generatePlaintext();
		const record = this.tokenRepository.create({
			tokenHash: this.hashToken(plaintext),
			user: userId,
			label,
			scope,
			expiresAt,
		});
		await this.em.persistAndFlush(record);
		return { ...this.toResponseDto(record), token: plaintext };
	}

	async list(userId: number): Promise<PersonalAccessTokenResponseDto[]> {
		const records = await this.tokenRepository.find(
			{ user: userId, revokedAt: null },
			{ orderBy: { createdAt: "DESC" } },
		);
		return records.map((record) => this.toResponseDto(record));
	}

	async revoke(userId: number, id: number): Promise<void> {
		const record = await this.tokenRepository.findOne({ id, user: userId });
		if (!record) {
			throw new NotFoundException(`Personal access token with ID ${id} not found`);
		}
		if (record.revokedAt) {
			return;
		}
		record.revokedAt = new Date();
		await this.em.persistAndFlush(record);
	}

	// Used by the bearer-auth strategy. Returns the populated record if the
	// presented plaintext is a valid, non-revoked, non-expired PAT; otherwise
	// null. Touches lastUsedAt at most once per LAST_USED_TOUCH_INTERVAL_MS.
	async verifyAndTouch(plaintext: string): Promise<PersonalAccessToken | null> {
		if (!plaintext.startsWith(PAT_TOKEN_PREFIX)) {
			return null;
		}
		const record = await this.tokenRepository.findOne(
			{ tokenHash: this.hashToken(plaintext), revokedAt: null },
			{ populate: ["user"] },
		);
		if (!record) {
			return null;
		}
		if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
			return null;
		}
		const now = new Date();
		const lastTouchAgeMs = record.lastUsedAt ? now.getTime() - record.lastUsedAt.getTime() : Number.POSITIVE_INFINITY;
		if (lastTouchAgeMs > LAST_USED_TOUCH_INTERVAL_MS) {
			record.lastUsedAt = now;
			// Fire-and-forget. The request continues even if the touch fails;
			// it is observability, not correctness.
			void this.em.flush().catch(() => undefined);
		}
		return record;
	}
}
