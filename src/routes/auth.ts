import { Router, Request, Response } from 'express';
import passport from 'passport';
import * as authController from '../controllers/auth.controller';
import express from 'express';
import { generateToken } from '../controllers/auth.controller';

const router = express.Router();

// GitHub OAuth login route
router.get('/github', passport.authenticate('github', { scope: ['read:user', 'read:org'] }));

// GitHub OAuth callback route
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/api/auth/login-failed' }),
  authController.githubCallback
);

// Success page after authentication
router.get('/success', authController.showSuccessPage);

// Failed login page
router.get('/login-failed', authController.showFailurePage);

// Verify token and return user info
router.get('/me', passport.authenticate('jwt', { session: false }), authController.getCurrentUser);

// Test login endpoint for development only
if (process.env.NODE_ENV !== 'production') {
  router.get('/test-login', (req, res) => {
    console.log('Using test login endpoint');

    // Create a test user ID
    const userId = 1;

    // Create a test token
    const token = generateToken(userId);

    res.json({
      token,
      user: {
        id: 1,
        username: 'test-user',
        email: 'test@example.com',
        role: 'admin'
      }
    });
  });
}

export default router;