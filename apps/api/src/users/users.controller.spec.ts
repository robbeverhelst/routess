import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { UsersController } from './users.controller';
import { User } from '../entities/user.entity';
import { UserFactory } from '../../test/test-utils';

describe('UsersController', () => {
  let controller: UsersController;
  let userRepository: jest.Mocked<EntityRepository<User>>;
  let entityManager: jest.Mocked<EntityManager>;

  beforeEach(async () => {
    const mockUserRepository = {
      findAll: jest.fn(),
      create: jest.fn(),
    };

    const mockEntityManager = {
      persistAndFlush: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    userRepository = module.get(getRepositoryToken(User));
    entityManager = module.get(EntityManager);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = [
        UserFactory.create(),
        UserFactory.create({ email: 'test2@example.com' }),
      ];
      userRepository.findAll.mockResolvedValue(users as User[]);

      const result = await controller.findAll();

      expect(userRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });

  describe('create', () => {
    it('should create and return a user', async () => {
      const userData = UserFactory.create() as { email: string; name: string };
      const createdUser = { id: 1, ...userData } as User;
      
      userRepository.create.mockReturnValue(createdUser);
      entityManager.persistAndFlush.mockResolvedValue(undefined);

      const result = await controller.create(userData);

      expect(userRepository.create).toHaveBeenCalledWith(userData);
      expect(entityManager.persistAndFlush).toHaveBeenCalledWith(createdUser);
      expect(result).toEqual(createdUser);
    });
  });
}); 