'use strict';

const crypto = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create an admin user if none exists
    const adminUsers = await queryInterface.sequelize.query(
      `SELECT * FROM "users" WHERE "role" = 'admin' LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (adminUsers.length === 0) {
      // Create dummy token for initial setup
      // This would normally be a GitHub OAuth token, but for seeding we use a placeholder
      const dummyToken = crypto.randomBytes(16).toString('hex');

      // Create an admin user
      await queryInterface.bulkInsert('users', [{
        github_id: 0, // This would normally be the GitHub ID
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        access_token: dummyToken,
        created_at: new Date(),
        updated_at: new Date()
      }]);

      console.log('Admin user created successfully.');
      console.log('Please replace this user with a real GitHub account after OAuth setup.');
    } else {
      console.log('Admin user already exists. Skipping seed.');
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove the seeded admin user
    await queryInterface.bulkDelete('users', {
      username: 'admin',
      email: 'admin@example.com'
    });
  }
};