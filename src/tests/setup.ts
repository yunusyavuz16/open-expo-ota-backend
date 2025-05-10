// Load environment variables for testing
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

// Load test environment variables
process.env.NODE_ENV = 'test';

// Use .env.test if it exists, otherwise fall back to .env
try {
  dotenv.config({ path: '.env.test' });
} catch {
  dotenv.config();
}

// Mock Sequelize
jest.mock('sequelize', () => {
  const actualSequelize = jest.requireActual('sequelize');

  // Create a mock class for the Sequelize instance
  const mockSequelize = {
    authenticate: jest.fn().mockResolvedValue(undefined),
    sync: jest.fn().mockResolvedValue(undefined),
    transaction: jest.fn().mockResolvedValue({
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
    define: jest.fn().mockReturnValue({
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue([1]),
      destroy: jest.fn().mockResolvedValue(1),
    }),
    getQueryInterface: jest.fn().mockReturnValue({
      createTable: jest.fn().mockResolvedValue(undefined),
      addColumn: jest.fn().mockResolvedValue(undefined),
      removeColumn: jest.fn().mockResolvedValue(undefined),
      changeColumn: jest.fn().mockResolvedValue(undefined),
      queryGenerator: {
        createTableQuery: jest.fn().mockReturnValue('CREATE TABLE mock'),
        dropTableQuery: jest.fn().mockReturnValue('DROP TABLE mock'),
      },
    }),
    query: jest.fn().mockResolvedValue([[], {}]),
  };

  // Return the constructor
  return {
    ...actualSequelize,
    Sequelize: jest.fn(() => mockSequelize),
  };
});

// Mock Supabase
jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
          order: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: {}, error: null }),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: {}, error: null }),
            })),
          })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        })),
      })),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn().mockResolvedValue({ data: { Key: 'test-key' }, error: null }),
          getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://test-url.com' } })),
          remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      },
      auth: {
        signIn: jest.fn().mockResolvedValue({ data: { user: {} }, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        session: jest.fn().mockReturnValue(null),
      },
    })),
  };
});

// Mock GitHub OAuth
jest.mock('passport-github2', () => {
  return {
    Strategy: jest.fn((options, verify) => ({
      name: 'github',
      authenticate: jest.fn(),
    })),
  };
});

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('test-token'),
  verify: jest.fn().mockReturnValue({ id: 1 }),
}));

// Mock express-session
jest.mock('express-session', () => {
  return jest.fn(() => (req: any, res: any, next: any) => next());
});

// Set up global test environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/api/auth/github/callback';

// Mock for Supabase client
// We use a manual mock file instead of inline mocking
// See __mocks__/supabase.ts for the actual implementation

// Here we just leave a comment explaining the approach
// Jest will automatically use mocks from the __mocks__ folder

// Setup code that runs before all tests
// These functions are provided by the Jest global environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).beforeAll(() => {
  console.log('Starting test suite...');
});

// Teardown code that runs after all tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).afterAll(() => {
  console.log('Test suite completed.');
});