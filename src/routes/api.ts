import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateJWT, requireAdmin, requireAppAccess } from '../middleware/auth';
import * as appController from '../controllers/app.controller';
import * as updateController from '../controllers/update.controller';

const router = Router();

// Configure multer with more options
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../temp'));
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// Multer configuration with detailed options
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Increase to 100MB limit
  // Accept any field name for maximum compatibility
  fileFilter: function (req, file, cb) {
    // Accept all files regardless of format
    console.log('Incoming file:', file.fieldname, file.originalname, file.mimetype);
    cb(null, true);
  }
});

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
console.log('Registering POST route for updates at /apps/:appId/updates');
router.post(
  '/apps/:appId/updates',
  requireAppAccess,
  (req, res, next) => {
    // Log the request for debugging
    console.log('Update upload request details:', {
      appId: req.params.appId,
      contentType: req.headers['content-type']
    });
    next();
  },
  // Use multer.any() to accept any fields without restrictions
  upload.any(),
  updateController.createUpdate
);
router.get('/apps/:appId/updates/:id', requireAppAccess, updateController.getUpdate);
router.post('/apps/:appId/updates/:id/rollback', requireAppAccess, updateController.rollbackUpdate);
router.post('/apps/:appId/updates/:id/promote', requireAppAccess, updateController.promoteUpdate);

export default router;