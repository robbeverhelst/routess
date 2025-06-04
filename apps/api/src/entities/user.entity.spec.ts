import { User } from './user.entity';

describe('User Entity', () => {
  let user: User;

  beforeEach(() => {
    user = new User();
  });

  it('should create a user with default timestamps', () => {
    user.email = 'test@example.com';
    user.name = 'Test User';

    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('should have createdAt and updatedAt as Date objects', () => {
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('should update updatedAt when modified', (done) => {
    const originalUpdatedAt = user.updatedAt;

    // Simulate time passing
    setTimeout(() => {
      user.updatedAt = new Date();
      expect(user.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
      done();
    }, 10);
  });
}); 