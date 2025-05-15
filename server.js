/**
 * Production server script for OpenExpoOTA backend
 * This script starts the server without auto-reloading to ensure stability during file uploads
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Clean up old temp files before starting
try {
  const now = Date.now();
  const files = fs.readdirSync(tempDir);

  // Remove files older than 1 hour
  files.forEach(file => {
    const filePath = path.join(tempDir, file);
    try {
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtimeMs;

      // Remove if older than 1 hour (3600000 ms)
      if (fileAge > 3600000) {
        if (fs.statSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
        console.log(`Cleaned up old temp file: ${file}`);
      }
    } catch (err) {
      console.warn(`Error checking temp file ${file}:`, err.message);
    }
  });
} catch (err) {
  console.warn('Error cleaning temp directory:', err.message);
}

// Start the Node.js server with appropriate flags
const nodeProcess = spawn('node', [
  // Increase memory limit to 4GB
  '--max-old-space-size=4096',
  // Use the compiled JavaScript version
  path.join(__dirname, 'dist', 'index.js')
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    // Ensure we have proper timeout settings
    HTTP_TIMEOUT: '600000' // 10 minutes
  }
});

nodeProcess.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

nodeProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Server exited with code ${code}`);
    process.exit(code);
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT - shutting down gracefully');
  nodeProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM - shutting down gracefully');
  nodeProcess.kill('SIGTERM');
});

console.log('OpenExpoOTA production server started');