import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import semver from 'semver';
import sequelize from '../config/database'; // Import sequelize instance
import { Update, Bundle, Manifest, Asset, App, User } from '../models';
import { ReleaseChannel, Platform } from '../types';
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
  let zipPath: string | undefined;
  let extractDir: string | undefined;

  try {
    // Cast request to include file without strict typing
    const reqWithFile = req as any;
    const appId = parseInt(req.params.appId, 10);
    const user = reqWithFile.user as User | undefined;

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
      platforms,
      targetVersionRange,
    } = req.body;

    // Validate targetVersionRange if provided
    if (targetVersionRange && typeof targetVersionRange === 'string' && !semver.validRange(targetVersionRange)) {
      res.status(400).json({ message: 'Invalid targetVersionRange format.' });
      return;
    }

    // Process platforms from request body (might be stringified JSON)
    let parsedPlatformsFromBody = platforms;
    if (typeof platforms === 'string') {
      try {
        parsedPlatformsFromBody = JSON.parse(platforms);
      } catch (e) {
        console.warn('Failed to parse platforms from request body string, using as is or default handling will apply.');
        // Potentially set to a default or let normalizePlatforms handle it
      }
    }
    // Normalize platforms (handles default if platforms is undefined or empty)
    const normalizedBodyPlatforms = normalizePlatforms(parsedPlatformsFromBody || [Platform.IOS, Platform.ANDROID]);

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
    zipPath = updatePackageFile.path; // Assign zipPath here

    console.log('STEP 3: Found update package file');
    console.log('File details:', {
      size: updatePackageFile.size,
      encoding: updatePackageFile.encoding,
      mimetype: updatePackageFile.mimetype,
      path: updatePackageFile.path
    });

    // Explicit check for zipPath to satisfy linter, though flow implies it's a string
    if (!zipPath) {
      // This case should ideally not be reached if updatePackageFile.path is always a string
      console.error('Critical error: zipPath is undefined after assignment.');
      res.status(500).json({ message: 'Internal server error: Update package path not found after assignment.'});
      return;
    }

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
    extractDir = path.dirname(extractedUpdate.bundlePath); // Assign extractDir here
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

      // If metadata has version/runtimeVersion/platforms, they take precedence over form data
      const updateVersion = extractedUpdate.metadata.version || version;
      const updateChannel = (extractedUpdate.metadata.channel || channel || ReleaseChannel.DEVELOPMENT) as ReleaseChannel;
      const updateRuntimeVersion = extractedUpdate.metadata.runtimeVersion || runtimeVersion;

      // Platforms: Use metadata if available, otherwise use normalized platforms from body
      const updatePlatforms = extractedUpdate.metadata.platforms && extractedUpdate.metadata.platforms.length > 0
        ? normalizePlatforms(extractedUpdate.metadata.platforms)
        : normalizedBodyPlatforms;

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

      console.log('STEP 13: Storing manifest and assets');

      const transaction = await sequelize.transaction();

      try {
        console.log('STEP 14: Creating new update record');
        const newUpdate = await Update.create({
          appId: appId,
          version: updateVersion,
          channel: updateChannel,
          runtimeVersion: updateRuntimeVersion,
          platforms: updatePlatforms, // Use the processed updatePlatforms from metadata or body
          targetVersionRange: targetVersionRange || null, // Store targetVersionRange
          bundleId: bundleId,
          manifestId: 0, // Placeholder, will be updated after manifest creation
          publishedBy: user?.id || 0,
        }, { transaction });
        console.log('STEP 15: New update record created successfully with ID:', newUpdate.id);

        // Create Asset records from extractedUpdate.assets
        console.log('STEP 16: Creating asset records');
        const createdDbAssets: Asset[] = [];
        for (const assetFile of extractedUpdate.assets) { // assetFile has { path, buffer, hash, name }
          const safeAssetStorageName = path.basename(assetFile.name); // Sanitize asset name for storage path
          const assetKey = generateStorageKey(appId, `assets/${newUpdate.id}`, safeAssetStorageName);
          const storeResult = await storeFile(assetFile.buffer, assetKey); // Use .buffer

          const dbAsset = await Asset.create({
            updateId: newUpdate.id,
            name: assetFile.name, // Store original name from zip (e.g., 'icons/home.png')
            hash: assetFile.hash,
            storageType: storeResult.storageType,
            storagePath: storeResult.storagePath, // Based on safeAssetStorageName
            size: assetFile.buffer.length, // Use .buffer.length for size
          }, { transaction });
          createdDbAssets.push(dbAsset);
          console.log(`Successfully created asset in DB: ${dbAsset.id} - ${assetFile.name}`);
        }
        console.log('STEP 17: All asset records created in DB');

        // Prepare ManifestMetadata
        const bundleRecord = await Bundle.findByPk(bundleId, { transaction });
        if (!bundleRecord) throw new Error('Bundle record not found after creation/lookup');

        const manifestMetadata: Parameters<typeof generateManifest>[0] = {
          version: newUpdate.version,
          runtimeVersion: newUpdate.runtimeVersion,
          platforms: newUpdate.platforms as Platform[],
          channel: newUpdate.channel,
          bundleUrl: `${req.protocol}://${req.get('host')}/api/bundles/${app.slug}/${bundleRecord.id}`, // Construct bundle URL
          bundleHash: bundleRecord.hash, // Hash from the Bundle record
          createdAt: newUpdate.createdAt || new Date(),
        };

        console.log('STEP 18: Generating manifest content');
        const manifestContent = generateManifest(manifestMetadata, createdDbAssets);
        console.log('STEP 19: Manifest content generated');

        const manifestRecord = await Manifest.create({
          appId: appId,
          version: newUpdate.version,
          channel: newUpdate.channel,
          runtimeVersion: newUpdate.runtimeVersion,
          platforms: newUpdate.platforms as Platform[],
          content: manifestContent,
          hash: createHash('sha256').update(JSON.stringify(manifestContent)).digest('hex'),
        }, { transaction });
        console.log('STEP 20: Manifest record created with ID:', manifestRecord.id);

        await newUpdate.update({ manifestId: manifestRecord.id }, { transaction });
        console.log('STEP 21: Update record updated with manifest ID');

        await transaction.commit();
        console.log('STEP 22: Transaction committed');

        const populatedUpdate = await Update.findByPk(newUpdate.id, {
          include: [
            { model: App, as: 'app' },
            { model: Bundle, as: 'bundle' },
            { model: Manifest, as: 'manifest' },
            { model: Asset, as: 'assets' },
            { model: User, as: 'publisher'}
          ],
        });

        res.status(201).json({
          message: 'Update published successfully',
          update: populatedUpdate,
        });
        console.log('STEP 23: Response sent!');

      } catch (error) {
        await transaction.rollback();
        console.error('Error during update publishing transaction:', error);
        res.status(500).json({ message: 'Failed to publish update', error: (error as Error).message });
      }
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

    res.status(500).json({ message: `Error creating update: ${error.message || 'Unknown error'}` });
  } finally {
    if (extractDir) {
      try {
        console.log('Cleaning up temporary extracted files from:', extractDir);
        await cleanupExtractedFiles(extractDir);
        console.log('Temporary extracted files cleaned up successfully.');
      } catch (err) {
        console.warn('Warning: Failed to clean up extracted files:', err);
      }
    }
    if (zipPath) {
      try {
        console.log('Cleaning up uploaded ZIP file:', zipPath);
        fs.unlinkSync(zipPath);
        console.log('Uploaded ZIP file cleaned up successfully.');
      } catch (err) {
        console.warn('Warning: Failed to clean up uploaded ZIP file:', err);
      }
    }
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
    const clientRuntimeVersion = req.query.runtimeVersion as string;

    console.log(`[getManifest] Request: appSlug=${appSlug}, channel=${channel}, platform=${platform}, clientRuntimeVersion=${clientRuntimeVersion}`);

    if (!clientRuntimeVersion) {
      res.status(400).json({ message: 'runtimeVersion query parameter is required' });
      return;
    }
    if (!semver.valid(clientRuntimeVersion)) {
        res.status(400).json({ message: 'Invalid clientRuntimeVersion format.' });
        return;
    }

    const app = await App.findOne({ where: { slug: appSlug } });
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    const allUpdates = await Update.findAll({
      where: { appId: app.id, channel: channel },
      order: [['createdAt', 'DESC']],
      include: [{ model: Manifest, as: 'manifest', required: true }]
    });

    if (!allUpdates || allUpdates.length === 0) {
      res.status(404).json({ message: 'No updates available for this app and channel' });
      return;
    }

    const compatibleUpdates = allUpdates.filter(update => {
      const manifestPlatforms = update.manifest?.platforms || [];
      if (manifestPlatforms.length > 0 && !manifestPlatforms.includes(platform)) {
        console.log(`[getManifest] Update ID ${update.id} skipped: platform ${platform} not in manifest platforms [${manifestPlatforms.join(', ')}]`);
        return false;
      }

      if (update.targetVersionRange) {
        if (semver.satisfies(clientRuntimeVersion, update.targetVersionRange)) {
          console.log(`[getManifest] Update ID ${update.id} (version ${update.version}, tvr: ${update.targetVersionRange}) satisfies clientRuntimeVersion ${clientRuntimeVersion}.`);
          return true;
        } else {
          console.log(`[getManifest] Update ID ${update.id} (version ${update.version}, tvr: ${update.targetVersionRange}) does NOT satisfy clientRuntimeVersion ${clientRuntimeVersion}.`);
          return false;
        }
      } else {
        if (update.runtimeVersion === clientRuntimeVersion) {
          console.log(`[getManifest] Update ID ${update.id} (version ${update.version}, no tvr) matches clientRuntimeVersion ${clientRuntimeVersion} exactly.`);
          return true;
        } else {
           console.log(`[getManifest] Update ID ${update.id} (version ${update.version}, no tvr, updateRuntime: ${update.runtimeVersion}) does NOT match clientRuntimeVersion ${clientRuntimeVersion} exactly.`);
          return false;
        }
      }
    });

    if (compatibleUpdates.length === 0) {
      console.log(`[getManifest] No updates found satisfying version constraints for clientRuntimeVersion ${clientRuntimeVersion}`);
      res.status(404).json({ message: 'No compatible updates available for your app version' });
      return;
    }

    const sortedCompatibleUpdates = compatibleUpdates.sort((a, b) => semver.rcompare(a.version, b.version));
    const latestCompatibleUpdate = sortedCompatibleUpdates[0];

    console.log(`[getManifest] Selected latest compatible update ID: ${latestCompatibleUpdate.id}, version: ${latestCompatibleUpdate.version}`);

    try {
      let manifestContent = latestCompatibleUpdate.manifest!.content;
      if (typeof manifestContent === 'string') {
        manifestContent = JSON.parse(manifestContent);
      }
      res.json(manifestContent);
    } catch (error) {
      console.error('[getManifest] Error parsing manifest content:', error);
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
    res.set('Content-Disposition', `attachment; filename="${path.basename(asset.name)}"`);
    // Send the file
    res.sendFile(assetPath);
  } catch (error) {
    console.error('Error fetching asset file:', error);
    res.status(500).json({ message: 'Server error while fetching asset file' });
  }
};