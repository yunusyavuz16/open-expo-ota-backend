import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { db } from '../db/context';
import { User } from '../models';

// Define a User interface for request.user
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      role: string;
      githubId?: number;
      accessToken?: string;
    }
  }
}

/**
 * Generate a JWT token for a user
 */
export const generateToken = (userId: number): string => {
  const secretKey = process.env.JWT_SECRET || 'default_jwt_secret';
  const expiresIn = process.env.JWT_EXPIRATION || '24h';

  // Bypass TypeScript type checking for jwt.sign
  return jwt.sign({ id: userId }, secretKey, { expiresIn } as any);
};

/**
 * Handle the GitHub OAuth callback
 */
export const githubCallback = (req: Request, res: Response): void => {
  try {
    // Get user from request
    const user = req.user;

    if (!user || !user.id) {
      res.redirect('/api/auth/login-failed');
      return;
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Check for redirect URL - first try the redirect query parameter (from CLI)
    let redirectUrl = req.query.redirect as string;

    // If not found, check the state parameter (traditional OAuth flow)
    if (!redirectUrl) {
      const state = req.query.state as string;
      if (state) {
        try {
          redirectUrl = Buffer.from(state, 'base64').toString();
        } catch (e) {
          console.error('Error decoding redirect URL from state:', e);
        }
      }
    }

    // If we have a valid redirect URL, redirect to it with the token
    if (redirectUrl) {
      try {
        // Make sure the redirect URL includes a protocol to prevent open redirect vulnerabilities
        if (redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://')) {
          // Add token as query parameter to the redirect URL
          const separator = redirectUrl.includes('?') ? '&' : '?';
          console.log(`Redirecting to CLI callback: ${redirectUrl}${separator}token=${token}`);
          return res.redirect(`${redirectUrl}${separator}token=${token}`);
        }
      } catch (e) {
        console.error('Error processing redirect URL:', e);
      }
    }

    // If no valid redirect URL, fall back to the success page
    console.log('No valid redirect URL found, showing success page');
    res.redirect(`/api/auth/success?token=${token}`);
  } catch (error) {
    console.error('Authentication callback error:', error);
    res.redirect('/api/auth/login-failed');
  }
};

/**
 * Get the current user information
 */
export const getCurrentUser = (req: Request, res: Response): void => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Don't return sensitive information
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error('Error retrieving user information:', error);
    res.status(500).json({ message: 'Error retrieving user information' });
  }
};

/**
 * Show success page after authentication
 */
export const showSuccessPage = (req: Request, res: Response): void => {
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
};

/**
 * Show failure page after authentication
 */
export const showFailurePage = (req: Request, res: Response): void => {
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
};