'use strict';

const crypto = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Generate a random app key
    const appKey = crypto.randomBytes(16).toString('hex');

    // Step 1: Create a demo user
    const userId = 1;
    await queryInterface.bulkInsert('users', [{
      id: userId,
      github_id: 12345,
      username: 'demouser',
      email: 'demo@example.com',
      role: 'admin',
      access_token: 'fake_token_for_testing',
      created_at: new Date(),
      updated_at: new Date()
    }], {});

    // Step 2: Create a demo app
    const appId = 1;
    await queryInterface.bulkInsert('apps', [{
      id: appId,
      name: 'Test App',
      slug: 'otaslug',
      description: 'A test app for OTA updates',
      owner_id: userId,
      github_repo_url: 'https://github.com/example/test-app',
      app_key: appKey,
      created_at: new Date(),
      updated_at: new Date()
    }], {});

    // Step 3: Create a demo bundle
    const bundleId = 1;
    await queryInterface.bulkInsert('bundles', [{
      id: bundleId,
      app_id: appId,
      hash: 'demo_bundle_hash',
      storage_type: 'local',
      storage_path: 'uploads/bundles/demo_bundle.js',
      size: 1024,
      created_at: new Date(),
      updated_at: new Date()
    }], {});

    // Step 4: Create a demo manifest
    const manifestId = 1;
    const manifestContent = JSON.stringify({
      name: 'Test App',
      version: '1.0.0',
      runtimeVersion: '1.1.0',
      bundleUrl: '/api/assets/uploads/bundles/demo_bundle.js',
      platforms: ['ios', 'android']
    });

    await queryInterface.bulkInsert('manifests', [{
      id: manifestId,
      app_id: appId,
      content: manifestContent,
      hash: 'demo_manifest_hash',
      version: '1.0.0',
      channel: 'production',
      runtime_version: '1.1.0',
      platforms: ['ios', 'android'],
      created_at: new Date(),
      updated_at: new Date()
    }], {});

    // Step 5: Create a demo update
    await queryInterface.bulkInsert('updates', [{
      id: 1,
      app_id: appId,
      version: '1.0.0',
      channel: 'production',
      runtime_version: '1.1.0',
      is_rollback: false,
      bundle_id: bundleId,
      manifest_id: manifestId,
      published_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    }], {});
  },

  async down (queryInterface, Sequelize) {
    // Remove data in reverse order
    await queryInterface.bulkDelete('updates', null, {});
    await queryInterface.bulkDelete('manifests', null, {});
    await queryInterface.bulkDelete('bundles', null, {});
    await queryInterface.bulkDelete('apps', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};
