'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if the column already exists
    const tableInfo = await queryInterface.describeTable('updates');

    if (!tableInfo.target_version_range) {
      await queryInterface.addColumn('updates', 'target_version_range', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Target version range for update compatibility'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    // Remove the target_version_range column
    const tableInfo = await queryInterface.describeTable('updates');

    if (tableInfo.target_version_range) {
      await queryInterface.removeColumn('updates', 'target_version_range');
    }
  }
};
