#!/usr/bin/env node

import { sequelize, User, App } from '../db/models';
import chalk from 'chalk';
import { UserRole, ReleaseChannel } from '../types';

/**
 * Seed the database with initial data for development
 */
async function seedDatabase() {
  try {
    console.log(chalk.cyan('Seeding database with initial data...'));

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Create admin user
      console.log(chalk.yellow('Creating admin user...'));
      const adminUser = await User.create({
        githubId: 9999999,
        username: 'admin',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        accessToken: 'dummy-token-for-development',
      }, { transaction });

      // Create demo user
      console.log(chalk.yellow('Creating demo user...'));
      const demoUser = await User.create({
        githubId: 8888888,
        username: 'demo',
        email: 'demo@example.com',
        role: UserRole.DEVELOPER,
        accessToken: 'dummy-token-for-development',
      }, { transaction });

      // Create demo app
      console.log(chalk.yellow('Creating demo app...'));
      const demoApp = await App.create({
        name: 'Demo App',
        slug: 'demo-app',
        description: 'A demo app for testing OpenExpoOTA',
        ownerId: adminUser.id,
        githubRepoUrl: 'https://github.com/username/demo-app',
      }, { transaction });

      // Commit the transaction
      await transaction.commit();

      console.log(chalk.green('✅ Database seeding complete!'));
      console.log(chalk.green('Created admin user:'));
      console.log(chalk.green(`  - Username: ${adminUser.username}`));
      console.log(chalk.green(`  - Email: ${adminUser.email}`));
      console.log(chalk.green(`  - Role: ${adminUser.role}`));
      console.log(chalk.green('Created demo app:'));
      console.log(chalk.green(`  - Name: ${demoApp.name}`));
      console.log(chalk.green(`  - Slug: ${demoApp.slug}`));
      console.log(chalk.green(`  - App Key: ${demoApp.appKey}`));

    } catch (error) {
      // Rollback the transaction if something fails
      await transaction.rollback();
      throw error;
    }

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Error seeding database:'), error);
    process.exit(1);
  }
}

// Check if we're in production
if (process.env.NODE_ENV === 'production') {
  console.error(chalk.red('This script should not be run in production!'));
  process.exit(1);
}

// Run the seed function
seedDatabase();