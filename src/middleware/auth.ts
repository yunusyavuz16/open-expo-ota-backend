import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, User } from '../types';
import UserRepository from '../repositories/UserRepository';
import AppRepository from '../repositories/AppRepository';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// JWT token generation function
export const generateToken = (userId: number): string => {
  const secretKey = process.env.JWT_SECRET || 'default_jwt_secret';
  const expiresIn = process.env.JWT_EXPIRATION || '24h';

  // Use correct typing for JWT sign
  return jwt.sign({ id: userId }, secretKey, { expiresIn });
};

export const authenticateJWT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secretKey = process.env.JWT_SECRET || 'default_jwt_secret';

    const decoded = jwt.verify(token, secretKey) as { id: number };
    const user = await UserRepository.findById(decoded.id);

    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  if (req.user.role !== UserRole.ADMIN) {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }

  next();
};

export const requireAppAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const appId = parseInt(req.params.appId || req.params.id, 10);

    // Check if user is admin (admins have access to all apps)
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    // Check if user is the owner of the app
    const app = await AppRepository.findById(appId);
    if (app && app.ownerId === req.user.id) {
      next();
      return;
    }

    // Check if user has access to the app
    const appUsers = await AppRepository.getUsers(appId);
    const hasAccess = appUsers.some(au => au.userId === req.user.id);

    if (!hasAccess) {
      res.status(403).json({ message: 'You do not have access to this app' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error while checking app access' });
  }
};