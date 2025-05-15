/**
 * Simple test script for uploading a test bundle
 */
import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';
import path from 'path';
import AdmZip from 'adm-zip';

const API_URL = 'http://localhost:3000';

async function main() {
  try {
    // Get test token first
    console.log('Getting test login token...');
    const loginResponse = await axios.get(`${API_URL}/api/auth/test-login`);
    console.log('Response:', loginResponse.status, loginResponse.statusText);
    const token = loginResponse.data.token;
    console.log('Got test token:', token);

    // Create a test zip file
    console.log('Creating test zip file...');
    const zip = new AdmZip();

    // Add a test bundle
    zip.addFile('bundle.js', Buffer.from('console.log("Test bundle");'));

    // Create and add metadata
    const metadata = {
      version: '1.0.0-test',
      runtimeVersion: '1.0.0',
      platforms: ['ios', 'android']
    };
    zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata)));

    // Write the zip file
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const zipPath = path.join(tempDir, 'test-upload.zip');
    zip.writeZip(zipPath);
    console.log(`Created test zip at ${zipPath}`);

    // Create form data for upload
    const form = new FormData();
    form.append('updatePackage', fs.createReadStream(zipPath));
    form.append('version', '1.0.0-test');
    form.append('runtimeVersion', '1.0.0');

    // Make sure platforms is properly formatted
    const platforms = ['ios', 'android'];
    console.log('Platforms array:', platforms);
    console.log('Platforms JSON:', JSON.stringify(platforms));
    form.append('platforms', JSON.stringify(platforms));

    // Upload to server
    console.log('Uploading test bundle...');
    console.log('Authorization header:', `Bearer ${token}`);
    const response = await axios.post(
      `${API_URL}/api/apps/1/updates`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    console.log('Upload response status:', response.status, response.statusText);
    console.log('Upload response data:', response.data);
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status, error.response.statusText);
      console.error('Response data:', error.response.data);
    }
  }
}

main();