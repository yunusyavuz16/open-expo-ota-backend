import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';

dotenv.config();

// Make fs functions return promises
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';
const LOCAL_STORAGE_PATH = process.env.STORAGE_PATH || './uploads';

// For S3 storage
let s3Client: S3Client | null = null;
const S3_BUCKET = process.env.S3_BUCKET || '';

if (STORAGE_TYPE === 's3') {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.S3_ENDPOINT || '',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
  });
}

// Ensure the upload directory exists for local storage
if (STORAGE_TYPE === 'local') {
  // Create directory if it doesn't exist
  try {
    if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
      fs.mkdirSync(LOCAL_STORAGE_PATH, { recursive: true });
    }
  } catch (err) {
    console.error('Error creating storage directory:', err);
  }
}

interface StorageObject {
  key: string;
  size: number;
  contentType: string;
  data: Buffer;
}

export const generateStorageKey = (appId: number, type: string, filename: string): string => {
  const hash = crypto.createHash('sha256')
    .update(`${appId}-${type}-${filename}-${Date.now()}`)
    .digest('hex');

  return `${appId}/${type}/${hash}/${path.basename(filename)}`;
};

export const storeFile = async (
  buffer: Buffer,
  key: string,
  contentType = 'application/octet-stream'
): Promise<{ storagePath: string; storageType: string; size: number }> => {
  if (STORAGE_TYPE === 's3') {
    if (!s3Client) {
      throw new Error('S3 client not initialized');
    }

    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    return {
      storagePath: key,
      storageType: 's3',
      size: buffer.length,
    };
  } else {
    // Local storage
    const filePath = path.join(LOCAL_STORAGE_PATH, key);

    // Create directory structure if it doesn't exist
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });

    // Write the file
    await writeFile(filePath, buffer);

    return {
      storagePath: key,
      storageType: 'local',
      size: buffer.length,
    };
  }
};

export const getFile = async (storagePath: string, storageType: string): Promise<Buffer> => {
  if (storageType === 's3') {
    if (!s3Client) {
      throw new Error('S3 client not initialized');
    }

    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: storagePath,
    }));

    // Convert readable stream to buffer
    if (response.Body instanceof Readable) {
      return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        response.Body.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.Body.on('end', () => resolve(Buffer.concat(chunks)));
        response.Body.on('error', reject);
      });
    } else {
      throw new Error('Invalid response body from S3');
    }
  } else {
    // Local storage
    const filePath = path.join(LOCAL_STORAGE_PATH, storagePath);
    return await readFile(filePath);
  }
};

export const getFileUrl = (storagePath: string, storageType: string): string => {
  if (storageType === 's3') {
    // Return pre-signed URL or direct URL depending on your S3 configuration
    return `${process.env.S3_ENDPOINT}/${S3_BUCKET}/${storagePath}`;
  } else {
    // Local URL
    return `/api/assets/${storagePath}`;
  }
};