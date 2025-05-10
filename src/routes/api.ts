import { Router } from 'express';
import multer from 'multer';
import { authenticateJWT, requireAdmin, requireAppAccess } from '../middleware/auth';
import * as appController from '../controllers/app.controller';
import * as updateController from '../controllers/update.controller';

const router = Router();
const upload = multer({ dest: 'temp/' });

// Public routes (no authentication required)
router.get('/manifest/:appSlug', updateController.getManifest);
router.get('/bundle/:appSlug/:bundleId', updateController.getBundleFile);
router.get('/assets/:appSlug/:assetId', updateController.getAssetFile);
router.get('/apps/:slug/public', appController.getPublicAppInfo);

// Authentication middleware for all API routes
router.use(authenticateJWT);

// App routes
router.get('/apps', appController.getApps);
router.post('/apps', appController.createApp);
router.get('/apps/:id', requireAppAccess, appController.getApp);
router.put('/apps/:id', requireAppAccess, appController.updateApp);
router.delete('/apps/:id', requireAppAccess, appController.deleteApp);

// App users routes
router.post('/apps/:id/users', requireAppAccess, appController.addUserToApp);
router.delete('/apps/:id/users/:userId', requireAppAccess, appController.removeUserFromApp);
router.post('/apps/:id/invite', requireAppAccess, appController.inviteUserToApp);

// Update routes
router.get('/apps/:appId/updates', requireAppAccess, updateController.getUpdates);
router.post(
  '/apps/:appId/updates',
  requireAppAccess,
  upload.fields([
    { name: 'bundle', maxCount: 1 },
    { name: 'assets', maxCount: 10 },
  ]),
  updateController.createUpdate
);
router.get('/apps/:appId/updates/:id', requireAppAccess, updateController.getUpdate);
router.post('/apps/:appId/updates/:id/rollback', requireAppAccess, updateController.rollbackUpdate);
router.post('/apps/:appId/updates/:id/promote', requireAppAccess, updateController.promoteUpdate);

export default router;