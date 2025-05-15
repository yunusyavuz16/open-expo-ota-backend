# OpenExpoOTA Backend

Backend API service for OpenExpoOTA, a self-hosted OTA update platform for Expo apps.

## Features

- GitHub OAuth authentication
- App and update management
- File storage (local or S3-compatible)
- OTA manifest generation
- Expo updates compatibility

## Setup

### Prerequisites

- Node.js 14+
- A Supabase account for hosting the database

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/openexpoota
cd openexpoota/backend
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration.

## Database Setup

This project uses Sequelize ORM with PostgreSQL for database management. The database can be hosted on Supabase or any other PostgreSQL provider.

### Configuration

1. Create a `.env` file based on `.env.example`:

```
cp .env.example .env
```

2. Update the database connection settings in `.env`:

```
# Option 1: Use full connection string (recommended)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Option 2: Use individual connection parameters
DB_HOST=db.[YOUR-PROJECT-REF].supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=[YOUR-PASSWORD]
```

### Running Migrations

To apply database migrations:

```
npm run db:migrate
```

### Creating New Migrations

To create a new migration:

```
npm run db:create-migration
```

To generate a migration based on model changes:

```
npm run db:generate-migration
```

For more details on working with the database, see [SEQUELIZE_POSTGRESQL_GUIDE.md](./SEQUELIZE_POSTGRESQL_GUIDE.md).

### Starting the Server

For development:

```bash
npm run dev
```

For production:

```bash
npm run build
npm start
```

## Architecture

### Database

The database layer follows an Entity Framework-like approach:

- **Models**: TypeScript classes representing database tables
- **Database Context**: A central context for database operations
- **Migrations**: SQL files for schema changes

```typescript
// Example of database usage
import { db } from './db/context';

const user = await db.users.findById(1);
```

### API Endpoints

#### Authentication

- `POST /api/auth/github` - Initiate GitHub OAuth flow
- `GET /api/auth/github/callback` - OAuth callback
- `POST /api/auth/token` - Get/refresh JWT token

#### Apps

- `GET /api/apps` - List apps
- `POST /api/apps` - Create an app
- `GET /api/apps/:id` - Get app details
- `PUT /api/apps/:id` - Update app
- `DELETE /api/apps/:id` - Delete app

#### Updates

- `GET /api/apps/:appId/updates` - List updates for an app
- `POST /api/apps/:appId/updates` - Create a new update
- `GET /api/updates/:id` - Get update details
- `DELETE /api/updates/:id` - Delete an update

#### Manifests

- `GET /api/manifests/:appKey` - Get latest manifest for an app
- `GET /api/manifests/:appKey/:channel` - Get channel-specific manifest

## Development

### Code Style

This project uses ESLint and TypeScript for type safety and code quality:

```bash
npm run lint
```

### Testing

```bash
npm test
```

## ZIP-Based Update Process

The backend now supports receiving updates as a single ZIP file package instead of multiple separate files. This approach simplifies the update publishing process and makes it more reliable.

### Update Package Structure

The expected ZIP file structure is:

```
update-package.zip
├── bundle.js              # The main JavaScript bundle
├── assets/                # Directory containing assets
│   ├── image1.png
│   ├── font1.ttf
│   └── ...
└── metadata.json          # Update metadata
```

The `metadata.json` file should contain:

```json
{
  "version": "1.0.0",
  "channel": "production",
  "runtimeVersion": "1.0.0",
  "platforms": ["ios", "android"]
}
```

### Testing the ZIP Upload

You can test the ZIP upload functionality using the provided test script:

```bash
# Set the required environment variables
export AUTH_TOKEN="your-jwt-token"
export APP_ID=1  # Your app ID
export API_URL="http://localhost:3000/api"

# Run the test script
node src/scripts/test-zip-upload.js
```

The script will:
1. Create a sample bundle with a test JS file and asset
2. Package them into a ZIP file
3. Upload to the specified backend endpoint
4. Display the server response

## License

MIT