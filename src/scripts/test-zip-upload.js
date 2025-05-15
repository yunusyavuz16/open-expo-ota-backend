#!/usr/bin/env node
/**
 * Test script to verify ZIP file upload functionality
 *
 * This script creates a sample update package and uploads it to the backend
 * to test the ZIP extraction and processing.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const os = require('os');
const archiver = require('archiver');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const APP_ID = process.env.APP_ID || 1; // Default app ID
const AUTH_TOKEN = process.env.AUTH_TOKEN; // Get from environment variable

if (!AUTH_TOKEN) {
  console.error('ERROR: AUTH_TOKEN environment variable is required.');
  console.error('Get a valid JWT token by logging in and copy it from the CLI config.');
  process.exit(1);
}

// Create a simple test bundle
async function createTestBundle() {
  const tempDir = path.join(os.tmpdir(), `test-update-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'assets'), { recursive: true });

  // Create a sample bundle.js file
  const bundleContent = `
    // This is a test bundle
    console.log('Test bundle loaded successfully!');
    export default function App() {
      return "Hello from test OTA update!";
    }
  `;
  fs.writeFileSync(path.join(tempDir, 'bundle.js'), bundleContent);

  // Create a sample asset file
  const assetContent = 'Sample asset file';
  fs.writeFileSync(path.join(tempDir, 'assets', 'sample-asset.txt'), assetContent);

  // Create metadata.json
  const metadata = {
    version: '1.0.0',
    channel: 'test-channel',
    runtimeVersion: '1.0.0',
    platforms: ['ios', 'android']
  };
  fs.writeFileSync(path.join(tempDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  return tempDir;
}

// Create a zip file for the test bundle
async function createZipFile(sourceDir) {
  const zipPath = path.join(os.tmpdir(), `test-update-${Date.now()}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`ZIP created: ${zipPath} (${Math.round(archive.pointer() / 1024)} KB)`);
      resolve(zipPath);
    });

    output.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Upload the zip file to the backend
async function uploadZipFile(zipPath) {
  const formData = new FormData();
  formData.append('version', '1.0.0');
  formData.append('channel', 'test-channel');
  formData.append('runtimeVersion', '1.0.0');
  formData.append('updatePackage', fs.createReadStream(zipPath));

  console.log(`Uploading ZIP to ${API_URL}/updates/${APP_ID}`);

  try {
    const response = await axios.post(`${API_URL}/updates/${APP_ID}`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log('Upload successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Upload failed!');
    if (error.response) {
      console.error('Server response:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

// Clean up temporary files
function cleanup(tempDir, zipPath) {
  try {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (zipPath && fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  } catch (err) {
    console.warn('Warning: Failed to clean up temporary files:', err);
  }
}

// Run the test
async function main() {
  let tempDir = null;
  let zipPath = null;

  try {
    console.log('Creating test bundle...');
    tempDir = await createTestBundle();

    console.log('Creating ZIP file...');
    zipPath = await createZipFile(tempDir);

    console.log('Uploading to backend...');
    await uploadZipFile(zipPath);

    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    cleanup(tempDir, zipPath);
  }
}

main();