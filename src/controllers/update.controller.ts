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

    // Parse the data field if it exists, otherwise use req.body directly
    let updateData = req.body;

    if (req.body.data && typeof req.body.data === 'string') {
      try {
        updateData = JSON.parse(req.body.data);
      } catch (error) {
        console.error('Error parsing update data JSON:', error);
      }
    }

    const {
      version,
      channel = ReleaseChannel.DEVELOPMENT,
      runtimeVersion,
      platforms = [Platform.IOS, Platform.ANDROID],
    } = updateData;

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

    // Update the assets with updateId
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
      ? updates.filter(update => update.platforms.includes(platform))
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

    if (runtimeVersion) {
      query.runtimeVersion = runtimeVersion;
    }

    // Find the latest update for the app in the specified channel
    const update = await Update.findOne({
      where: query,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Manifest,
          as: 'manifest'
        }
      ]
    });

    if (!update) {
      console.log(`[getManifest] No updates found for app ID: ${app.id}, channel: ${channel}, runtimeVersion: ${runtimeVersion}`);
      res.status(404).json({ message: 'No updates available' });
      return;
    }

    console.log(`[getManifest] Found update ID: ${update.id}`);

    // Explicitly check for manifest association
    const manifest = update.get('manifest') as Manifest | undefined;
    if (!manifest) {
      console.log(`[getManifest] No manifest found for update ID: ${update.id}`);
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

      console.log(`[getManifest] Successfully returning manifest for update ID: ${update.id}`);
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