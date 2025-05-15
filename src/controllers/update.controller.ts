import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Update, Bundle, Manifest, Asset, App } from '../models';
import { ReleaseChannel, Platform, User } from '../types';
import { storeFile, generateStorageKey } from '../utils/storage';
import { generateManifest, isCompatibleRuntimeVersion } from '../utils/manifest';
import { db } from '../db/context';
import { createHash } from 'crypto';
import { extractUpdatePackage, cleanupExtractedFiles } from '../utils/extract';

// Define the expected structure of multer file
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
}

// Helper function to normalize platform values to ensure they match the enum
const normalizePlatforms = (platforms: any[]): Platform[] => {
  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return [Platform.IOS, Platform.ANDROID];
  }

  return platforms.map(p => {
    const platform = String(p).toLowerCase();
    if (platform === 'ios') return Platform.IOS;
    if (platform === 'android') return Platform.ANDROID;
    if (platform === 'web') return Platform.WEB;

    // Default to a valid platform if input doesn't match
    console.warn(`Unrecognized platform: ${p}, defaulting to 'ios'`);
    return Platform.IOS;
  });
};

// Helper function to calculate hash of a file buffer
const calculateHash = (buffer: Buffer): string => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

export const createUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    // Cast request to include file without strict typing
    const reqWithFile = req as any;
    const appId = parseInt(req.params.appId, 10);
    const user = reqWithFile.user;

    // Log the request data for debugging
    console.log('Processing update request:', {
      appId,
      body: req.body,
      files: reqWithFile.files ? reqWithFile.files.length : 'No files',
      user: user?.id || 'unknown'
    });

    // Additional debugging
    if (reqWithFile.files && Array.isArray(reqWithFile.files)) {
      reqWithFile.files.forEach((file: any, index: number) => {
        console.log(`File ${index} details:`, {
          fieldname: file.fieldname,
          originalname: file.originalname,
          size: file.size,
          path: file.path
        });
      });
    }

    console.log('STEP 1: Parsing request data');

    const {
      version,
      channel = ReleaseChannel.DEVELOPMENT,
      runtimeVersion,
      platforms = [Platform.IOS, Platform.ANDROID],
    } = req.body;

    // Check if app exists
    const app = await App.findByPk(appId);
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    console.log('STEP 2: Found app with ID:', appId);

    // Look for update package - could be in different field names
    let updatePackageFile;

    if (reqWithFile.files && Array.isArray(reqWithFile.files) && reqWithFile.files.length > 0) {
      // Check for field called 'updatePackage' first
      updatePackageFile = reqWithFile.files.find((f: any) => f.fieldname === 'updatePackage');

      // If not found, try with field name 'bundle'
      if (!updatePackageFile) {
        updatePackageFile = reqWithFile.files.find((f: any) => f.fieldname === 'bundle');
      }

      // If still not found, just take the first file
      if (!updatePackageFile && reqWithFile.files.length > 0) {
        updatePackageFile = reqWithFile.files[0];
      }
    } else if (reqWithFile.file) {
      // For backward compatibility with upload.single()
      updatePackageFile = reqWithFile.file;
    }

    // Check if we found a file
    if (!updatePackageFile) {
      res.status(400).json({ message: 'Update package file is required' });
      return;
    }

    console.log('STEP 3: Found update package file');

    const zipPath = updatePackageFile.path;
    console.log('Using update package file:', updatePackageFile.fieldname, updatePackageFile.originalname);
    console.log('File details:', {
      size: updatePackageFile.size,
      encoding: updatePackageFile.encoding,
      mimetype: updatePackageFile.mimetype,
      path: updatePackageFile.path
    });

    // Verify the zip file exists and has content
    try {
      const fileStats = fs.statSync(zipPath);
      console.log(`ZIP file size: ${fileStats.size} bytes`);

      if (fileStats.size === 0) {
        res.status(400).json({ message: 'Received empty ZIP file' });
        return;
      }

      // Temporarily skip ZIP header validation
      /*
      // Check if the file is a proper zip
      try {
        // Try to read first few bytes to validate it's a ZIP file
        const fd = fs.openSync(zipPath, 'r');
        const buffer = Buffer.alloc(4);
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);

        console.log('File header bytes:', [...buffer].map(b => b.toString(16)).join(' '));

        // ZIP files start with PK header (0x50 0x4B)
        if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
          console.error('Invalid ZIP header:', [...buffer].map(b => b.toString(16)).join(' '));
          res.status(400).json({ message: 'Invalid ZIP file format: incorrect header' });
          return;
        }
      } catch (err) {
        console.error('Error reading file header:', err);
        res.status(500).json({ message: 'Error validating ZIP file' });
        return;
      }
      */
    } catch (err) {
      console.error('Error checking ZIP file stats:', err);
      res.status(500).json({ message: 'Error validating ZIP file' });
      return;
    }

    // Extract the update package
    console.log('STEP 4: Extracting update package...');
    const extractedUpdate = await extractUpdatePackage(zipPath);
    const extractDir = path.dirname(extractedUpdate.bundlePath);
    console.log('STEP 5: Successfully extracted update package:', {
      bundleHash: extractedUpdate.bundleHash,
      assets: extractedUpdate.assets.length,
      metadata: extractedUpdate.metadata
    });

    try {
      // Store bundle
      console.log('STEP 6: Storing bundle');
      const bundleKey = generateStorageKey(appId, 'bundles', path.basename(extractedUpdate.bundlePath));
      const bundleStoreResult = await storeFile(extractedUpdate.bundleBuffer, bundleKey);
      console.log('STEP 7: Bundle stored successfully');

      // Add logging for platforms
      console.log('Platforms from metadata:', extractedUpdate.metadata.platforms);
      console.log('Platforms from request body:', req.body.platforms);

      // Parse platforms correctly - coming from either metadata or body
      let updatePlatforms = extractedUpdate.metadata.platforms || [];

      // If platforms is in the request body and is a string, try to parse it
      if (req.body.platforms && typeof req.body.platforms === 'string') {
        try {
          const parsedPlatforms = JSON.parse(req.body.platforms);
          // Ensure it's always an array
          updatePlatforms = Array.isArray(parsedPlatforms) ? parsedPlatforms : [parsedPlatforms].filter(Boolean);
        } catch (err) {
          console.error('Error parsing platforms from request body:', err);
        }
      }

      // If platforms is still empty, use a default value
      if (!updatePlatforms || !updatePlatforms.length) {
        updatePlatforms = [Platform.IOS, Platform.ANDROID];
      }

      // Ensure platforms is in the correct format for PostgreSQL ARRAY type - must be array of strings
      if (!Array.isArray(updatePlatforms)) {
        updatePlatforms = [updatePlatforms].filter(Boolean);
      }

      // Convert any non-string values to strings to ensure compatibility
      updatePlatforms = updatePlatforms.map(p => String(p));

      // Log the final parsed platforms for debugging
      console.log('Final platforms value:', updatePlatforms);
      console.log('Is Array:', Array.isArray(updatePlatforms));
      console.log('Element Types:', updatePlatforms.map(p => typeof p));

      // If metadata has version/runtimeVersion, they take precedence over form data
      const updateVersion = extractedUpdate.metadata.version || version;
      const updateChannel = (extractedUpdate.metadata.channel || channel || ReleaseChannel.DEVELOPMENT) as ReleaseChannel;
      const updateRuntimeVersion = extractedUpdate.metadata.runtimeVersion || runtimeVersion;

      // Validate required fields
      if (!updateVersion || !updateRuntimeVersion) {
        res.status(400).json({ message: 'Version and runtimeVersion are required' });
        return;
      }

      // Process the bundle
      console.log('STEP 8: Processing bundle');
      const bundleHash = extractedUpdate.bundleHash;

      // Check if bundle with same hash already exists
      const existingBundle = await Bundle.findOne({ where: { hash: bundleHash } });
      let bundleId: number;

      if (existingBundle) {
        console.log('STEP 9: Using existing bundle with ID:', existingBundle.id);
        bundleId = existingBundle.id;
      } else {
        // Store bundle file
        console.log('STEP 9: Creating new bundle record');
        const bundleKey = generateStorageKey(appId, 'bundles', 'bundle.js');
        const storeResult = await storeFile(
          extractedUpdate.bundleBuffer,
          bundleKey,
          'application/javascript'
        );

        // Create bundle record
        const bundle = await Bundle.create({
          appId,
          hash: bundleHash,
          storageType: storeResult.storageType,
          storagePath: storeResult.storagePath,
          size: storeResult.size,
        });

        console.log('STEP 10: Created new bundle with ID:', bundle.id);
        bundleId = bundle.id;
      }

      // Process assets but don't create records yet - just store files and collect info
      console.log('STEP 11: Processing assets');
      const assetInfos: Array<{
        name: string;
        hash: string;
        storageType: string;
        storagePath: string;
        size: number;
      }> = [];

      for (const assetItem of extractedUpdate.assets) {
        // Store asset file
        console.log(`Processing asset: ${assetItem.name}`);
        const assetKey = generateStorageKey(appId, 'assets', assetItem.name);
        const storeResult = await storeFile(assetItem.buffer, assetKey);

        // Just store the asset info for now - don't create in database yet
        assetInfos.push({
          name: assetItem.name,
          hash: assetItem.hash,
          storageType: storeResult.storageType,
          storagePath: storeResult.storagePath,
          size: storeResult.size,
        });
      }

      console.log('STEP 12: Processed all assets');

      // Get bundle information
      const bundle = await Bundle.findByPk(bundleId);
      if (!bundle) {
        res.status(500).json({ message: 'Bundle not found after creation' });
        return;
      }

      console.log('STEP 13: Creating manifest');

      // Create manifest
      const manifestContent = generateManifest(
        {
          version: updateVersion,
          runtimeVersion: updateRuntimeVersion,
          platforms: updatePlatforms as Platform[],
          channel: updateChannel as ReleaseChannel,
          bundleUrl: `/api/assets/${bundle.storagePath}`,
          bundleHash,
          createdAt: new Date(),
        },
        []  // Empty array for now - we'll add assets to the manifest after creating them
      );

      // Generate a hash for the manifest content
      const manifestHash = crypto.createHash('sha256')
        .update(JSON.stringify(manifestContent))
        .digest('hex');

      console.log('STEP 14: Generated manifest hash:', manifestHash);

      // Ensure platforms is always a properly typed array before creating the manifest
      const validPlatforms = normalizePlatforms(updatePlatforms);

      console.log('STEP 14.5: Valid platforms array:', validPlatforms);
      console.log('Is Array:', Array.isArray(validPlatforms));
      console.log('Length:', validPlatforms.length);
      console.log('Elements:', validPlatforms.join(', '));
      console.log('Types:', validPlatforms.map(p => typeof p).join(', '));

      console.log('STEP 15: Creating manifest record in database');

      const manifest = await Manifest.create({
        appId,
        version: updateVersion,
        channel: updateChannel as ReleaseChannel,
        runtimeVersion: updateRuntimeVersion,
        platforms: validPlatforms,
        content: manifestContent,
        hash: manifestHash,
      });

      console.log('STEP 16: Created manifest with ID:', manifest.id);
      console.log('STEP 17: Creating update record');

      // Debug log the update creation object
      console.log('Update creation object:', {
        appId,
        version: updateVersion,
        channel: updateChannel,
        runtimeVersion: updateRuntimeVersion,
        platforms: validPlatforms,
        isRollback: false,
        bundleId,
        manifestId: manifest.id,
        publishedBy: user.id
      });

      // Create update - ensure platforms is included and is properly formatted as an array of valid Platform enum values
      const update = await Update.create({
        appId,
        version: updateVersion,
        channel: updateChannel as ReleaseChannel,
        runtimeVersion: updateRuntimeVersion,
        platforms: validPlatforms,
        isRollback: false,
        bundleId,
        manifestId: manifest.id,
        publishedBy: user.id,
      });

      console.log('STEP 18: Created update with ID:', update.id);
      console.log('STEP 19: Creating asset records');

      // Now create the assets with the correct updateId
      const assets: Asset[] = [];
      for (const assetInfo of assetInfos) {
        try {
          console.log(`Creating asset: ${assetInfo.name}`);
          const asset = await Asset.create({
            ...assetInfo,
            updateId: update.id
          });
          console.log(`Successfully created asset: ${asset.id}`);
          assets.push(asset);
        } catch (err) {
          console.error(`Error creating asset: ${assetInfo.name}`, err);
        }
      }

      console.log('STEP 20: Created all asset records');
      console.log('STEP 21: Updating manifest with asset information');

      // Update the manifest with asset information
      const updatedManifestContent = generateManifest(
        {
          version: updateVersion,
          runtimeVersion: updateRuntimeVersion,
          platforms: validPlatforms,
          channel: updateChannel as ReleaseChannel,
          bundleUrl: `/api/assets/${bundle.storagePath}`,
          bundleHash,
          createdAt: new Date(),
        },
        assets
      );

      // Update the manifest content
      await manifest.update({
        content: updatedManifestContent
      });

      console.log('STEP 22: Updated manifest content');
      console.log('STEP 23: Preparing response');

      // Get the update with related data for the response
      const populatedUpdate = await Update.findOne({
        where: { id: update.id },
        include: [
          { model: Bundle, as: 'bundle' },
          { model: Asset, as: 'assets' }
        ]
      });

      // Extract the bundle and assets properly with type checking
      const updateBundle = populatedUpdate ? (populatedUpdate as any).bundle : null;
      const updateAssets = populatedUpdate ? (populatedUpdate as any).assets || [] : [];

      // Return the update with related data - structure it more consistently
      res.status(201).json({
        status: 'success',
        message: 'Update processed successfully',
        update: {
          id: update.id,
          appId: update.appId,
          version: update.version,
          channel: update.channel,
          runtimeVersion: update.runtimeVersion,
          platforms: update.platforms,
          isRollback: update.isRollback,
          createdAt: update.createdAt,
          updatedAt: update.updatedAt,
          publishedBy: update.publishedBy,
          bundleId: update.bundleId,
          manifestId: update.manifestId,
          bundle: updateBundle,
          assets: updateAssets,
          manifest: updatedManifestContent
        }
      });

      console.log('STEP 24: Response sent!');
    } finally {
      // Clean up extracted files
      console.log('STEP 25: Cleaning up temp files');
      await cleanupExtractedFiles(extractDir);
      console.log('STEP 26: Cleaning up zip file');
      // Clean up zip file
      try {
        console.log('STEP 27: Cleaning up zip file');
        fs.unlinkSync(zipPath);
        console.log('STEP 28: Zip file cleaned up');
      } catch (err) {
        console.warn('Warning: Failed to clean up zip file:', err);
      }
    }
  } catch (error: any) {
    console.error('Error creating update:', error);
    console.error('Stack trace:', error.stack);

    // Show more detailed error information for debugging
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.cause) {
      console.error('Error cause:', error.cause);
    }

    res.json({ status: 'error', message: `Error creating update: ${error.message || 'Unknown error'}` });
  }
};

export const getUpdates = async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId, 10);
    const channel = req.query.channel as ReleaseChannel || undefined;
    const platform = req.query.platform as Platform || undefined;

    // Validate appId
    if (isNaN(appId)) {
      res.status(400).json({ message: 'Invalid app ID' });
      return;
    }

    // Build query filters
    const filters: any = { appId };
    if (channel) {
      filters.channel = channel;
    }

    // Get updates
    const updates = await db.models.Update.findAll({
      where: filters,
      include: [
        {
          model: db.models.Bundle,
          as: 'bundle',
          attributes: ['id', 'hash', 'size']
        },
        {
          model: db.models.Asset,
          as: 'assets',
          attributes: ['id', 'name', 'hash', 'size']
        },
        {
          model: db.models.User,
          as: 'publisher',
          attributes: ['id', 'username', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Filter updates by platform if specified
    const filteredUpdates = platform
      ? updates.filter((update: any) => update.platforms.includes(platform))
      : updates;

    res.json(filteredUpdates);
  } catch (error) {
    console.error('Error fetching updates:', error);
    res.status(500).json({ message: 'Server error while fetching updates' });
  }
};

export const getUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId, 10);
    const updateId = parseInt(req.params.id, 10);

    // Validate IDs
    if (isNaN(appId) || isNaN(updateId)) {
      res.status(400).json({ message: 'Invalid app or update ID' });
      return;
    }

    // Find the update
    const update = await db.models.Update.findOne({
      where: { id: updateId, appId },
      include: [
        {
          model: db.models.Bundle,
          as: 'bundle',
          attributes: ['id', 'hash', 'storagePath', 'size']
        },
        {
          model: db.models.Asset,
          as: 'assets',
          attributes: ['id', 'name', 'hash', 'storagePath', 'size']
        },
        {
          model: db.models.Manifest,
          as: 'manifest',
          attributes: ['id', 'content', 'hash']
        },
        {
          model: db.models.User,
          as: 'publisher',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    if (!update) {
      res.status(404).json({ message: 'Update not found' });
      return;
    }

    res.json(update);
  } catch (error) {
    console.error('Error fetching update:', error);
    res.status(500).json({ message: 'Server error while fetching update' });
  }
};

export const getManifest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { appSlug } = req.params;
    const channel = req.query.channel as ReleaseChannel || ReleaseChannel.PRODUCTION;
    const platform = req.query.platform as Platform || Platform.IOS;
    const runtimeVersion = req.query.runtimeVersion as string;

    console.log(`[getManifest] Requested manifest for app: ${appSlug}, channel: ${channel}, platform: ${platform}, runtimeVersion: ${runtimeVersion}`);

    // Find the app by slug
    const app = await App.findOne({
      where: { slug: appSlug }
    });

    if (!app) {
      console.log(`[getManifest] App not found: ${appSlug}`);
      res.status(404).json({ message: 'App not found' });
      return;
    }

    console.log(`[getManifest] Found app with ID: ${app.id}`);

    // Build query for updates
    const query: any = {
      appId: app.id,
      channel
    };

    // Remove exact runtime version match - we'll use semver comparison later
    // if (runtimeVersion) {
    //   query.runtimeVersion = runtimeVersion;
    // }

    // Find all updates for the app in the specified channel
    const updates = await Update.findAll({
      where: query,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Manifest,
          as: 'manifest'
        }
      ]
    });

    if (!updates || updates.length === 0) {
      console.log(`[getManifest] No updates found for app ID: ${app.id}, channel: ${channel}`);
      res.status(404).json({ message: 'No updates available' });
      return;
    }

    // If runtimeVersion is provided, filter updates to find those with higher versions
    let compatibleUpdate = null;
    if (runtimeVersion) {
      // Simple semver comparison function
      const isNewerVersion = (v1: string, v2: string): boolean => {
        const v1Parts = v1.split('.').map(Number);
        const v2Parts = v2.split('.').map(Number);

        console.log(`[getManifest] Comparing versions: ${v1} vs ${v2}`);
        console.log(`[getManifest] Parsed parts: ${v1Parts.join('.')} vs ${v2Parts.join('.')}`);

        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
          const v1Part = v1Parts[i] || 0;
          const v2Part = v2Parts[i] || 0;
          console.log(`[getManifest] Comparing component ${i}: ${v1Part} vs ${v2Part}`);
          if (v1Part > v2Part) {
            console.log(`[getManifest] ${v1} is newer than ${v2}`);
            return true;
          }
          if (v1Part < v2Part) {
            console.log(`[getManifest] ${v1} is older than ${v2}`);
            return false;
          }
        }
        console.log(`[getManifest] ${v1} is equal to ${v2}`);
        return false; // Versions are equal
      };

      // Log all available updates
      console.log(`[getManifest] Found ${updates.length} updates to check for compatibility`);
      updates.forEach((update, index) => {
        console.log(`[getManifest] Update ${index+1}: version=${update.version}, runtimeVersion=${update.runtimeVersion}`);
      });

      // Find the newest update with a version higher than current runtime version
      for (const update of updates) {
        // First check for exact match
        if (update.runtimeVersion === runtimeVersion) {
          console.log(`[getManifest] Found exact runtime version match: ${update.runtimeVersion}`);
          compatibleUpdate = update;
          break;
        }

        // Then check for newer version
        if (isNewerVersion(update.version, runtimeVersion)) {
          console.log(`[getManifest] Found newer version: ${update.version} > ${runtimeVersion}`);
          compatibleUpdate = update;
          break;
        } else {
          console.log(`[getManifest] Update version ${update.version} is not newer than ${runtimeVersion}, skipping`);
        }
      }
    } else {
      // If no runtimeVersion provided, just use the latest update
      compatibleUpdate = updates[0];
    }

    if (!compatibleUpdate) {
      console.log(`[getManifest] No compatible updates found for app ID: ${app.id}, channel: ${channel}, runtimeVersion: ${runtimeVersion}`);
      res.status(404).json({ message: 'No compatible updates available' });
      return;
    }

    console.log(`[getManifest] Found compatible update ID: ${compatibleUpdate.id}`);

    // Explicitly check for manifest association
    const manifest = compatibleUpdate.get('manifest') as Manifest | undefined;
    if (!manifest) {
      console.log(`[getManifest] No manifest found for update ID: ${compatibleUpdate.id}`);
      res.status(404).json({ message: 'Manifest not found' });
      return;
    }

    // Check if update supports the requested platform
    const platforms = manifest.platforms || [];
    if (platforms.length > 0 && !platforms.includes(platform)) {
      console.log(`[getManifest] Update doesn't support platform: ${platform}`);
      res.status(404).json({ message: `No update available for platform ${platform}` });
      return;
    }

    // Parse manifest content and return it
    try {
      let manifestContent = manifest.content;
      if (typeof manifestContent === 'string') {
        try {
          manifestContent = JSON.parse(manifestContent);
        } catch (parseError) {
          console.error('[getManifest] Error parsing manifest content:', parseError);
        }
      }

      console.log(`[getManifest] Successfully returning manifest for update ID: ${compatibleUpdate.id}`);
      res.json(manifestContent);
    } catch (error) {
      console.error('[getManifest] Error processing manifest content:', error);
      res.status(500).json({ message: 'Error processing manifest content' });
    }
  } catch (error) {
    console.error('[getManifest] Error fetching manifest:', error);
    res.status(500).json({ message: 'Server error while fetching manifest' });
  }
};

export const promoteUpdate = async (req: Request, res: Response): Promise<void> => {
  // Implementation for promotion logic
  res.status(501).json({ message: 'Promotion functionality not implemented yet' });
};

export const rollbackUpdate = async (req: Request, res: Response): Promise<void> => {
  // Implementation for rollback logic
  res.status(501).json({ message: 'Rollback functionality not implemented yet' });
};

export const getBundleFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { appSlug, bundleId } = req.params;

    // Find the app by slug
    const app = await db.models.App.findOne({
      where: { slug: appSlug }
    });

    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Find the bundle
    const bundle = await db.models.Bundle.findOne({
      where: { id: bundleId, appId: app.id }
    });

    if (!bundle) {
      res.status(404).json({ message: 'Bundle not found' });
      return;
    }

    // Get the bundle file path
    const bundlePath = path.join(__dirname, '../../', bundle.storagePath);

    // Check if file exists
    if (!fs.existsSync(bundlePath)) {
      res.status(404).json({ message: 'Bundle file not found' });
      return;
    }

    // Set appropriate headers
    res.set('Content-Type', 'application/javascript');
    res.set('Content-Disposition', `attachment; filename="bundle-${bundleId}.js"`);

    // Send the file
    res.sendFile(bundlePath);
  } catch (error) {
    console.error('Error fetching bundle file:', error);
    res.status(500).json({ message: 'Server error while fetching bundle file' });
  }
};

export const getAssetFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { appSlug, assetId } = req.params;

    // Find the app by slug
    const app = await db.models.App.findOne({
      where: { slug: appSlug }
    });

    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Find the asset
    const asset = await db.models.Asset.findOne({
      where: { id: assetId },
      include: [
        {
          model: db.models.Update,
          as: 'update',
          where: { appId: app.id }
        }
      ]
    });

    if (!asset) {
      res.status(404).json({ message: 'Asset not found' });
      return;
    }

    // Get the asset file path
    const assetPath = path.join(__dirname, '../../', asset.storagePath);

    // Check if file exists
    if (!fs.existsSync(assetPath)) {
      res.status(404).json({ message: 'Asset file not found' });
      return;
    }

    // Set appropriate Content-Type based on file extension
    const ext = path.extname(asset.name).toLowerCase();
    let contentType = 'application/octet-stream'; // Default content type

    // Set content type based on file extension
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.html') contentType = 'text/html';

    // Set headers
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename="${asset.name}"`);

    // Send the file
    res.sendFile(assetPath);
  } catch (error) {
    console.error('Error fetching asset file:', error);
    res.status(500).json({ message: 'Server error while fetching asset file' });
  }
};

// Helper function to determine content type from file name
function getContentTypeFromFileName(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  switch (extension) {
    case '.js':
      return 'application/javascript';
    case '.json':
      return 'application/json';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.ttf':
      return 'font/ttf';
    case '.otf':
      return 'font/otf';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.css':
      return 'text/css';
    case '.html':
      return 'text/html';
    default:
      return 'application/octet-stream';
  }
}