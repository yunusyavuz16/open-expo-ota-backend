import { Platform, ReleaseChannel } from '../types';
import { Asset } from '../models';
import { getFileUrl } from './storage';

interface ManifestAsset {
  hash: string;
  key: string;
  contentType: string;
  url: string;
}

interface ManifestMetadata {
  version: string;
  runtimeVersion: string;
  platforms: Platform[];
  channel: ReleaseChannel;
  bundleUrl: string;
  bundleHash: string;
  createdAt: Date;
}

export const generateManifest = (
  metadata: ManifestMetadata,
  assets: Asset[],
): Record<string, any> => {
  // Format assets for manifest
  const formattedAssets: Record<string, ManifestAsset> = {};

  assets.forEach((asset) => {
    formattedAssets[asset.name] = {
      hash: asset.hash,
      key: asset.storagePath,
      contentType: 'application/octet-stream', // Default content type
      url: getFileUrl(asset.storagePath, asset.storageType),
    };
  });

  // Construct manifest in format compatible with Expo Updates
  return {
    id: metadata.bundleHash, // Using bundle hash as the unique ID
    createdAt: metadata.createdAt.toISOString(),
    runtimeVersion: metadata.runtimeVersion,
    version: metadata.version,
    platforms: metadata.platforms,
    channel: metadata.channel,
    assets: formattedAssets,
    launchAsset: {
      hash: metadata.bundleHash,
      key: metadata.bundleUrl.split('/').pop(),
      contentType: 'application/javascript',
      url: metadata.bundleUrl,
    },
    metadata: {
      // Additional metadata can be added here
      channel: metadata.channel,
      type: 'expo',
    },
  };
};

// Helper function to check if a runtime version is compatible
export const isCompatibleRuntimeVersion = (
  clientVersion: string,
  updateVersion: string,
): boolean => {
  // Runtime versioning strategy can be customized
  // This is a simple implementation that checks exact match
  // More advanced implementations could use semver parsing
  return clientVersion === updateVersion;
};