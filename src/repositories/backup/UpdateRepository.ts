import supabase from '../config/supabase';
import { ReleaseChannel, Platform } from '../types';

export interface UpdateInput {
  appId: number;
  version: string;
  channel: ReleaseChannel;
  runtimeVersion: string;
  isRollback?: boolean;
  bundleId: number;
  manifestId: number;
  publishedBy: number;
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

export interface UpdateWithDetails extends Update {
  manifest?: {
    id: number;
    version: string;
    channel: ReleaseChannel;
    runtimeVersion: string;
    platforms: Platform[];
    content: Record<string, any>;
  };
  bundle?: {
    id: number;
    hash: string;
    storageType: string;
    storagePath: string;
    size: number;
  };
  assets?: Array<{
    id: number;
    name: string;
    hash: string;
    storageType: string;
    storagePath: string;
    size: number;
  }>;
}

// Define database row types
interface UpdateRow {
  id: number;
  app_id: number;
  version: string;
  channel: ReleaseChannel;
  runtime_version: string;
  is_rollback: boolean;
  bundle_id: number;
  manifest_id: number;
  published_by: number;
  created_at: string;
  updated_at: string;
}

interface AssetRow {
  id: number;
  name: string;
  hash: string;
  storage_type: string;
  storage_path: string;
  size: number;
}

export class UpdateRepository {
  /**
   * Find an update by ID
   */
  async findById(id: number, appId: number): Promise<Update | null> {
    const { data, error } = await supabase
      .from('updates')
      .select('*')
      .eq('id', id)
      .eq('app_id', appId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToUpdate(data);
  }

  /**
   * Find update with all related details
   */
  async findByIdWithDetails(id: number, appId: number): Promise<UpdateWithDetails | null> {
    // Get the update
    const update = await this.findById(id, appId);
    if (!update) {
      return null;
    }

    // Get manifest
    const { data: manifestData } = await supabase
      .from('manifests')
      .select('*')
      .eq('id', update.manifestId)
      .single();

    // Get bundle
    const { data: bundleData } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', update.bundleId)
      .single();

    // Get assets
    const { data: assetsData } = await supabase
      .from('assets')
      .select('*')
      .eq('update_id', update.id);

    const result: UpdateWithDetails = {
      ...update
    };

    if (manifestData) {
      result.manifest = {
        id: manifestData.id,
        version: manifestData.version,
        channel: manifestData.channel,
        runtimeVersion: manifestData.runtime_version,
        platforms: manifestData.platforms,
        content: manifestData.content
      };
    }

    if (bundleData) {
      result.bundle = {
        id: bundleData.id,
        hash: bundleData.hash,
        storageType: bundleData.storage_type,
        storagePath: bundleData.storage_path,
        size: bundleData.size
      };
    }

    if (assetsData && assetsData.length > 0) {
      result.assets = assetsData.map((asset: AssetRow) => ({
        id: asset.id,
        name: asset.name,
        hash: asset.hash,
        storageType: asset.storage_type,
        storagePath: asset.storage_path,
        size: asset.size
      }));
    }

    return result;
  }

  /**
   * Get updates for an app
   */
  async findByAppId(appId: number, channel?: ReleaseChannel): Promise<Update[]> {
    let query = supabase
      .from('updates')
      .select('*')
      .eq('app_id', appId)
      .order('created_at', { ascending: false });

    if (channel) {
      query = query.eq('channel', channel);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map((update: UpdateRow) => this.mapToUpdate(update));
  }

  /**
   * Get latest update for an app by channel and runtime version
   */
  async findLatestByChannelAndRuntime(
    appId: number,
    channel: ReleaseChannel,
    runtimeVersion: string
  ): Promise<UpdateWithDetails | null> {
    const { data, error } = await supabase
      .from('updates')
      .select('*')
      .eq('app_id', appId)
      .eq('channel', channel)
      .eq('runtime_version', runtimeVersion)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return this.findByIdWithDetails(data.id, appId);
  }

  /**
   * Create a new update
   */
  async create(update: UpdateInput): Promise<Update> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('updates')
      .insert({
        app_id: update.appId,
        version: update.version,
        channel: update.channel,
        runtime_version: update.runtimeVersion,
        is_rollback: update.isRollback || false,
        bundle_id: update.bundleId,
        manifest_id: update.manifestId,
        published_by: update.publishedBy,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error creating update: ${error?.message}`);
    }

    return this.mapToUpdate(data);
  }

  /**
   * Map a Supabase update record to an Update object
   */
  private mapToUpdate(data: UpdateRow): Update {
    return {
      id: data.id,
      appId: data.app_id,
      version: data.version,
      channel: data.channel,
      runtimeVersion: data.runtime_version,
      isRollback: data.is_rollback,
      bundleId: data.bundle_id,
      manifestId: data.manifest_id,
      publishedBy: data.published_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

export default new UpdateRepository();