/**
 * This is a dummy implementation of the Supabase client.
 * It's only here to prevent import errors while we migrate to Sequelize.
 * All actual database operations should use Sequelize models.
 */

import logger from '../utils/logger';

if (process.env.NODE_ENV === 'development') {
  logger.warn('⚠️ Supabase is no longer used in this project. Please update your code to use Sequelize models directly.');
}

// Create a dummy client that logs warnings but doesn't throw errors
// This allows for gradual migration while keeping the app running
const dummyClient = {
  from: (tableName: string) => {
    logger.warn(`Attempted to use Supabase client for table: ${tableName}. Use Sequelize models instead.`);
    return {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: new Error('Supabase is deprecated') }),
          order: () => ({ data: [], error: null }),
          limit: () => ({ data: [], error: null }),
          data: [],
          error: null
        }),
        order: () => ({ data: [], error: null }),
        limit: () => ({ data: [], error: null }),
        data: [],
        error: null
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: new Error('Supabase is deprecated') })
        }),
        data: null,
        error: null
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: new Error('Supabase is deprecated') })
          }),
          data: null,
          error: null
        }),
        data: null,
        error: null
      }),
      delete: () => ({
        eq: () => Promise.resolve({ data: null, error: new Error('Supabase is deprecated') }),
        data: null,
        error: null
      }),
      data: null,
      error: null
    };
  },
  auth: {
    signOut: () => Promise.resolve({ error: null }),
    signInWithGithub: () => Promise.resolve({ user: null, error: null })
  },
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: new Error('Supabase storage is deprecated') }),
      download: () => Promise.resolve({ data: null, error: new Error('Supabase storage is deprecated') }),
      remove: () => Promise.resolve({ data: null, error: new Error('Supabase storage is deprecated') })
    })
  }
};

export default dummyClient;