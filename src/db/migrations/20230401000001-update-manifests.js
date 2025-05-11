'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First check if columns exist to avoid errors if they already exist
    const tableInfo = await queryInterface.describeTable('manifests');

    // Add version column if it doesn't exist
    if (!tableInfo.version) {
      await queryInterface.addColumn('manifests', 'version', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // Add channel column if it doesn't exist
    if (!tableInfo.channel) {
      await queryInterface.addColumn('manifests', 'channel', {
        type: Sequelize.ENUM('production', 'staging', 'development'),
        allowNull: true,
        defaultValue: 'development',
      });
    }

    // Add runtime_version column if it doesn't exist
    if (!tableInfo.runtime_version) {
      await queryInterface.addColumn('manifests', 'runtime_version', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // Add platforms column if it doesn't exist
    if (!tableInfo.platforms) {
      await queryInterface.addColumn('manifests', 'platforms', {
        type: Sequelize.ARRAY(Sequelize.ENUM('ios', 'android', 'web')),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove columns in reverse order
    await queryInterface.removeColumn('manifests', 'platforms');
    await queryInterface.removeColumn('manifests', 'runtime_version');
    await queryInterface.removeColumn('manifests', 'channel');
    await queryInterface.removeColumn('manifests', 'version');
  }
};