import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { isValidHandle, mergeUserPreferences } from "@routess/core";
import { SessionService } from "../auth/session.service";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import type { UpdateCurrentUserDto } from "./dto/update-current-user.dto";
import { isHandleUniqueViolation } from "./handle.util";

// Days of grace between self-initiated deletion and the hard-delete cron.
// Per ADR 0017. If you change this, update the ADR + UI copy + tests.
const SELF_DELETE_GRACE_DAYS = 30;

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);

	constructor(
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
		private readonly em: EntityManager,
		private readonly sessionService: SessionService,
	) {}

	async findOne(id: number): Promise<User> {
		const user = await this.userRepository.findOne({ id });
		if (!user) {
			throw new NotFoundException(`User with ID ${id} not found`);
		}
		return user;
	}

	async update(id: number, updateUserDto: UpdateCurrentUserDto): Promise<User> {
		const user = await this.findOne(id);

		if (updateUserDto.name !== undefined) {
			user.name = updateUserDto.name;
		}
		if (updateUserDto.handle !== undefined && updateUserDto.handle !== user.handle) {
			if (!isValidHandle(updateUserDto.handle)) {
				throw new BadRequestException(
					"Handle must be 3-30 lowercase letters, digits or hyphens, and not a reserved word",
				);
			}
			const taken = await this.userRepository.findOne(
				{ handle: updateUserDto.handle },
				{ filters: { softDelete: false } },
			);
			if (taken) {
				throw new ConflictException("This handle is already taken");
			}
			user.handle = updateUserDto.handle;
		}
		if (updateUserDto.avatar !== undefined) {
			user.avatar = updateUserDto.avatar;
		}
		if (updateUserDto.preferences !== undefined) {
			user.preferences = mergeUserPreferences(user.preferences, updateUserDto.preferences);
		}

		try {
			await this.em.persistAndFlush(user);
		} catch (error) {
			// Lost the handle race to a concurrent claim; same 409 as the
			// up-front taken check.
			if (isHandleUniqueViolation(error)) {
				throw new ConflictException("This handle is already taken");
			}
			throw error;
		}
		return user;
	}

	// Self-initiated deletion (ADR 0017). Sets deletionStatus = pending and the
	// requested timestamp, soft-deletes the user + their routes, and revokes all
	// sessions. The hardDeleteExpiredAccounts cron later hard-deletes after the
	// grace window. Distinct from admin-driven soft-delete (ADR 0016) which
	// leaves deletionStatus = 'active' and is reversible by relogin.
	async remove(id: number): Promise<void> {
		const user = await this.findOne(id);
		const now = new Date();
		user.deletedAt = now;
		user.deletionStatus = "pending_hard_delete";
		user.deletionRequestedAt = now;

		const routes = await this.routeRepository.find({ user: id });
		for (const route of routes) {
			route.deletedAt = now;
		}

		await this.em.persistAndFlush(user);
		await this.em.flush();
		await this.sessionService.invalidateUserSessions(id);
	}

	// Cancel a pending self-deletion. Restores the user (clears deletedAt and
	// deletionStatus) and un-soft-deletes their routes. No-op if the user is not
	// in a pending state.
	async cancelDeletion(id: number): Promise<User> {
		const user = await this.userRepository.findOne({ id }, { filters: { softDelete: false } });
		if (!user) {
			throw new NotFoundException(`User with ID ${id} not found`);
		}
		if (user.deletionStatus !== "pending_hard_delete") {
			return user;
		}
		user.deletedAt = undefined;
		user.deletionStatus = "active";
		user.deletionRequestedAt = undefined;
		await this.em.persistAndFlush(user);
		await this.em.getConnection().execute(`update "route" set "deleted_at" = null where "user_id" = ?`, [id]);
		return user;
	}

	@Cron(CronExpression.EVERY_DAY_AT_3AM)
	async hardDeleteExpiredAccountsCron(): Promise<void> {
		try {
			const purged = await this.hardDeleteExpiredAccounts();
			if (purged > 0) {
				this.logger.log(`Hard-deleted ${purged} accounts past their ${SELF_DELETE_GRACE_DAYS}-day grace window`);
			}
		} catch (error) {
			this.logger.error("Failed to hard-delete expired accounts", error);
		}
	}

	// Hard-deletes users whose self-initiated deletion grace window has expired.
	// Returns the number of users deleted. Safe to call manually (e.g. in tests).
	async hardDeleteExpiredAccounts(): Promise<number> {
		const cutoff = new Date(Date.now() - SELF_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);
		const expired = await this.userRepository.find(
			{
				deletionStatus: "pending_hard_delete",
				deletionRequestedAt: { $lt: cutoff },
			},
			{ filters: { softDelete: false } },
		);
		if (expired.length === 0) return 0;

		const ids = expired.map((u) => u.id);
		const conn = this.em.getConnection();
		// Hard-delete in FK-safe order: routes → sessions → user. Bypasses the
		// soft-delete filter by using raw SQL with explicit ids.
		await conn.execute(`delete from "route" where "user_id" in (${ids.map(() => "?").join(",")})`, ids);
		await conn.execute(`delete from "session" where "user_id" in (${ids.map(() => "?").join(",")})`, ids);
		await conn.execute(`delete from "user" where "id" in (${ids.map(() => "?").join(",")})`, ids);
		this.em.clear();
		return expired.length;
	}
}
