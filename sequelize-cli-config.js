require('dotenv').config();

// Determine if DATABASE_URL exists, otherwise use individual params
const useConnectionString = !!process.env.DATABASE_URL;

module.exports = {
  development: useConnectionString
    ? {
        url: process.env.DATABASE_URL,
        dialect: 'postgres',
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        },
        logging: console.log,
      }
    : {
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'expo_ota_development',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        dialectOptions: {
          ssl: process.env.DB_SSL === 'true'
            ? {
                require: true,
                rejectUnauthorized: false
              }
            : false
        },
        logging: console.log,
      },
  test: useConnectionString
    ? {
        url: process.env.DATABASE_URL || process.env.TEST_DATABASE_URL,
        dialect: 'postgres',
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        },
        logging: false,
      }
    : {
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.TEST_DB_NAME || 'expo_ota_test',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        dialectOptions: {
          ssl: process.env.DB_SSL === 'true'
            ? {
                require: true,
                rejectUnauthorized: false
              }
            : false
        },
        logging: false,
      },
  production: useConnectionString
    ? {
        url: process.env.DATABASE_URL,
        dialect: 'postgres',
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        },
        logging: false,
      }
    : {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        },
        logging: false,
      }
};