import { Router, Request, Response } from 'express';
import passport from 'passport';
import User from '../models/User';
import { generateToken } from '../middleware/auth';

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
  passport.authenticate('github', { session: false, failureRedirect: '/login-failed' }),
  (req: Request, res: Response) => {
    try {
      // Get user from request
      const user = req.user as User;

      // Generate JWT token
      const token = generateToken(user.id);

      // Check if there's a redirect URL in the state parameter
      const state = req.query.state as string;
      if (state) {
        try {
          const redirectUrl = Buffer.from(state, 'base64').toString();
          // Make sure the redirect URL includes a protocol to prevent open redirect vulnerabilities
          if (redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://')) {
            // Add token as query parameter to the redirect URL
            const separator = redirectUrl.includes('?') ? '&' : '?';
            return res.redirect(`${redirectUrl}${separator}token=${token}`);
          }
        } catch (e) {
          console.error('Error decoding redirect URL:', e);
        }
      }

      // If no valid redirect URL, fall back to the success page
      res.redirect(`/api/auth/success?token=${token}`);
    } catch (error) {
      console.error('Authentication callback error:', error);
      res.redirect('/api/auth/login-failed');
    }
  }
);

// Success page - in a real app, this would redirect to your frontend with the token
router.get('/success', (req: Request, res: Response) => {
  res.send(`
    <html>
    <head>
      <title>Authentication Successful</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c7be5; }
        .token { background: #f1f1f1; padding: 10px; border-radius: 4px; word-break: break-all; }
        .note { font-size: 14px; color: #666; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Authentication Successful</h1>
      <p>Your token has been generated successfully.</p>
      <div class="token">${req.query.token}</div>
      <p class="note">You can now close this window and return to the CLI.</p>
      <script>
        // This will help in case the CLI is waiting for the token
        if (window.opener) {
          window.opener.postMessage({ token: "${req.query.token}" }, "*");
        }
      </script>
    </body>
    </html>
  `);
});

// Failed login page
router.get('/login-failed', (req: Request, res: Response) => {
  res.status(401).send(`
    <html>
    <head>
      <title>Authentication Failed</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #e53e3e; }
      </style>
    </head>
    <body>
      <h1>Authentication Failed</h1>
      <p>We couldn't authenticate you with GitHub. Please try again.</p>
      <button onclick="window.close()">Close Window</button>
    </body>
    </html>
  `);
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