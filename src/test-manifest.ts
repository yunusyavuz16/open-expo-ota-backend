import { Manifest } from './models';
import { Platform, ReleaseChannel } from './types';
import { db } from './db/context';
import './config/database'; // Import the sequelize instance

async function testManifestCreation() {
  try {
    console.log('Testing manifest creation...');

    // Test data
    const testData = {
      appId: 1,
      version: '1.0.0',
      channel: ReleaseChannel.DEVELOPMENT,
      runtimeVersion: '1.0.0',
      platforms: [Platform.IOS, Platform.ANDROID],
      content: { test: true },
      hash: 'test-hash-' + Date.now()
    };

    console.log('Creating manifest with data:', testData);
    console.log('Platforms type:', Array.isArray(testData.platforms));

    // Create manifest
    const manifest = await Manifest.create(testData);
    console.log('Manifest created successfully:', manifest.id);

    // Retrieve and validate
    const retrieved = await Manifest.findByPk(manifest.id);
    console.log('Retrieved manifest:', retrieved?.toJSON());
    console.log('Retrieved platforms:', retrieved?.platforms);
    console.log('Is array:', Array.isArray(retrieved?.platforms));

    console.log('Test successful!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testManifestCreation();