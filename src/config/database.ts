import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
import supabase from './supabase';

dotenv.config();

// Check if we're using Supabase or direct PostgreSQL
const useSupabase = process.env.USE_SUPABASE === 'true';

// Create a Sequelize instance for direct PostgreSQL connection
// This is used by the sequelize models if not using Supabase
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  username: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  logging: process.env.NODE_ENV === 'development',
});

export const initDatabase = async (): Promise<void> => {
  try {
    if (useSupabase) {
      // Verify connection to Supabase
      const { data, error } = await supabase.from('migrations').select('count').limit(1);

      if (error) {
        // Check if it's just because the migrations table doesn't exist yet
        if (error.code === '42P01') { // PostgreSQL table doesn't exist
          console.log('Migrations table not found. Run migrations to create schema.');
        } else {
          console.error('Unable to connect to Supabase:', error);
          throw error;
        }
      } else {
        console.log('Supabase connection has been established successfully.');
      }
    } else {
      // Test Sequelize connection
      await sequelize.authenticate();
      console.log('PostgreSQL connection has been established successfully.');
    }
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};

export { sequelize, supabase, useSupabase };
export default sequelize;