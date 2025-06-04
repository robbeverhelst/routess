import { Test, TestingModule } from '@nestjs/testing';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/postgresql';
import { UsersController } from '../../src/users/users.controller';
import { User } from '../../src/entities/user.entity';
import { DatabaseService } from '../../src/db/db.service';
import { TestUtils, UserFactory } from '../test-utils';
import { testConfig } from '../../src/test-config';

describe('Users Integration Tests', () => {
  let module: TestingModule;
  let controller: UsersController;
  let em: EntityManager;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot(testConfig),
        MikroOrmModule.forFeature([User]),
      ],
      controllers: [UsersController],
      providers: [DatabaseService],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    em = module.get<EntityManager>(EntityManager);

    await TestUtils.setupDatabase(module);
  });

  afterAll(async () => {
    await TestUtils.closeDatabase(module);
  });

  beforeEach(async () => {
    await TestUtils.cleanDatabase(module);
  });

  describe('User CRUD Operations', () => {
    it('should create a user and persist to database', async () => {
      const userData = UserFactory.create() as { email: string; name: string };

      const createdUser = await controller.create(userData);

      expect(createdUser.id).toBeDefined();
      expect(createdUser.email).toBe(userData.email);
      expect(createdUser.name).toBe(userData.name);

      // Verify it's actually in the database
      const foundUser = await em.findOne(User, { id: createdUser.id });
      expect(foundUser).toBeTruthy();
      expect(foundUser!.email).toBe(userData.email);
    });

    it('should retrieve all users from database', async () => {
      // Create test users
      const usersData = UserFactory.createMany(3);

      for (const userData of usersData) {
        await controller.create(userData as { email: string; name: string });
      }

      const allUsers = await controller.findAll();

      expect(allUsers).toHaveLength(3);
      expect(allUsers.map((u) => u.email)).toEqual(
        expect.arrayContaining(usersData.map((u) => u.email)),
      );
    });

    it('should handle empty database', async () => {
      const users = await controller.findAll();

      expect(users).toEqual([]);
    });
  });

  describe('Database Constraints', () => {
    it('should auto-generate timestamps', async () => {
      const userData = UserFactory.create() as { email: string; name: string };

      const createdUser = await controller.create(userData);

      expect(createdUser.createdAt).toBeInstanceOf(Date);
      expect(createdUser.updatedAt).toBeInstanceOf(Date);
      expect(createdUser.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(createdUser.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
}); 