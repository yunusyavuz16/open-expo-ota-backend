import { Model, DataTypes, Sequelize } from 'sequelize';

interface AssetAttributes {
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

interface AssetCreationAttributes {
  updateId: number;
  name: string;
  hash: string;
  storageType: string;
  storagePath: string;
  size: number;
}

class Asset extends Model<AssetAttributes, AssetCreationAttributes> implements AssetAttributes {
  public id!: number;
  public updateId!: number;
  public name!: string;
  public hash!: string;
  public storageType!: string;
  public storagePath!: string;
  public size!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public static associate(models: any): void {
    Asset.belongsTo(models.Update, {
      foreignKey: 'updateId',
      as: 'update'
    });
  }

  // Static initialization method
  public static initialize(sequelize: Sequelize): void {
    Asset.init({
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      updateId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'update_id',
        references: {
          model: 'updates',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      storageType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'storage_type'
      },
      storagePath: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'storage_path'
      },
      size: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at'
      }
    }, {
      sequelize,
      tableName: 'assets',
      timestamps: true,
      underscored: true
    });
  }
}

export default Asset;