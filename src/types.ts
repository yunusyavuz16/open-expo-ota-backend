// Define enums
export enum UserRole {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
}

export enum ReleaseChannel {
  PRODUCTION = 'production',
  STAGING = 'staging',
  DEVELOPMENT = 'development',
}

export enum Platform {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
}

// Define the structure of the User object
export interface User {
  id: number;
  githubId: number;
  username: string;
  email: string;
  role: UserRole;
  accessToken: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define additional interfaces as needed for type safety
export interface AppUser {
  userId: number;
  role: UserRole;
}

// Extend Express namespace to include user in Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}