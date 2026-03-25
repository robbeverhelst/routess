import type { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable, NotFoundException } from "@nestjs/common";
import { User } from "../entities/user.entity";
import type { CreateUserDto, UpdateUserDto } from "./dto/user.dto";

@Injectable()
export class UsersService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		private readonly em: EntityManager,
	) {}

	async create(createUserDto: CreateUserDto): Promise<User> {
		const user = this.userRepository.create(createUserDto);
		await this.em.persistAndFlush(user);
		return user;
	}

	async findAll(): Promise<User[]> {
		return this.userRepository.find({ deletedAt: null });
	}

	async findOne(id: number): Promise<User> {
		const user = await this.userRepository.findOne({ id, deletedAt: null });
		if (!user) {
			throw new NotFoundException(`User with ID ${id} not found`);
		}
		return user;
	}

	async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
		const user = await this.findOne(id);

		// Only allow updating certain fields
		if (updateUserDto.name !== undefined) {
			user.name = updateUserDto.name;
		}
		if (updateUserDto.avatar !== undefined) {
			user.avatar = updateUserDto.avatar;
		}
		// Note: email and googleId updates are not allowed

		await this.em.persistAndFlush(user);
		return user;
	}

	async remove(id: number): Promise<void> {
		const user = await this.findOne(id);
		user.deletedAt = new Date();
		await this.em.persistAndFlush(user);
	}

	async hardDelete(id: number): Promise<void> {
		const user = await this.userRepository.findOne(id);
		if (!user) {
			throw new NotFoundException(`User with ID ${id} not found`);
		}
		await this.em.removeAndFlush(user);
	}
}
