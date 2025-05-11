# Sequelize + PostgreSQL Migration Guide for Supabase

This guide explains how to use Sequelize ORM with PostgreSQL (including Supabase) in a code-first approach for managing database schemas and migrations.

## Overview

OpenExpoOTA uses a code-first approach with Sequelize ORM to define models and manage database schema. This guide covers connecting to a PostgreSQL database hosted on Supabase and using standard Sequelize migrations.

## Connection Setup

### Environment Variables

The application uses the following environment variables for database connection:

```
# Option 1: Use full connection string (recommended)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.mzmhehiuocaqmqtkwikl.supabase.co:5432/postgres

# Option 2: Use individual connection parameters
DB_HOST=db.mzmhehiuocaqmqtkwikl.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=[YOUR-PASSWORD]
```

### Connection String

For Supabase, your connection string follows this format:

```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

Where:
- `[YOUR-PASSWORD]` is your database password (shown in Supabase dashboard)
- `[YOUR-PROJECT-REF]` is your Supabase project reference ID

## Defining Models

Define your data models in `src/db/models` using Sequelize model syntax:

```typescript
// src/db/models/User.ts
import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database';

class User extends Model {
  public id!: number;
  public githubId!: number;
  public username!: string;
  public email!: string;
  public role!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  githubId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    field: 'github_id',
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'developer',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
  },
}, {
  sequelize,
  tableName: 'users',
  timestamps: true,
  underscored: true,
});

export default User;
```

## Migration Workflow

### Create Migrations

You have two approaches to create migrations:

#### 1. Generate Migrations from Model Changes

```bash
npm run db:generate-migration
```

This will:
1. Load all your models
2. Generate a new migration file based on your model definitions
3. Create a timestamped migration file in `src/db/migrations/`

#### 2. Create Empty Migrations

```bash
npm run db:create-migration
```

This creates an empty migration file for you to fill in manually.

### Run Migrations

To apply pending migrations:

```bash
npm run db:migrate
```

This will:
1. Connect to your PostgreSQL database
2. Run any pending migrations in order
3. Update the migrations table to track what has been applied

## Model Associations

Define model associations in their respective model files:

```typescript
// In User.ts
User.associate = (models) => {
  User.hasMany(models.App, {
    foreignKey: 'ownerId',
    as: 'ownedApps'
  });

  User.belongsToMany(models.App, {
    through: 'app_users',
    foreignKey: 'userId',
    as: 'apps'
  });
};

// In App.ts
App.associate = (models) => {
  App.belongsTo(models.User, {
    foreignKey: 'ownerId',
    as: 'owner'
  });

  App.belongsToMany(models.User, {
    through: 'app_users',
    foreignKey: 'appId',
    as: 'users'
  });
};
```

## Using Models in Your Code

Import and use your models in your controllers and services:

```typescript
import { User, App } from '../db/models';

// Find a user
const user = await User.findByPk(1, {
  include: [{ model: App, as: 'ownedApps' }]
});

// Create a new app
const app = await App.create({
  name: 'My App',
  slug: 'my-app',
  description: 'An example app',
  ownerId: user.id
});
```

## Troubleshooting

### Connection Issues

If you encounter connection issues:

1. Check your PostgreSQL credentials in `.env`
2. Verify the database exists and is accessible
3. Ensure SSL settings are correctly configured (required for Supabase)

### Migration Errors

If migrations fail:

1. Check your Sequelize model definitions for errors
2. Review generated migration files before applying them
3. For complex schema changes, consider editing the migration manually

### SSL Connection Issues

When connecting to Supabase, you must use SSL. Ensure your connection includes:

```javascript
dialectOptions: {
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
}
```

## Direct Sequelize CLI Usage

You can also use the Sequelize CLI directly:

```bash
# Create a new migration
npx sequelize-cli migration:generate --name add-new-column

# Run migrations
npx sequelize-cli db:migrate

# Undo last migration
npx sequelize-cli db:migrate:undo
```