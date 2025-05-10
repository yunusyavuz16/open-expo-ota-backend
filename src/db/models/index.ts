/**
 * Database models index file
 * This file imports and exports all models and initializes associations
 */

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import models
import User from './User';
import App from './App';
import AppUser from './AppUser';
import Bundle from './Bundle';
import Update from './Update';
import Manifest from './Manifest';
import Asset from './Asset';

// Initialize Sequelize
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  username: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'openexpoota',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

// Initialize all models
User.initialize(sequelize);
App.initialize(sequelize);
AppUser.initialize(sequelize);
Bundle.initialize(sequelize);
Update.initialize(sequelize);
Manifest.initialize(sequelize);
Asset.initialize(sequelize);

// Set up model associations
const models = {
  User,
  App,
  AppUser,
  Bundle,
  Update,
  Manifest,
  Asset,
};

// Initialize associations
User.associate(models);
App.associate(models);
AppUser.associate(models);
Bundle.associate(models);
Update.associate(models);
Manifest.associate(models);
Asset.associate(models);

// Export all models
export {
  User,
  App,
  AppUser,
  Bundle,
  Update,
  Manifest,
  Asset,
  sequelize,
};

// Default export for convenience
export default {
  ...models,
  sequelize,
};