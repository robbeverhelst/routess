import { Controller, Get, Post, Body } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/postgresql';
import { User } from '../entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager,
  ) {}

  @Get()
  async findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  @Post()
  async create(
    @Body() userData: { email: string; name: string },
  ): Promise<User> {
    const user = this.userRepository.create(userData);
    await this.em.persistAndFlush(user);
    return user;
  }
} 