import express from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateJWT, requireAppAccess } from '../middleware/auth';
import * as UpdateController from '../controllers/update.controller';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../temp'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Create a new update - updated to handle FormData correctly
router.post(
  '/:appId',
  authenticateJWT,
  requireAppAccess,
  (req, res, next) => {
    // Log the request for debugging
    console.log('Update upload request received:', {
      appId: req.params.appId,
      contentType: req.headers['content-type'],
      keys: Object.keys(req.body || {})
    });
    next();
  },
  upload.fields([
    { name: 'bundle', maxCount: 1 },
    { name: 'assets', maxCount: 20 } // Increased max count for assets
  ]),
  UpdateController.createUpdate
);

// Get updates for an app
router.get('/app/:appId', authenticateJWT, requireAppAccess, UpdateController.getUpdates);

// Get update by ID
router.get('/:id', authenticateJWT, requireAppAccess, UpdateController.getUpdate);

// TODO: Add delete update endpoint when controller method is implemented
// router.delete('/:id', authenticateJWT, requireAppAccess, UpdateController.removeUpdate);

// TODO: Add get latest update endpoints when controller methods are implemented
// router.get('/latest/:appId', authenticateJWT, UpdateController.getLatestUpdate);
// router.get('/latest/:appId/:channel', authenticateJWT, UpdateController.getLatestUpdateByChannel);

export default router;