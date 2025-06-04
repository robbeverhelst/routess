import { Test, TestingModule } from '@nestjs/testing';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { testConfig } from '../src/test-config';
import { User } from '../src/entities/user.entity';
import { DatabaseService } from '../src/db/db.service';

export class TestUtils {
  static async createTestingModule(
    entities: any[] = [User],
  ): Promise<TestingModule> {
    const module = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot(testConfig),
        MikroOrmModule.forFeature(entities),
      ],
      providers: [DatabaseService],
    }).compile();

    return module;
  }

  static async setupDatabase(module: TestingModule): Promise<void> {
    const orm = module.get<MikroORM>(MikroORM);
    const generator = orm.getSchemaGenerator();
    
    // Drop and recreate schema
    await generator.dropSchema();
    await generator.createSchema();
  }

  static async cleanDatabase(module: TestingModule): Promise<void> {
    const em = module.get<EntityManager>(EntityManager);
    
    // Clear all entities
    await em.nativeDelete(User, {});
    await em.flush();
  }

  static async closeDatabase(module: TestingModule): Promise<void> {
    const orm = module.get<MikroORM>(MikroORM);
    await orm.close();
  }
}

// Test data factories
export class UserFactory {
  static create(overrides: Partial<User> = {}): Partial<User> {
    return {
      email: 'test@example.com',
      name: 'Test User',
      ...overrides,
    };
  }

  static createMany(
    count: number,
    overrides: Partial<User> = {},
  ): Partial<User>[] {
    return Array.from({ length: count }, (_, index) => ({
      email: `test${index}@example.com`,
      name: `Test User ${index}`,
      ...overrides,
    }));
  }
} 