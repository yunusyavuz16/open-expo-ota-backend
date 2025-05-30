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

interface RequestContext {
  protocol: string;
  host: string;
  appSlug: string;
}

export const generateManifest = (
  metadata: ManifestMetadata,
  assets: Asset[],
  requestContext?: RequestContext
): Record<string, any> => {
  // Format assets for manifest - new format expects assets as array
  const formattedAssets: ManifestAsset[] = assets.map((asset) => {
    let assetUrl: string;
    if (requestContext) {
      // Generate URL using request context for dynamic manifest generation
      assetUrl = `${requestContext.protocol}://${requestContext.host}/api/assets/${requestContext.appSlug}/${asset.id}`;
    } else {
      // Fallback to storage URL for static manifest generation
      assetUrl = getFileUrl(asset.storagePath, asset.storageType);
    }

    return {
      hash: asset.hash,
      key: asset.name,
      contentType: 'application/octet-stream', // Default content type
      url: assetUrl,
    };
  });

  // Generate a unique update ID (UUID format expected by expo-updates)
  const updateId = metadata.bundleHash; // Use bundle hash as update ID

  // Construct manifest in the new expo-updates format
  const manifest = {
    id: updateId,
    createdAt: metadata.createdAt.toISOString(),
    runtimeVersion: metadata.runtimeVersion,
    launchAsset: {
      hash: metadata.bundleHash,
      key: 'bundle.js',
      contentType: 'application/javascript',
      url: metadata.bundleUrl,
    },
    assets: formattedAssets,
    metadata: {
      version: metadata.version,
      channel: metadata.channel,
      platforms: metadata.platforms,
    },
    extra: {
      // Additional metadata for compatibility
      expoClient: {
        name: 'OpenExpoOTA App',
        slug: 'openexpoota-app',
        version: metadata.version,
        runtimeVersion: metadata.runtimeVersion,
        platforms: metadata.platforms,
      },
    },
  };

  return manifest;
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