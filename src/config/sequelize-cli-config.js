require('dotenv').config();

// Creates a PostgreSQL connection config from environment variables
// If DATABASE_URL is provided, use that directly
// Otherwise build from individual components

let config;

if (process.env.DATABASE_URL) {
  // If a full connection string is provided, use it
  config = {
    url: process.env.DATABASE_URL,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  };
} else {
  // Otherwise build from individual parts
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'postgres';
  const username = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || '';

  config = {
    username,
    password,
    database,
    host,
    port,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  };
}

module.exports = {
  development: {
    ...config,
    logging: console.log
  },
  test: {
    ...config,
    logging: false
  },
  production: {
    ...config,
    logging: false
  }
};