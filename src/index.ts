import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import passport from 'passport';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { db } from './db/context';

// Load environment variables
dotenv.config();

// Import configuration
import './config/passport';
import { initDatabase } from './db';

// Import routes
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';

// Create express app
const app = express();
const PORT = process.env.PORT || 3000;

// Increase the server limits for large file uploads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL?.split(',') || '*',
  credentials: true
}));
app.use(morgan('dev'));

// Only apply JSON and URL-encoded body parsing to non-multipart routes
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    // Skip body parsing for multipart requests (let multer handle it)
    next();
  } else {
    // For non-multipart requests, apply the JSON body parser
    express.json()(req, res, next);
  }
});
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    // Skip URL-encoded parsing for multipart requests
    next();
  } else {
    // For non-multipart requests, apply the URL-encoded body parser
    express.urlencoded({ extended: true })(req, res, next);
  }
});

app.use(passport.initialize());

// Routes
console.log('Registering auth routes at /api/auth');
app.use('/api/auth', authRoutes);
console.log('Registering API routes at /api');
app.use('/api', apiRoutes);

// Static file serving for uploads
app.use('/assets', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: process.env.npm_package_version });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    console.log(chalk.yellow('Initializing database...'));
    await initDatabase();

    // Initialize database context
    console.log(chalk.yellow('Initializing database context...'));
    await db.initialize();

    // Start the server with increased timeout
    const server = app.listen(PORT, () => {
      console.log(chalk.green(`Server running on port ${PORT}`));
    });

    // Increase timeout for the server
    server.timeout = 600000; // 10 minutes
    server.keepAliveTimeout = 650000; // Set higher than the timeout
    server.headersTimeout = 660000; // Set even higher
  } catch (error) {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  }
}

startServer();