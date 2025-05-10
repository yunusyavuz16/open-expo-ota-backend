# OpenExpoOTA Backend Setup Guide

This guide explains the setup and code-first approach implemented in the OpenExpoOTA backend.

## Code-First Approach

The backend follows a code-first approach to database management, which means:

1. Models are defined in TypeScript with Sequelize decorators
2. Database schema is generated from the model definitions
3. Migrations are created based on model changes

### Key Components

- **Model Definitions**: Located in `src/db/models/`
- **Database Initialization**: In `src/db/index.ts`
- **Migration Generation**: Using `src/scripts/generate-migration.ts`
- **Schema Synchronization**: Using `src/scripts/sync-db.ts` (for development)

## Setup Instructions

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit the `.env` file to set up:
- Database connection (Supabase or direct PostgreSQL)
- GitHub OAuth credentials
- JWT Secret
- Storage configuration

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

Choose one of the following approaches:

#### Option A: Run Migrations (Recommended for Production)

```bash
# Set up the database structure using migrations
npm run setup-db
```

#### Option B: Sync Database (Development Only)

```bash
# Synchronize the database with model definitions
npm run db:sync
```

### 4. Development

```bash
# Start the development server with hot reload
npm run dev
```

### 5. Testing

```bash
# Run tests
npm run test
```

## Database Management

### Generate Migrations

When you make changes to the model definitions, you can automatically generate a migration:

```bash
npm run migrate:generate
```

This will:
1. Analyze differences between model definitions and database
2. Generate a SQL migration file in the `migrations` directory
3. Record the migration in the database when applied

### Apply Migrations

To apply pending migrations:

```bash
npm run migrate
```

### Seed Development Data

For development, you can seed the database with test data:

```bash
npm run seed
```

## Architecture Overview

- **Models**: Define database structure and relationships
- **Repositories**: Handle data access logic
- **Controllers**: Handle HTTP requests and responses
- **Services**: Implement business logic
- **Routes**: Define API endpoints
- **Middleware**: Implement authentication and request processing

## GitHub OAuth Flow

The authentication system uses GitHub OAuth:

1. User initiates login via `/api/auth/github`
2. GitHub redirects to callback URL with authorization code
3. Backend exchanges code for access token
4. User record is created/updated in database
5. JWT token is issued for API access

## API Documentation

API documentation is available at `/api/docs` when the server is running.