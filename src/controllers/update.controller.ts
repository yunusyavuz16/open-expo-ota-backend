import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Update, Bundle, Manifest, Asset, App } from '../models';
import { ReleaseChannel, Platform, User } from '../types';
import { storeFile, generateStorageKey } from '../utils/storage';
import { generateManifest, isCompatibleRuntimeVersion } from '../utils/manifest';

// Define the expected structure of req.files from multer
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

interface FileRequest extends Request {
  files: {
    bundle?: MulterFile[];
    assets?: MulterFile[];
  };
  user: User;
}

// Helper function to calculate hash of a file buffer
const calculateHash = (buffer: Buffer): string => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

export const createUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { files, user } = req as FileRequest;
    const appId = parseInt(req.params.appId, 10);
    const {
      version,
      channel = ReleaseChannel.DEVELOPMENT,
      runtimeVersion,
      platforms = [Platform.IOS, Platform.ANDROID],
    } = req.body;

    // Validate input
    if (!version || !runtimeVersion) {
      res.status(400).json({ message: 'Version and runtimeVersion are required' });
      return;
    }

    // Check if app exists
    const app = await App.findByPk(appId);
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Check for bundle file
    if (!files || !files.bundle || files.bundle.length === 0) {
      res.status(400).json({ message: 'Bundle file is required' });
      return;
    }

    const bundleFile = files.bundle[0];
    const bundleBuffer = fs.readFileSync(bundleFile.path);
    const bundleHash = calculateHash(bundleBuffer);

    // Check if bundle with same hash already exists
    const existingBundle = await Bundle.findOne({ where: { hash: bundleHash } });
    let bundleId: number;

    if (existingBundle) {
      bundleId = existingBundle.id;
    } else {
      // Store bundle file
      const bundleKey = generateStorageKey(appId, 'bundles', bundleFile.originalname);
      const storeResult = await storeFile(bundleBuffer, bundleKey, 'application/javascript');

      // Create bundle record
      const bundle = await Bundle.create({
        appId,
        hash: bundleHash,
        storageType: storeResult.storageType,
        storagePath: storeResult.storagePath,
        size: storeResult.size,
      });

      bundleId = bundle.id;
    }

    // Process assets
    const assets: Asset[] = [];
    if (files && files.assets && files.assets.length > 0) {
      for (const assetFile of files.assets) {
        const assetBuffer = fs.readFileSync(assetFile.path);
        const assetHash = calculateHash(assetBuffer);

        // Store asset file
        const assetKey = generateStorageKey(appId, 'assets', assetFile.originalname);
        const storeResult = await storeFile(assetBuffer, assetKey);

        // Create asset record
        const asset = await Asset.create({
          updateId: 0, // Will update this after Update is created
          name: path.basename(assetFile.originalname),
          hash: assetHash,
          storageType: storeResult.storageType,
          storagePath: storeResult.storagePath,
          size: storeResult.size,
        });

        assets.push(asset);
      }
    }

    // Get bundle information
    const bundle = await Bundle.findByPk(bundleId);
    if (!bundle) {
      res.status(500).json({ message: 'Bundle not found after creation' });
      return;
    }

    // Create manifest
    const manifestContent = generateManifest(
      {
        version,
        runtimeVersion,
        platforms: platforms as Platform[],
        channel: channel as ReleaseChannel,
        bundleUrl: `/api/assets/${bundle.storagePath}`,
        bundleHash,
        createdAt: new Date(),
      },
      assets,
    );

    const manifest = await Manifest.create({
      appId,
      updateId: 0, // Will update this after Update is created
      version,
      channel: channel as ReleaseChannel,
      runtimeVersion,
      platforms: platforms as Platform[],
      content: manifestContent,
    });

    // Create update
    const update = await Update.create({
      appId,
      version,
      channel: channel as ReleaseChannel,
      runtimeVersion,
      isRollback: false,
      bundleId,
      manifestId: manifest.id,
      publishedBy: user.id,
    });

    // Update the updateId in manifest and assets
    await manifest.update({ updateId: update.id });

    for (const asset of assets) {
      await asset.update({ updateId: update.id });
    }

    // Return the update with related data
    res.status(201).json({
      ...update.toJSON(),
      manifest: manifestContent,
    });
  } catch (error) {
    console.error('Error creating update:', error);
    res.status(500).json({ message: 'Error creating update' });
  }
};

export const getUpdates = async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId, 10);
    const { channel } = req.query;

    // Check if app exists
    const app = await App.findByPk(appId);
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Build query
    const query: any = { appId };
    if (channel) {
      query.channel = channel;
    }

    // Get updates
    const updates = await Update.findAll({
      where: query,
      order: [['createdAt', 'DESC']],
    });

    res.json(updates);
  } catch (error) {
    console.error('Error fetching updates:', error);
    res.status(500).json({ message: 'Error fetching updates' });
  }
};

export const getUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId, 10);
    const updateId = parseInt(req.params.id, 10);

    // Check if app exists
    const app = await App.findByPk(appId);
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Get update
    const update = await Update.findOne({
      where: { id: updateId, appId },
      include: [
        { model: Manifest, as: 'manifest' },
        { model: Bundle, as: 'bundle' },
        { model: Asset, as: 'assets' },
      ],
    });

    if (!update) {
      res.status(404).json({ message: 'Update not found' });
      return;
    }

    res.json(update);
  } catch (error) {
    console.error('Error fetching update:', error);
    res.status(500).json({ message: 'Error fetching update' });
  }
};

export const getManifest = async (req: Request, res: Response): Promise<void> => {
  try {
    const appSlug = req.params.appSlug;
    const {
      platform = Platform.IOS,
      channel = ReleaseChannel.PRODUCTION,
      runtimeVersion,
    } = req.query;

    if (!runtimeVersion) {
      res.status(400).json({ message: 'Runtime version is required' });
      return;
    }

    // Get app by slug
    const app = await App.findOne({ where: { slug: appSlug } });
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Find latest update for platform, channel, and compatible with runtimeVersion
    const updates = await Update.findAll({
      where: {
        appId: app.id,
        channel: channel as ReleaseChannel,
        runtimeVersion: runtimeVersion as string,
      },
      order: [['createdAt', 'DESC']],
      include: [{ model: Manifest, as: 'manifest' }],
    });

    if (!updates || updates.length === 0) {
      res.status(404).json({ message: 'No compatible updates found' });
      return;
    }

    // Get the latest update with its manifest
    const latestUpdate = updates[0];
    const updateManifest = latestUpdate.manifest;

    // Check if platform is supported
    if (!updateManifest || !updateManifest.platforms.includes(platform as Platform)) {
      res.status(404).json({ message: 'Platform not supported by this update' });
      return;
    }

    // Return manifest content
    res.json(updateManifest.content);
  } catch (error) {
    console.error('Error fetching manifest:', error);
    res.status(500).json({ message: 'Error fetching manifest' });
  }
};

export const promoteUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user } = req as FileRequest;
    const appId = parseInt(req.params.appId, 10);
    const updateId = parseInt(req.params.id, 10);
    const { channel } = req.body;

    // Validate channel
    if (!channel || !Object.values(ReleaseChannel).includes(channel)) {
      res.status(400).json({
        message: 'Valid channel is required',
        validChannels: Object.values(ReleaseChannel)
      });
      return;
    }

    // Check if app exists
    const app = await App.findByPk(appId);
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Get update with manifest
    const update = await Update.findOne({
      where: { id: updateId, appId },
      include: [
        { model: Manifest, as: 'manifest' },
        { model: Bundle, as: 'bundle' },
      ],
    });

    if (!update) {
      res.status(404).json({ message: 'Update not found' });
      return;
    }

    // Create a new update with the new channel
    const promotedUpdate = await Update.create({
      appId,
      version: update.version,
      channel: channel as ReleaseChannel,
      runtimeVersion: update.runtimeVersion,
      isRollback: false,
      bundleId: update.bundleId,
      manifestId: update.manifestId,
      publishedBy: user.id,
    });

    // Update the manifest with the new channel
    const updateManifest = update.manifest;
    if (updateManifest) {
      const manifestContent = {
        ...updateManifest.content,
        channel: channel
      };

      const newManifest = await Manifest.create({
        appId,
        updateId: promotedUpdate.id,
        version: updateManifest.version,
        channel: channel as ReleaseChannel,
        runtimeVersion: updateManifest.runtimeVersion,
        platforms: updateManifest.platforms,
        content: manifestContent,
      });

      // Update the promoted update with the new manifest
      await promotedUpdate.update({ manifestId: newManifest.id });
    }

    // Copy assets to the new update
    const assets = await Asset.findAll({ where: { updateId: updateId } });
    for (const asset of assets) {
      await Asset.create({
        updateId: promotedUpdate.id,
        name: asset.name,
        hash: asset.hash,
        storageType: asset.storageType,
        storagePath: asset.storagePath,
        size: asset.size,
      });
    }

    res.json({
      message: `Update promoted to ${channel} channel successfully`,
      update: promotedUpdate
    });
  } catch (error) {
    console.error('Error promoting update:', error);
    res.status(500).json({ message: 'Error promoting update' });
  }
};

export const rollbackUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user } = req as FileRequest;
    const appId = parseInt(req.params.appId, 10);
    const updateId = parseInt(req.params.id, 10);

    // Check if app exists
    const app = await App.findByPk(appId);
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Get update to rollback
    const updateToRollback = await Update.findOne({
      where: { id: updateId, appId },
    });

    if (!updateToRollback) {
      res.status(404).json({ message: 'Update not found' });
      return;
    }

    // Create a new update that's a rollback of the specified update
    const rollbackUpdate = await Update.create({
      appId,
      version: `${updateToRollback.version}-rollback`,
      channel: updateToRollback.channel,
      runtimeVersion: updateToRollback.runtimeVersion,
      isRollback: true,
      bundleId: updateToRollback.bundleId,
      manifestId: updateToRollback.manifestId,
      publishedBy: user.id,
    });

    res.json(rollbackUpdate);
  } catch (error) {
    console.error('Error rolling back update:', error);
    res.status(500).json({ message: 'Error rolling back update' });
  }
};

export const getBundleFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const appSlug = req.params.appSlug;
    const bundleId = parseInt(req.params.bundleId, 10);

    // Get app by slug
    const app = await App.findOne({ where: { slug: appSlug } });
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Get bundle
    const bundle = await Bundle.findOne({
      where: { id: bundleId, appId: app.id },
    });

    if (!bundle) {
      res.status(404).json({ message: 'Bundle not found' });
      return;
    }

    // Determine file path based on storage type
    let filePath: string;
    if (bundle.storageType === 'local') {
      filePath = path.join(process.env.LOCAL_STORAGE_PATH || './storage', bundle.storagePath);
    } else {
      // For S3 or other storage types, implement the retrieval logic
      res.status(501).json({ message: 'S3 storage not implemented yet' });
      return;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'Bundle file not found' });
      return;
    }

    // Set headers
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', `attachment; filename=bundle.js`);

    // Stream the file
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Error serving bundle file:', error);
    res.status(500).json({ message: 'Error serving bundle file' });
  }
};

export const getAssetFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const appSlug = req.params.appSlug;
    const assetId = parseInt(req.params.assetId, 10);

    // Get app by slug
    const app = await App.findOne({ where: { slug: appSlug } });
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Get asset
    const asset = await Asset.findOne({
      where: { id: assetId },
      include: [
        {
          model: Update,
          as: 'update',
          where: { appId: app.id },
          required: true
        }
      ]
    });

    if (!asset) {
      res.status(404).json({ message: 'Asset not found' });
      return;
    }

    // Determine file path based on storage type
    let filePath: string;
    if (asset.storageType === 'local') {
      filePath = path.join(process.env.LOCAL_STORAGE_PATH || './storage', asset.storagePath);
    } else {
      // For S3 or other storage types, implement the retrieval logic
      res.status(501).json({ message: 'S3 storage not implemented yet' });
      return;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'Asset file not found' });
      return;
    }

    // Set appropriate content type based on file extension
    const contentType = getContentTypeFromFileName(asset.name);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${asset.name}`);

    // Stream the file
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Error serving asset file:', error);
    res.status(500).json({ message: 'Error serving asset file' });
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