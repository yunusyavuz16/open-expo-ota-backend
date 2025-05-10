import supabase from '../config/supabase';

export interface AssetInput {
  updateId: number;
  name: string;
  hash: string;
  storageType: string;
  storagePath: string;
  size: number;
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

// Define database row type
interface AssetRow {
  id: number;
  update_id: number;
  name: string;
  hash: string;
  storage_type: string;
  storage_path: string;
  size: number;
  created_at: string;
  updated_at: string;
}

export class AssetRepository {
  /**
   * Find an asset by ID
   */
  async findById(id: number): Promise<Asset | null> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToAsset(data);
  }

  /**
   * Find an asset by hash
   */
  async findByHash(hash: string): Promise<Asset | null> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('hash', hash)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToAsset(data);
  }

  /**
   * Find assets by update ID
   */
  async findByUpdateId(updateId: number): Promise<Asset[]> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('update_id', updateId);

    if (error || !data) {
      return [];
    }

    return data.map((asset: AssetRow) => this.mapToAsset(asset));
  }

  /**
   * Create a new asset
   */
  async create(asset: AssetInput): Promise<Asset> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('assets')
      .insert({
        update_id: asset.updateId,
        name: asset.name,
        hash: asset.hash,
        storage_type: asset.storageType,
        storage_path: asset.storagePath,
        size: asset.size,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error creating asset: ${error?.message}`);
    }

    return this.mapToAsset(data);
  }

  /**
   * Update an asset's update ID
   */
  async updateUpdateId(id: number, updateId: number): Promise<Asset> {
    const { data, error } = await supabase
      .from('assets')
      .update({
        update_id: updateId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error updating asset: ${error?.message}`);
    }

    return this.mapToAsset(data);
  }

  /**
   * Delete an asset
   */
  async delete(id: number): Promise<void> {
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting asset: ${error.message}`);
    }
  }

  /**
   * Map a Supabase asset record to an Asset object
   */
  private mapToAsset(data: AssetRow): Asset {
    return {
      id: data.id,
      updateId: data.update_id,
      name: data.name,
      hash: data.hash,
      storageType: data.storage_type,
      storagePath: data.storage_path,
      size: data.size,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

export default new AssetRepository();