'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if app with ID 1 exists
    const app = await queryInterface.sequelize.query(
      'SELECT id FROM apps WHERE id = 1',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!app.length) {
      console.log('App with ID 1 not found, skipping seed');
      return;
    }

    // Create a bundle if one doesn't exist
    let bundle = await queryInterface.sequelize.query(
      'SELECT id FROM bundles WHERE app_id = 1 LIMIT 1',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    let bundleId;
    if (!bundle.length) {
      // Create a new bundle
      const bundleResult = await queryInterface.bulkInsert('bundles', [{
        app_id: 1,
        hash: 'test_bundle_hash_' + Date.now(),
        storage_type: 'local',
        storage_path: 'uploads/bundles/test_bundle.js',
        size: 1024,
        created_at: new Date(),
        updated_at: new Date()
      }], { returning: true });

      bundleId = bundleResult[0].id;
    } else {
      bundleId = bundle[0].id;
    }

    // Create a manifest matching runtime version 1.1.0
    const manifestContent = JSON.stringify({
      name: 'Test App',
      version: '1.3.0',
      runtimeVersion: '1.1.0',
      bundleUrl: '/api/bundle/otaslug/' + bundleId,
      platforms: ['ios', 'android']
    });

    // Check if the platforms enum exists
    const enumExists = await queryInterface.sequelize.query(
      "SELECT typname FROM pg_type WHERE typname = 'enum_manifests_platforms'",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    // Use raw query to handle ENUM array
    const manifestQuery = `
      INSERT INTO manifests (
        app_id, content, hash, version, channel, runtime_version, platforms, created_at, updated_at
      ) VALUES (
        1,
        '${manifestContent}',
        'test_manifest_hash_${Date.now()}',
        '1.3.0',
        'production',
        '1.1.0',
        ARRAY['ios', 'android']::enum_manifests_platforms[],
        NOW(),
        NOW()
      ) RETURNING id
    `;

    const [manifestResult] = await queryInterface.sequelize.query(manifestQuery);
    const manifestId = manifestResult[0].id;

    // Create the update record
    await queryInterface.sequelize.query(`
      INSERT INTO updates (
        app_id, version, channel, runtime_version, is_rollback,
        bundle_id, manifest_id, published_by, platforms, created_at, updated_at
      ) VALUES (
        1, '1.3.0', 'production', '1.1.0', false,
        ${bundleId}, ${manifestId}, 1, ARRAY['ios', 'android']::enum_updates_platforms[],
        NOW(), NOW()
      )
    `);

    console.log('Created update for runtime version 1.1.0');
  },

  async down (queryInterface, Sequelize) {
    // Remove the created records in reverse order
    await queryInterface.bulkDelete('updates', { runtime_version: '1.1.0' });
    await queryInterface.bulkDelete('manifests', { runtime_version: '1.1.0' });
  }
};
