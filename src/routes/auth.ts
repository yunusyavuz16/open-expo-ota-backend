import { Router, Request, Response } from 'express';
import passport from 'passport';
import * as authController from '../controllers/auth.controller';

const router = Router();

// GitHub OAuth login route
router.get('/github', (req: Request, res: Response, next) => {
  // Store the redirect URL in the session or state parameter if provided
  const redirectUrl = req.query.redirect as string;
  const state = redirectUrl ? Buffer.from(redirectUrl).toString('base64') : '';

  passport.authenticate('github', {
    session: false,
    state: state
  })(req, res, next);
});

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

export default router;