'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create users table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      github_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('admin', 'developer'),
        allowNull: false,
        defaultValue: 'developer',
      },
      access_token: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create apps table
    await queryInterface.createTable('apps', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      owner_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      github_repo_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      app_key: {
        type: Sequelize.STRING(32),
        allowNull: false,
        unique: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create app_users table (many-to-many relationship between users and apps)
    await queryInterface.createTable('app_users', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      app_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'apps',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.ENUM('admin', 'developer'),
        allowNull: false,
        defaultValue: 'developer',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create a unique index on app_id and user_id
    await queryInterface.addIndex('app_users', ['app_id', 'user_id'], {
      unique: true,
      name: 'app_users_app_id_user_id_unique',
    });

    // Create bundles table
    await queryInterface.createTable('bundles', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      app_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'apps',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      hash: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      storage_type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'local',
      },
      storage_path: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      size: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create manifests table
    await queryInterface.createTable('manifests', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      app_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'apps',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      hash: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create the platform ENUM type
    await queryInterface.sequelize.query(
      'CREATE TYPE enum_platform AS ENUM (\'ios\', \'android\', \'web\');'
    );

    // Create updates table
    await queryInterface.createTable('updates', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      app_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'apps',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      version: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      channel: {
        type: Sequelize.ENUM('production', 'staging', 'development'),
        allowNull: false,
        defaultValue: 'development',
      },
      runtime_version: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      platforms: {
        type: Sequelize.ARRAY(Sequelize.ENUM('ios', 'android', 'web')),
        allowNull: false,
      },
      is_rollback: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      bundle_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'bundles',
          key: 'id',
        },
      },
      manifest_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'manifests',
          key: 'id',
        },
      },
      published_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create a unique index on app_id, version, and channel
    await queryInterface.addIndex('updates', ['app_id', 'version', 'channel'], {
      unique: true,
      name: 'updates_app_id_version_channel_unique',
    });

    // Create assets table
    await queryInterface.createTable('assets', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      update_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'updates',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      hash: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      storage_type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'local',
      },
      storage_path: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      size: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order to avoid foreign key constraints
    await queryInterface.dropTable('assets');
    await queryInterface.dropTable('updates');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_platform;');
    await queryInterface.dropTable('manifests');
    await queryInterface.dropTable('bundles');
    await queryInterface.dropTable('app_users');
    await queryInterface.dropTable('apps');
    await queryInterface.dropTable('users');
  },
};