import axios from 'axios';

async function testSimpleRequest() {
  try {
    console.log('Sending basic request to the server...');

    // Send a simple GET request to test if the server is responding
    const response = await axios.get('http://localhost:3000/api/apps', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzQ3MzE0Nzk1LCJleHAiOjE3NDc0MDExOTV9.95IAoWLdUboGs3NmjUWmlPDEQjYsgHK9xbI8BZskko8'
      },
      timeout: 5000 // 5 second timeout
    });

    console.log('GET response:', response.status, response.statusText);

    // Now try a simple POST with minimal data
    const postResponse = await axios.post('http://localhost:3000/api/apps', {
      name: 'Test App',
      slug: 'test-app-' + Date.now(),
      description: 'Test app created by test script'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzQ3MzE0Nzk1LCJleHAiOjE3NDc0MDExOTV9.95IAoWLdUboGs3NmjUWmlPDEQjYsgHK9xbI8BZskko8'
      },
      timeout: 5000 // 5 second timeout
    });

    console.log('POST response:', postResponse.status, postResponse.statusText);
    console.log('Created app:', postResponse.data);

  } catch (error: any) {
    console.error('Test failed:');
    if (error.response) {
      console.error('Server responded with error:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
    } else {
      console.error('Error setting up request:', error.message);
    }
  }
}

// Run the test
testSimpleRequest().then(() => {
  console.log('Test completed');
});