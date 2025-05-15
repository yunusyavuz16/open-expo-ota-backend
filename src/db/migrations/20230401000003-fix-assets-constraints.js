'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Change update_id to allow NULL temporarily
    await queryInterface.changeColumn('assets', 'update_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'updates',
        key: 'id',
      },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface, Sequelize) {
    // Change back to NOT NULL constraint
    await queryInterface.changeColumn('assets', 'update_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'updates',
        key: 'id',
      },
      onDelete: 'CASCADE',
    });
  }
};
