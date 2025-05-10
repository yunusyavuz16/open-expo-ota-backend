export enum UserRole {
  ADMIN = 'admin',
  DEVELOPER = 'developer'
}

export enum ReleaseChannel {
  PRODUCTION = 'production',
  STAGING = 'staging',
  DEVELOPMENT = 'development'
}

export enum Platform {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web'
}

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

export interface App {
  id: number;
  name: string;
  slug: string;
  description: string;
  ownerId: number;
  githubRepoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppUser {
  id: number;
  appId: number;
  userId: number;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Update {
  id: number;
  appId: number;
  version: string;
  channel: ReleaseChannel;
  runtimeVersion: string;
  isRollback: boolean;
  bundleId: number;
  manifestId: number;
  publishedBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bundle {
  id: number;
  appId: number;
  hash: string;
  storageType: string;
  storagePath: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Manifest {
  id: number;
  appId: number;
  updateId: number;
  version: string;
  channel: ReleaseChannel;
  runtimeVersion: string;
  platforms: Platform[];
  content: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Asset {
  id: number;
  updateId: number;
  name: string;
  hash: string;
  storageType: string;
  storagePath: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}