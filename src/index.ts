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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Routes
app.use('/api/auth', authRoutes);
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

    // Start the server
    app.listen(PORT, () => {
      console.log(chalk.green(`Server running on port ${PORT}`));
    });
  } catch (error) {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  }
}

startServer();