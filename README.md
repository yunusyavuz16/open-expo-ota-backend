# OpenExpoOTA Backend

Backend API service for OpenExpoOTA - A self-hosted OTA update system for Expo apps.

## Features

- GitHub OAuth authentication
- App management with access control
- OTA update publishing and management
- Serving of manifests and bundles
- Support for local file storage or S3-compatible storage
- Supabase integration for database management

## Prerequisites

- Node.js (v14 or newer)
- Supabase account and project
- (Optional) S3-compatible storage

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and update the variables:
   ```
   cp .env.example .env
   ```
4. Configure your GitHub OAuth application and update the `.env` file with your client ID and secret
5. Create a Supabase project and update the `.env` file with your Supabase URL and key
6. Run migrations to set up the database schema:
   ```
   npm run migrate
   ```
7. Build the project:
   ```
   npm run build
   ```
8. Start the server:
   ```
   npm start
   ```

## Development

Start the development server with hot reload:

```
npm run dev
```

## Supabase Setup

This project uses Supabase as the database backend. Follow these steps to set up your Supabase project:

1. Create a new Supabase project at [https://supabase.com](https://supabase.com)
2. Once your project is created, go to Settings > API to get your project URL and API keys
3. Add these to your `.env` file:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your_supabase_key
   SUPABASE_JWT_SECRET=same_as_supabase_jwt_secret
   ```
4. Run the migrations to set up your database schema:
   ```
   npm run migrate
   ```

## Database Structure

The system uses a code-first approach with migration scripts to set up the database schema in Supabase. The main database entities are:

- **Users**: Authenticated users through GitHub OAuth
- **Apps**: Applications registered in the system
- **AppUsers**: Many-to-many relationship between users and apps
- **Updates**: OTA updates published for apps
- **Bundles**: JS bundles for updates
- **Manifests**: Metadata about updates for Expo clients
- **Assets**: Additional files included in updates

## API Endpoints

### Authentication

- `GET /api/auth/github` - GitHub OAuth login
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `GET /api/auth/me` - Get current user info

### Apps

- `GET /api/apps` - List apps
- `POST /api/apps` - Create a new app
- `GET /api/apps/:id` - Get app details
- `PUT /api/apps/:id` - Update app
- `DELETE /api/apps/:id` - Delete app

### App Users

- `POST /api/apps/:id/users` - Add user to app
- `DELETE /api/apps/:id/users/:userId` - Remove user from app
- `POST /api/apps/:id/invite` - Invite user by GitHub username

### Updates

- `GET /api/apps/:appId/updates` - List updates for an app
- `POST /api/apps/:appId/updates` - Create a new update
- `GET /api/apps/:appId/updates/:id` - Get update details
- `POST /api/apps/:appId/updates/:id/rollback` - Rollback to a previous update
- `POST /api/apps/:appId/updates/:id/promote` - Promote an update to a different channel

### OTA Endpoints

- `GET /api/manifest/:appSlug` - Get app manifest (public endpoint)
- `GET /api/assets/:assetPath` - Get assets (public endpoint)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Node environment | `development` |
| `SUPABASE_URL` | Supabase project URL | - |
| `SUPABASE_KEY` | Supabase service role key | - |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret | - |
| `JWT_SECRET` | JWT secret key | - |
| `JWT_EXPIRATION` | JWT expiration time | `24h` |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | - |
| `GITHUB_CALLBACK_URL` | GitHub OAuth callback URL | - |
| `STORAGE_TYPE` | Storage type (`local` or `s3`) | `local` |
| `STORAGE_PATH` | Local storage path | `./uploads` |
| `S3_ENDPOINT` | S3 endpoint URL (for S3 storage) | - |
| `S3_BUCKET` | S3 bucket name (for S3 storage) | - |
| `S3_ACCESS_KEY` | S3 access key (for S3 storage) | - |
| `S3_SECRET_KEY` | S3 secret key (for S3 storage) | - |

## Troubleshooting

### Supabase Connection Issues

If you encounter issues connecting to Supabase:

1. Make sure your Supabase URL and API key are correct
2. Check that your IP address is allowed in Supabase's authentication settings
3. Ensure you're using the correct API key (service role key) for migrations

### Row Level Security (RLS)

Supabase uses Row Level Security (RLS) to control access to your data. Our migrations set up appropriate RLS policies, but if you need to customize them:

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Write and execute custom SQL to modify or add RLS policies

## License

MIT