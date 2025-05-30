import supabase from '../config/supabase';
import { UserRole } from '../types';

export interface UserInput {
  githubId: number;
  username: string;
  email: string;
  role?: UserRole;
  accessToken: string;
}

export interface User {
  id: number;
  githubId: number;
  username: string;
  email: string;
  role: UserRole;
  accessToken: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserRepository {
  /**
   * Find a user by ID
   */
  async findById(id: number): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToUser(data);
  }

  /**
   * Find a user by GitHub ID
   */
  async findByGithubId(githubId: number): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('github_id', githubId)
      .single();

    if (error) {
      // Check if it's a 'not found' error, which we expect sometimes
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching user by GitHub ID:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return this.mapToUser(data);
  }

  /**
   * Create a new user
   */
  async create(user: UserInput): Promise<User> {
    try {
      const now = new Date().toISOString();
      const userData = {
        github_id: user.githubId,
        username: user.username,
        email: user.email,
        role: user.role || UserRole.DEVELOPER,
        access_token: user.accessToken,
        created_at: now,
        updated_at: now
      };

      console.log('Creating user with data:', JSON.stringify(userData, null, 2));

      const { data, error } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw new Error(`Error creating user: ${error.message}`);
      }

      if (!data) {
        throw new Error('User created but no data returned');
      }

      return this.mapToUser(data);
    } catch (error) {
      console.error('Error in create method:', error);
      throw error;
    }
  }

  /**
   * Update a user
   */
  async update(id: number, user: Partial<UserInput>): Promise<User> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (user.username !== undefined) updateData.username = user.username;
    if (user.email !== undefined) updateData.email = user.email;
    if (user.role !== undefined) updateData.role = user.role;
    if (user.accessToken !== undefined) updateData.access_token = user.accessToken;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      throw new Error(`Error updating user: ${error.message}`);
    }

    if (!data) {
      throw new Error('User updated but no data returned');
    }

    return this.mapToUser(data);
  }

  /**
   * Delete a user
   */
  async delete(id: number): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  /**
   * Map a Supabase user record to a User object
   */
  private mapToUser(data: any): User {
    return {
      id: data.id,
      githubId: data.github_id,
      username: data.username,
      email: data.email,
      role: data.role,
      accessToken: data.access_token,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

export default new UserRepository();