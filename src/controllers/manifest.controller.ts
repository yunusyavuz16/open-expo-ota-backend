import { Request, Response } from 'express';
import { db } from '../db/context';
import AppRepository from '../repositories/AppRepository';
import ManifestRepository from '../repositories/ManifestRepository';

/**
 * Get the latest manifest for an app by app key
 */
export const getLatestManifest = async (req: Request, res: Response) => {
  try {
    const { appKey } = req.params;

    // Find the app by its key
    const app = await AppRepository.findByAppKey(appKey);
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Get the latest update for the app (default channel)
    const { data: updates, error } = await db.getClient()
      .from('updates')
      .select('*, manifest:manifests(*)')
      .eq('app_id', app.id)
      .eq('channel', 'production')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error getting latest update:', error);
      return res.status(500).json({ error: 'Failed to get manifest' });
    }

    if (!updates || updates.length === 0 || !updates[0].manifest) {
      return res.status(404).json({ error: 'No manifest found for this app' });
    }

    // Return the manifest content
    return res.json(updates[0].manifest.content);
  } catch (error) {
    console.error('Error in getLatestManifest:', error);
    return res.status(500).json({ error: 'Failed to get manifest' });
  }
};

/**
 * Get the latest manifest for an app by channel
 */
export const getChannelManifest = async (req: Request, res: Response) => {
  try {
    const { appKey, channel } = req.params;

    // Validate channel
    const validChannels = ['production', 'staging', 'development'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({ error: 'Invalid channel' });
    }

    // Find the app by its key
    const app = await AppRepository.findByAppKey(appKey);
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Get the latest update for the app by channel
    const { data: updates, error } = await db.getClient()
      .from('updates')
      .select('*, manifest:manifests(*)')
      .eq('app_id', app.id)
      .eq('channel', channel)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error getting latest update by channel:', error);
      return res.status(500).json({ error: 'Failed to get manifest' });
    }

    if (!updates || updates.length === 0 || !updates[0].manifest) {
      return res.status(404).json({ error: `No manifest found for this app on ${channel} channel` });
    }

    // Return the manifest content
    return res.json(updates[0].manifest.content);
  } catch (error) {
    console.error('Error in getChannelManifest:', error);
    return res.status(500).json({ error: 'Failed to get manifest' });
  }
};

/**
 * Get manifest by ID
 */
export const getManifestById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const manifest = await ManifestRepository.findById(parseInt(id, 10));
    if (!manifest) {
      return res.status(404).json({ error: 'Manifest not found' });
    }

    // Return the manifest content
    return res.json(manifest.content);
  } catch (error) {
    console.error('Error in getManifestById:', error);
    return res.status(500).json({ error: 'Failed to get manifest' });
  }
};