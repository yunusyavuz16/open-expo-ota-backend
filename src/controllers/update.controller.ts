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
        // Prepare ManifestMetadata first
        const bundleRecord = await Bundle.findByPk(bundleId, { transaction });
        if (!bundleRecord) throw new Error('Bundle record not found after creation/lookup');

        const manifestMetadata: Parameters<typeof generateManifest>[0] = {
          version: updateVersion,
          runtimeVersion: updateRuntimeVersion,
          platforms: updatePlatforms as Platform[],
          channel: updateChannel,
          bundleUrl: `${req.protocol}://${req.get('host')}/api/bundle/${app.slug}/${bundleRecord.id}`, // Construct bundle URL
          bundleHash: bundleRecord.hash, // Hash from the Bundle record
          createdAt: new Date(),
        };

        console.log('STEP 14: Generating manifest content (without assets first)');
        // Generate initial manifest content without assets (we'll update it later)
        const initialManifestContent = generateManifest(manifestMetadata, []);
        console.log('STEP 15: Initial manifest content generated');

        const manifestRecord = await Manifest.create({
          appId: appId,
          version: updateVersion,
          channel: updateChannel,
          runtimeVersion: updateRuntimeVersion,
          platforms: updatePlatforms as Platform[],
          content: initialManifestContent,
          hash: createHash('sha256').update(JSON.stringify(initialManifestContent)).digest('hex'),
        }, { transaction });
        console.log('STEP 16: Manifest record created with ID:', manifestRecord.id);

        console.log('STEP 17: Creating new update record');

        // Check for existing update with same app, version, and channel
        const existingUpdate = await Update.findOne({
          where: {
            appId: appId,
            version: updateVersion,
            channel: updateChannel,
          },
          transaction
        });

        if (existingUpdate) {
          throw new Error(`An update with version "${updateVersion}" already exists for channel "${updateChannel}". Please use a different version number or delete the existing update first.`);
        }

        const newUpdate = await Update.create({
          appId: appId,
          version: updateVersion,
          channel: updateChannel,
          runtimeVersion: updateRuntimeVersion,
          platforms: updatePlatforms, // Use the processed updatePlatforms from metadata or body
          targetVersionRange: targetVersionRange || null, // Store targetVersionRange
          bundleId: bundleId,
          manifestId: manifestRecord.id, // Use the actual manifest ID
          publishedBy: user?.id || 0,
        }, { transaction });
        console.log('STEP 18: New update record created successfully with ID:', newUpdate.id);

        // Create Asset records from extractedUpdate.assets
        console.log('STEP 19: Creating asset records');
        const createdDbAssets: Asset[] = [];
        for (const assetFile of extractedUpdate.assets) { // assetFile has { path, buffer, hash, name }
          // Check if asset with same hash already exists
          const existingAsset = await Asset.findOne({
            where: { hash: assetFile.hash },
            transaction
          });

          if (existingAsset) {
            console.log(`Asset with hash ${assetFile.hash} already exists, reusing asset ID: ${existingAsset.id}`);
            // Create a new asset record for this update but reference the existing storage
            const dbAsset = await Asset.create({
              updateId: newUpdate.id,
              name: assetFile.name,
              hash: assetFile.hash + '_' + newUpdate.id, // Make hash unique per update
              storageType: existingAsset.storageType,
              storagePath: existingAsset.storagePath,
              size: assetFile.buffer.length,
            }, { transaction });
            createdDbAssets.push(dbAsset);
            console.log(`Successfully created asset reference in DB: ${dbAsset.id} - ${assetFile.name}`);
          } else {
            // Store new asset file
            const assetKey = generateStorageKey(appId, `assets/${newUpdate.id}`, assetFile.name);
            const storeResult = await storeFile(assetFile.buffer, assetKey);

            const dbAsset = await Asset.create({
              updateId: newUpdate.id,
              name: assetFile.name,
              hash: assetFile.hash,
              storageType: storeResult.storageType,
              storagePath: storeResult.storagePath,
              size: assetFile.buffer.length,
            }, { transaction });
            createdDbAssets.push(dbAsset);
            console.log(`Successfully created new asset in DB: ${dbAsset.id} - ${assetFile.name}`);
          }
        }
        console.log('STEP 20: All asset records created in DB');

        // Now update the manifest with the complete asset information
        console.log('STEP 21: Updating manifest with asset information');
        const updatedManifestContent = generateManifest(manifestMetadata, createdDbAssets);
        await manifestRecord.update({
          content: updatedManifestContent,
          hash: createHash('sha256').update(JSON.stringify(updatedManifestContent)).digest('hex'),
        }, { transaction });
        console.log('STEP 22: Manifest updated with assets');

        await transaction.commit();
        console.log('STEP 23: Transaction committed');

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
        console.log('STEP 24: Response sent!');

      } catch (error) {
        await transaction.rollback();
        console.error('Error during update publishing transaction:', error);

        // Check if it's a Sequelize validation error
        if (error instanceof Error && error.name === 'SequelizeValidationError') {
          console.error('Validation error details:', error.message);
          res.status(400).json({
            message: 'Validation error',
            error: error.message,
            details: (error as any).errors
          });
        } else if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
          console.error('Unique constraint error details:', error.message);
          res.status(409).json({
            message: 'Duplicate update detected',
            error: 'An update with this version and channel combination already exists for this app',
            suggestion: 'Please use a different version number or delete the existing update first'
          });
        } else if (error instanceof Error && error.message.includes('already exists for channel')) {
          // Our custom duplicate check error
          console.error('Duplicate update error:', error.message);
          res.status(409).json({
            message: 'Duplicate update detected',
            error: error.message,
            suggestion: 'Please increment your version number (e.g., from 1.3.0 to 1.3.1) or use a different channel'
          });
        } else {
          res.status(500).json({ message: 'Failed to publish update', error: (error as Error).message });
        }
      } finally {
        console.log('STEP 25: Cleaning up temp extracted files');
        await cleanupExtractedFiles(extractDir);
      }
    } finally {
      // Clean up extracted files and zip file (main cleanup)
      console.log('STEP 26: Cleaning up temp files');
      await cleanupExtractedFiles(extractDir);
      console.log('STEP 27: Cleaning up zip file');
      // Clean up zip file
      try {
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
    const clientRuntimeVersion = req.query.runtimeVersion as string;
    const clientAppVersion = req.query.appVersion as string; // New: app binary version for targetVersion comparison

    console.log(`[getManifest] Request: appSlug=${appSlug}, channel=${channel}, platform=${platform}, clientRuntimeVersion=${clientRuntimeVersion}, clientAppVersion=${clientAppVersion}`);

    if (!clientRuntimeVersion) {
      res.status(400).json({ message: 'runtimeVersion query parameter is required' });
      return;
    }
    if (!semver.valid(clientRuntimeVersion)) {
        res.status(400).json({ message: 'Invalid clientRuntimeVersion format.' });
        return;
    }

    // App version is optional but if provided, should be valid semver
    if (clientAppVersion && !semver.valid(clientAppVersion)) {
        res.status(400).json({ message: 'Invalid clientAppVersion format.' });
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
      // Check platform compatibility
      const manifestPlatforms = update.manifest?.platforms || [];
      if (manifestPlatforms.length > 0 && !manifestPlatforms.includes(platform)) {
        console.log(`[getManifest] Update ID ${update.id} skipped: platform ${platform} not in manifest platforms [${manifestPlatforms.join(', ')}]`);
        return false;
      }

      // Check targetVersion compatibility (app binary version)
      if (update.targetVersionRange) {
        // Use app version for targetVersion comparison if available, otherwise fall back to runtime version
        const versionToCheck = clientAppVersion || clientRuntimeVersion;
        if (semver.satisfies(versionToCheck, update.targetVersionRange)) {
          console.log(`[getManifest] Update ID ${update.id} (version ${update.version}, targetVersionRange: ${update.targetVersionRange}) satisfies client version ${versionToCheck}.`);
        } else {
          console.log(`[getManifest] Update ID ${update.id} (version ${update.version}, targetVersionRange: ${update.targetVersionRange}) does NOT satisfy client version ${versionToCheck}.`);
          return false;
        }
      }

      // Check runtime version compatibility (separate from targetVersion)
      if (update.runtimeVersion === clientRuntimeVersion) {
        console.log(`[getManifest] Update ID ${update.id} (version ${update.version}) matches clientRuntimeVersion ${clientRuntimeVersion} exactly.`);
        return true;
      } else {
         console.log(`[getManifest] Update ID ${update.id} (version ${update.version}, updateRuntime: ${update.runtimeVersion}) does NOT match clientRuntimeVersion ${clientRuntimeVersion} exactly.`);
         return false;
      }
    });

    if (compatibleUpdates.length === 0) {
      console.log(`[getManifest] No updates found satisfying version constraints for clientRuntimeVersion ${clientRuntimeVersion} and clientAppVersion ${clientAppVersion || 'not provided'}`);
      res.status(404).json({ message: 'No compatible updates available for your app version' });
      return;
    }

    const sortedCompatibleUpdates = compatibleUpdates.sort((a, b) => semver.rcompare(a.version, b.version));
    const latestCompatibleUpdate = sortedCompatibleUpdates[0];

    console.log(`[getManifest] Selected latest compatible update ID: ${latestCompatibleUpdate.id}, version: ${latestCompatibleUpdate.version}`);

    try {
      // DYNAMIC MANIFEST GENERATION: Instead of using stored content, generate it dynamically
      const updateWithBundle = await Update.findByPk(latestCompatibleUpdate.id, {
        include: [
          { model: Bundle, as: 'bundle', required: true },
          { model: Asset, as: 'assets' }
        ]
      });

      if (!updateWithBundle || !updateWithBundle.bundle) {
        res.status(500).json({ message: 'Bundle not found for update' });
        return;
      }

      console.log(`[getManifest] Dynamically generating manifest for update ID: ${latestCompatibleUpdate.id}`);

      // Generate the correct bundle URL
      const bundleUrl = `${req.protocol}://${req.get('host')}/api/bundle/${appSlug}/${updateWithBundle.bundle.id}`;

      // Prepare manifest metadata
      const manifestMetadata = {
        version: latestCompatibleUpdate.version,
        runtimeVersion: latestCompatibleUpdate.runtimeVersion,
        platforms: latestCompatibleUpdate.platforms as Platform[],
        channel: latestCompatibleUpdate.channel,
        bundleUrl: bundleUrl,
        bundleHash: updateWithBundle.bundle.hash,
        createdAt: latestCompatibleUpdate.createdAt,
      };

      // Get assets - pass Asset instances directly to generateManifest
      const assets = updateWithBundle.assets || [];

      // Generate manifest using the updated function with request context
      const requestContext = {
        protocol: req.protocol,
        host: req.get('host') || 'localhost:3000',
        appSlug: appSlug
      };
      const dynamicManifest = generateManifest(manifestMetadata, assets, requestContext);

      // Add targetVersion to manifest for client-side verification
      if (latestCompatibleUpdate.targetVersionRange) {
        dynamicManifest.targetVersion = latestCompatibleUpdate.targetVersionRange;
      }

      console.log(`[getManifest] Dynamic manifest generated successfully with new format`);
      res.json(dynamicManifest);

    } catch (error) {
      console.error('[getManifest] Error generating dynamic manifest:', error);
      res.status(500).json({ message: 'Error generating manifest content' });
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

    console.log(`[getBundleFile] Requesting bundle: appSlug=${appSlug}, bundleId=${bundleId}`);

    // Find the app by slug - use direct import instead of db.models
    const app = await App.findOne({
      where: { slug: appSlug }
    });

    if (!app) {
      console.log(`[getBundleFile] App not found for slug: ${appSlug}`);
      res.status(404).json({ message: 'App not found' });
      return;
    }

    console.log(`[getBundleFile] App found: ID=${app.id}, slug=${app.slug}`);

    // Find the bundle - use direct import instead of db.models
    const bundle = await Bundle.findOne({
      where: { id: bundleId, appId: app.id }
    });

    if (!bundle) {
      console.log(`[getBundleFile] Bundle not found: bundleId=${bundleId}, appId=${app.id}`);
      res.status(404).json({ message: 'Bundle not found' });
      return;
    }

    console.log(`[getBundleFile] Bundle found: ID=${bundle.id}, path=${bundle.storagePath}`);

    // Get the bundle file path - fix path construction for TypeScript source execution
    const bundlePath = path.join(process.cwd(), 'uploads', bundle.storagePath);

    console.log(`[getBundleFile] Full file path: ${bundlePath}`);

    // Check if file exists
    if (!fs.existsSync(bundlePath)) {
      console.log(`[getBundleFile] Bundle file not found on disk: ${bundlePath}`);
      res.status(404).json({ message: 'Bundle file not found' });
      return;
    }

    console.log(`[getBundleFile] File exists, serving bundle: ${bundlePath}`);

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
    const app = await App.findOne({
      where: { slug: appSlug }
    });

    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Find the asset
    const asset = await Asset.findOne({
      where: { id: assetId },
      include: [
        {
          model: Update,
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
    const assetPath = path.join(process.cwd(), 'uploads', asset.storagePath);

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