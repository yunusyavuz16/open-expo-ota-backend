import supabase from '../config/supabase';

export interface BundleInput {
  appId: number;
  hash: string;
  storageType: string;
  storagePath: string;
  size: number;
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

export class BundleRepository {
  /**
   * Find a bundle by ID
   */
  async findById(id: number): Promise<Bundle | null> {
    const { data, error } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToBundle(data);
  }

  /**
   * Find a bundle by hash
   */
  async findByHash(hash: string): Promise<Bundle | null> {
    const { data, error } = await supabase
      .from('bundles')
      .select('*')
      .eq('hash', hash)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToBundle(data);
  }

  /**
   * Create a new bundle
   */
  async create(bundle: BundleInput): Promise<Bundle> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('bundles')
      .insert({
        app_id: bundle.appId,
        hash: bundle.hash,
        storage_type: bundle.storageType,
        storage_path: bundle.storagePath,
        size: bundle.size,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error creating bundle: ${error?.message}`);
    }

    return this.mapToBundle(data);
  }

  /**
   * Delete a bundle
   */
  async delete(id: number): Promise<void> {
    const { error } = await supabase
      .from('bundles')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting bundle: ${error.message}`);
    }
  }

  /**
   * Map a Supabase bundle record to a Bundle object
   */
  private mapToBundle(data: any): Bundle {
    return {
      id: data.id,
      appId: data.app_id,
      hash: data.hash,
      storageType: data.storage_type,
      storagePath: data.storage_path,
      size: data.size,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

export default new BundleRepository();