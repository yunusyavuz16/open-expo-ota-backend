import { Router, Request, Response } from 'express';
import passport from 'passport';
import User from '../models/User';
import { generateToken } from '../middleware/auth';

const router = Router();

// GitHub OAuth login route
router.get('/github', passport.authenticate('github', { session: false }));

// GitHub OAuth callback route
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login-failed' }),
  (req: Request, res: Response) => {
    try {
      // Get user from request
      const user = req.user as User;

      // Generate JWT token
      const token = generateToken(user.id);

      // Send token to client-side (You might want to redirect with the token or show it)
      res.redirect(`/auth/success?token=${token}`);
    } catch (error) {
      console.error('Authentication callback error:', error);
      res.redirect('/login-failed');
    }
  }
);

// Success page - in a real app, this would redirect to your frontend with the token
router.get('/success', (req: Request, res: Response) => {
  res.send(`
    <h1>Authentication Successful</h1>
    <p>Your token: ${req.query.token}</p>
    <p>You can now use this token to authenticate API requests.</p>
  `);
});

// Failed login page
router.get('/login-failed', (req: Request, res: Response) => {
  res.status(401).send('Authentication failed');
});

// Verify token and return user info
router.get('/me', passport.authenticate('jwt', { session: false }), (req: Request, res: Response) => {
  try {
    const user = req.user as User;

    // Don't return sensitive information
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving user information' });
  }
});

export default router;