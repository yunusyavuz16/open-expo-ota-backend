import express from 'express';
import { authenticateJWT, requireAdmin, requireAppAccess } from '../middleware/auth';
import * as AppController from '../controllers/app.controller';

const router = express.Router();

// Get all apps (admin sees all, others see only their apps)
router.get('/', authenticateJWT, AppController.getApps);

// Create a new app
router.post('/', authenticateJWT, AppController.createApp);

// Get app by ID
router.get('/:id', authenticateJWT, requireAppAccess, AppController.getApp);

// Update app
router.put('/:id', authenticateJWT, requireAppAccess, AppController.updateApp);

// Delete app
router.delete('/:id', authenticateJWT, requireAppAccess, AppController.deleteApp);

// Add user to app
router.post('/:id/users', authenticateJWT, requireAppAccess, AppController.addUserToApp);

// Remove user from app
router.delete('/:id/users/:userId', authenticateJWT, requireAppAccess, AppController.removeUserFromApp);

// Get app users
// router.get('/:id/users', authenticateJWT, requireAppAccess, AppController.getAppUsers);

export default router;