import os from 'os';
import fs from 'fs';
import path from 'path';

/**
 * Diagnostic script to check server state and analyze potential issues
 */
function checkServerState() {
  console.log('======= SERVER DIAGNOSTIC REPORT =======');

  // Check Node.js version
  console.log(`Node.js version: ${process.version}`);

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  console.log('Memory usage:');
  console.log(` - RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB`);
  console.log(` - Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`);
  console.log(` - Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`);
  console.log(` - External: ${Math.round(memoryUsage.external / 1024 / 1024)} MB`);

  // Check system memory
  console.log('System memory:');
  console.log(` - Total: ${Math.round(os.totalmem() / 1024 / 1024)} MB`);
  console.log(` - Free: ${Math.round(os.freemem() / 1024 / 1024)} MB`);

  // Check disk space in temp directory
  const tempDir = path.join(__dirname, '../temp');
  if (fs.existsSync(tempDir)) {
    try {
      const files = fs.readdirSync(tempDir);
      console.log(`Temp directory contains ${files.length} files`);

      // List the largest files
      const fileStats = files.map(file => {
        const filePath = path.join(tempDir, file);
        try {
          const stats = fs.statSync(filePath);
          return { name: file, size: stats.size, created: stats.birthtime };
        } catch (err) {
          return { name: file, size: 0, created: new Date(0) };
        }
      });

      // Sort by size (largest first)
      fileStats.sort((a, b) => b.size - a.size);

      console.log('Largest files in temp directory:');
      fileStats.slice(0, 5).forEach(file => {
        console.log(` - ${file.name}: ${Math.round(file.size / 1024)} KB (created: ${file.created.toISOString()})`);
      });
    } catch (err) {
      console.error('Error reading temp directory:', err);
    }
  } else {
    console.log('Temp directory does not exist');
  }

  // Check for active handles and requests
  console.log('Process uptime:', Math.round(process.uptime()), 'seconds');

  // Note: Using any type to access non-standard Node.js internal properties
  const nodeProcess = process as any;
  if (nodeProcess._getActiveHandles && nodeProcess._getActiveRequests) {
    console.log(`Active handles: ${nodeProcess._getActiveHandles().length}`);
    console.log(`Active requests: ${nodeProcess._getActiveRequests().length}`);
  } else {
    console.log('Unable to access internal Node.js handle counts');
  }

  console.log('======= END OF REPORT =======');
}

// Run the diagnostic
checkServerState();

export default checkServerState;