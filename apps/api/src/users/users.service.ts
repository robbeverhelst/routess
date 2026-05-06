import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable, NotFoundException } from "@nestjs/common";
import { SessionService } from "../auth/session.service";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import type { UpdateCurrentUserDto } from "./dto/update-current-user.dto";
import { mergeUserPreferences } from "./user-preferences";

@Injectable()
export class UsersService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
		private readonly em: EntityManager,
		private readonly sessionService: SessionService,
	) {}

	async findOne(id: number): Promise<User> {
		const user = await this.userRepository.findOne({ id, deletedAt: null });
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
		if (updateUserDto.avatar !== undefined) {
			user.avatar = updateUserDto.avatar;
		}
		if (updateUserDto.preferences !== undefined) {
			user.preferences = mergeUserPreferences(user.preferences, updateUserDto.preferences);
		}

		await this.em.persistAndFlush(user);
		return user;
	}

	async getStatistics(userId: number): Promise<{ totalRoutes: number; totalDistance: number }> {
		return this.sessionService.getUserStatistics(userId);
	}

	async remove(id: number): Promise<void> {
		const user = await this.findOne(id);
		const deletedAt = new Date();
		user.deletedAt = deletedAt;

		const routes = await this.routeRepository.find({ user: id, deletedAt: null });
		for (const route of routes) {
			route.deletedAt = deletedAt;
		}

		await this.em.persistAndFlush(user);
		await this.em.flush();
		await this.sessionService.invalidateUserSessions(id);
	}
}
