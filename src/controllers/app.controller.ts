import { Request, Response } from 'express';
import AppRepository from '../repositories/AppRepository';
import UserRepository from '../repositories/UserRepository';
import { UserRole } from '../types';

export const createApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, slug, description, githubRepoUrl } = req.body;

    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/i.test(slug)) {
      res.status(400).json({ message: 'Invalid slug format. Use only letters, numbers, and hyphens.' });
      return;
    }

    // Check if slug is already taken
    const existingApp = await AppRepository.findBySlug(slug);
    if (existingApp) {
      res.status(409).json({ message: 'An app with this slug already exists.' });
      return;
    }

    // Create app
    const app = await AppRepository.create({
      name,
      slug,
      description,
      ownerId: req.user.id,
      githubRepoUrl,
    });

    // Add owner as admin to the app
    await AppRepository.addUser(app.id, req.user.id, UserRole.ADMIN);

    res.status(201).json(app);
  } catch (error) {
    console.error('Error creating app:', error);
    res.status(500).json({ message: 'Error creating app' });
  }
};

export const getApps = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    // If user is admin, return all apps
    let apps;
    if (req.user.role === UserRole.ADMIN) {
      apps = await AppRepository.findAll();
    } else {
      // Otherwise, return only apps user has access to
      apps = await AppRepository.findByUserId(req.user.id);
    }

    res.json(apps);
  } catch (error) {
    console.error('Error fetching apps:', error);
    res.status(500).json({ message: 'Error fetching apps' });
  }
};

export const getApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.id, 10);

    const app = await AppRepository.findById(appId);

    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    res.json(app);
  } catch (error) {
    console.error('Error fetching app:', error);
    res.status(500).json({ message: 'Error fetching app' });
  }
};

export const updateApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.id, 10);
    const { name, description, githubRepoUrl } = req.body;

    const app = await AppRepository.findById(appId);

    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Update app
    const updatedApp = await AppRepository.update(appId, {
      name,
      description,
      githubRepoUrl,
    });

    res.json(updatedApp);
  } catch (error) {
    console.error('Error updating app:', error);
    res.status(500).json({ message: 'Error updating app' });
  }
};

export const deleteApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.id, 10);

    const app = await AppRepository.findById(appId);

    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Delete app
    await AppRepository.delete(appId);

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting app:', error);
    res.status(500).json({ message: 'Error deleting app' });
  }
};

export const inviteUserToApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.id, 10);
    const { username, role = UserRole.DEVELOPER } = req.body;

    // Validate inputs
    if (!username) {
      res.status(400).json({ message: 'GitHub username is required' });
      return;
    }

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      res.status(400).json({
        message: 'Invalid role',
        validRoles: Object.values(UserRole)
      });
      return;
    }

    // Check if app exists
    const app = await AppRepository.findById(appId);
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Find user by GitHub username
    const user = await UserRepository.findByGithubId(parseInt(username, 10));
    if (!user) {
      res.status(404).json({
        message: 'User not found',
        details: 'The user must have logged in at least once to be invited'
      });
      return;
    }

    // Add user to app
    await AppRepository.addUser(appId, user.id, role);

    res.status(201).json({
      message: 'User invited successfully',
      appId,
      userId: user.id,
      role
    });
  } catch (error) {
    console.error('Error inviting user to app:', error);
    res.status(500).json({ message: 'Error inviting user to app' });
  }
};

export const addUserToApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.id, 10);
    const { userId, role } = req.body;

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      res.status(400).json({ message: 'Invalid role' });
      return;
    }

    // Check if app exists
    const app = await AppRepository.findById(appId);
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Check if user exists
    const user = await UserRepository.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Add user to app
    await AppRepository.addUser(appId, userId, role);

    res.status(201).json({
      message: 'User added successfully',
      appId,
      userId,
      role
    });
  } catch (error) {
    console.error('Error adding user to app:', error);
    res.status(500).json({ message: 'Error adding user to app' });
  }
};

export const removeUserFromApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);

    // Check if app exists
    const app = await AppRepository.findById(appId);
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Remove user from app
    await AppRepository.removeUser(appId, userId);

    res.status(204).end();
  } catch (error) {
    console.error('Error removing user from app:', error);
    res.status(500).json({ message: 'Error removing user from app' });
  }
};

export const getPublicAppInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug;

    // Check if app exists
    const app = await AppRepository.findBySlug(slug);
    if (!app) {
      res.status(404).json({ message: 'App not found' });
      return;
    }

    // Return minimal public information
    res.json({
      id: app.id,
      name: app.name,
      slug: app.slug,
      description: app.description
    });
  } catch (error) {
    console.error('Error fetching public app info:', error);
    res.status(500).json({ message: 'Error fetching public app info' });
  }
};