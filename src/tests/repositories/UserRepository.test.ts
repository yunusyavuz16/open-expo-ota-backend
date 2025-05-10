import UserRepository from '../../repositories/UserRepository';
import { UserRole } from '../../types';
import supabase from '../../config/supabase';

// Mock the Supabase client
jest.mock('../../config/supabase', () => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(),
    })),
  })),
}));

describe('UserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      // Setup mock return value
      const mockUser = {
        id: 1,
        github_id: 12345,
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        access_token: 'token123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: selectMock,
      });

      // Call the method
      const result = await UserRepository.findById(1);

      // Assertions
      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(result).toEqual({
        id: 1,
        githubId: 12345,
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        accessToken: 'token123',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should return null when user not found', async () => {
      // Setup mock return value for not found
      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: selectMock,
      });

      // Call the method
      const result = await UserRepository.findById(999);

      // Assertions
      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      // Setup mock to throw error
      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: selectMock,
      });

      // Call the method
      const result = await UserRepository.findById(1);

      // Assertions
      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(result).toBeNull();
    });
  });

  // Add more tests for other methods as needed
});