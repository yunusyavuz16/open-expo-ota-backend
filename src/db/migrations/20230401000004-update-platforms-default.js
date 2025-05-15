'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update any existing update records with NULL platforms to use a default value
    await queryInterface.sequelize.query(`
      UPDATE "updates"
      SET "platforms" = ARRAY['ios', 'android']::enum_platform[]
      WHERE "platforms" IS NULL
    `);

    // Update the table definition to set a default value
    await queryInterface.sequelize.query(`
      ALTER TABLE "updates"
      ALTER COLUMN "platforms" SET DEFAULT ARRAY['ios', 'android']::enum_platform[]
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove the default value
    await queryInterface.sequelize.query(`
      ALTER TABLE "updates"
      ALTER COLUMN "platforms" DROP DEFAULT
    `);
  }
};