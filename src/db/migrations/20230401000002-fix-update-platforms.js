'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First describe the table to see if the column exists and its current properties
    const tableInfo = await queryInterface.describeTable('updates');

    if (tableInfo.platforms) {
      console.log('Found platforms column, checking if it needs to be modified');

      // Modify the column to ensure it's properly set to accept an array of enum values
      // Drop any constraint on the platforms column first
      await queryInterface.sequelize.query(`
        ALTER TABLE "updates"
        ALTER COLUMN "platforms" TYPE "enum_platform"[] USING ARRAY["platforms"]::text[]::enum_platform[]
      `);

      // Ensure the column is not nullable
      await queryInterface.sequelize.query(`
        ALTER TABLE "updates"
        ALTER COLUMN "platforms" SET NOT NULL
      `);

      // Set a default value for existing rows
      await queryInterface.sequelize.query(`
        UPDATE "updates"
        SET "platforms" = ARRAY['ios', 'android']::enum_platform[]
        WHERE "platforms" IS NULL
      `);
    } else {
      console.log('Platforms column not found, creating it');

      // Create the platforms column if it doesn't exist
      await queryInterface.addColumn('updates', 'platforms', {
        type: Sequelize.ARRAY(Sequelize.ENUM('ios', 'android', 'web')),
        allowNull: false,
        defaultValue: ['ios', 'android']
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // This is a data fix, no undo required
  }
};