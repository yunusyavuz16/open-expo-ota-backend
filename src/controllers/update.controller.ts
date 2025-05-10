import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Update, Bundle, Manifest, Asset, App } from '../models';
import { ReleaseChannel, Platform } from '../types';
import { storeFile, generateStorageKey } from '../utils/storage';
import { generateManifest, isCompatibleRuntimeVersion } from '../utils/manifest';

// Helper function to calculate hash of a file buffer
const calculateHash = (buffer: Buffer): string => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

export const createUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
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
    if (!req.files || !req.files.bundle || Array.isArray(req.files.bundle)) {
      res.status(400).json({ message: 'Bundle file is required' });
      return;
    }

    const bundleFile = req.files.bundle;
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
    if (req.files && req.files.assets && Array.isArray(req.files.assets)) {
      for (const assetFile of req.files.assets) {
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
      publishedBy: req.user.id,
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

    // Get the latest update
    const latestUpdate = updates[0];

    // Check if platform is supported
    if (latestUpdate.manifest &&
        !latestUpdate.manifest.platforms.includes(platform as Platform)) {
      res.status(404).json({ message: 'Platform not supported by this update' });
      return;
    }

    // Return manifest content
    if (latestUpdate.manifest) {
      res.json(latestUpdate.manifest.content);
    } else {
      res.status(404).json({ message: 'Manifest not found' });
    }
  } catch (error) {
    console.error('Error fetching manifest:', error);
    res.status(500).json({ message: 'Error fetching manifest' });
  }
};

export const promoteUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
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

    // Get update
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
      publishedBy: req.user.id,
    });

    // Update the manifest with the new channel
    if (update.manifest) {
      const manifestContent = {
        ...update.manifest.content,
        channel: channel
      };

      const newManifest = await Manifest.create({
        appId,
        updateId: promotedUpdate.id,
        version: update.manifest.version,
        channel: channel as ReleaseChannel,
        runtimeVersion: update.manifest.runtimeVersion,
        platforms: update.manifest.platforms,
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
      publishedBy: req.user.id,
    });

    res.json(rollbackUpdate);
  } catch (error) {
    console.error('Error rolling back update:', error);
    res.status(500).json({ message: 'Error rolling back update' });
  }
};