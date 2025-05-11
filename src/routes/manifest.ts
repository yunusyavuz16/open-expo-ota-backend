import express from 'express';
import * as ManifestController from '../controllers/manifest.controller';

const router = express.Router();

// Get the latest manifest for an app
router.get('/:appKey', ManifestController.getLatestManifest);

// Get the latest manifest for an app by channel
router.get('/:appKey/:channel', ManifestController.getChannelManifest);

// Get manifest by ID (requires authentication)
router.get('/id/:id', ManifestController.getManifestById);

export default router;