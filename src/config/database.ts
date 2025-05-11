import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config();

// Create a direct PostgreSQL connection
// Format: postgresql://postgres:[YOUR-PASSWORD]@dbhost:5432/dbname
const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER || 'postgres'}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'expo_ota_development'}`;

// Set SSL options based on the environment
const dialectOptions = {
  ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
    ? {
        require: true,
        rejectUnauthorized: false
      }
    : false
};

// Create the Sequelize instance
const sequelize = new Sequelize(connectionString, {
  dialect: 'postgres',
  dialectOptions,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

export default sequelize;