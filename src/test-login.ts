/**
 * Simple test script for testing login
 */
import axios from 'axios';

const API_URL = 'http://localhost:3000';

async function main() {
  try {
    console.log('Trying to get test login token...');
    const response = await axios.get(`${API_URL}/api/auth/test-login`);
    console.log('Response:', response.status, response.statusText);
    console.log('Token:', response.data.token);
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.statusText);
      console.error('Data:', error.response.data);
    }
  }
}

main();