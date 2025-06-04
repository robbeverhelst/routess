# Testing Guide for Maps API

This document explains the testing setup and how to run tests for the Maps API.

## 🧪 Test Structure

Our testing strategy includes three types of tests:

### 1. **Unit Tests** (`src/**/*.spec.ts`)
- Test individual components in isolation
- Mock external dependencies
- Fast execution
- Located alongside source files

### 2. **Integration Tests** (`test/integration/**/*.spec.ts`)
- Test modules working together
- Real database connections with test data
- Verify database operations
- Test API endpoints with actual database

### 3. **E2E Tests** (`test/**/*.e2e-spec.ts`)
- Full application testing
- Real HTTP requests through the entire stack
- Complete user workflows

## 🗄️ Database Testing

### Test Database Setup
We use a separate PostgreSQL instance for testing:
- **Host**: localhost
- **Port**: 5433 (different from dev database)
- **Database**: maps_test_db
- **User**: maps_test_user
- **Password**: maps_test_password

### Database Management
- Tests automatically create/drop schema
- Each test gets a clean database state
- Transactions are used for isolation

## 🚀 Running Tests

### Prerequisites
```bash
# Start the test database
bun run test:db:setup
```

### Test Commands

```bash
# Run all tests
bun run test

# Run specific test types
bun run test:unit        # Unit tests only
bun run test:integration # Integration tests only
bun run test:e2e         # E2E tests only

# Development
bun run test:watch       # Watch mode
bun run test:cov         # With coverage report

# Database management
bun run test:db:setup    # Start test database
bun run test:db:teardown # Stop test database
bun run test:db:reset    # Reset test database

# Complete test cycle
bun run test:all         # Setup DB → Run tests → Teardown DB
```

## 📊 Coverage Report

Current coverage targets:
- **Statements**: >70%
- **Branches**: >50%
- **Functions**: >65%
- **Lines**: >70%

View detailed coverage:
```bash
bun run test:cov
open coverage/lcov-report/index.html
```

## 🛠️ Test Utilities

### TestUtils Class
Located in `test/test-utils.ts`:
- `createTestingModule()` - Create NestJS testing module
- `setupDatabase()` - Initialize test database schema
- `cleanDatabase()` - Clear all test data
- `closeDatabase()` - Close database connections

### UserFactory Class
Test data factory for creating User entities:
```typescript
// Create single user
const user = UserFactory.create();
const customUser = UserFactory.create({ email: 'custom@example.com' });

// Create multiple users
const users = UserFactory.createMany(5);
```

## 📝 Writing Tests

### Unit Test Example
```typescript
describe('UsersController', () => {
  let controller: UsersController;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UserRepository, useValue: mockRepository },
      ],
    }).compile();
    
    controller = module.get<UsersController>(UsersController);
  });
  
  it('should create a user', async () => {
    const userData = UserFactory.create();
    const result = await controller.create(userData);
    expect(result).toBeDefined();
  });
});
```

### Integration Test Example
```typescript
describe('Users Integration', () => {
  let module: TestingModule;
  let controller: UsersController;
  
  beforeAll(async () => {
    module = await TestUtils.createTestingModule([User]);
    controller = module.get<UsersController>(UsersController);
    await TestUtils.setupDatabase(module);
  });
  
  afterAll(async () => {
    await TestUtils.closeDatabase(module);
  });
  
  beforeEach(async () => {
    await TestUtils.cleanDatabase(module);
  });
  
  it('should persist user to database', async () => {
    const userData = UserFactory.create();
    const user = await controller.create(userData);
    
    // Verify in database
    const found = await em.findOne(User, { id: user.id });
    expect(found).toBeTruthy();
  });
});
```

## 🔧 Configuration

### Jest Configuration
Located in `package.json`:
- Root directory: `.` (includes both src and test)
- Test pattern: `.*\.spec\.ts$`
- Coverage excludes: test files, interfaces, main.ts

### MikroORM Test Config
Located in `src/test-config.ts`:
- Uses test database credentials
- Explicit entity list for faster startup
- Global context allowed for testing

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Ensure test database is running
   docker-compose -f ../../docker-compose.test.yml ps
   
   # Check logs
   docker-compose -f ../../docker-compose.test.yml logs postgres-test
   ```

2. **Entity Discovery Issues**
   - Ensure entities are properly exported
   - Check test-config.ts entity list
   - Verify no circular imports

3. **Test Isolation Issues**
   - Ensure `cleanDatabase()` is called in `beforeEach`
   - Check for async/await in test setup
   - Verify database transactions are properly handled

### Performance Tips

1. **Faster Test Runs**
   - Use `--testPathPattern` for specific tests
   - Run unit tests separately from integration tests
   - Use `--maxWorkers=1` for database tests

2. **Database Optimization**
   - Keep test data minimal
   - Use factories for consistent test data
   - Clean up properly in teardown

## 📈 Continuous Integration

Tests are automatically run in CI/CD pipeline:
- Unit tests run on every PR
- Integration tests run on main branch
- Coverage reports are generated
- Database is automatically set up/torn down

## 🎯 Best Practices

1. **Test Organization**
   - One test file per source file for unit tests
   - Group related integration tests
   - Use descriptive test names

2. **Test Data**
   - Use factories for consistent data
   - Keep test data minimal and focused
   - Clean up after each test

3. **Assertions**
   - Test behavior, not implementation
   - Use specific assertions
   - Test error cases

4. **Performance**
   - Mock external dependencies in unit tests
   - Use real database only when necessary
   - Keep tests fast and focused 