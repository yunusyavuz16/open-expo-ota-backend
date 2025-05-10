import supabase from '../config/supabase';
import { ReleaseChannel, Platform } from '../types';

export interface ManifestInput {
  appId: number;
  updateId: number;
  version: string;
  channel: ReleaseChannel;
  runtimeVersion: string;
  platforms: Platform[];
  content: Record<string, any>;
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

// Define the shape of the database row
interface ManifestRow {
  id: number;
  app_id: number;
  update_id: number;
  version: string;
  channel: ReleaseChannel;
  runtime_version: string;
  platforms: Platform[];
  content: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export class ManifestRepository {
  /**
   * Find a manifest by ID
   */
  async findById(id: number): Promise<Manifest | null> {
    const { data, error } = await supabase
      .from('manifests')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToManifest(data);
  }

  /**
   * Find manifests by app ID
   */
  async findByAppId(appId: number): Promise<Manifest[]> {
    const { data, error } = await supabase
      .from('manifests')
      .select('*')
      .eq('app_id', appId);

    if (error || !data) {
      return [];
    }

    return data.map((manifest: ManifestRow) => this.mapToManifest(manifest));
  }

  /**
   * Find manifest by update ID
   */
  async findByUpdateId(updateId: number): Promise<Manifest | null> {
    const { data, error } = await supabase
      .from('manifests')
      .select('*')
      .eq('update_id', updateId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToManifest(data);
  }

  /**
   * Create a new manifest
   */
  async create(manifest: ManifestInput): Promise<Manifest> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('manifests')
      .insert({
        app_id: manifest.appId,
        update_id: manifest.updateId,
        version: manifest.version,
        channel: manifest.channel,
        runtime_version: manifest.runtimeVersion,
        platforms: manifest.platforms,
        content: manifest.content,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error creating manifest: ${error?.message}`);
    }

    return this.mapToManifest(data);
  }

  /**
   * Update a manifest
   */
  async update(id: number, updateId: number): Promise<Manifest> {
    const { data, error } = await supabase
      .from('manifests')
      .update({
        update_id: updateId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error updating manifest: ${error?.message}`);
    }

    return this.mapToManifest(data);
  }

  /**
   * Map a Supabase manifest record to a Manifest object
   */
  private mapToManifest(data: ManifestRow): Manifest {
    return {
      id: data.id,
      appId: data.app_id,
      updateId: data.update_id,
      version: data.version,
      channel: data.channel,
      runtimeVersion: data.runtime_version,
      platforms: data.platforms,
      content: data.content,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

export default new ManifestRepository();